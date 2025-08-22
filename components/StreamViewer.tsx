'use client'

import { useState, useEffect, useRef } from 'react'
import { socketManager } from '@/lib/socket'
import { createPeerConnection, createAnswer, handleIceCandidate } from '@/lib/webrtc'

interface StreamViewerProps {
  streamId?: string
  className?: string
  onViewerCountChange?: (count: number) => void
  onError?: (error: string) => void
}

export default function StreamViewer({
  streamId,
  className = '',
  onViewerCountChange,
  onError
}: StreamViewerProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isWatching, setIsWatching] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [error, setError] = useState<string>('')
  const [streamAvailable, setStreamAvailable] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  useEffect(() => {
    initializeViewer()
    return () => cleanup()
  }, [streamId])

  const initializeViewer = () => {
    try {
      // Connect to signaling server
      const socket = socketManager.connect()
      setIsConnected(socketManager.isConnected())

      // Setup socket listeners
      setupSocketListeners()

      // Auto-join stream if streamId provided
      if (streamId) {
        joinStream(streamId)
      } else {
        // Try to join any available stream
        joinStream()
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize viewer'
      setError(errorMsg)
      onError?.(errorMsg)
    }
  }

  const setupSocketListeners = () => {
    // Connection events
    socketManager.on('connect', () => {
      setIsConnected(true)
      setError('')
    })

    socketManager.on('disconnect', () => {
      setIsConnected(false)
      setIsWatching(false)
      setStreamAvailable(false)
    })

    // Stream events
    socketManager.on('stream-joined', (data: any) => {
      console.log('✅ Successfully joined stream:', data)
      setIsWatching(true)
      setStreamAvailable(true)
      if (data.viewerCount !== undefined) {
        setViewerCount(data.viewerCount)
        onViewerCountChange?.(data.viewerCount)
      }
    })

    socketManager.on('stream-ended', () => {
      console.log('🛑 Stream ended')
      setIsWatching(false)
      setStreamAvailable(false)
      setViewerCount(0)
      onViewerCountChange?.(0)
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    })

    socketManager.on('viewer-count', (data: any) => {
      setViewerCount(data.count)
      onViewerCountChange?.(data.count)
    })

    socketManager.on('stream-available', (data: any) => {
      console.log('📺 New stream available:', data)
      setStreamAvailable(true)
      // Auto-join if not already watching
      if (!isWatching) {
        joinStream(data.sessionId)
      }
    })

    socketManager.on('stream-unavailable', () => {
      console.log('📺 Stream no longer available')
      setStreamAvailable(false)
      setIsWatching(false)
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
    })

    // WebRTC signaling
    socketManager.onStreamOffer(async (data: any) => {
      console.log('📡 Received WebRTC offer')
      await handleOffer(data.offer, data.from)
    })

    socketManager.on('ice-candidate', async (data: any) => {
      console.log('📡 Received ICE candidate')
      if (peerConnectionRef.current) {
        await handleIceCandidate(peerConnectionRef.current, data.candidate)
      }
    })

    socketManager.on('stream-error', (data: any) => {
      console.error('❌ Stream error:', data)
      setError(data.message)
      onError?.(data.message)
    })
  }

  const joinStream = (sessionId?: string) => {
    if (!isConnected) {
      setError('Not connected to server')
      return
    }

    try {
      console.log('🚪 Joining stream...', sessionId || 'any available')
      socketManager.joinStream(sessionId)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to join stream'
      setError(errorMsg)
      onError?.(errorMsg)
    }
  }

  const handleOffer = async (offer: RTCSessionDescriptionInit, fromSocketId: string) => {
    try {
      // Create peer connection for this viewer
      peerConnectionRef.current = createPeerConnection(
        (candidate: RTCIceCandidate) => {
          socketManager.sendIceCandidate(candidate, fromSocketId)
        },
        (state: RTCPeerConnectionState) => {
          console.log('🔗 Peer connection state:', state)
          if (state === 'connected') {
            setError('')
          } else if (state === 'failed' || state === 'disconnected') {
            setError('Connection to stream lost')
          }
        },
        (event: RTCTrackEvent) => {
          console.log('📺 Received remote stream')
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0]
            videoRef.current.play().catch(console.error)
          }
        }
      )

      // Create answer
      const answer = await createAnswer(peerConnectionRef.current, offer)
      socketManager.sendAnswer(answer, fromSocketId)

      console.log('✅ WebRTC connection established')

    } catch (err) {
      console.error('❌ Error handling offer:', err)
      const errorMsg = err instanceof Error ? err.message : 'Failed to establish connection'
      setError(errorMsg)
      onError?.(errorMsg)
    }
  }

  const cleanup = () => {
    console.log('🧹 Cleaning up viewer...')
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    socketManager.off('connect')
    socketManager.off('disconnect')
    socketManager.off('stream-joined')
    socketManager.off('stream-ended')
    socketManager.off('viewer-count')
    socketManager.off('stream-available')
    socketManager.off('stream-unavailable')
    socketManager.off('stream-offer')
    socketManager.off('ice-candidate')
    socketManager.off('stream-error')
  }

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        className="w-full h-full object-cover"
      />

      {/* Connection Status */}
      <div className="absolute top-4 left-4">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
          isConnected 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Live Indicator */}
      {isWatching && streamAvailable && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            LIVE
          </div>
        </div>
      )}

      {/* Viewer Count */}
      {viewerCount > 0 && isWatching && (
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
          <div className="flex items-center gap-1 text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            {viewerCount} watching
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-center text-white max-w-md mx-auto p-6">
            <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-lg font-semibold mb-2">Connection Error</p>
            <p className="text-sm text-gray-300 mb-4">{error}</p>
            <button
              onClick={() => {
                setError('')
                joinStream(streamId)
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* No Stream Overlay */}
      {!isWatching && !error && isConnected && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            </div>
            <p className="text-lg font-semibold mb-2">Waiting for Stream</p>
            <p className="text-sm text-gray-300">
              {streamAvailable ? 'Connecting to stream...' : 'No active streams available'}
            </p>
            {!streamAvailable && (
              <button
                onClick={() => joinStream()}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Check for Streams
              </button>
            )}
          </div>
        </div>
      )}

      {/* Connection Loading */}
      {!isConnected && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-lg font-semibold">Connecting to Stream Server...</p>
          </div>
        </div>
      )}
    </div>
  )
}