from rest_framework import serializers
from .models import Photo, Tag
from django.urls import reverse


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'color', 'created_at']
        read_only_fields = ['created_at']


class PhotoSerializer(serializers.ModelSerializer):
    """Serializer for Photo model with full image URLs"""

    # Include tag names as a list for easier frontend consumption
    tags = serializers.SlugRelatedField(
        many=True,
        slug_field='name',
        queryset=Tag.objects.all()
    )

    # Provide URLs for different image sizes
    thumbnail_url = serializers.SerializerMethodField()
    medium_url = serializers.SerializerMethodField()
    large_url = serializers.SerializerMethodField()
    original_url = serializers.SerializerMethodField()

    # Position as nested object for cleaner frontend handling
    position = serializers.SerializerMethodField()

    # API URL for the photo
    url = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        fields = [
            'id',
            'title',
            'caption',
            'thumbnail_url',
            'medium_url',
            'large_url',
            'original_url',
            'upload_date',
            'tags',
            'visibility_start',
            'visibility_end',
            'is_active',
            'position',
            'url',
        ]
        read_only_fields = [
            'upload_date',
            'position_x',
            'position_y',
            'position_z',
        ]

    def get_thumbnail_url(self, obj):
        if obj.thumbnail:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.thumbnail.url)
            return obj.thumbnail.url
        return None

    def get_medium_url(self, obj):
        if obj.medium:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.medium.url)
            return obj.medium.url
        return None

    def get_large_url(self, obj):
        if obj.large:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.large.url)
            return obj.large.url
        return None

    def get_original_url(self, obj):
        if obj.image_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image_file.url)
            return obj.image_file.url
        return None

    def get_position(self, obj):
        return {
            'x': obj.position_x,
            'y': obj.position_y,
            'z': obj.position_z,
        }

    def get_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(reverse('photo-detail', kwargs={'pk': obj.pk}))
        return f"/api/photos/{obj.pk}/"


class PhotoCreateSerializer(serializers.ModelSerializer):
    """Serializer for photo creation with file upload handling"""

    tags = serializers.SlugRelatedField(
        many=True,
        slug_field='name',
        queryset=Tag.objects.all(),
        required=False
    )

    class Meta:
        model = Photo
        fields = [
            'title',
            'caption',
            'image_file',
            'tags',
            'visibility_start',
            'visibility_end',
            'is_active',
            'position_x',
            'position_y',
            'position_z',
        ]

    def validate_image_file(self, value):
        """Validate image file"""
        # Check file size (max 50MB)
        max_size = 50 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError(f"File size cannot exceed 50MB. Current size: {value.size / (1024*1024):.2f}MB")

        # Check file type
        allowed_types = ['image/jpeg', 'image/png', 'image/webp']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError(f"File type {value.content_type} is not allowed. Allowed types: {', '.join(allowed_types)}")

        return value

    def create(self, validated_data):
        """Create photo with automatic position generation if not provided"""
        tags_data = validated_data.pop('tags', [])

        # Generate random position if not provided
        if not validated_data.get('position_x') and not validated_data.get('position_y') and not validated_data.get('position_z'):
            import random
            validated_data['position_x'] = random.uniform(-50, 50)
            validated_data['position_y'] = random.uniform(-30, 30)
            validated_data['position_z'] = random.uniform(-100, 100)

        photo = Photo.objects.create(**validated_data)
        photo.tags.set(tags_data)

        return photo


class PhotoUpdateSerializer(serializers.ModelSerializer):
    """Serializer for photo updates"""

    tags = serializers.SlugRelatedField(
        many=True,
        slug_field='name',
        queryset=Tag.objects.all(),
        required=False
    )

    class Meta:
        model = Photo
        fields = [
            'title',
            'caption',
            'tags',
            'visibility_start',
            'visibility_end',
            'is_active',
            'position_x',
            'position_y',
            'position_z',
        ]

    def update(self, instance, validated_data):
        """Update photo with tag handling"""
        tags_data = validated_data.pop('tags', None)

        # Update photo fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update tags if provided
        if tags_data is not None:
            instance.tags.set(tags_data)

        return instance


class BulkUploadSerializer(serializers.Serializer):
    """Serializer for bulk photo upload"""

    photos = serializers.ListField(
        child=serializers.FileField(),
        allow_empty=False,
        max_length=50,  # Limit to 50 photos at once
        help_text="List of image files to upload"
    )

    # Optional metadata that can be applied to all photos
    title_prefix = serializers.CharField(max_length=200, required=False, allow_blank=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        help_text="Tags to apply to all uploaded photos"
    )
    visibility_start = serializers.DateTimeField(required=False, allow_null=True)
    visibility_end = serializers.DateTimeField(required=False, allow_null=True)

    def validate_photos(self, value):
        """Validate uploaded photos"""
        max_size = 50 * 1024 * 1024  # 50MB
        allowed_types = ['image/jpeg', 'image/png', 'image/webp']

        for photo_file in value:
            if photo_file.size > max_size:
                raise serializers.ValidationError(f"File {photo_file.name} is too large (max 50MB)")

            if photo_file.content_type not in allowed_types:
                raise serializers.ValidationError(f"File {photo_file.name} has unsupported format")

        return value