'use client'

import { useEffect, useRef, useState } from 'react'
import MuxPlayer from '@mux/mux-player-react'

// Define the MuxPlayerElement type to match the Mux player expectations
interface MuxPlayerElement extends HTMLElement {
  // Add properties that exist on MuxPlayerElement
  currentTime?: number
  duration?: number
  paused?: boolean
  play?: () => Promise<void>
  pause?: () => void
  muted?: boolean
  volume?: number
}

interface MuxLivePlayerProps {
  playbackId: string
  streamTitle?: string
  autoPlay?: boolean
  muted?: boolean
  controls?: boolean
  accentColor?: string
  showViewerCount?: boolean
  onStreamStart?: () => void
  onStreamEnd?: () => void
  onError?: (error: string) => void
  className?: string
}

export default function MuxLivePlayer({
  playbackId,
  streamTitle = 'Live Stream',
  autoPlay = true,
  muted = false,
  controls = true,
  accentColor = '#ff6b35',
  showViewerCount = true,
  onStreamStart,
  onStreamEnd,
  onError,
  className = ''
}: MuxLivePlayerProps) {
  // Fix: Change ref type from HTMLVideoElement to MuxPlayerElement
  const playerRef = useRef<MuxPlayerElement>(null)
  const [isLive, setIsLive] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [error, setError] = useState<string>('')
  const [playerReady, setPlayerReady] = useState(false)

  useEffect(() => {
    // Monitor live stream status
    const checkStreamStatus = async () => {
      try {
        const response = await fetch(`https://stream.mux.com/${playbackId}.m3u8`)
        const isStreamActive = response.ok
        
        if (isStreamActive !== isLive) {
          setIsLive(isStreamActive)
          
          if (isStreamActive) {
            onStreamStart?.()
          } else {
            onStreamEnd?.()
          }
        }
      } catch (err) {
        console.error('Error checking stream status:', err)
      }
    }

    const interval = setInterval(checkStreamStatus, 5000)
    checkStreamStatus() // Initial check

    return () => clearInterval(interval)
  }, [playbackId, isLive, onStreamStart, onStreamEnd])

  const handlePlayerReady = () => {
    console.log('🎥 Mux player ready for playback ID:', playbackId)
    setPlayerReady(true)
    setError('')
  }

  const handlePlayerError = (event: any) => {
    const errorMessage = event.detail?.message || 'Video playback error'
    console.error('❌ Mux player error:', errorMessage)
    setError(errorMessage)
    onError?.(errorMessage)
  }

  const handleLoadStart = () => {
    console.log('📡 Loading stream:', playbackId)
    setError('')
  }

  const handleCanPlay = () => {
    console.log('✅ Stream ready to play')
    setIsLive(true)
    onStreamStart?.()
  }

  const handleEnded = () => {
    console.log('🔴 Stream ended')
    setIsLive(false)
    onStreamEnd?.()
  }

  const copyPlaybackId = async () => {
    try {
      await navigator.clipboard.writeText(playbackId)
      console.log('✅ Playback ID copied to clipboard')
    } catch (err) {
      console.error('❌ Failed to copy playback ID')
    }
  }

  const copyStreamUrl = async () => {
    const streamUrl = `https://stream.mux.com/${playbackId}.m3u8`
    try {
      await navigator.clipboard.writeText(streamUrl)
      console.log('✅ Stream URL copied to clipboard')
    } catch (err) {
      console.error('❌ Failed to copy stream URL')
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Stream Status Overlay */}
      {isLive && (
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>LIVE</span>
          </div>
        </div>
      )}

      {/* Viewer Count */}
      {showViewerCount && viewerCount > 0 && (
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-black bg-opacity-75 text-white px-3 py-1 rounded-full text-sm">
            {viewerCount} watching
          </div>
        </div>
      )}

      {/* Stream Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex space-x-2">
        <button
          onClick={copyPlaybackId}
          className="bg-black bg-opacity-75 text-white p-2 rounded-lg hover:bg-opacity-90 transition-colors"
          title="Copy Playback ID"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
            <path d="M3 5a2 2 0 012-2 3 3 0 003 3h6a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L14.586 13H19v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
          </svg>
        </button>
        
        <button
          onClick={copyStreamUrl}
          className="bg-black bg-opacity-75 text-white p-2 rounded-lg hover:bg-opacity-90 transition-colors"
          title="Copy Stream URL"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-red-600 text-white p-4 rounded-lg max-w-md text-center">
            <div className="flex items-center justify-center mb-2">
              <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-semibold">Playback Error</span>
            </div>
            <p className="text-sm">{error}</p>
            <button
              onClick={() => setError('')}
              className="mt-3 px-4 py-2 bg-white text-red-600 rounded hover:bg-gray-100 text-sm font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Mux Player */}
      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        streamType="live"
        autoPlay={autoPlay}
        muted={muted}
        controls={controls}
        style={{
          height: '100%',
          width: '100%',
          aspectRatio: '16/9',
          '--controls-accent-color': accentColor
        } as any}
        title={streamTitle}
        onCanPlay={handleCanPlay}
        onLoadStart={handleLoadStart}
        onEnded={handleEnded}
        onError={handlePlayerError}
        onLoadedData={handlePlayerReady}
        metadata={{
          video_id: playbackId,
          video_title: streamTitle,
          video_stream_type: 'live',
          page_type: 'live_stream_viewer'
        }}
      />

      {/* Stream Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{streamTitle}</h3>
            <div className="flex items-center space-x-4 text-sm opacity-75">
              <span>Playback ID: {playbackId.substring(0, 8)}...</span>
              {isLive ? (
                <span className="text-green-400">● Live</span>
              ) : (
                <span className="text-gray-400">● Offline</span>
              )}
            </div>
          </div>
          
          {playerReady && (
            <div className="text-right text-sm opacity-75">
              <div>Powered by Mux</div>
              {isLive && <div>Low-latency streaming</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}