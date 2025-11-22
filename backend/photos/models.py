import os
import uuid
from django.db import models
from django.conf import settings
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile


def get_photo_upload_path(instance, filename):
    """Generate upload path for photos with date organization"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join('photos', 'original', filename)


def get_thumbnail_upload_path(instance, filename, size):
    """Generate upload path for thumbnails"""
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}_thumb_{size[0]}x{size[1]}.{ext}"
    return os.path.join('photos', 'thumbnails', filename)


class Tag(models.Model):
    """Model for photo tags"""
    name = models.CharField(max_length=100, unique=True)
    color = models.CharField(max_length=7, default='#FF6B6B', help_text="Hex color code for UI display")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Photo(models.Model):
    """Main photo model for CelestiaGallery"""

    # Basic metadata
    title = models.CharField(max_length=200, blank=True)
    caption = models.TextField(blank=True)

    # File fields
    image_file = models.ImageField(upload_to=get_photo_upload_path)
    thumbnail = models.ImageField(upload_to='photos/thumbnails/', blank=True)
    medium = models.ImageField(upload_to='photos/medium/', blank=True)
    large = models.ImageField(upload_to='photos/large/', blank=True)

    # Dates
    upload_date = models.DateTimeField(auto_now_add=True)
    visibility_start = models.DateTimeField(null=True, blank=True, help_text="When photo becomes visible")
    visibility_end = models.DateTimeField(null=True, blank=True, help_text="When photo stops being visible")

    # Status
    is_active = models.BooleanField(default=True)

    # 3D position for gallery
    position_x = models.FloatField(default=0.0, help_text="X position in 3D space")
    position_y = models.FloatField(default=0.0, help_text="Y position in 3D space")
    position_z = models.FloatField(default=0.0, help_text="Z position in 3D space")

    # Tags (many-to-many relationship)
    tags = models.ManyToManyField(Tag, blank=True, related_name='photos')

    class Meta:
        ordering = ['-upload_date']
        indexes = [
            models.Index(fields=['upload_date']),
            models.Index(fields=['is_active']),
            models.Index(fields=['position_x', 'position_y', 'position_z']),
        ]

    def __str__(self):
        return self.title or f"Photo {self.id}"

    def save(self, *args, **kwargs):
        """Override save to generate thumbnails and positions"""
        is_new = self.pk is None

        # Generate 3D position if not set
        if not self.position_x and not self.position_y and not self.position_z:
            import random
            self.position_x = random.uniform(-50, 50)
            self.position_y = random.uniform(-30, 30)
            self.position_z = random.uniform(-100, 100)

        super().save(*args, **kwargs)

        # Generate thumbnails if this is a new photo or image changed
        if is_new or 'image_file' in kwargs.get('update_fields', []):
            self.generate_thumbnails()

    def generate_thumbnails(self):
        """Generate different sized thumbnails"""
        if not self.image_file:
            return

        try:
            with Image.open(self.image_file.path) as img:
                # Convert to RGB if necessary
                if img.mode != 'RGB':
                    img = img.convert('RGB')

                # Generate thumbnails
                thumbnail_sizes = {
                    'thumbnail': (150, 150),
                    'medium': (800, 600),
                    'large': (1920, 1080)
                }

                for size_name, size in thumbnail_sizes.items():
                    # Create thumbnail
                    img_copy = img.copy()
                    img_copy.thumbnail(size, Image.Resampling.LANCZOS)

                    # Create a new image with the target size and center the thumbnail
                    thumb_img = Image.new('RGB', size, (0, 0, 0))

                    # Calculate position to center the image
                    x = (size[0] - img_copy.width) // 2
                    y = (size[1] - img_copy.height) // 2
                    thumb_img.paste(img_copy, (x, y))

                    # Save to BytesIO
                    thumb_io = BytesIO()
                    thumb_img.save(thumb_io, format='JPEG', quality=85)
                    thumb_io.seek(0)

                    # Generate filename
                    ext = os.path.splitext(self.image_file.name)[1][1:]  # Remove the dot
                    filename = f"{uuid.uuid4()}_{size_name}.{ext}"

                    # Save to appropriate field
                    thumb_file = ContentFile(thumb_io.getvalue(), filename)
                    if size_name == 'thumbnail':
                        self.thumbnail.save(filename, thumb_file, save=False)
                    elif size_name == 'medium':
                        self.medium.save(filename, thumb_file, save=False)
                    elif size_name == 'large':
                        self.large.save(filename, thumb_file, save=False)

                # Save the model with new thumbnails
                super().save(update_fields=['thumbnail', 'medium', 'large'])

        except Exception as e:
            print(f"Error generating thumbnails for photo {self.id}: {e}")

    def get_absolute_url(self):
        return f"/api/photos/{self.id}/"

    @property
    def is_visible(self):
        """Check if photo is currently visible"""
        from django.utils import timezone

        if not self.is_active:
            return False

        now = timezone.now()

        if self.visibility_start and now < self.visibility_start:
            return False

        if self.visibility_end and now > self.visibility_end:
            return False

        return True
