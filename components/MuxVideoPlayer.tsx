'use client'

import { useRef, useEffect, useState } from 'react'
import Hls from 'hls.js'
import * as mux from 'mux-embed'

// Create proper type declarations for mux-embed
interface MuxData {
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

interface MuxOptions {
  debug?: boolean
  hlsjs?: any
  Hls?: any
  data?: MuxData
}

// Type the mux-embed functions we use
declare const mux: {
  monitor: (video: HTMLVideoElement, options: MuxOptions) => void
  updateData: (data: any) => void
}

interface MuxVideoPlayerProps {
  playbackId: string
  title?: string
  autoPlay?: boolean
  muted?: boolean
  controls?: boolean
  poster?: string
  className?: string
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
  onLoadStart,
  onLoadedData,
  onPlay,
  onPause,
  onEnded,
  onError
}: MuxVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const muxPlayerInitTime = useRef(Date.now())

  useEffect(() => {
    if (!videoRef.current || !playbackId) return

    const video = videoRef.current
    const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`
    
    console.log('🎥 Initializing Mux video player for:', playbackId)
    setIsLoading(true)
    setHasError(false)

    // Check if HLS.js is supported
    if (Hls.isSupported()) {
      // Initialize HLS.js
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      })
      hlsRef.current = hls

      // Load the HLS stream
      hls.loadSource(hlsUrl)
      hls.attachMedia(video)

      // HLS.js error handling
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('❌ HLS.js error:', data)
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error encountered, trying to recover...')
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error encountered, trying to recover...')
              hls.recoverMediaError()
              break
            default:
              console.error('Fatal error, cannot recover')
              setHasError(true)
              setErrorMessage('Video playback failed. Please try again.')
              onError?.(data)
              break
          }
        }
      })

      // HLS.js manifest loaded
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ HLS manifest parsed successfully')
        setIsLoading(false)
        
        // Auto-play if enabled
        if (autoPlay) {
          video.play().catch(console.error)
        }
      })

      // Initialize Mux Data tracking
      try {
        mux.monitor(video, {
          debug: false,
          hlsjs: hls,
          Hls: Hls,
          data: {
            env_key: 'rp53rp6qs11209chk3qid8j44', // Your Mux environment key
            // Player Metadata
            player_name: 'Cosmic Mux Player',
            player_version: '1.0.0',
            player_init_time: muxPlayerInitTime.current,
            // Video Metadata
            video_id: playbackId,
            video_title: title,
            video_stream_type: 'on-demand', // or 'live' for live streams
            // Site Metadata
            viewer_user_id: '', // You can set user ID if available
            experiment_name: '', // For A/B testing
            sub_property_id: 'cosmic-livestream' // Your site identifier
          }
        })
        console.log('✅ Mux Data tracking initialized')
      } catch (error) {
        console.error('❌ Failed to initialize Mux Data tracking:', error)
      }

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // For Safari, use native HLS support
      console.log('🍎 Using native HLS support (Safari)')
      video.src = hlsUrl
      
      // Initialize Mux Data tracking for native HLS
      try {
        mux.monitor(video, {
          debug: false,
          data: {
            env_key: 'rp53rp6qs11209chk3qid8j44',
            player_name: 'Cosmic Native Player',
            player_version: '1.0.0',
            player_init_time: muxPlayerInitTime.current,
            video_id: playbackId,
            video_title: title,
            video_stream_type: 'on-demand',
            sub_property_id: 'cosmic-livestream'
          }
        })
        console.log('✅ Mux Data tracking initialized (native)')
      } catch (error) {
        console.error('❌ Failed to initialize Mux Data tracking:', error)
      }

      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false)
      })
    } else {
      console.error('❌ HLS not supported in this browser')
      setHasError(true)
      setErrorMessage('Video format not supported in this browser.')
    }

    // Video event listeners - Fixed: Remove parameters to match expected signatures
    const handleLoadStart = () => {
      console.log('📡 Video load started')
      onLoadStart?.()
    }

    const handleLoadedData = () => {
      console.log('✅ Video data loaded')
      setIsLoading(false)
      onLoadedData?.()
    }

    const handlePlay = () => {
      console.log('▶️ Video play started')
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

    const handleError = (e: Event) => {
      console.error('❌ Video element error:', e)
      setHasError(true)
      setErrorMessage('Video playback error occurred.')
      onError?.(e)
    }

    // Add event listeners
    video.addEventListener('loadstart', handleLoadStart)
    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up Mux video player')
      
      // Remove event listeners
      video.removeEventListener('loadstart', handleLoadStart)
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)

      // Clean up HLS.js
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [playbackId, title, autoPlay, onLoadStart, onLoadedData, onPlay, onPause, onEnded, onError])

  // Handle metadata updates for Mux tracking
  useEffect(() => {
    try {
      if (title && playbackId) {
        mux.updateData({
          video_title: title,
          video_id: playbackId
        })
      }
    } catch (error) {
      console.warn('⚠️ Could not update Mux metadata:', error)
    }
  }, [title, playbackId])

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        controls={controls}
        muted={muted}
        playsInline
        poster={poster}
        className="w-full h-full object-contain"
        onContextMenu={(e) => e.preventDefault()} // Disable right-click menu
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
                window.location.reload()
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