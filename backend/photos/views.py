from django.shortcuts import get_object_or_404, render
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.utils import timezone
from .models import Photo, Tag
from .serializers import (
    PhotoSerializer,
    PhotoCreateSerializer,
    PhotoUpdateSerializer,
    BulkUploadSerializer,
    TagSerializer
)


class PhotoPagination(PageNumberPagination):
    """Custom pagination for photo listing"""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data
        })


class PhotoViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Photo model with CRUD operations and custom actions
    """
    queryset = Photo.objects.all()
    serializer_class = PhotoSerializer
    pagination_class = PhotoPagination
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        """Filter queryset based on query parameters"""
        queryset = Photo.objects.prefetch_related('tags')

        # Filter by visibility
        only_visible = self.request.query_params.get('visible', None)
        if only_visible is not None and only_visible.lower() == 'true':
            queryset = queryset.filter(is_active=True)

        # Filter by tags
        tags = self.request.query_params.get('tags', None)
        if tags:
            tag_list = [tag.strip() for tag in tags.split(',')]
            queryset = queryset.filter(tags__name__in=tag_list).distinct()

        # Search by title or caption
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(caption__icontains=search)
            )

        # Filter by upload date range
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)
        if date_from:
            queryset = queryset.filter(upload_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(upload_date__lte=date_to)

        return queryset

    def get_serializer_class(self):
        """Return appropriate serializer based on action"""
        if self.action == 'create':
            return PhotoCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return PhotoUpdateSerializer
        return PhotoSerializer

    def retrieve(self, request, pk=None):
        """Get single photo with full details"""
        photo = get_object_or_404(Photo, pk=pk)
        serializer = self.get_serializer(photo)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def bulk_upload(self, request):
        """
        Upload multiple photos at once
        POST /api/photos/bulk_upload/
        """
        serializer = BulkUploadSerializer(data=request.data)
        if serializer.is_valid():
            uploaded_photos = []
            errors = []

            photos = serializer.validated_data['photos']
            title_prefix = serializer.validated_data.get('title_prefix', '')
            tags = serializer.validated_data.get('tags', [])
            visibility_start = serializer.validated_data.get('visibility_start')
            visibility_end = serializer.validated_data.get('visibility_end')

            # Create or get tags
            tag_objects = []
            for tag_name in tags:
                tag, created = Tag.objects.get_or_create(
                    name=tag_name,
                    defaults={'color': f"#{hash(tag_name) % 0xFFFFFF:06x}"}
                )
                tag_objects.append(tag)

            for i, photo_file in enumerate(photos):
                try:
                    # Generate title from filename or use prefix
                    title = title_prefix
                    if not title:
                        title = photo_file.name.rsplit('.', 1)[0].replace('_', ' ').replace('-', ' ').title()
                    else:
                        title = f"{title_prefix} {i+1}"

                    photo_data = {
                        'title': title,
                        'image_file': photo_file,
                        'visibility_start': visibility_start,
                        'visibility_end': visibility_end,
                    }

                    photo_serializer = PhotoCreateSerializer(data=photo_data, context={'request': request})
                    if photo_serializer.is_valid():
                        photo = photo_serializer.save()
                        photo.tags.set(tag_objects)

                        # Return serialized photo data
                        response_serializer = PhotoSerializer(photo, context={'request': request})
                        uploaded_photos.append(response_serializer.data)
                    else:
                        errors.append({
                            'file': photo_file.name,
                            'errors': photo_serializer.errors
                        })

                except Exception as e:
                    errors.append({
                        'file': photo_file.name,
                        'errors': str(e)
                    })

            response_data = {
                'uploaded_count': len(uploaded_photos),
                'uploaded_photos': uploaded_photos,
                'errors_count': len(errors),
                'errors': errors
            }

            if errors:
                return Response(response_data, status=status.HTTP_207_MULTI_STATUS)
            else:
                return Response(response_data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'])
    def regenerate_thumbnails(self, request, pk=None):
        """
        Regenerate thumbnails for a specific photo
        PATCH /api/photos/{id}/regenerate_thumbnails/
        """
        photo = get_object_or_404(Photo, pk=pk)
        try:
            photo.generate_thumbnails()
            photo.refresh_from_db()
            serializer = self.get_serializer(photo)
            return Response({
                'message': 'Thumbnails regenerated successfully',
                'photo': serializer.data
            })
        except Exception as e:
            return Response({
                'error': f'Failed to regenerate thumbnails: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Get gallery statistics
        GET /api/photos/stats/
        """
        total_photos = Photo.objects.count()
        active_photos = Photo.objects.filter(is_active=True).count()
        total_tags = Tag.objects.count()

        # Storage info (simplified)
        from django.db.models import Sum
        total_storage = Photo.objects.aggregate(
            total=Sum('image_file_size')
        )['total'] or 0

        return Response({
            'total_photos': total_photos,
            'active_photos': active_photos,
            'hidden_photos': total_photos - active_photos,
            'total_tags': total_tags,
            'total_storage_bytes': total_storage,
            'total_storage_mb': round(total_storage / (1024 * 1024), 2),
        })

    @action(detail=False, methods=['get'])
    def positions(self, request):
        """
        Get 3D positions for all photos (for frontend positioning)
        GET /api/photos/positions/
        """
        photos = Photo.objects.filter(is_active=True).values(
            'id', 'position_x', 'position_y', 'position_z', 'thumbnail'
        )

        positions = []
        request_obj = request
        for photo in photos:
            position_data = {
                'id': photo['id'],
                'position': {
                    'x': photo['position_x'],
                    'y': photo['position_y'],
                    'z': photo['position_z']
                }
            }
            if photo['thumbnail']:
                position_data['thumbnail_url'] = request_obj.build_absolute_uri(photo['thumbnail'])
            positions.append(position_data)

        return Response({
            'positions': positions,
            'count': len(positions)
        })


class TagViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Tag model
    """
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    lookup_field = 'name'

    def get_queryset(self):
        """Filter tags based on query parameters"""
        queryset = Tag.objects.all()

        # Filter by usage count
        min_usage = self.request.query_params.get('min_usage', None)
        if min_usage:
            queryset = queryset.annotate(
                photo_count=models.Count('photos')
            ).filter(photo_count__gte=int(min_usage))

        return queryset

    @action(detail=True, methods=['get'])
    def photos(self, request, name=None):
        """
        Get photos for a specific tag
        GET /api/tags/{tag_name}/photos/
        """
        tag = get_object_or_404(Tag, name=name)
        photos = Photo.objects.filter(tags=tag, is_active=True)

        page = self.paginate_queryset(photos)
        if page is not None:
            serializer = PhotoSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = PhotoSerializer(photos, many=True, context={'request': request})
        return Response(serializer.data)
