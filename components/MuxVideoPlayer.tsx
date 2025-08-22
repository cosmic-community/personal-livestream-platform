'use client'

import { useRef, useEffect, useState } from 'react'
import MuxPlayer from '@mux/mux-player-react'

interface MuxVideoPlayerProps {
  playbackId: string
  title?: string
  autoPlay?: boolean
  muted?: boolean
  controls?: boolean
  poster?: string
  className?: string
  accentColor?: string
  onLoadStart?: () => void
  onLoadedData?: () => void
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onError?: (error: any) => void
}

export default function MuxVideoPlayer({
  playbackId,
  title = 'Video',
  autoPlay = false,
  muted = true,
  controls = true,
  poster,
  className = '',
  accentColor = '#fa50b5',
  onLoadStart,
  onLoadedData,
  onPlay,
  onPause,
  onEnded,
  onError
}: MuxVideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleLoadStart = () => {
    console.log('📡 Video load started')
    setIsLoading(true)
    setHasError(false)
    onLoadStart?.()
  }

  const handleLoadedData = () => {
    console.log('✅ Video data loaded')
    setIsLoading(false)
    onLoadedData?.()
  }

  const handlePlay = () => {
    console.log('▶️ Video play started')
    setIsLoading(false)
    onPlay?.()
  }

  const handlePause = () => {
    console.log('⏸️ Video paused')
    onPause?.()
  }

  const handleEnded = () => {
    console.log('🏁 Video ended')
    onEnded?.()
  }

  const handleError = (error: any) => {
    console.error('❌ Video element error:', error)
    setHasError(true)
    setErrorMessage('Video playback error occurred.')
    setIsLoading(false)
    onError?.(error)
  }

  const handleCanPlay = () => {
    console.log('✅ Video can play')
    setIsLoading(false)
    setHasError(false)
  }

  if (!playbackId) {
    return (
      <div className={`relative bg-black rounded-lg overflow-hidden aspect-video ${className}`}>
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            </div>
            <p className="text-lg font-semibold">No Playback ID</p>
            <p className="text-sm text-gray-300">Please provide a valid Mux playback ID</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      <MuxPlayer
        playbackId={playbackId}
        metadata={{
          video_id: playbackId,
          video_title: title,
          viewer_user_id: 'anonymous-viewer'
        }}
        accentColor={accentColor}
        autoPlay={autoPlay}
        muted={muted}
        poster={poster}
        onLoadStart={handleLoadStart}
        onLoadedData={handleLoadedData}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
        onCanPlay={handleCanPlay}
        style={{
          width: '100%',
          height: '100%'
        }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-lg font-semibold">Loading video...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-lg font-semibold mb-2">Playback Error</p>
            <p className="text-sm text-gray-300 mb-4">{errorMessage}</p>
            <button
              onClick={() => {
                setHasError(false)
                setErrorMessage('')
                setIsLoading(true)
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}