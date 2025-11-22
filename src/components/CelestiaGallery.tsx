import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Text, Float, PerspectiveCamera } from '@react-three/drei'
import { Vector3, Group } from 'three'
import { PhotoStar } from './PhotoStar'
import { PhotoViewer } from './PhotoViewer'
import { useGalleryStore } from '@/stores/galleryStore'
import { usePhotoData } from '@/hooks/usePhotoData'
import { useCameraController, cameraController } from '@/utils/cameraAnimations'

// Loading screen component
const LoadingScreen = () => {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="mb-8">
          <div className="w-24 h-24 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4">CelestiaGallery</h1>
        <p className="text-blue-300 text-lg">Entering cosmic photo universe{dots}</p>
      </div>
    </div>
  )
}

// Error screen component
const ErrorScreen = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
    <div className="text-center max-w-md p-8">
      <div className="text-red-400 mb-6">
        <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-white mb-4">Cosmic Error</h2>
      <p className="text-gray-300 mb-6">{error}</p>
      <button
        onClick={onRetry}
        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
      >
        Retry Connection
      </button>
    </div>
  </div>
)

// Star field background component
const StarField = () => {
  return (
    <Stars
      radius={300}
      depth={60}
      count={2000}
      factor={4}
      saturation={0}
      fade
      speed={1}
    />
  )
}

