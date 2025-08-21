'use client'

import { useRef, useEffect, useState } from 'react'
import Hls from 'hls.js'
import mux from 'mux-embed'

// Create type declaration for mux-embed
declare module 'mux-embed' {
  interface MuxOptions {
    debug?: boolean
    hlsjs?: any
    Hls?: any
    data?: {
      env_key?: string
      player_name?: string
      player_version?: string
      player_init_time?: number
      video_id?: string
      video_title?: string
      video_stream_type?: string
      viewer_user_id?: string
      experiment_name?: string
      sub_property_id?: string
    }
  }

  function monitor(video: HTMLVideoElement, options: MuxOptions): void
  function updateData(data: any): void

  export = { monitor, updateData }
}

interface MuxLivePlayerProps {
  playbackId: string
  streamTitle?: string
  autoPlay?: boolean
  muted?: boolean
  className?: string
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
  showViewerCount = true,
  onViewerCountUpdate,
  onStreamStart,
  onStreamEnd
}: MuxLivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [latency, setLatency] = useState(0)
  const muxPlayerInitTime = useRef(Date.now())
  const retryCount = useRef(0)
  const maxRetries = 5

  useEffect(() => {
    if (!videoRef.current || !playbackId) return

    const video = videoRef.current
    const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`
    
    console.log('📺 Initializing Mux live player for:', playbackId)
    setIsLoading(true)
    setHasError(false)

    const initializePlayer = () => {
      if (Hls.isSupported()) {
        // Enhanced HLS.js configuration for live streaming
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 10, // Shorter buffer for lower latency
          maxMaxBufferLength: 30,
          liveDurationInfinity: true,
          liveBackBufferLength: 5, // Keep minimal back buffer for live
          liveSyncDurationCount: 3 // Stay close to live edge
        })
        hlsRef.current = hls

        // Load the live stream
        hls.loadSource(hlsUrl)
        hls.attachMedia(video)

        // HLS.js events for live streaming
        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log('✅ Live manifest parsed:', data)
          setIsLoading(false)
          setIsLive(data.levels.length > 0)
          
          if (autoPlay) {
            video.play().catch(err => {
              console.warn('⚠️ Auto-play failed:', err)
              // Auto-play might be blocked, show play button
            })
          }
          
          onStreamStart?.()
        })

        // Live stream specific events
        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
          // Calculate live latency
          if (data.details.live) {
            const drift = data.details.drift || 0
            setLatency(Math.abs(drift))
          }
        })

        // Enhanced error handling for live streams
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('❌ HLS live error:', data)
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn('🔄 Network error, attempting recovery...')
                if (retryCount.current < maxRetries) {
                  retryCount.current++
                  setTimeout(() => {
                    hls.startLoad()
                  }, 1000 * retryCount.current) // Exponential backoff
                } else {
                  setHasError(true)
                }
                break
                
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.warn('🔄 Media error, attempting recovery...')
                hls.recoverMediaError()
                break
                
              default:
                console.error('💥 Fatal error, stream may have ended')
                setIsLive(false)
                setHasError(true)
                onStreamEnd?.()
                break
            }
          }
        })

        // Initialize Mux Data tracking for live stream
        try {
          mux.monitor(video, {
            debug: false,
            hlsjs: hls,
            Hls: Hls,
            data: {
              env_key: 'rp53rp6qs11209chk3qid8j44', // Your Mux environment key
              // Player Metadata
              player_name: 'Cosmic Live Player',
              player_version: '1.0.0',
              player_init_time: muxPlayerInitTime.current,
              // Video Metadata
              video_id: playbackId,
              video_title: streamTitle,
              video_stream_type: 'live', // Important: Set to 'live' for live streams
              // Site Metadata
              viewer_user_id: '', // Set user ID if available
              experiment_name: 'live-streaming',
              sub_property_id: 'cosmic-livestream'
            }
          })
          console.log('✅ Mux Data live tracking initialized')
        } catch (error) {
          console.error('❌ Failed to initialize Mux Data tracking:', error)
        }

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        console.log('🍎 Using native HLS for live stream')
        video.src = hlsUrl
        
        try {
          mux.monitor(video, {
            debug: false,
            data: {
              env_key: 'rp53rp6qs11209chk3qid8j44',
              player_name: 'Cosmic Native Live Player',
              player_version: '1.0.0',
              player_init_time: muxPlayerInitTime.current,
              video_id: playbackId,
              video_title: streamTitle,
              video_stream_type: 'live',
              sub_property_id: 'cosmic-livestream'
            }
          })
        } catch (error) {
          console.error('❌ Mux tracking failed:', error)
        }

        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false)
          setIsLive(true)
          onStreamStart?.()
        })
      }
    }

    initializePlayer()

    // Simulate viewer count updates (in real app, this would come from your backend)
    const viewerInterval = setInterval(() => {
      if (isLive) {
        const newCount = Math.floor(Math.random() * 50) + 10 // Mock viewer count
        setViewerCount(newCount)
        onViewerCountUpdate?.(newCount)
      }
    }, 10000)

    // Monitor stream health
    const healthCheckInterval = setInterval(() => {
      if (hlsRef.current && isLive) {
        const levels = hlsRef.current.levels
        if (levels.length === 0) {
          console.warn('⚠️ No levels available, stream may have ended')
          setIsLive(false)
          onStreamEnd?.()
        }
      }
    }, 30000) // Check every 30 seconds

    return () => {
      console.log('🧹 Cleaning up live player')
      clearInterval(viewerInterval)
      clearInterval(healthCheckInterval)
      
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [playbackId, streamTitle, autoPlay, isLive, onViewerCountUpdate, onStreamStart, onStreamEnd])

  // Handle video events
  const handlePlay = () => {
    console.log('▶️ Live stream play started')
    if (hlsRef.current) {
      // Ensure we're at the live edge
      hlsRef.current.currentLevel = -1 // Auto level selection
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current && hlsRef.current && isLive) {
      const video = videoRef.current
      const hls = hlsRef.current
      
      // Check if we're too far behind live edge - Fixed null check
      if (hls.liveSyncPosition !== null && hls.liveSyncPosition !== undefined) {
        const drift = hls.liveSyncPosition - video.currentTime
        if (drift > 30) { // More than 30 seconds behind
          console.log('⏩ Seeking to live edge')
          video.currentTime = hls.liveSyncPosition
        }
      }
    }
  }

  const handleError = () => {
    console.error('❌ Video element error occurred')
    setHasError(true)
    setIsLive(false)
  }

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        controls
        muted={muted}
        playsInline
        className="w-full h-full object-contain"
        onPlay={handlePlay}
        onTimeUpdate={handleTimeUpdate}
        onError={handleError}
      />

      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-4 left-4">
          <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            LIVE
          </div>
        </div>
      )}

      {/* Viewer count */}
      {showViewerCount && isLive && viewerCount > 0 && (
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

      {/* Latency indicator */}
      {isLive && latency > 0 && (
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
          Latency: {latency.toFixed(1)}s
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
            <p className="text-sm text-gray-300 mb-4">
              The live stream is currently offline or experiencing issues.
            </p>
            <button
              onClick={() => {
                setHasError(false)
                retryCount.current = 0
                window.location.reload()
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
            <p className="text-lg font-semibold mb-2">Stream Ended</p>
            <p className="text-sm text-gray-300">This live stream has concluded.</p>
          </div>
        </div>
      )}
    </div>
  )
}