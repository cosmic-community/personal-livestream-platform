'use client'

import { useState, useEffect, useRef } from 'react'

interface LiveStreamComponentProps {
  isBroadcaster: boolean
  streamId?: string
  roomId?: string
  serverUrl?: string
  onError?: (error: string) => void
  onStateChange?: (state: any) => void
  className?: string
}

export default function LiveStreamComponent({
  isBroadcaster,
  streamId,
  roomId = 'default-room',
  serverUrl = 'ws://localhost:3001',
  onError,
  onStateChange,
  className = ''
}: LiveStreamComponentProps) {
  // State
  const [isConnected, setIsConnected] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)
  const [error, setError] = useState<string>('')
  const [isInitializing, setIsInitializing] = useState(true)

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const localStreamRef = useRef<MediaStream | undefined>(undefined)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)

  // WebRTC Configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  useEffect(() => {
    initializeConnection()
    return () => cleanup()
  }, [])

  const initializeConnection = async () => {
    try {
      setIsInitializing(true)
      setError('')

      // Check WebRTC support
      if (!window.RTCPeerConnection) {
        throw new Error('WebRTC is not supported in your browser')
      }

      // Connect to WebSocket server
      await connectWebSocket()
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize'
      setError(errorMsg)
      onError?.(errorMsg)
    } finally {
      setIsInitializing(false)
    }
  }

  const connectWebSocket = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(serverUrl + '/ws')
        wsRef.current = ws

        ws.onopen = () => {
          console.log('✅ WebSocket connected')
          setIsConnected(true)
          resolve()
        }

        ws.onclose = () => {
          console.log('🔌 WebSocket disconnected')
          setIsConnected(false)
          setIsStreaming(false)
        }

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error)
          reject(new Error('WebSocket connection failed'))
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            handleWebSocketMessage(message)
          } catch (err) {
            console.error('❌ Error parsing WebSocket message:', err)
          }
        }

        // Connection timeout
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket connection timeout'))
          }
        }, 10000)

      } catch (err) {
        reject(err)
      }
    })
  }

  const handleWebSocketMessage = (message: any) => {
    console.log('📨 WebSocket message:', message.type)

    switch (message.type) {
      case 'connected':
        console.log('✅ Server connection confirmed')
        break

      case 'stream-started':
        if (isBroadcaster) {
          setIsStreaming(true)
          console.log('✅ Stream started:', message.sessionId)
        }
        break

      case 'stream-ended':
        setIsStreaming(false)
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null
        }
        break

      case 'viewer-count':
        setViewerCount(message.count)
        break

      case 'stream-joined':
        if (!isBroadcaster) {
          console.log('✅ Joined stream:', message.sessionId)
        }
        break

      case 'error':
        setError(message.message)
        onError?.(message.message)
        break

      default:
        console.log('📨 Unknown message type:', message.type)
    }
  }

  const startStream = async (streamType: 'webcam' | 'screen' = 'webcam') => {
    if (!isBroadcaster || !isConnected) return

    try {
      setError('')
      
      let stream: MediaStream
      if (streamType === 'screen') {
        // Fixed: Use proper MediaStreamConstraints instead of DisplayMediaStreamConstraints
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          } as MediaTrackConstraints,
          audio: true
        })
      } else {
        // Fixed: Proper typing for user media
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        }
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      }

      localStreamRef.current = stream

      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        await localVideoRef.current.play().catch(console.error)
      }

      // Start broadcast via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'start-broadcast',
          streamType,
          timestamp: new Date().toISOString()
        }))
      }

      console.log('✅ Stream started successfully')

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start stream'
      console.error('❌ Stream error:', err)
      setError(errorMsg)
      onError?.(errorMsg)
      throw err
    }
  }

  const stopStream = () => {
    if (!isBroadcaster) return

    try {
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = undefined
      }

      // Clear video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
      }

      // Stop broadcast
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'stop-broadcast',
          timestamp: new Date().toISOString()
        }))
      }

      setIsStreaming(false)
      console.log('✅ Stream stopped')

    } catch (err) {
      console.error('❌ Error stopping stream:', err)
    }
  }

  const joinStream = () => {
    if (isBroadcaster || !isConnected) return

    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'join-stream',
          sessionId: streamId,
          timestamp: new Date().toISOString()
        }))
      }
    } catch (err) {
      console.error('❌ Error joining stream:', err)
    }
  }

  const cleanup = () => {
    console.log('🧹 Cleaning up...')

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = undefined
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  // Loading state
  if (isInitializing) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing live streaming...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="font-medium">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {isBroadcaster && isStreaming && (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-medium">
                LIVE
              </span>
            )}
          </div>
          
          {viewerCount > 0 && (
            <div className="text-sm text-gray-600">
              {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}
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
            <button
              onClick={() => setError('')}
              className="text-sm text-red-600 underline hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
        </div>
      )}

      {/* Broadcaster Controls */}
      {isBroadcaster && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Broadcasting Controls</h2>
          
          {!isStreaming ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => startStream('webcam')}
                  disabled={!isConnected}
                  className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                  <span>Start Webcam</span>
                </button>

                <button
                  onClick={() => startStream('screen')}
                  disabled={!isConnected}
                  className="flex items-center justify-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 8V5h12v7H4z" clipRule="evenodd" />
                  </svg>
                  <span>Start Screen Share</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={stopStream}
                className="flex items-center justify-center space-x-2 bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 mx-auto transition-colors"
              >
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                <span>Stop Stream</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Viewer Controls */}
      {!isBroadcaster && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Stream Viewer</h2>
          <div className="text-center">
            <button
              onClick={joinStream}
              disabled={!isConnected}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Join Stream
            </button>
          </div>
        </div>
      )}

      {/* Video Display */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="aspect-video bg-gray-900 relative">
          {isBroadcaster ? (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              controls
              className="w-full h-full object-cover"
            />
          )}

          {/* Live Indicator */}
          {isStreaming && (
            <div className="absolute top-4 left-4">
              <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span>LIVE</span>
              </span>
            </div>
          )}

          {/* Viewer Count */}
          {viewerCount > 0 && (
            <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
              <span className="text-sm">{viewerCount} watching</span>
            </div>
          )}

          {/* Placeholder when not streaming */}
          {!isStreaming && !isBroadcaster && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                <p className="text-lg font-semibold">No Stream Active</p>
                <p className="text-sm text-gray-300 mt-2">Waiting for a broadcaster...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stream Information */}
      {isStreaming && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Stream Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {viewerCount}
              </div>
              <div className="text-gray-600">Current Viewers</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {isConnected ? 'Online' : 'Offline'}
              </div>
              <div className="text-gray-600">Connection Status</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}