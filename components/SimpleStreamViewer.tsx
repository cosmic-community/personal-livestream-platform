'use client'

import { useState, useEffect, useRef } from 'react'
import { SimpleStreamingClient, StreamState } from '@/lib/simple-streaming'

interface SimpleStreamViewerProps {
  serverUrl?: string
  streamId?: string
  onStateChange?: (state: StreamState) => void
}

export default function SimpleStreamViewer({ 
  serverUrl = 'ws://localhost:3001',
  streamId,
  onStateChange 
}: SimpleStreamViewerProps) {
  const [streamState, setStreamState] = useState<StreamState>({
    isConnected: false,
    isStreaming: false,
    viewerCount: 0
  })
  const [error, setError] = useState<string>('')
  const [isInitializing, setIsInitializing] = useState(true)
  const [isWaitingForStream, setIsWaitingForStream] = useState(false)

  const streamingClientRef = useRef<SimpleStreamingClient | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  useEffect(() => {
    initializeViewer()

    return () => {
      cleanup()
    }
  }, [])

  const initializeViewer = async () => {
    try {
      setIsInitializing(true)
      setError('')

      // Create streaming client
      streamingClientRef.current = new SimpleStreamingClient(
        { 
          serverUrl,
          debug: true 
        },
        {
          onStateChange: (state) => {
            setStreamState(state)
            onStateChange?.(state)
            
            if (state.error) {
              setError(state.error)
            }

            // Auto-join stream when it becomes available
            if (state.isConnected && !state.isStreaming && !isWaitingForStream) {
              setIsWaitingForStream(true)
              setTimeout(() => {
                joinStream()
              }, 1000)
            }
          },
          onError: (errorMsg) => {
            setError(errorMsg)
          },
          onViewerCount: (count) => {
            console.log('Viewer count updated:', count)
          }
        }
      )

      // Setup WebRTC offer handler
      if (streamingClientRef.current) {
        const client = streamingClientRef.current as any
        const originalSetupEventListeners = client.setupEventListeners
        
        client.setupEventListeners = function() {
          originalSetupEventListeners.call(this)
          
          if (this.socket) {
            this.socket.on('stream-offer', async (offer: RTCSessionDescriptionInit) => {
              await handleStreamOffer(offer)
            })
          }
        }
      }

      // Connect to server
      const connected = await streamingClientRef.current.connect()
      if (!connected) {
        setError('Failed to connect to streaming server')
      } else {
        // Try to join stream after connection
        setTimeout(() => {
          joinStream()
        }, 1000)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Initialization failed')
    } finally {
      setIsInitializing(false)
    }
  }

  const cleanup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    streamingClientRef.current?.disconnect()
  }

  const joinStream = () => {
    if (!streamingClientRef.current?.isConnected()) {
      setError('Not connected to streaming server')
      return
    }

    try {
      setError('')
      streamingClientRef.current.joinStream(streamId)
      setIsWaitingForStream(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join stream')
    }
  }

  const handleStreamOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      console.log('Received stream offer, setting up peer connection...')

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      })

      peerConnectionRef.current = pc

      // Handle incoming stream
      pc.ontrack = (event) => {
        console.log('Received remote stream')
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0]
          videoRef.current.play().catch(console.error)
          setIsWaitingForStream(false)
        }
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && streamingClientRef.current) {
          streamingClientRef.current.sendIceCandidate(event.candidate)
        }
      }

      // Set remote description and create answer
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      // Send answer back
      if (streamingClientRef.current) {
        streamingClientRef.current.sendAnswer(answer)
      }

    } catch (err) {
      console.error('Error handling stream offer:', err)
      setError('Failed to connect to stream')
    }
  }

  const handleRetryConnection = async () => {
    setError('')
    setIsWaitingForStream(false)
    await initializeViewer()
  }

  const handleJoinStream = () => {
    setError('')
    joinStream()
  }

  if (isInitializing) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Connecting to stream...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              streamState.isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="font-medium">
              {streamState.isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {isWaitingForStream && (
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-sm font-medium">
                Waiting for stream...
              </span>
            )}
          </div>
          
          {streamState.viewerCount > 0 && (
            <div className="text-sm text-gray-600">
              {streamState.viewerCount} viewer{streamState.viewerCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800 font-medium">Error</span>
            </div>
            <div className="flex space-x-2">
              {!streamState.isConnected && (
                <button
                  onClick={handleRetryConnection}
                  className="text-sm text-red-600 underline hover:text-red-800"
                >
                  Retry Connection
                </button>
              )}
              <button
                onClick={() => setError('')}
                className="text-sm text-red-600 underline hover:text-red-800"
              >
                Dismiss
              </button>
            </div>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
        </div>
      )}

      {/* Video Player */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="aspect-video bg-gray-900 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            controls
            className="w-full h-full object-cover"
            poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Crect width='1920' height='1080' fill='%23111827'/%3E%3C/svg%3E"
          />
          
          {/* Waiting Overlay */}
          {isWaitingForStream && (
            <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-lg font-semibold">Waiting for stream...</p>
                <p className="text-sm text-gray-300 mt-2">
                  Stream will appear automatically when broadcasting starts
                </p>
              </div>
            </div>
          )}

          {/* No Stream Overlay */}
          {!isWaitingForStream && !videoRef.current?.srcObject && streamState.isConnected && (
            <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
              <div className="text-center text-white">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                <p className="text-lg font-semibold mb-2">No Active Stream</p>
                <p className="text-sm text-gray-300 mb-4">
                  Waiting for a broadcaster to start streaming...
                </p>
                <button
                  onClick={handleJoinStream}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Check for Stream
                </button>
              </div>
            </div>
          )}

          {/* Live Indicator */}
          {videoRef.current?.srcObject && (
            <div className="absolute top-4 left-4">
              <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span>LIVE</span>
              </span>
            </div>
          )}

          {/* Viewer Count */}
          {streamState.viewerCount > 0 && (
            <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">
                  {streamState.viewerCount} watching
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stream Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Stream Viewer</h3>
            <p className="text-gray-600 text-sm">
              {streamState.isConnected ? 
                'Connected and ready to watch streams' : 
                'Disconnected from streaming server'
              }
            </p>
          </div>
          
          <div className="flex space-x-3">
            {!streamState.isConnected && (
              <button
                onClick={handleRetryConnection}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Reconnect
              </button>
            )}
            
            {streamState.isConnected && !isWaitingForStream && (
              <button
                onClick={handleJoinStream}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Join Stream
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Connection Info */}
      <div className="text-center text-sm text-gray-500">
        <p>Server: {serverUrl}</p>
        {streamState.streamId && (
          <p>Stream ID: {streamState.streamId}</p>
        )}
      </div>
    </div>
  )
}