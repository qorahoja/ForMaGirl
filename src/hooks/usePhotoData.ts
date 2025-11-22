import { useState, useEffect, useCallback } from 'react'
import { Photo, PhotoPosition } from '@/stores/galleryStore'
import { useGalleryStore } from '@/stores/galleryStore'

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

// Error types
export interface PhotoApiError {
  message: string
  status?: number
  details?: any
}

// Response types
interface PhotosResponse {
  count: number
  next: string | null
  previous: string | null
  results: Photo[]
}

interface PositionsResponse {
  positions: PhotoPosition[]
  count: number
}

// Cache for photo positions
let photoPositionsCache: PhotoPosition[] | null = null
let positionsCacheTime = 0
const POSITIONS_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Custom hook for photo data management
export function usePhotoData() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<PhotoApiError | null>(null)

  const {
    setPhotos,
    setPhotoPositions,
    setPhotosLoaded,
    setError: setStoreError
  } = useGalleryStore()

  // Fetch all photos with pagination
  const fetchPhotos = useCallback(async (page = 1, tags?: string[], search?: string) => {
    setLoading(true)
    setError(null)
    setStoreError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        visible: 'true',
        page_size: '200', // Increase page size for better performance
      })

      if (tags && tags.length > 0) {
        params.append('tags', tags.join(','))
      }

      if (search) {
        params.append('search', search)
      }

      const response = await fetch(`${API_BASE_URL}/photos/?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: PhotosResponse = await response.json()
      setPhotos(data.results)
      setPhotosLoaded(true)

      return data
    } catch (err) {
      const apiError: PhotoApiError = {
        message: err instanceof Error ? err.message : 'Failed to fetch photos',
        status: err instanceof Error && 'status' in err ? (err as any).status : undefined,
      }
      setError(apiError)
      setStoreError(apiError.message)
      throw apiError
    } finally {
      setLoading(false)
    }
  }, [setPhotos, setPhotosLoaded, setStoreError])

  // Fetch photo positions (cached)
  const fetchPhotoPositions = useCallback(async () => {
    // Check cache first
    const now = Date.now()
    if (photoPositionsCache && (now - positionsCacheTime) < POSITIONS_CACHE_DURATION) {
      setPhotoPositions(photoPositionsCache)
      return photoPositionsCache
    }

    try {
      const response = await fetch(`${API_BASE_URL}/photos/positions/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: PositionsResponse = await response.json()

      // Update cache
      photoPositionsCache = data.positions
      positionsCacheTime = now

      setPhotoPositions(data.positions)
      return data.positions
    } catch (err) {
      const apiError: PhotoApiError = {
        message: err instanceof Error ? err.message : 'Failed to fetch photo positions',
      }
      console.warn('Could not fetch photo positions:', apiError.message)
      return []
    }
  }, [setPhotoPositions])

  // Fetch single photo
  const fetchPhoto = useCallback(async (photoId: number): Promise<Photo> => {
    try {
      const response = await fetch(`${API_BASE_URL}/photos/${photoId}/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const photo: Photo = await response.json()
      return photo
    } catch (err) {
      const apiError: PhotoApiError = {
        message: err instanceof Error ? err.message : 'Failed to fetch photo',
      }
      throw apiError
    }
  }, [])

  // Upload photos
  const uploadPhotos = useCallback(async (files: File[], metadata?: {
    titlePrefix?: string
    tags?: string[]
    visibilityStart?: string
    visibilityEnd?: string
  }) => {
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()

      // Add photos
      files.forEach((file) => {
        formData.append('photos', file)
      })

      // Add metadata
      if (metadata?.titlePrefix) {
        formData.append('title_prefix', metadata.titlePrefix)
      }
      if (metadata?.tags) {
        metadata.tags.forEach((tag) => formData.append('tags', tag))
      }
      if (metadata?.visibilityStart) {
        formData.append('visibility_start', metadata.visibilityStart)
      }
      if (metadata?.visibilityEnd) {
        formData.append('visibility_end', metadata.visibilityEnd)
      }

      const response = await fetch(`${API_BASE_URL}/photos/bulk_upload/`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      // Refresh photos after successful upload
      await fetchPhotos()

      return result
    } catch (err) {
      const apiError: PhotoApiError = {
        message: err instanceof Error ? err.message : 'Failed to upload photos',
        status: err instanceof Error && 'status' in err ? (err as any).status : undefined,
      }
      setError(apiError)
      setStoreError(apiError.message)
      throw apiError
    } finally {
      setLoading(false)
    }
  }, [fetchPhotos, setError, setStoreError])

  // Update photo metadata
  const updatePhoto = useCallback(async (photoId: number, updates: Partial<Photo>) => {
    try {
      const response = await fetch(`${API_BASE_URL}/photos/${photoId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const updatedPhoto: Photo = await response.json()

      // Update store
      const { photos } = useGalleryStore.getState()
      const updatedPhotos = photos.map(p => p.id === photoId ? updatedPhoto : p)
      useGalleryStore.getState().setPhotos(updatedPhotos)

      return updatedPhoto
    } catch (err) {
      const apiError: PhotoApiError = {
        message: err instanceof Error ? err.message : 'Failed to update photo',
      }
      throw apiError
    }
  }, [])

  // Delete photo (soft delete by setting is_active to false)
  const deletePhoto = useCallback(async (photoId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/photos/${photoId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: false }),
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      // Update store
      const { photos } = useGalleryStore.getState()
      const updatedPhotos = photos.filter(p => p.id !== photoId)
      useGalleryStore.getState().setPhotos(updatedPhotos)

      return true
    } catch (err) {
      const apiError: PhotoApiError = {
        message: err instanceof Error ? err.message : 'Failed to delete photo',
      }
      throw apiError
    }
  }, [])

  // Get gallery statistics
  const getStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/photos/stats/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (err) {
      const apiError: PhotoApiError = {
        message: err instanceof Error ? err.message : 'Failed to fetch stats',
      }
      throw apiError
    }
  }, [])

  // Initial data load
  const loadInitialData = useCallback(async () => {
    try {
      // Load positions first (for initial 3D layout)
      await fetchPhotoPositions()

      // Then load photos
      await fetchPhotos()
    } catch (err) {
      console.error('Failed to load initial data:', err)
    }
  }, [fetchPhotoPositions, fetchPhotos])

  // Clear cache
  const clearCache = useCallback(() => {
    photoPositionsCache = null
    positionsCacheTime = 0
  }, [])

  return {
    // State
    loading,
    error,

    // Actions
    fetchPhotos,
    fetchPhotoPositions,
    fetchPhoto,
    uploadPhotos,
    updatePhoto,
    deletePhoto,
    getStats,
    loadInitialData,
    clearCache,
  }
}

// Hook for real-time photo updates (WebSocket could be added here later)
export function usePhotoUpdates() {
  const { fetchPhotos } = usePhotoData()

  // Poll for updates every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPhotos().catch(console.error)
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [fetchPhotos])

  // Listen for visibility changes to refresh when user returns to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPhotos().catch(console.error)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchPhotos])
}