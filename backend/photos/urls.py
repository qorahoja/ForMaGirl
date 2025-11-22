from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PhotoViewSet, TagViewSet

# Create a router and register our viewsets
router = DefaultRouter()
router.register(r'photos', PhotoViewSet, basename='photo')
router.register(r'tags', TagViewSet, basename='tag')

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', include(router.urls)),
]