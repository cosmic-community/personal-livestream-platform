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

  useEffect(() => {
    // Connect socket
    const socket = socketManager.connect()

    // Join stream if available
    if (initialSession) {
      handleJoinStream()
    }

    // Setup socket event listeners
    socketManager.onStreamStarted((data) => {
      setCurrentSession({ id: data.sessionId } as StreamSession)
      setViewerState(prev => ({
        ...prev,
        streamAvailable: true
      }))
      handleJoinStream()
    })

    socketManager.onStreamEnded(() => {
      handleStreamEnded()
    })

    socketManager.onViewerCount((count) => {
      setViewerState(prev => ({ ...prev, viewerCount: count }))
    })

    socketManager.onStreamOffer(async (offer) => {
      await handleStreamOffer(offer)
    })

    socketManager.onIceCandidate(async (candidate) => {
      if (peerConnectionRef.current) {
        await handleIceCandidate(peerConnectionRef.current, candidate)
      }
    })

    socketManager.onStreamError((error) => {
      setViewerState(prev => ({
        ...prev,
        error: error.message || 'Stream error occurred',
        isConnecting: false
      }))
    })

    return () => {
      handleDisconnect()
      socketManager.disconnect()
    }
  }, [])

  const handleJoinStream = () => {
    if (!viewerState.streamAvailable) return

    setViewerState(prev => ({
      ...prev,
      isConnecting: true,
      error: undefined
    }))

    // Emit join stream event directly since there's no joinStream method
    const socket = socketManager.connect()
    if (socket?.connected) {
      socket.emit('join-stream')
    }
  }

  const handleStreamOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      // Create peer connection
      const peerConnection = createPeerConnection(
        (candidate) => {
          socketManager.sendIceCandidate(candidate)
        },
        (state) => {
          console.log('Connection state:', state)
          if (state === 'connected') {
            setViewerState(prev => ({
              ...prev,
              isConnected: true,
              isConnecting: false
            }))
          } else if (state === 'disconnected' || state === 'failed') {
            handleStreamEnded()
          }
        },
        (event) => {
          // Handle incoming stream
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0]
            videoRef.current.play().catch(console.error)
          }
        }
      )

      peerConnectionRef.current = peerConnection

      // Create answer
      const answer = await createAnswer(peerConnection, offer)
      // Use the correct method name from SocketManager
      socketManager.sendAnswer(answer, socketManager.getSocketId() || '')

    } catch (error) {
      console.error('Error handling stream offer:', error)
      setViewerState(prev => ({
        ...prev,
        error: 'Failed to connect to stream',
        isConnecting: false
      }))
    }
  }

  const handleStreamEnded = () => {
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
  }

  const handleDisconnect = () => {
    // Emit leave stream event directly since there's no leaveStream method
    const socket = socketManager.connect()
    if (socket?.connected) {
      socket.emit('leave-stream')
    }
    handleStreamEnded()
  }

  const handleRetryConnection = () => {
    handleJoinStream()
  }

  if (!viewerState.streamAvailable && !viewerState.isConnecting) {
    return (
      <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center text-white">
          <div className="loading-spinner mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Waiting for Stream</h3>
          <p className="text-gray-400">
            No stream is currently active. This page will automatically connect when broadcasting starts.
          </p>
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
          className="w-full aspect-video"
          poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Crect width='1920' height='1080' fill='%23111827'/%3E%3C/svg%3E"
        />
        
        {/* Stream Status Overlay */}
        {viewerState.isConnecting && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="loading-spinner mx-auto mb-4"></div>
              <p>Connecting to stream...</p>
            </div>
          </div>
        )}

        {/* Live Indicator */}
        {viewerState.isConnected && (
          <div className="absolute top-4 left-4">
            <span className="status-badge status-live flex items-center gap-2">
              <div className="live-indicator"></div>
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
      </div>

      {/* Error State */}
      {viewerState.error && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-800">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Connection Error</span>
            </div>
            <button
              onClick={handleRetryConnection}
              className="btn btn-sm btn-outline"
            >
              Retry
            </button>
          </div>
          <p className="text-red-700 mt-2">{viewerState.error}</p>
        </div>
      )}

      {/* Stream Info */}
      {viewerState.isConnected && currentSession && (
        <div className="card bg-gray-800 border-gray-700">
          <div className="flex items-center justify-between text-white">
            <div>
              <h3 className="font-semibold">Live Stream</h3>
              <p className="text-gray-400 text-sm">
                Started {new Date(currentSession.metadata?.start_time || Date.now()).toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              className="btn btn-sm btn-outline text-gray-400 border-gray-600 hover:bg-gray-700"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}