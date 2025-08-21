'use client'

import { useState, useEffect, useRef } from 'react'
import { ViewerState, StreamSession } from '@/types'
import { socketManager } from '@/lib/socket'
import { createPeerConnection, createAnswer, handleIceCandidate } from '@/lib/webrtc'

interface StreamViewerProps {
  initialSession: StreamSession | null
}

export default function StreamViewer({ initialSession }: StreamViewerProps) {
  const [viewerState, setViewerState] = useState<ViewerState>({
    isConnected: false,
    isConnecting: false,
    streamAvailable: !!initialSession,
    viewerCount: 0,
    streamQuality: 'auto'
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const [currentSession, setCurrentSession] = useState<StreamSession | null>(initialSession)
  const reconnectAttemptRef = useRef<number>(0)
  const maxReconnectAttempts = 5

  useEffect(() => {
    // Initialize viewer
    initializeViewer()

    return () => {
      handleDisconnect()
      socketManager.disconnect()
    }
  }, [])

  const initializeViewer = async () => {
    try {
      console.log('🔌 Initializing stream viewer...')
      
      // Connect socket
      const socket = socketManager.connect()

      // Setup socket event listeners
      setupSocketEventListeners()

      // Join stream if available
      if (initialSession) {
        await handleJoinStream()
      } else {
        // Wait for stream to become available
        setViewerState((prev: ViewerState) => ({
          ...prev,
          isConnecting: false,
          streamAvailable: false
        }))
      }

    } catch (error) {
      console.error('❌ Failed to initialize viewer:', error)
      setViewerState((prev: ViewerState) => ({
        ...prev,
        error: 'Failed to initialize viewer. Please refresh the page.',
        isConnecting: false
      }))
    }
  }

  const setupSocketEventListeners = () => {
    // Clear existing listeners
    socketManager.off('stream-started')
    socketManager.off('stream-ended')
    socketManager.off('viewer-count')
    socketManager.off('stream-offer')
    socketManager.off('ice-candidate')
    socketManager.off('stream-error')

    // Setup new listeners
    socketManager.onStreamStarted((data) => {
      console.log('✅ Stream started, joining...', data)
      setCurrentSession({ id: data.sessionId } as StreamSession)
      setViewerState((prev: ViewerState) => ({
        ...prev,
        streamAvailable: true,
        error: undefined
      }))
      handleJoinStream()
    })

    socketManager.onStreamEnded(() => {
      console.log('🛑 Stream ended')
      handleStreamEnded()
    })

    socketManager.onViewerCount((count) => {
      setViewerState((prev: ViewerState) => ({ ...prev, viewerCount: count }))
    })

    socketManager.onStreamOffer(async (offer) => {
      console.log('📥 Received stream offer')
      await handleStreamOffer(offer)
    })

    socketManager.onIceCandidate(async (candidate: RTCIceCandidateInit) => {
      if (peerConnectionRef.current) {
        await handleIceCandidate(peerConnectionRef.current, candidate)
      }
    })

    socketManager.onStreamError((error) => {
      console.error('❌ Stream error:', error)
      setViewerState((prev: ViewerState) => ({
        ...prev,
        error: error.message || 'Stream error occurred',
        isConnecting: false
      }))
    })
  }

  const handleJoinStream = async () => {
    if (!viewerState.streamAvailable && !currentSession) {
      console.log('⚠️ No stream available to join')
      return
    }

    try {
      console.log('🚀 Joining stream...')
      setViewerState((prev: ViewerState) => ({
        ...prev,
        isConnecting: true,
        error: undefined
      }))

      // Check socket connection
      if (!socketManager.isConnected()) {
        throw new Error('Not connected to streaming server')
      }

      // Emit join stream event
      const socket = socketManager.connect()
      if (socket?.connected || socketManager.isFallbackMode()) {
        socket.emit('join-stream', {
          sessionId: currentSession?.id,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        })
        console.log('📡 Join stream event sent')
      } else {
        throw new Error('Socket not connected')
      }

      // Set timeout for join response
      setTimeout(() => {
        if (viewerState.isConnecting && !viewerState.isConnected) {
          console.warn('⏱️ Join stream timeout')
          setViewerState((prev: ViewerState) => ({
            ...prev,
            error: 'Failed to join stream - timeout. Retrying...',
            isConnecting: false
          }))
          
          // Retry join
          if (reconnectAttemptRef.current < maxReconnectAttempts) {
            reconnectAttemptRef.current++
            setTimeout(() => handleJoinStream(), 2000)
          }
        }
      }, 10000) // 10 second timeout

    } catch (error) {
      console.error('❌ Error joining stream:', error)
      setViewerState((prev: ViewerState) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to join stream',
        isConnecting: false
      }))
    }
  }

  const handleStreamOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      console.log('📥 Processing stream offer...')

      // Clean up existing peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
        peerConnectionRef.current = null
      }

      // Create new peer connection
      const peerConnection = createPeerConnection(
        (candidate: RTCIceCandidate) => {
          console.log('🧊 Sending ICE candidate')
          socketManager.sendIceCandidate(candidate, socketManager.getSocketId())
        },
        (state: RTCPeerConnectionState) => {
          console.log('🔗 Connection state changed:', state)
          if (state === 'connected') {
            setViewerState((prev: ViewerState) => ({
              ...prev,
              isConnected: true,
              isConnecting: false,
              error: undefined
            }))
            reconnectAttemptRef.current = 0 // Reset reconnect attempts
          } else if (state === 'disconnected') {
            console.warn('⚠️ Peer connection disconnected')
            setViewerState((prev: ViewerState) => ({
              ...prev,
              isConnected: false,
              error: 'Connection lost. Attempting to reconnect...'
            }))
            
            // Attempt to rejoin
            setTimeout(() => {
              if (reconnectAttemptRef.current < maxReconnectAttempts) {
                reconnectAttemptRef.current++
                handleJoinStream()
              } else {
                setViewerState((prev: ViewerState) => ({
                  ...prev,
                  error: 'Connection lost. Please refresh to retry.'
                }))
              }
            }, 3000)
          } else if (state === 'failed') {
            console.error('❌ Peer connection failed')
            setViewerState((prev: ViewerState) => ({
              ...prev,
              isConnected: false,
              error: 'Connection failed. Retrying...'
            }))
            
            // Attempt to rejoin after a delay
            setTimeout(() => {
              if (reconnectAttemptRef.current < maxReconnectAttempts) {
                reconnectAttemptRef.current++
                handleJoinStream()
              }
            }, 5000)
          }
        },
        (event: RTCTrackEvent) => {
          // Handle incoming stream
          console.log('📺 Received remote stream')
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0]
            videoRef.current.play().catch(console.error)
            
            // Update stream quality based on received stream
            const videoTrack = event.streams[0].getVideoTracks()[0]
            if (videoTrack) {
              const settings = videoTrack.getSettings()
              console.log('📺 Stream settings:', settings)
            }
          }
        }
      )

      peerConnectionRef.current = peerConnection

      // Create answer
      const answer = await createAnswer(peerConnection, offer)
      
      // Send answer back
      socketManager.sendAnswer(answer, socketManager.getSocketId() || '')
      
      console.log('✅ Stream offer processed successfully')

    } catch (error) {
      console.error('❌ Error handling stream offer:', error)
      setViewerState((prev: ViewerState) => ({
        ...prev,
        error: 'Failed to connect to stream. Please try refreshing.',
        isConnecting: false
      }))
    }
  }

  const handleStreamEnded = () => {
    console.log('🛑 Handling stream end...')
    
    // Clean up peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    // Clear video
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    // Reset state
    setViewerState({
      isConnected: false,
      isConnecting: false,
      streamAvailable: false,
      viewerCount: 0,
      streamQuality: 'auto'
    })
    setCurrentSession(null)
    reconnectAttemptRef.current = 0
  }

  const handleDisconnect = () => {
    console.log('🔌 Disconnecting viewer...')
    
    // Emit leave stream event
    const socket = socketManager.connect()
    if (socket?.connected || socketManager.isFallbackMode()) {
      socket.emit('leave-stream', {
        sessionId: currentSession?.id,
        timestamp: new Date().toISOString()
      })
    }
    
    handleStreamEnded()
  }

  const handleRetryConnection = () => {
    console.log('🔄 Manual retry requested')
    reconnectAttemptRef.current = 0
    setViewerState((prev: ViewerState) => ({ ...prev, error: undefined }))
    
    if (currentSession || viewerState.streamAvailable) {
      handleJoinStream()
    } else {
      // Try to reconnect socket
      socketManager.forceReconnect()
      setTimeout(() => {
        initializeViewer()
      }, 2000)
    }
  }

  const handleRefreshPage = () => {
    window.location.reload()
  }

  // Show waiting state when no stream is available
  if (!viewerState.streamAvailable && !viewerState.isConnecting && !currentSession) {
    return (
      <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-pulse mb-4">
            <div className="w-16 h-16 bg-gray-700 rounded-full mx-auto flex items-center justify-center">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2">Waiting for Stream</h3>
          <p className="text-gray-400 mb-4">
            No stream is currently active. This page will automatically connect when broadcasting starts.
          </p>
          <button
            onClick={handleRetryConnection}
            className="btn btn-sm btn-outline text-gray-300 border-gray-600 hover:bg-gray-800"
          >
            Check Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Video Player */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          controls
          muted={false}
          className="w-full aspect-video"
          poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Crect width='1920' height='1080' fill='%23111827'/%3E%3Ctext x='50%25' y='50%25' font-family='system-ui' font-size='48' fill='%23374151' text-anchor='middle' dy='0.35em'%3EConnecting to stream...%3C/text%3E%3C/svg%3E"
        />
        
        {/* Connection Status Overlay */}
        {viewerState.isConnecting && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg font-semibold">Connecting to stream...</p>
              <p className="text-sm text-gray-300 mt-2">
                Attempt {reconnectAttemptRef.current + 1} of {maxReconnectAttempts}
              </p>
            </div>
          </div>
        )}

        {/* Live Indicator */}
        {viewerState.isConnected && (
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-red-600 text-white">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              LIVE
            </span>
          </div>
        )}

        {/* Viewer Count */}
        {viewerState.isConnected && (
          <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">
                {viewerState.viewerCount} viewer{viewerState.viewerCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* Connection Quality Indicator */}
        {viewerState.isConnected && (
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            Quality: {viewerState.streamQuality}
          </div>
        )}
      </div>

      {/* Error State */}
      {viewerState.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-800">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Connection Error</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRetryConnection}
                className="text-sm text-red-600 underline hover:text-red-800"
              >
                Retry
              </button>
              {reconnectAttemptRef.current >= maxReconnectAttempts && (
                <button
                  onClick={handleRefreshPage}
                  className="text-sm text-red-600 underline hover:text-red-800"
                >
                  Refresh
                </button>
              )}
            </div>
          </div>
          <p className="text-red-700 mt-2 text-sm">{viewerState.error}</p>
          {reconnectAttemptRef.current > 0 && (
            <p className="text-red-600 mt-1 text-xs">
              Reconnection attempts: {reconnectAttemptRef.current}/{maxReconnectAttempts}
            </p>
          )}
        </div>
      )}

      {/* Stream Info */}
      {viewerState.isConnected && currentSession && (
        <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <div className="flex items-center justify-between text-white">
            <div>
              <h3 className="font-semibold">Live Stream Active</h3>
              <p className="text-gray-400 text-sm">
                Started {new Date(currentSession.metadata?.start_time || Date.now()).toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Connection Status Info */}
      <div className="text-sm text-gray-500 text-center">
        {socketManager.isFallbackMode() && (
          <p className="text-yellow-600">
            ⚠️ Running in offline mode - limited functionality
          </p>
        )}
        {!socketManager.isConnected() && !socketManager.isFallbackMode() && (
          <p className="text-red-600">
            ❌ Not connected to streaming server
          </p>
        )}
        {socketManager.isConnected() && !socketManager.isFallbackMode() && (
          <p className="text-green-600">
            ✅ Connected to streaming server
          </p>
        )}
      </div>
    </div>
  )
}