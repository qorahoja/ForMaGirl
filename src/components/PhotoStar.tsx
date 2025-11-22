import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { Sphere, Text } from '@react-three/drei'
import { TextureLoader, Vector3 } from 'three'
import { Photo } from '@/stores/galleryStore'
import { useGalleryStore } from '@/stores/galleryStore'

interface PhotoStarProps {
  photo: Photo
  onPhotoClick: (photo: Photo) => void
  index: number
  totalPhotos: number
}

// Particle effect component
const StarParticles = ({ count = 5, radius = 2 }) => {
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * radius,
        (Math.random() - 0.5) * radius,
        (Math.random() - 0.5) * radius,
      ] as [number, number, number],
      scale: Math.random() * 0.5 + 0.5,
    }))
  }, [count, radius])

  return (
    <>
      {particles.map((particle, i) => (
        <mesh key={i} position={particle.position}>
          <sphereGeometry args={[particle.scale * 0.1, 8, 8]} />
          <meshStandardMaterial
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={0.3}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}
    </>
  )
}

export function PhotoStar({ photo, onPhotoClick, index, totalPhotos }: PhotoStarProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const [texture, setTexture] = useState<THREE.Texture | null>(null)

  const { selectPhoto } = useGalleryStore()

  // Load thumbnail texture
  useEffect(() => {
    if (photo.thumbnail_url) {
      const loader = new TextureLoader()
      loader.load(
        photo.thumbnail_url,
        (loadedTexture) => {
          loadedTexture.colorSpace = 'srgb'
          setTexture(loadedTexture)
        },
        undefined,
        (error) => {
          console.warn(`Failed to load texture for photo ${photo.id}:`, error)
        }
      )

      return () => {
        if (texture) {
          texture.dispose()
        }
      }
    }
  }, [photo.thumbnail_url])

  // Animation parameters - unique for each photo
  const animationParams = useMemo(() => ({
    // Unique phase offset for organic movement
    phase: (index * 0.137) % (Math.PI * 2), // Golden ratio for distribution

    // Drift speed varies by position in gallery
    driftSpeed: 0.2 + (index / totalPhotos) * 0.3,

    // Base drift amount
    driftAmount: 0.5 + Math.random() * 0.3,

    // Rotation speed
    rotationSpeed: 0.001 + Math.random() * 0.002,

    // Pulse parameters for glow effect
    pulseFrequency: 0.5 + Math.random() * 0.5,
    pulseIntensity: 0.1 + Math.random() * 0.1,
  }), [index, totalPhotos])

  // Handle click
  const handleClick = (event: any) => {
    event.stopPropagation()
    selectPhoto(photo)
    onPhotoClick(photo)
  }

  // Handle pointer events
  const handlePointerOver = () => {
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }

  const handlePointerOut = () => {
    setHovered(false)
    document.body.style.cursor = 'default'
  }

  // Animation loop
  useFrame((state, delta) => {
    if (meshRef.current) {
      const time = state.clock.elapsedTime

      // Drifting animation using sine waves
      const driftX = Math.sin(time * animationParams.driftSpeed + animationParams.phase) * animationParams.driftAmount
      const driftY = Math.cos(time * animationParams.driftSpeed * 0.7 + animationParams.phase) * animationParams.driftAmount * 0.8
      const driftZ = Math.sin(time * animationParams.driftSpeed * 0.5 + animationParams.phase * 1.5) * animationParams.driftAmount * 0.6

      // Apply drift to original position
      const originalX = photo.position.x
      const originalY = photo.position.y
      const originalZ = photo.position.z

      meshRef.current.position.x = originalX + driftX
      meshRef.current.position.y = originalY + driftY
      meshRef.current.position.z = originalZ + driftZ

      // Gentle rotation
      meshRef.current.rotation.y += animationParams.rotationSpeed

      // Pulse effect when hovered
      if (hovered) {
        const pulse = Math.sin(time * animationParams.pulseFrequency * Math.PI * 2) * animationParams.pulseIntensity
        const baseScale = texture ? 1.5 : 1.2 // Larger scale if we have a texture
        meshRef.current.scale.setScalar(baseScale + pulse)
      } else {
        meshRef.current.scale.setScalar(texture ? 1.2 : 1)
      }
    }
  })

  // Determine star color based on photo properties
  const starColor = useMemo(() => {
    if (photo.tags.includes('featured')) return '#FFD700' // Gold for featured
    if (photo.tags.includes('new')) return '#87CEEB' // Sky blue for new
    if (photo.tags.includes('favorite')) return '#FF69B4' // Pink for favorites

    // Default colors based on upload date
    const uploadDate = new Date(photo.upload_date)
    const daysSinceUpload = (Date.now() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceUpload < 7) return '#90EE90' // Light green for recent
    if (daysSinceUpload < 30) return '#FFB6C1' // Light pink for this month
    return '#FFFFFF' // White for older photos
  }, [photo.tags, photo.upload_date])

  return (
    <group position={[photo.position.x, photo.position.y, photo.position.z]}>
      {/* Glow effect */}
      <mesh ref={meshRef} scale={texture ? 1.2 : 1}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial
          color={starColor}
          emissive={starColor}
          emissiveIntensity={hovered ? 0.8 : 0.3}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Photo texture sphere */}
      {texture && (
        <mesh
          scale={1.1}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <sphereGeometry args={[0.7, 32, 32]} />
          <meshStandardMaterial
            map={texture}
            emissive={starColor}
            emissiveIntensity={hovered ? 0.2 : 0.05}
            transparent
            opacity={hovered ? 1 : 0.8}
          />
        </mesh>
      )}

      {/* Clickable area for photos without textures */}
      {!texture && (
        <mesh
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          scale={1.3}
        >
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshStandardMaterial
            transparent
            opacity={0.1}
            visible={false}
          />
        </mesh>
      )}

      {/* Title text (shows on hover) */}
      {hovered && photo.title && (
        <Text
          position={[0, 1.2, 0]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="black"
        >
          {photo.title}
        </Text>
      )}

      {/* Particle effects */}
      {hovered && <StarParticles count={8} radius={2} />}

      {/* Connection lines to nearby photos (optional visual enhancement) */}
      {hovered && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([0, 0, 0, 0, 2, 0])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={starColor} opacity={0.3} transparent />
        </lineSegments>
      )}
    </group>
  )
}

// Default export for backward compatibility
export default PhotoStar