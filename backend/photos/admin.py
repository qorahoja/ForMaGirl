from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import Photo, Tag
import json


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['name', 'color_display', 'created_at']
    search_fields = ['name']
    list_filter = ['created_at']
    ordering = ['name']

    def color_display(self, obj):
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; border-radius: 3px;">{}</span>',
            obj.color,
            obj.name
        )
    color_display.short_description = 'Color'


class PhotoTagInline(admin.TabularInline):
    model = Photo.tags.through
    extra = 1
    verbose_name = 'Tag'
    verbose_name_plural = 'Tags'


@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = [
        'thumbnail_display',
        'title',
        'caption_preview',
        'upload_date',
        'is_active',
        'visibility_status',
        'position_display'
    ]
    list_filter = [
        'is_active',
        'upload_date',
        'tags',
        'visibility_start',
        'visibility_end'
    ]
    search_fields = ['title', 'caption', 'tags__name']
    date_hierarchy = 'upload_date'
    ordering = ['-upload_date']
    readonly_fields = [
        'thumbnail_preview',
        'medium_preview',
        'position_info',
        'file_info'
    ]
    inlines = [PhotoTagInline]

    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'caption', 'image_file')
        }),
        ('Visibility', {
            'fields': ('is_active', 'visibility_start', 'visibility_end'),
            'classes': ('collapse',)
        }),
        ('3D Position', {
            'fields': ('position_x', 'position_y', 'position_z', 'position_info'),
            'classes': ('collapse',)
        }),
        ('Previews', {
            'fields': ('thumbnail_preview', 'medium_preview'),
            'classes': ('collapse',)
        }),
        ('File Information', {
            'fields': ('file_info',),
            'classes': ('collapse',)
        }),
    )

    def thumbnail_display(self, obj):
        if obj.thumbnail:
            return format_html(
                '<img src="{}" width="50" height="50" style="object-fit: cover; border-radius: 3px;" />',
                obj.thumbnail.url
            )
        return "No thumbnail"
    thumbnail_display.short_description = 'Thumbnail'

    def caption_preview(self, obj):
        if obj.caption:
            return obj.caption[:100] + "..." if len(obj.caption) > 100 else obj.caption
        return ""
    caption_preview.short_description = 'Caption'

    def visibility_status(self, obj):
        if obj.is_visible:
            return format_html(
                '<span style="color: green;">✓ Visible</span>'
            )
        return format_html(
            '<span style="color: red;">✗ Hidden</span>'
        )
    visibility_status.short_description = 'Status'

    def position_display(self, obj):
        return f"({obj.position_x:.1f}, {obj.position_y:.1f}, {obj.position_z:.1f})"
    position_display.short_description = '3D Position'

    def thumbnail_preview(self, obj):
        if obj.thumbnail:
            return format_html(
                '<img src="{}" width="300" style="max-width: 100%; height: auto;" />',
                obj.thumbnail.url
            )
        return "No thumbnail available"
    thumbnail_preview.short_description = 'Thumbnail Preview'

    def medium_preview(self, obj):
        if obj.medium:
            return format_html(
                '<img src="{}" width="600" style="max-width: 100%; height: auto;" />',
                obj.medium.url
            )
        return "No medium size available"
    medium_preview.short_description = 'Medium Preview'

    def position_info(self, obj):
        info = {
            'x': obj.position_x,
            'y': obj.position_y,
            'z': obj.position_z,
            'distance_from_origin': (obj.position_x**2 + obj.position_y**2 + obj.position_z**2)**0.5
        }
        return format_html(
            '<pre>{}</pre>',
            json.dumps(info, indent=2)
        )
    position_info.short_description = 'Position Info'

    def file_info(self, obj):
        if obj.image_file:
            try:
                size_mb = obj.image_file.size / (1024 * 1024)
                return format_html(
                    '<ul><li>File: {}</li><li>Size: {:.2f} MB</li><li>Dimensions: {}x{}</li></ul>',
                    obj.image_file.name,
                    size_mb,
                    obj.image_file.width if hasattr(obj.image_file, 'width') else 'N/A',
                    obj.image_file.height if hasattr(obj.image_file, 'height') else 'N/A'
                )
            except Exception as e:
                return f"Error reading file info: {e}"
        return "No file uploaded"
    file_info.short_description = 'File Information'

    def get_queryset(self, request):
        return super().get_queryset(request).prefetch_related('tags')

    actions = ['bulk_set_visible', 'bulk_set_hidden', 'randomize_positions']

    def bulk_set_visible(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} photos set to visible.')
    bulk_set_visible.short_description = 'Set selected photos to visible'

    def bulk_set_hidden(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} photos set to hidden.')
    bulk_set_hidden.short_description = 'Set selected photos to hidden'

    def randomize_positions(self, request, queryset):
        import random
        for photo in queryset:
            photo.position_x = random.uniform(-50, 50)
            photo.position_y = random.uniform(-30, 30)
            photo.position_z = random.uniform(-100, 100)
            photo.save()
        self.message_user(request, f'Positions randomized for {queryset.count()} photos.')
    randomize_positions.short_description = 'Randomize 3D positions'

    # Exclude the through model from the inline form
    exclude = ('tags',)
