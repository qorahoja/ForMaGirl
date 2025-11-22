import { Vector3, Spherical } from 'three'
import { Photo } from '@/stores/galleryStore'

// Camera position configuration
export interface CameraPosition {
  position: Vector3
  target: Vector3
  duration?: number
}

// Easing functions for smooth animations
export const Easing = {
  // Cubic ease-in-out (default for most animations)
  easeInOutCubic: (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  },

  // Exponential ease-out (for quick, snappy movements)
  easeOutExpo: (t: number): number => {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
  },

  // Sine ease-in-out (for gentle, organic movements)
  easeInOutSine: (t: number): number => {
    return -(Math.cos(Math.PI * t) - 1) / 2
  },

  // Bounce ease-out (for playful, energetic movements)
  easeOutBounce: (t: number): number => {
    const n1 = 7.5625
    const d1 = 2.75

    if (t < 1 / d1) {
      return n1 * t * t
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375
    }
  },
}

// Default animation duration (3 seconds as specified in planning)
export const DEFAULT_ANIMATION_DURATION = 3000

// Camera animation states
export interface CameraAnimationState {
  startPosition: Vector3
  endPosition: Vector3
  startTarget: Vector3
  endTarget: Vector3
  duration: number
  startTime: number
  easing: (t: number) => number
  onComplete?: () => void
}

// Active animations registry
const activeAnimations = new Map<string, CameraAnimationState>()

// Create orbital camera positions around a target
export function createOrbitalPosition(
  target: Vector3,
  radius: number,
  angle: number,
  elevation: number = 0
): CameraPosition {
  const spherical = new Spherical(radius, Math.PI / 2 - elevation, angle)
  const position = new Vector3().setFromSpherical(spherical).add(target)

  return {
    position,
    target: target.clone(),
  }
}

// Calculate optimal camera position for viewing a photo
export function calculatePhotoViewPosition(
  photo: Photo,
  cameraDistance: number = 8
): CameraPosition {
  const photoPosition = new Vector3(
    photo.position.x,
    photo.position.y,
    photo.position.z
  )

  // Create a slightly offset position for better viewing angle
  const offset = new Vector3(1, 0.5, 1).normalize().multiplyScalar(cameraDistance)

  return {
    position: photoPosition.clone().add(offset),
    target: photoPosition,
  }
}

// Create gallery overview position
export function createGalleryOverviewPosition(): CameraPosition {
  return {
    position: new Vector3(0, 30, 60),
    target: new Vector3(0, 0, 0),
  }
}

// Generate random exploration positions
export function generateExplorationPosition(): CameraPosition {
  const angle = Math.random() * Math.PI * 2
  const radius = 20 + Math.random() * 30
  const height = 5 + Math.random() * 15

  const position = new Vector3(
    Math.cos(angle) * radius,
    height,
    Math.sin(angle) * radius
  )

  return {
    position,
    target: new Vector3(0, 0, 0),
  }
}

// Camera animation controller class
export class CameraController {
  private animationId: string | null = null

  // Start a new camera animation
  startAnimation(
    animationId: string,
    config: CameraAnimationState
  ): Promise<void> {
    return new Promise((resolve) => {
      // Cancel any existing animation with the same ID
      if (activeAnimations.has(animationId)) {
        activeAnimations.delete(animationId)
      }

      // Add completion callback
      config.onComplete = resolve

      // Store the animation
      activeAnimations.set(animationId, config)
      this.animationId = animationId
    })
  }

  // Update camera position based on active animations
  update(currentTime: number): { position?: Vector3; target?: Vector3 } {
    const completedAnimations: string[] = []

    let result: { position?: Vector3; target?: Vector3 } = {}

    for (const [id, animation] of activeAnimations) {
      const elapsed = currentTime - animation.startTime
      const progress = Math.min(elapsed / animation.duration, 1)

      if (progress >= 1) {
        // Animation completed
        completedAnimations.push(id)
        result.position = animation.endPosition.clone()
        result.target = animation.endTarget.clone()

        if (animation.onComplete) {
          animation.onComplete()
        }
      } else {
        // Interpolate current position
        const easedProgress = animation.easing(progress)

        result.position = new Vector3()
          .copy(animation.startPosition)
          .lerp(animation.endPosition, easedProgress)

        result.target = new Vector3()
          .copy(animation.startTarget)
          .lerp(animation.endTarget, easedProgress)
      }
    }

    // Clean up completed animations
    completedAnimations.forEach(id => activeAnimations.delete(id))

    if (completedAnimations.includes(this.animationId!)) {
      this.animationId = null
    }

    return result
  }

