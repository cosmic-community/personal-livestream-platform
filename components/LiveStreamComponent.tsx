'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { StreamType, StreamError, StreamState } from '@/types'
import { socketManager } from '@/lib/socket'
import { 
  getUserMediaStream, 
  createPeerConnection, 
  createOffer, 
  createAnswer, 
  handleIceCandidate,
  stopMediaStream,
  checkWebRTCSupport
} from '@/lib/webrtc'

interface LiveStreamComponentProps {
  isBroadcaster: boolean
  streamId?: string
  roomId?: string
  serverUrl?: string
  onError?: (error: StreamError) => void
  onStateChange?: (state: StreamState) => void
  className?: string
}

interface PeerConnection {
  pc: RTCPeerConnection
  id: string
  isOfferer: boolean
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
  // State management
  const [isInitialized, setIsInitialized] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [currentStreamType, setCurrentStreamType] = useState<StreamType>('webcam')
  const [viewerCount, setViewerCount] = useState(0)
  const [error, setError] = useState<StreamError | null>(null)
  const [isWebRTCSupported, setIsWebRTCSupported] = useState(true)
  const [roomIdInput, setRoomIdInput] = useState(roomId)
  const [isWaitingForStream, setIsWaitingForStream] = useState(false)

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map())
  const isInitializingRef = useRef(false)

  // Initialize component
  useEffect(() => {
    initializeComponent()
    return () => cleanup()
  }, [])

  // Handle connection state changes
  useEffect(() => {
    if (isConnected && isBroadcaster) {
      joinRoom(roomIdInput)
    } else if (isConnected && !isBroadcaster) {
      joinRoom(roomIdInput)
      setIsWaitingForStream(true)
    }
  }, [isConnected, roomIdInput])

  // Emit state changes
  useEffect(() => {
    const state: StreamState = {
      isLive: isStreaming,
      isConnecting: !isConnected && isInitialized,
      streamType: currentStreamType,
      webcamEnabled: currentStreamType === 'webcam' || currentStreamType === 'both',
      screenEnabled: currentStreamType === 'screen' || currentStreamType === 'both',
      viewerCount,
      sessionId: roomIdInput,
      error: error?.message
    }
    onStateChange?.(state)
  }, [isStreaming, isConnected, isInitialized, currentStreamType, viewerCount, error, roomIdInput])

  const initializeComponent = async () => {
    if (isInitializingRef.current) return
    isInitializingRef.current = true

    try {
      console.log('🚀 Initializing LiveStreamComponent', { isBroadcaster, roomId })

      // Check WebRTC support
      const supported = checkWebRTCSupport()
      setIsWebRTCSupported(supported)

      if (!supported) {
        const error: StreamError = {
          code: 'WEBRTC_NOT_SUPPORTED',
          message: 'WebRTC is not supported in your browser. Please use Chrome, Firefox, or Safari.',
          timestamp: new Date().toISOString()
        }
        setError(error)
        onError?.(error)
        return
      }

      // Connect to signaling server
      await connectToServer()
      setIsInitialized(true)

    } catch (err) {
      console.error('❌ Component initialization failed:', err)
      const error: StreamError = {
        code: 'INITIALIZATION_FAILED',
        message: err instanceof Error ? err.message : 'Failed to initialize streaming component',
        timestamp: new Date().toISOString()
      }
      setError(error)
      onError?.(error)
    } finally {
      isInitializingRef.current = false
    }
  }

  const connectToServer = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting to signaling server...')

        // Connect socket
        const socket = socketManager.connect()

        if (socketManager.isConnected()) {
          setIsConnected(true)
          setupSignalingListeners()
          resolve()
          return
        }

        // Wait for connection
        const connectionTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'))
        }, 10000)

        const handleConnect = () => {
          clearTimeout(connectionTimeout)
          setIsConnected(true)
          setupSignalingListeners()
          console.log('✅ Connected to signaling server')
          resolve()
        }

        const handleError = (error: any) => {
          clearTimeout(connectionTimeout)
          console.error('❌ Connection failed:', error)
          reject(error)
        }

        socketManager.on('connect', handleConnect)
        socketManager.on('connect_error', handleError)

      } catch (err) {
        reject(err)
      }
    })
  }

  const setupSignalingListeners = () => {
    console.log('📡 Setting up signaling listeners...')

    // Handle WebRTC offers (for viewers)
    socketManager.onStreamOffer(async (data) => {
      if (isBroadcaster) return // Broadcasters don't handle offers
      
      console.log('📥 Received stream offer:', data)
      const { offer, from } = data
      await handleOffer(offer, from)
    })

    // Handle WebRTC answers (for broadcasters)
    socketManager.onStreamAnswer(async (data) => {
      if (!isBroadcaster) return // Viewers don't handle answers
      
      console.log('📥 Received stream answer:', data)
      const { answer, from } = data
      await handleAnswer(answer, from)
    })

    // Handle ICE candidates
    socketManager.onIceCandidate(async (data) => {
      console.log('📥 Received ICE candidate:', data)
      const { candidate, from } = data
      await handleRemoteIceCandidate(candidate, from)
    })

    // Handle viewer count updates
    socketManager.onViewerCount((count) => {
      console.log('👥 Viewer count updated:', count)
      setViewerCount(count)
    })

    // Handle peer events
    socketManager.on('peer-joined', (data) => {
      console.log('👤 Peer joined:', data)
      if (isBroadcaster && isStreaming) {
        // Send offer to new viewer
        sendOfferToPeer(data.peerId)
      }
    })

    socketManager.on('peer-left', (data) => {
      console.log('👤 Peer left:', data)
      removePeerConnection(data.peerId)
    })

    // Handle stream events
    socketManager.onStreamStarted((data) => {
      console.log('🎬 Stream started:', data)
      if (!isBroadcaster) {
        setIsWaitingForStream(false)
        // Stream is available, try to join
        requestStreamFromBroadcaster()
      }
    })

    socketManager.onStreamEnded((data) => {
      console.log('🛑 Stream ended:', data)
      if (!isBroadcaster) {
        setIsWaitingForStream(true)
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null
        }
      }
    })

    socketManager.onStreamError((error) => {
      console.error('❌ Stream error:', error)
      const streamError: StreamError = {
        code: error.code || 'STREAM_ERROR',
        message: error.message || 'Stream error occurred',
        timestamp: new Date().toISOString()
      }
      setError(streamError)
      onError?.(streamError)
    })
  }

  const startStream = async (streamType: StreamType = 'webcam') => {
    if (!isBroadcaster) {
      console.warn('⚠️ Only broadcasters can start streams')
      return
    }

    if (!isConnected) {
      throw new Error('Not connected to signaling server')
    }

    try {
      console.log('🎬 Starting stream with type:', streamType)
      setError(null)
      setCurrentStreamType(streamType)

      // Get media stream
      const stream = await getUserMediaStream(
        streamType === 'screen' ? 'screen' : 'webcam'
      )
      
      localStreamRef.current = stream
      setIsStreaming(true)

      // Display local stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        localVideoRef.current.play().catch(console.error)
      }

      // Notify server about stream start
      await socketManager.startBroadcast(streamType)

      console.log('✅ Stream started successfully')

    } catch (err) {
      console.error('❌ Failed to start stream:', err)
      const error: StreamError = {
        code: 'STREAM_START_FAILED',
        message: err instanceof Error ? err.message : 'Failed to start stream',
        timestamp: new Date().toISOString()
      }
      setError(error)
      onError?.(error)
      throw error
    }
  }

  const stopStream = async () => {
    if (!isBroadcaster) return

    try {
      console.log('🛑 Stopping stream...')

      // Stop local stream
      if (localStreamRef.current) {
        stopMediaStream(localStreamRef.current)
        localStreamRef.current = null
      }

      // Close all peer connections
      peerConnectionsRef.current.forEach((peerConn) => {
        peerConn.pc.close()
      })
      peerConnectionsRef.current.clear()

      // Clear video elements
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
      }

      // Notify server
      socketManager.stopBroadcast()

      setIsStreaming(false)
      setViewerCount(0)

      console.log('✅ Stream stopped successfully')

    } catch (err) {
      console.error('❌ Failed to stop stream:', err)
      const error: StreamError = {
        code: 'STREAM_STOP_FAILED',
        message: err instanceof Error ? err.message : 'Failed to stop stream',
        timestamp: new Date().toISOString()
      }
      setError(error)
      onError?.(error)
    }
  }

  const joinRoom = (room: string) => {
    if (!isConnected) return

    console.log('🚪 Joining room:', room)
    const socket = socketManager.connect()
    if (socket) {
      socket.emit('join-room', { roomId: room })
    }
  }

  const requestStreamFromBroadcaster = () => {
    if (isBroadcaster) return

    console.log('📺 Requesting stream from broadcaster...')
    const socket = socketManager.connect()
    if (socket) {
      socket.emit('request-stream', { roomId: roomIdInput })
    }
  }

  const sendOfferToPeer = async (peerId: string) => {
    if (!localStreamRef.current) return

    try {
      console.log('📤 Sending offer to peer:', peerId)

      const peerConnection = createPeerConnection(
        (candidate) => {
          socketManager.sendIceCandidate(candidate, peerId)
        },
        (state) => {
          console.log('🔗 Peer connection state:', state, 'for peer:', peerId)
        }
      )

      // Store peer connection
      peerConnectionsRef.current.set(peerId, {
        pc: peerConnection,
        id: peerId,
        isOfferer: true
      })

      // Create and send offer
      const offer = await createOffer(peerConnection, localStreamRef.current)
      socketManager.sendOffer(offer, peerId)

    } catch (err) {
      console.error('❌ Failed to send offer to peer:', peerId, err)
    }
  }

  const handleOffer = async (offer: RTCSessionDescriptionInit, from: string) => {
    if (isBroadcaster) return

    try {
      console.log('📥 Handling offer from:', from)

      const peerConnection = createPeerConnection(
        (candidate) => {
          socketManager.sendIceCandidate(candidate, from)
        },
        (state) => {
          console.log('🔗 Peer connection state:', state, 'from:', from)
        },
        (event) => {
          console.log('📺 Received remote stream from:', from)
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0]
            remoteVideoRef.current.play().catch(console.error)
            setIsWaitingForStream(false)
          }
        }
      )

      // Store peer connection
      peerConnectionsRef.current.set(from, {
        pc: peerConnection,
        id: from,
        isOfferer: false
      })

      // Create and send answer
      const answer = await createAnswer(peerConnection, offer)
      socketManager.sendAnswer(answer, from)

    } catch (err) {
      console.error('❌ Failed to handle offer from:', from, err)
    }
  }

  const handleAnswer = async (answer: RTCSessionDescriptionInit, from: string) => {
    if (!isBroadcaster) return

    try {
      console.log('📥 Handling answer from:', from)

      const peerConn = peerConnectionsRef.current.get(from)
      if (peerConn) {
        await peerConn.pc.setRemoteDescription(new RTCSessionDescription(answer))
        console.log('✅ Remote description set for:', from)
      }

    } catch (err) {
      console.error('❌ Failed to handle answer from:', from, err)
    }
  }

  const handleRemoteIceCandidate = async (candidate: RTCIceCandidateInit, from: string) => {
    try {
      const peerConn = peerConnectionsRef.current.get(from)
      if (peerConn) {
        await handleIceCandidate(peerConn.pc, candidate)
      }
    } catch (err) {
      console.error('❌ Failed to handle ICE candidate from:', from, err)
    }
  }

  const removePeerConnection = (peerId: string) => {
    const peerConn = peerConnectionsRef.current.get(peerId)
    if (peerConn) {
      peerConn.pc.close()
      peerConnectionsRef.current.delete(peerId)
      console.log('🗑️ Removed peer connection:', peerId)
    }
  }

  const cleanup = () => {
    console.log('🧹 Cleaning up LiveStreamComponent...')

    // Stop streams
    if (localStreamRef.current) {
      stopMediaStream(localStreamRef.current)
      localStreamRef.current = null
    }

    // Close peer connections
    peerConnectionsRef.current.forEach((peerConn) => {
      peerConn.pc.close()
    })
    peerConnectionsRef.current.clear()

    // Disconnect socket
    socketManager.disconnect()

    setIsStreaming(false)
    setIsConnected(false)
  }

  const clearError = () => {
    setError(null)
  }

  // Render loading state
  if (!isInitialized || !isWebRTCSupported) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="max-w-2xl mx-auto text-center">
          {!isWebRTCSupported ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="text-red-600 mb-4">
                <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-red-800 mb-2">WebRTC Not Supported</h2>
              <p className="text-red-700">
                Your browser doesn't support WebRTC live streaming. Please use Chrome, Firefox, or Safari.
              </p>
            </div>
          ) : (
            <div className="py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Initializing live streaming...</p>
            </div>
          )}
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
            {!isBroadcaster && isWaitingForStream && (
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-sm font-medium">
                Waiting for stream...
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
              onClick={clearError}
              className="text-sm text-red-600 underline hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
          <p className="text-red-700 mt-2">{error.message}</p>
        </div>
      )}

      {/* Room ID Input */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {isBroadcaster ? 'Stream ID / Room ID' : 'Join Stream ID / Room ID'}
        </label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
            placeholder="Enter room ID or stream ID"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isStreaming}
          />
          {!isStreaming && (
            <button
              onClick={() => joinRoom(roomIdInput)}
              disabled={!isConnected || !roomIdInput.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isBroadcaster ? 'Set Room' : 'Join Room'}
            </button>
          )}
        </div>
      </div>

      {/* Broadcaster Controls */}
      {isBroadcaster && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Broadcasting Controls</h2>
          
          {!isStreaming ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => startStream('webcam')}
                  disabled={!isConnected}
                  className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                  <span>Start with Webcam</span>
                </button>

                <button
                  onClick={() => startStream('screen')}
                  disabled={!isConnected}
                  className="flex items-center justify-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 8V5h12v7H4z" clipRule="evenodd" />
                  </svg>
                  <span>Start with Screen</span>
                </button>

                <button
                  onClick={() => startStream('both')}
                  disabled={!isConnected}
                  className="flex items-center justify-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                  <span>Start with Both</span>
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

          {/* Waiting Overlay for Viewers */}
          {!isBroadcaster && isWaitingForStream && (
            <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-lg font-semibold">Waiting for stream...</p>
                <p className="text-sm text-gray-300 mt-2">
                  Stream will appear when broadcasting starts
                </p>
                <button
                  onClick={requestStreamFromBroadcaster}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Check for Stream
                </button>
              </div>
            </div>
          )}

          {/* Live Indicator */}
          {((isBroadcaster && isStreaming) || (!isBroadcaster && !isWaitingForStream)) && (
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
        </div>
      </div>

      {/* Stream Information */}
      {(isStreaming || viewerCount > 0) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            {isBroadcaster ? 'Stream Information' : 'Viewing Information'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {viewerCount}
              </div>
              <div className="text-gray-600">
                {isBroadcaster ? 'Current Viewers' : 'Total Viewers'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {currentStreamType.toUpperCase()}
              </div>
              <div className="text-gray-600">Stream Type</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">
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