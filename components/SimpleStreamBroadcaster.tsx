'use client'

import { useState, useEffect, useRef } from 'react'
import { SimpleStreamingClient, StreamState } from '@/lib/simple-streaming'
import { MediaHandler } from '@/lib/media-handler'

interface SimpleStreamBroadcasterProps {
  serverUrl?: string
  onStateChange?: (state: StreamState) => void
}

export default function SimpleStreamBroadcaster({ 
  serverUrl = 'ws://localhost:3001',
  onStateChange 
}: SimpleStreamBroadcasterProps) {
  const [streamState, setStreamState] = useState<StreamState>({
    isConnected: false,
    isStreaming: false,
    viewerCount: 0
  })
  const [error, setError] = useState<string>('')
  const [isInitializing, setIsInitializing] = useState(true)

  const streamingClientRef = useRef<SimpleStreamingClient | null>(null)
  const mediaHandlerRef = useRef<MediaHandler>(new MediaHandler())
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const currentStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    initializeStreaming()

    return () => {
      cleanup()
    }
  }, [])

  const initializeStreaming = async () => {
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
          },
          onError: (errorMsg) => {
            setError(errorMsg)
          },
          onViewerCount: (count) => {
            console.log('Viewer count updated:', count)
          }
        }
      )

      // Connect to server
      const connected = await streamingClientRef.current.connect()
      if (!connected) {
        setError('Failed to connect to streaming server')
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Initialization failed')
    } finally {
      setIsInitializing(false)
    }
  }

  const cleanup = () => {
    if (currentStreamRef.current) {
      mediaHandlerRef.current.stopStream(currentStreamRef.current)
      currentStreamRef.current = null
    }
    
    mediaHandlerRef.current.stopAllStreams()
    streamingClientRef.current?.disconnect()
  }

  const startStream = async (streamType: 'webcam' | 'screen' | 'both') => {
    try {
      setError('')

      if (!streamingClientRef.current?.isConnected()) {
        throw new Error('Not connected to streaming server')
      }

      // Get media stream
      let stream: MediaStream

      switch (streamType) {
        case 'webcam':
          stream = await mediaHandlerRef.current.getWebcamStream()
          break
        case 'screen':
          stream = await mediaHandlerRef.current.getScreenStream()
          break
        case 'both':
          stream = await mediaHandlerRef.current.getCombinedStream(true, true)
          break
        default:
          throw new Error('Invalid stream type')
      }

      currentStreamRef.current = stream

      // Show preview
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream
        await previewVideoRef.current.play()
      }

      // Start broadcast
      const success = await streamingClientRef.current.startBroadcast(streamType)
      if (!success) {
        throw new Error('Failed to start broadcast')
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start stream'
      setError(errorMessage)
      console.error('Stream start error:', err)
    }
  }

  const stopStream = () => {
    try {
      streamingClientRef.current?.stopBroadcast()

      if (currentStreamRef.current) {
        mediaHandlerRef.current.stopStream(currentStreamRef.current)
        currentStreamRef.current = null
      }

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = null
      }

    } catch (err) {
      console.error('Stop stream error:', err)
    }
  }

  const handleRetryConnection = async () => {
    setError('')
    await initializeStreaming()
  }

  if (isInitializing) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Initializing streaming system...</p>
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
            {streamState.isStreaming && (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-medium">
                LIVE
              </span>
            )}
          </div>
          
          {streamState.isStreaming && (
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

      {/* Stream Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Broadcasting Controls</h2>
        
        {!streamState.isStreaming ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => startStream('webcam')}
                disabled={!streamState.isConnected}
                className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                <span>Start with Webcam</span>
              </button>

              <button
                onClick={() => startStream('screen')}
                disabled={!streamState.isConnected}
                className="flex items-center justify-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 8V5h12v7H4z" clipRule="evenodd" />
                </svg>
                <span>Start with Screen</span>
              </button>

              <button
                onClick={() => startStream('both')}
                disabled={!streamState.isConnected}
                className="flex items-center justify-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                <span>Start with Both</span>
              </button>
            </div>
            
            {!streamState.isConnected && (
              <p className="text-gray-500 text-center">
                Please wait for connection before starting stream...
              </p>
            )}
          </div>
        ) : (
          <div className="text-center">
            <button
              onClick={stopStream}
              className="flex items-center justify-center space-x-2 bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 mx-auto"
            >
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              <span>Stop Stream</span>
            </button>
          </div>
        )}
      </div>

      {/* Stream Preview */}
      {streamState.isStreaming && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Live Preview</h3>
          <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
            <video
              ref={previewVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4">
              <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span>LIVE</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stream Info */}
      {streamState.isStreaming && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Stream Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{streamState.viewerCount}</div>
              <div className="text-gray-600">Current Viewers</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {streamState.isConnected ? 'Online' : 'Offline'}
              </div>
              <div className="text-gray-600">Connection Status</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {streamState.streamId ? 'Active' : 'Inactive'}
              </div>
              <div className="text-gray-600">Stream Status</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}