// Cosmic particles for ambiance
const CosmicParticles = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 100 }, () => ({
      position: [
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 200,
      ] as [number, number, number],
      scale: Math.random() * 0.5 + 0.1,
      color: ['#ffffff', '#ffd700', '#87ceeb', '#ff69b4'][Math.floor(Math.random() * 4)],
    }))
  }, [])

  return (
    <>
      {particles.map((particle, i) => (
        <mesh key={i} position={particle.position}>
          <sphereGeometry args={[particle.scale, 6, 6]} />
          <meshStandardMaterial
            color={particle.color}
            emissive={particle.color}
            emissiveIntensity={Math.random() * 0.5 + 0.1}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}
    </>
  )
}

// Gallery title component
const GalleryTitle = () => {
  return (
    <Float
      speed={2}
      rotationIntensity={0.1}
      floatIntensity={0.5}
    >
      <Text
        position={[0, 15, 0]}
        fontSize={3}
        color="white"
        anchorX="center"
        anchorY="middle"
        font="/fonts/Geist-Regular.woff"
        outlineWidth={0.05}
        outlineColor="#1e40af"
      >
        CelestiaGallery
      </Text>
    </Float>
  )
}

// Gallery instructions
const GalleryInstructions = ({ visible }: { visible: boolean }) => {
  if (!visible) return null

  return (
    <group position={[0, -15, 0]}>
      <Text
        position={[-10, 0, 0]}
        fontSize={0.8}
        color="white"
        anchorX="left"
        anchorY="middle"
        font="/fonts/Geist-Regular.woff"
        outlineWidth={0.02}
        outlineColor="black"
        opacity={0.8}
      >
        Click photos to explore • Scroll to zoom • Drag to rotate
      </Text>
    </group>
  )
}

// Photo collection component
const PhotoCollection = ({ onPhotoClick }: { onPhotoClick: (photo: any) => void }) => {
  const { photos } = useGalleryStore()

  return (
    <>
      {photos.map((photo, index) => (
        <PhotoStar
          key={photo.id}
          photo={photo}
          onPhotoClick={onPhotoClick}
          index={index}
          totalPhotos={photos.length}
        />
      ))}
    </>
  )
}

// Camera controller component
const CameraController = () => {
  const { camera } = useThree()
  const { targetCameraPosition, setCameraAnimating, setCameraPosition } = useGalleryStore()

  useFrame((state) => {
    // Update camera based on animation controller
    const update = cameraController.update(performance.now())

    if (update.position) {
      camera.position.copy(update.position)
      setCameraPosition([update.position.x, update.position.y, update.position.z])
    }

    if (update.target) {
      camera.lookAt(update.target)
    }

    setCameraAnimating(cameraController.isAnimating())
  })

  // Handle target camera position changes
  useEffect(() => {
    if (targetCameraPosition) {
      camera.position.set(...targetCameraPosition)
    }
  }, [targetCameraPosition, camera])

  return null
}

// Controls component with custom behavior
const CustomControls = () => {
  const { openPhotoViewer, closePhotoViewer } = useGalleryStore()

  return (
    <OrbitControls
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      zoomSpeed={0.6}
      panSpeed={0.5}
      rotateSpeed={0.4}
      minDistance={5}
      maxDistance={200}
      minPolarAngle={0}
      maxPolarAngle={Math.PI}
      minAzimuthAngle={-Math.PI}
      maxAzimuthAngle={Math.PI}
      enableDamping
      dampingFactor={0.05}
      makeDefault
    />
  )
}

// Main scene lighting
const SceneLighting = () => {
  return (
    <>
      {/* Ambient light for overall scene */}
      <ambientLight intensity={0.1} color="#1e40af" />

      {/* Main directional light */}
      <directionalLight
        position={[10, 10, 5]}
        intensity={0.3}
        color="#ffffff"
        castShadow
      />

      {/* Point lights for cosmic ambiance */}
      <pointLight position={[30, 20, 30]} intensity={0.5} color="#ffd700" />
      <pointLight position={[-30, 20, -30]} intensity={0.5} color="#87ceeb" />
      <pointLight position={[0, -20, 40]} intensity={0.3} color="#ff69b4" />

      {/* Spotlights for dramatic effect */}
      <spotLight
        position={[0, 50, 0]}
        angle={0.3}
        penumbra={1}
        intensity={0.5}
        color="#ffffff"
        castShadow
      />
    </>
  )
}

export function CelestiaGallery() {
  const [isClient, setIsClient] = useState(false)
  const [showInstructions, setShowInstructions] = useState(true)
  const { loading, error, loadInitialData } = usePhotoData()
  const { photos, openPhotoViewer, isPhotoViewerOpen } = useGalleryStore()
  const { loading: storeLoading } = useGalleryStore()
  const { flyToPhoto } = useCameraController()

  // Hide instructions after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowInstructions(false)
    }, 10000) // 10 seconds

    return () => clearTimeout(timer)
  }, [])

  // Handle client-side mounting
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Load initial data
  useEffect(() => {
    if (isClient) {
      loadInitialData().catch(console.error)
    }
  }, [isClient, loadInitialData])

  // Handle photo click with camera animation
  const handlePhotoClick = useCallback(async (photo: any) => {
    try {
      // Animate camera to photo
      await flyToPhoto(photo)
      // Open photo viewer
      openPhotoViewer()
    } catch (error) {
      console.error('Failed to fly to photo:', error)
      // Fallback: just open the viewer without animation
      openPhotoViewer()
    }
  }, [flyToPhoto, openPhotoViewer])

  // Handle retry
  const handleRetry = useCallback(() => {
    loadInitialData().catch(console.error)
  }, [loadInitialData])

  // Show loading screen
  if (loading.isLoading || !storeLoading.photosLoaded) {
    return <LoadingScreen />
  }

  // Show error screen
  if (error) {
    return <ErrorScreen error={error.message} onRetry={handleRetry} />
  }

  // Show empty state
  if (photos.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-4">No Photos Yet</h2>
          <p className="text-gray-300 mb-6">Upload some photos to get started!</p>
          <a
            href="http://localhost:8000/admin/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Open Admin Panel
          </a>
        </div>
      </div>
    )
  }

  // Main 3D scene
  return (
    <>
      {/* Main 3D Canvas */}
      <div className="w-full h-screen bg-black">
        <Canvas
          camera={{
            position: [0, 0, 50],
            fov: 60,
            near: 0.1,
            far: 1000,
          }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
          performance={{ min: 0.5, max: 1, debounce: 200 }}
        >
          <PerspectiveCamera makeDefault fov={60} near={0.1} far={1000} position={[0, 0, 50]} />

          {/* Scene components */}
          <SceneLighting />
          <StarField />
          <CosmicParticles />
          <GalleryTitle />
          <GalleryInstructions visible={showInstructions} />

          {/* Photo collection */}
          <PhotoCollection onPhotoClick={handlePhotoClick} />

          {/* Camera and controls */}
          <CameraController />
          <CustomControls />
        </Canvas>
      </div>

      {/* Photo viewer modal */}
      <PhotoViewer
        isOpen={isPhotoViewerOpen}
        onClose={() => {
          // Return camera to overview when closing
          flyToPhoto(photos[0]).catch(console.error)
        }}
      />

      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm p-4 rounded-lg text-white text-xs font-mono">
          <div>Photos: {photos.length}</div>
          <div>Loading: {loading.isLoading ? 'Yes' : 'No'}</div>
          <div>Error: {error ? 'Yes' : 'No'}</div>
        </div>
      )}
    </>
  )
}

export default CelestiaGallery