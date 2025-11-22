import { create } from 'zustand'

// Types for photo data
export interface Photo {
  id: number
  title: string
  caption: string
  thumbnail_url: string | null
  medium_url: string | null
  large_url: string | null
  original_url: string | null
  upload_date: string
  tags: string[]
  visibility_start: string | null
  visibility_end: string | null
  is_active: boolean
  position: {
    x: number
    y: number
    z: number
  }
  url: string
}

export interface PhotoPosition {
  id: number
  position: {
    x: number
    y: number
    z: number
  }
  thumbnail_url?: string
}

// Camera state types
export interface CameraState {
  position: [number, number, number]
  target: [number, number, number]
  isAnimating: boolean
}

// Loading states
export interface LoadingState {
  isLoading: boolean
  loadingMessage: string
  photosLoaded: boolean
  texturesLoaded: boolean
}

// Gallery store interface
interface GalleryStore {
  // Photo data
  photos: Photo[]
  photoPositions: PhotoPosition[]
  selectedPhoto: Photo | null
  currentPhotoIndex: number

  // Camera state
  cameraState: CameraState
  targetCameraPosition: [number, number, number] | null

  // Loading states
  loading: LoadingState

  // UI state
  isPhotoViewerOpen: boolean
  showNavigationControls: boolean
  error: string | null

  // Actions
  setPhotos: (photos: Photo[]) => void
  setPhotoPositions: (positions: PhotoPosition[]) => void
  selectPhoto: (photo: Photo | null) => void
  setNextPhoto: () => void
  setPreviousPhoto: () => void
  openPhotoViewer: () => void
  closePhotoViewer: () => void

  // Camera actions
  setCameraPosition: (position: [number, number, number]) => void
  setCameraTarget: (target: [number, number, number]) => void
  setCameraAnimating: (isAnimating: boolean) => void
  setTargetCameraPosition: (position: [number, number, number] | null) => void

  // Loading actions
  setLoading: (isLoading: boolean, message?: string) => void
  setPhotosLoaded: (loaded: boolean) => void
  setTexturesLoaded: (loaded: boolean) => void
  setError: (error: string | null) => void

  // UI actions
  toggleNavigationControls: () => void
  reset: () => void
}

// Create the store
export const useGalleryStore = create<GalleryStore>((set, get) => ({
  // Initial state
  photos: [],
  photoPositions: [],
  selectedPhoto: null,
  currentPhotoIndex: 0,

  cameraState: {
    position: [0, 0, 50],
    target: [0, 0, 0],
    isAnimating: false,
  },
  targetCameraPosition: null,

  loading: {
    isLoading: false,
    loadingMessage: '',
    photosLoaded: false,
    texturesLoaded: false,
  },

  isPhotoViewerOpen: false,
  showNavigationControls: true,
  error: null,

  // Actions
  setPhotos: (photos) => {
    set((state) => {
      const updatedPhotos = photos.sort((a, b) =>
        new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime()
      )
      return {
        photos: updatedPhotos,
        loading: { ...state.loading, photosLoaded: true }
      }
    })
  },

  setPhotoPositions: (photoPositions) => {
    set({ photoPositions })
  },

  selectPhoto: (photo) => {
    const currentPhotos = get().photos
    const currentIndex = currentPhotos.findIndex(p => p.id === photo?.id)
    set({
      selectedPhoto: photo,
      currentPhotoIndex: photo ? currentIndex : 0
    })
  },

  setNextPhoto: () => {
    const { photos, currentPhotoIndex } = get()
    if (photos.length === 0) return

    const nextIndex = (currentPhotoIndex + 1) % photos.length
    const nextPhoto = photos[nextIndex]
    set({
      selectedPhoto: nextPhoto,
      currentPhotoIndex: nextIndex
    })
  },

  setPreviousPhoto: () => {
    const { photos, currentPhotoIndex } = get()
    if (photos.length === 0) return

    const prevIndex = currentPhotoIndex === 0 ? photos.length - 1 : currentPhotoIndex - 1
    const prevPhoto = photos[prevIndex]
    set({
      selectedPhoto: prevPhoto,
      currentPhotoIndex: prevIndex
    })
  },

  openPhotoViewer: () => {
    set({ isPhotoViewerOpen: true })
  },

  closePhotoViewer: () => {
    set({
      isPhotoViewerOpen: false,
      targetCameraPosition: null
    })
  },

  setCameraPosition: (position) => {
    set((state) => ({
      cameraState: { ...state.cameraState, position }
    }))
  },

  setCameraTarget: (target) => {
    set((state) => ({
      cameraState: { ...state.cameraState, target }
    }))
  },

  setCameraAnimating: (isAnimating) => {
    set((state) => ({
      cameraState: { ...state.cameraState, isAnimating }
    }))
  },

  setTargetCameraPosition: (position) => {
    set({ targetCameraPosition: position })
  },

  setLoading: (isLoading, message = '') => {
    set((state) => ({
      loading: { ...state.loading, isLoading, loadingMessage: message }
    }))
  },

  setPhotosLoaded: (loaded) => {
    set((state) => ({
      loading: { ...state.loading, photosLoaded: loaded }
    }))
  },

  setTexturesLoaded: (loaded) => {
    set((state) => ({
      loading: { ...state.loading, texturesLoaded: loaded }
    }))
  },

  setError: (error) => {
    set({ error })
  },

  toggleNavigationControls: () => {
    set((state) => ({
      showNavigationControls: !state.showNavigationControls
    }))
  },

  reset: () => {
    set({
      photos: [],
      photoPositions: [],
      selectedPhoto: null,
      currentPhotoIndex: 0,
      cameraState: {
        position: [0, 0, 50],
        target: [0, 0, 0],
        isAnimating: false,
      },
      targetCameraPosition: null,
      loading: {
        isLoading: false,
        loadingMessage: '',
        photosLoaded: false,
        texturesLoaded: false,
      },
      isPhotoViewerOpen: false,
      showNavigationControls: true,
      error: null
    })
  }
}))

// Selectors for easier access to specific state
export const usePhotos = () => useGalleryStore((state) => state.photos)
export const usePhotoPositions = () => useGalleryStore((state) => state.photoPositions)
export const useSelectedPhoto = () => useGalleryStore((state) => state.selectedPhoto)
export const useCameraState = () => useGalleryStore((state) => state.cameraState)
export const useLoadingState = () => useGalleryStore((state) => state.loading)
export const usePhotoViewerState = () => useGalleryStore((state) => ({
  isPhotoViewerOpen: state.isPhotoViewerOpen,
  selectedPhoto: state.selectedPhoto,
  currentPhotoIndex: state.currentPhotoIndex,
  photosCount: state.photos.length
}))