'use client'

import { useRef, useEffect, useState } from 'react'
import MuxPlayer from '@mux/mux-player-react'

interface MuxLivePlayerProps {
  playbackId: string
  streamTitle?: string
  autoPlay?: boolean
  muted?: boolean
  className?: string
  accentColor?: string
  showViewerCount?: boolean
  onViewerCountUpdate?: (count: number) => void
  onStreamStart?: () => void
  onStreamEnd?: () => void
}

export default function MuxLivePlayer({
  playbackId,
  streamTitle = 'Live Stream',
  autoPlay = true,
  muted = false,
  className = '',
  accentColor = '#fa50b5',
  showViewerCount = true,
  onViewerCountUpdate,
  onStreamStart,
  onStreamEnd
}: MuxLivePlayerProps) {
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const retryCount = useRef(0)
  const maxRetries = 5

  useEffect(() => {
    if (!playbackId) return

    console.log('📺 Initializing Mux live player for:', playbackId)
    setIsLoading(true)
    setHasError(false)
    retryCount.current = 0

    // Simulate viewer count updates (in real app, this would come from your backend)
    const viewerInterval = setInterval(() => {
      if (isLive) {
        const newCount = Math.floor(Math.random() * 50) + 10 // Mock viewer count
        setViewerCount(newCount)
        onViewerCountUpdate?.(newCount)
      }
    }, 10000)

    return () => {
      console.log('🧹 Cleaning up live player')
      clearInterval(viewerInterval)
    }
  }, [playbackId, isLive, onViewerCountUpdate])

  const handleLoadStart = () => {
    console.log('📡 Live stream load started')
    setIsLoading(true)
    setHasError(false)
  }

  const handleLoadedData = () => {
    console.log('✅ Live stream data loaded')
    setIsLoading(false)
    setIsLive(true)
    onStreamStart?.()
  }

  const handlePlay = () => {
    console.log('▶️ Live stream play started')
    setIsLoading(false)
    setIsLive(true)
  }

  const handlePause = () => {
    console.log('⏸️ Live stream paused')
  }

  const handleEnded = () => {
    console.log('🏁 Live stream ended')
    setIsLive(false)
    onStreamEnd?.()
  }

  const handleError = (error: any) => {
    console.error('❌ Live stream error:', error)
    
    if (retryCount.current < maxRetries) {
      retryCount.current++
      console.warn(`🔄 Retrying live stream connection (${retryCount.current}/${maxRetries})...`)
      setTimeout(() => {
        setHasError(false)
        setIsLoading(true)
      }, 1000 * retryCount.current) // Exponential backoff
    } else {
      setHasError(true)
      setErrorMessage('Live stream is currently unavailable. Please try again later.')
      setIsLoading(false)
      setIsLive(false)
      onStreamEnd?.()
    }
  }

  const handleCanPlay = () => {
    console.log('✅ Live stream can play')
    setIsLoading(false)
    setHasError(false)
    setIsLive(true)
  }

  const handleWaiting = () => {
    console.log('⏳ Live stream buffering...')
    // Don't set loading to true for live streams as it might be temporary buffering
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
            <p className="text-lg font-semibold">No Stream ID</p>
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
        streamType="live"
        metadata={{
          video_id: playbackId,
          video_title: streamTitle,
          viewer_user_id: 'live-viewer'
        }}
        accentColor={accentColor}
        autoPlay={autoPlay}
        muted={muted}
        onLoadStart={handleLoadStart}
        onLoadedData={handleLoadedData}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        style={{
          width: '100%',
          height: '100%'
        }}
      />

      {/* Live indicator */}
      {isLive && !isLoading && !hasError && (
        <div className="absolute top-4 left-4">
          <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            LIVE
          </div>
        </div>
      )}

      {/* Viewer count */}
      {showViewerCount && isLive && viewerCount > 0 && !isLoading && !hasError && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
          <div className="flex items-center gap-1 text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            {viewerCount} watching
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
            <p className="text-lg font-semibold">Connecting to live stream...</p>
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
            <p className="text-lg font-semibold mb-2">Stream Unavailable</p>
            <p className="text-sm text-gray-300 mb-4">{errorMessage}</p>
            <button
              onClick={() => {
                setHasError(false)
                setErrorMessage('')
                retryCount.current = 0
                setIsLoading(true)
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stream ended overlay */}
      {!isLoading && !isLive && !hasError && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            </div>
            <p className="text-lg font-semibold mb-2">Stream Offline</p>
            <p className="text-sm text-gray-300">This live stream is currently offline.</p>
          </div>
        </div>
      )}
    </div>
  )
}