import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Photo } from '@/stores/galleryStore'
import { useGalleryStore } from '@/stores/galleryStore'

interface PhotoViewerProps {
  isOpen: boolean
  onClose: () => void
}

// Photo metadata component
const PhotoMetadata = ({ photo }: { photo: Photo }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ delay: 0.2 }}
      className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
    >
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-2">
          {photo.title || 'Untitled Photo'}
        </h2>

        {photo.caption && (
          <p className="text-white/90 mb-4 max-w-3xl">
            {photo.caption}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-white/70 text-sm">
          <div>
            <span className="font-semibold">Date:</span> {formatDate(photo.upload_date)}
          </div>

          {photo.tags.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-semibold">Tags:</span>
              <div className="flex flex-wrap gap-1">
                {photo.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-white/10 rounded-full text-xs backdrop-blur-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// Navigation button component
const NavButton = ({
  direction,
  onClick,
  disabled,
}: {
  direction: 'prev' | 'next'
  onClick: () => void
  disabled: boolean
}) => {
  const isPrev = direction === 'prev'

  return (
    <motion.button
      className={`absolute ${isPrev ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2
        w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/20
        flex items-center justify-center text-white transition-all
        hover:bg-black/70 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-white/50`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={isPrev ? 'Previous photo' : 'Next photo'}
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={isPrev ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
        />
      </svg>
    </motion.button>
  )
}

// Loading indicator
const LoadingIndicator = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
  </div>
)

// Error message
const ErrorMessage = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="text-center p-8">
      <div className="text-red-400 mb-4">
        <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="text-white mb-4">Failed to load photo</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
      >
        Retry
      </button>
    </div>
  </div>
)

export function PhotoViewer({ isOpen, onClose }: PhotoViewerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageSrc, setImageSrc] = useState<string>('')
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)

  const {
    selectedPhoto,
    currentPhotoIndex,
    photos,
    setNextPhoto,
    setPreviousPhoto,
    openPhotoViewer,
    closePhotoViewer: closeStoreViewer,
  } = useGalleryStore()

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      switch (event.key) {
        case 'Escape':
          handleClose()
          break
        case 'ArrowLeft':
          handlePrevious()
          break
        case 'ArrowRight':
          handleNext()
          break
        case ' ':
          event.preventDefault()
          handleNext()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Load image when selected photo changes
  useEffect(() => {
    if (!selectedPhoto) return

    setIsLoading(true)
    setImageError(null)

    // Choose the best image size based on window size
    const imageSizes = [
      { url: selectedPhoto.large_url, size: 'large' },
      { url: selectedPhoto.medium_url, size: 'medium' },
      { url: selectedPhoto.original_url, size: 'original' },
    ]

    // Find the first available image URL
    const availableImage = imageSizes.find(img => img.url)

    if (!availableImage) {
      setImageError('No image available')
      setIsLoading(false)
      return
    }

    // Preload the image
    const img = new Image()
    img.onload = () => {
      setImageSrc(availableImage.url)
      setIsLoading(false)
    }
    img.onerror = () => {
      setImageError('Failed to load image')
      setIsLoading(false)
    }
    img.src = availableImage.url
  }, [selectedPhoto])

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (photos.length <= 1) return
    setNextPhoto()
  }, [photos.length, setNextPhoto])

  const handlePrevious = useCallback(() => {
    if (photos.length <= 1) return
    setPreviousPhoto()
  }, [photos.length, setPreviousPhoto])

  const handleClose = useCallback(() => {
    closeStoreViewer()
    onClose()
  }, [closeStoreViewer, onClose])

  // Touch handlers for mobile swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    })
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    }

    const deltaX = touchEnd.x - touchStart.x
    const deltaY = touchEnd.y - touchStart.y

    // Check if it's a horizontal swipe (more horizontal than vertical movement)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        handlePrevious() // Swipe right - previous photo
      } else {
        handleNext() // Swipe left - next photo
      }
    }

    setTouchStart(null)
  }

  // Prevent background scrolling when viewer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!selectedPhoto) return null

  const hasMultiplePhotos = photos.length > 1
  const showNavigation = hasMultiplePhotos && !isLoading && !imageError

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={handleClose}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close button */}
          <motion.button
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md
              border border-white/20 flex items-center justify-center text-white
              hover:bg-black/70 hover:scale-110 transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation()
              handleClose()
            }}
            aria-label="Close photo viewer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>

          {/* Navigation buttons */}
          {showNavigation && (
            <>
              <NavButton
                direction="prev"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePrevious()
                }}
                disabled={false}
              />
              <NavButton
                direction="next"
                onClick={(e) => {
                  e.stopPropagation()
                  handleNext()
                }}
                disabled={false}
              />
            </>
          )}

          {/* Main image container */}
          <div className="relative w-full h-full flex items-center justify-center p-8">
            <motion.img
              key={selectedPhoto.id} // Force re-render when photo changes
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4 }}
              src={imageSrc}
              alt={selectedPhoto.title || 'Photo'}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image
              draggable={false}
            />

            {/* Loading indicator */}
            {isLoading && <LoadingIndicator />}

            {/* Error message */}
            {imageError && (
              <ErrorMessage
                error={imageError}
                onRetry={() => {
                  setImageError(null)
                  // Force reload by setting imageSrc to empty
                  setImageSrc('')
                }}
              />
            )}
          </div>

          {/* Photo metadata */}
          {!isLoading && !imageError && <PhotoMetadata photo={selectedPhoto} />}

          {/* Photo counter */}
          {hasMultiplePhotos && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md
              px-3 py-1 rounded-full border border-white/20 text-white text-sm">
              {currentPhotoIndex + 1} / {photos.length}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default PhotoViewer