  // Stop a specific animation
  stopAnimation(animationId: string): void {
    activeAnimations.delete(animationId)
    if (this.animationId === animationId) {
      this.animationId = null
    }
  }

  // Stop all animations
  stopAllAnimations(): void {
    activeAnimations.clear()
    this.animationId = null
  }

  // Check if an animation is currently running
  isAnimating(animationId?: string): boolean {
    if (animationId) {
      return activeAnimations.has(animationId)
    }
    return activeAnimations.size > 0
  }

  // Get current animation progress
  getAnimationProgress(animationId: string, currentTime: number): number {
    const animation = activeAnimations.get(animationId)
    if (!animation) return 0

    const elapsed = currentTime - animation.startTime
    return Math.min(elapsed / animation.duration, 1)
  }
}

// Global camera controller instance
export const cameraController = new CameraController()

// Utility functions for common camera animations
export const CameraAnimations = {
  // Fly to a specific photo
  flyToPhoto: (
    photo: Photo,
    duration: number = DEFAULT_ANIMATION_DURATION,
    easing: (t: number) => number = Easing.easeInOutCubic
  ): Promise<void> => {
    const targetPosition = calculatePhotoViewPosition(photo)
    const animationId = `fly-to-photo-${photo.id}`

    // Get current camera state (this would be injected from the camera component)
    const currentState = cameraController.isAnimating() ? {
      position: new Vector3(0, 0, 50), // Default fallback
      target: new Vector3(0, 0, 0),
    } : {
      position: new Vector3(0, 0, 50), // Would get from actual camera
      target: new Vector3(0, 0, 0),
    }

    return cameraController.startAnimation(animationId, {
      startPosition: currentState.position,
      endPosition: targetPosition.position,
      startTarget: currentState.target,
      endTarget: targetPosition.target,
      duration,
      startTime: performance.now(),
      easing,
    })
  },

  // Return to gallery overview
  returnToOverview: (
    duration: number = DEFAULT_ANIMATION_DURATION,
    easing: (t: number) => number = Easing.easeInOutCubic
  ): Promise<void> => {
    const overviewPosition = createGalleryOverviewPosition()
    const animationId = 'return-to-overview'

    // Get current camera state
    const currentState = {
      position: new Vector3(0, 0, 50), // Would get from actual camera
      target: new Vector3(0, 0, 0),
    }

    return cameraController.startAnimation(animationId, {
      startPosition: currentState.position,
      endPosition: overviewPosition.position,
      startTarget: currentState.target,
      endTarget: overviewPosition.target,
      duration,
      startTime: performance.now(),
      easing,
    })
  },

  // Explore random position
  exploreRandomPosition: (
    duration: number = DEFAULT_ANIMATION_DURATION,
    easing: (t: number) => number = Easing.easeInOutSine
  ): Promise<void> => {
    const randomPosition = generateExplorationPosition()
    const animationId = 'explore-random'

    // Get current camera state
    const currentState = {
      position: new Vector3(0, 0, 50), // Would get from actual camera
      target: new Vector3(0, 0, 0),
    }

    return cameraController.startAnimation(animationId, {
      startPosition: currentState.position,
      endPosition: randomPosition.position,
      startTarget: currentState.target,
      endTarget: randomPosition.target,
      duration,
      startTime: performance.now(),
      easing,
    })
  },

  // Orbit around a point
  orbitAroundPoint: (
    center: Vector3,
    radius: number,
    angleOffset: number,
    duration: number = DEFAULT_ANIMATION_DURATION,
    easing: (t: number) => number = Easing.easeInOutSine
  ): Promise<void> => {
    const startPosition = createOrbitalPosition(center, radius, 0)
    const endPosition = createOrbitalPosition(center, radius, angleOffset)
    const animationId = `orbit-around-${center.x}-${center.y}-${center.z}`

    return cameraController.startAnimation(animationId, {
      startPosition: startPosition.position,
      endPosition: endPosition.position,
      startTarget: startPosition.target,
      endTarget: endPosition.target,
      duration,
      startTime: performance.now(),
      easing,
    })
  },
}

// Hook for using camera controller in React components
export function useCameraController() {
  return {
    cameraController,
    flyToPhoto: CameraAnimations.flyToPhoto,
    returnToOverview: CameraAnimations.returnToOverview,
    exploreRandomPosition: CameraAnimations.exploreRandomPosition,
    orbitAroundPoint: CameraAnimations.orbitAroundPoint,
    isAnimating: (id?: string) => cameraController.isAnimating(id),
    stopAnimation: (id?: string) => {
      if (id) {
        cameraController.stopAnimation(id)
      } else {
        cameraController.stopAllAnimations()
      }
    },
  }
}