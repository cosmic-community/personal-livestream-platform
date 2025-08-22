'use client'

import { useState, useEffect } from 'react'
import { StreamManager } from '@/lib/stream-manager'
import StreamControls from './StreamControls'
import StreamStats from './StreamStats'
import StreamPreview from './StreamPreview'
import ConnectionStatus from './ConnectionStatus'
import { StreamType, BroadcasterState, StreamError, createStreamState } from '@/types'

export default function BroadcasterDashboard() {
  // Fixed: Initialize with proper BroadcasterState structure
  const [streamState, setStreamState] = useState<BroadcasterState>(() => ({
    ...createStreamState(),
    isStreaming: false,
    streamQuality: 'medium',
    currentSession: null,
    mediaStream: null,
    peerConnections: new Map<string, RTCPeerConnection>(),
    stats: {
      totalBytesReceived: 0,
      totalBytesSent: 0,
      packetLoss: 0,
      connectionQuality: 'good',
      averageBitrate: 0,
      frameRate: 0,
      resolution: '720p',
      latency: 0
    },
    errors: []
  }))
  
  const [streamManager] = useState(() => new StreamManager({
    debug: true,
    onStateChange: (state: BroadcasterState) => {
      // Fixed: Return proper BroadcasterState type
      setStreamState(prev => ({
        ...prev,
        ...state,
        // Ensure all required BroadcasterState properties are maintained
        isStreaming: state.isStreaming ?? prev.isStreaming,
        streamQuality: state.streamQuality ?? prev.streamQuality,
        currentSession: state.currentSession ?? prev.currentSession,
        mediaStream: state.mediaStream ?? prev.mediaStream,
        peerConnections: state.peerConnections ?? prev.peerConnections,
        stats: state.stats ?? prev.stats,
        errors: state.errors ?? prev.errors
      }))
    },
    onError: (error: StreamError) => {
      console.error('Stream error:', error)
      setStreamState(prev => ({
        ...prev,
        errors: [...prev.errors, error]
      }))
    }
  }))

  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initializeManager = async () => {
      try {
        // Set up initial state callback
        streamManager.onStateChange((state: BroadcasterState) => {
          setStreamState(state)
        })

        streamManager.onError((error: StreamError) => {
          console.error('Stream Manager Error:', error)
          setStreamState(prev => ({
            ...prev,
            errors: [...prev.errors, error]
          }))
        })

        setIsInitialized(true)
        console.log('🎬 Broadcaster dashboard initialized')

      } catch (error) {
        console.error('Failed to initialize broadcaster dashboard:', error)
        setStreamState(prev => ({
          ...prev,
          errors: [...prev.errors, {
            code: 'INIT_FAILED',
            message: error instanceof Error ? error.message : 'Initialization failed',
            timestamp: new Date().toISOString()
          }]
        }))
      }
    }

    initializeManager()

    return () => {
      streamManager.destroy()
    }
  }, [streamManager])

  const handleStartStream = async (type: StreamType) => {
    try {
      await streamManager.startStream(type)
    } catch (error) {
      console.error('Failed to start stream:', error)
    }
  }

  const handleStopStream = async () => {
    try {
      await streamManager.stopStream()
    } catch (error) {
      console.error('Failed to stop stream:', error)
    }
  }

  const handleToggleWebcam = async () => {
    try {
      await streamManager.toggleWebcam()
    } catch (error) {
      console.error('Failed to toggle webcam:', error)
    }
  }

  const handleToggleScreen = async () => {
    try {
      await streamManager.toggleScreen()
    } catch (error) {
      console.error('Failed to toggle screen share:', error)
    }
  }

  const clearErrors = () => {
    setStreamState(prev => ({
      ...prev,
      errors: []
    }))
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Initializing broadcaster...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Broadcaster Dashboard</h1>
          <p className="text-gray-400">Manage your live stream and monitor performance</p>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <ConnectionStatus 
            isConnected={streamState.isLive}
            connectionState={streamState.isConnecting ? 'connecting' : streamState.isLive ? 'connected' : 'disconnected'}
          />
        </div>

        {/* Error Display */}
        {streamState.errors && streamState.errors.length > 0 && (
          <div className="mb-6 bg-red-900 border border-red-500 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-red-100 font-semibold mb-2">Stream Errors</h3>
                <div className="space-y-2">
                  {streamState.errors.map((error, index) => (
                    <div key={index} className="text-red-200 text-sm">
                      <span className="font-medium">{error.code}:</span> {error.message}
                      <span className="text-red-400 ml-2 text-xs">
                        {new Date(error.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={clearErrors}
                className="text-red-300 hover:text-red-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stream Controls */}
          <div className="bg-gray-800 rounded-lg p-6">
            <StreamControls
              streamState={streamState}
              onStartStream={handleStartStream}
              onStopStream={handleStopStream}
              onToggleWebcam={handleToggleWebcam}
              onToggleScreen={handleToggleScreen}
            />
          </div>

          {/* Stream Preview */}
          <div className="bg-gray-800 rounded-lg p-6">
            <StreamPreview
              stream={streamState.mediaStream}
              isLive={streamState.isLive}
              streamType={streamState.streamType}
            />
          </div>

          {/* Stream Statistics */}
          <div className="bg-gray-800 rounded-lg p-6 lg:col-span-2">
            <StreamStats
              session={streamState.currentSession}
              isLive={streamState.isLive}
              viewerCount={streamState.viewerCount}
              stats={streamState.stats}
            />
          </div>
        </div>
      </div>
    </div>
  )
}