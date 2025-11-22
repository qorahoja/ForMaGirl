'use client'

import dynamic from 'next/dynamic'

// Dynamically import the 3D component to avoid SSR issues
const CelestiaGallery = dynamic(
  () => import('@/components/CelestiaGallery').then(mod => ({ default: mod.CelestiaGallery })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">CelestiaGallery</h1>
          <p className="text-blue-300 mt-2">Loading cosmic experience...</p>
        </div>
      </div>
    )
  }
)

export default function Home() {
  return <CelestiaGallery />
}
