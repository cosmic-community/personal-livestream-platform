'use client'

import { useState, useEffect } from 'react'

export default function CosmicBadge({ bucketSlug }: { bucketSlug: string }) {
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    // Show badge after a short delay and check if previously dismissed
    const isDismissed = localStorage.getItem('cosmic-badge-dismissed')
    if (!isDismissed) {
      const timer = setTimeout(() => setIsVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])
  
  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem('cosmic-badge-dismissed', 'true')
  }
  
  if (!isVisible) return null
  
  return (
    <div 
      className="fixed bottom-5 right-5 z-50 transition-colors duration-200"
      style={{
        position: 'fixed',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        padding: '12px 16px',
        width: '180px'
      }}
    >
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute -top-2 -right-2 w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-200"
        aria-label="Dismiss badge"
      >
        ×
      </button>
      
      {/* Main badge content */}
      <a
        href={`https://www.cosmicjs.com?utm_source=bucket_${bucketSlug}&utm_medium=referral&utm_campaign=app_badge&utm_content=built_with_cosmic`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-gray-800 text-sm font-medium no-underline"
        onMouseEnter={(e) => e.currentTarget.parentElement!.style.backgroundColor = '#f9fafb'}
        onMouseLeave={(e) => e.currentTarget.parentElement!.style.backgroundColor = 'white'}
      >
        <img 
          src="https://cdn.cosmicjs.com/b67de7d0-c810-11ed-b01d-23d7b265c299-logo508x500.svg" 
          alt="Cosmic Logo" 
          className="w-5 h-5"
        />
        Built with Cosmic
      </a>
    </div>
  )
}