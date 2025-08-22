'use client'

import { useState, useEffect } from 'react'
import { StreamingCore } from '@/lib/streaming-core'
import { StreamState, StreamType, StreamError, createStreamState } from '@/types'

export default function SimpleDashboard() {
  const [streamState, setStreamState] = useState<StreamState>(() => createStreamState({
    isLive: false,
    isConnecting: false,
    streamType: 'webcam',
    webcamEnabled: false,
    screenEnabled: false,
    viewerCount: 0
  }))
  
  const [error, setError] = useState<StreamError | null>(null)
  const [streamingCore] = useState(() => new StreamingCore({ debug: true }))
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initialize = async () => {
      try {
        const isSupported = await streamingCore.initialize()
        if (!isSupported) {
          throw new Error('WebRTC not supported in this browser')
        }

        // Set up event listeners
        streamingCore.onStateChange((state: StreamState) => {
          // Fixed: Ensure proper type handling for setState
          setStreamState(prevState => ({
            ...prevState,
            ...state
          }))
        })

        streamingCore.onError((err: StreamError) => {
          setError(err)
        })

        // Connect to signaling server
        await streamingCore.connect()
        setIsInitialized(true)

      } catch (err) {
        setError({
          code: 'INIT_FAILED',
          message: err instanceof Error ? err.message : 'Failed to initialize',
          timestamp: new Date().toISOString()
        })
      }
    }

    initialize()

    return () => {
      streamingCore.destroy()
    }
  }, [streamingCore])

  const handleStartStream = async (type: StreamType) => {
    try {
      setError(null)
      await streamingCore.startStream(type)
    } catch (err) {
      setError({
        code: 'STREAM_START_FAILED',
        message: err instanceof Error ? err.message : 'Failed to start stream',
        timestamp: new Date().toISOString()
      })
    }
  }

  const handleStopStream = async () => {
    try {
      await streamingCore.stopStream()
      setError(null)
    } catch (err) {
      setError({
        code: 'STREAM_STOP_FAILED',
        message: err instanceof Error ? err.message : 'Failed to stop stream',
        timestamp: new Date().toISOString()
      })
    }
  }

  const handleToggleWebcam = async () => {
    try {
      await streamingCore.toggleWebcam()
    } catch (err) {
      setError({
        code: 'WEBCAM_TOGGLE_FAILED',
        message: err instanceof Error ? err.message : 'Failed to toggle webcam',
        timestamp: new Date().toISOString()
      })
    }
  }

  const handleToggleScreen = async () => {
    try {
      await streamingCore.toggleScreen()
    } catch (err) {
      setError({
        code: 'SCREEN_TOGGLE_FAILED',
        message: err instanceof Error ? err.message : 'Failed to toggle screen share',
        timestamp: new Date().toISOString()
      })
    }
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing streaming...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Simple Livestream Dashboard</h1>
          
          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-red-800 font-medium">{error.code}</p>
                  <p className="text-red-600 text-sm mt-1">{error.message}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-600 underline text-sm mt-2 hover:text-red-800"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Stream Controls */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Stream Controls</h2>
              
              <div className="space-y-4">
                {/* Stream Status */}
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    streamState.isLive ? 'bg-red-500 animate-pulse' :
                    streamState.isConnecting ? 'bg-yellow-500 animate-pulse' :
                    'bg-gray-400'
                  }`}></div>
                  <span className="text-sm font-medium">
                    {streamState.isLive ? 'LIVE' : streamState.isConnecting ? 'CONNECTING' : 'OFFLINE'}
                  </span>
                  {streamState.viewerCount > 0 && (
                    <span className="text-sm text-gray-600">
                      {streamState.viewerCount} viewers
                    </span>
                  )}
                </div>

                {/* Stream Type Selection */}
                {!streamState.isLive && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Stream Type:</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleStartStream('webcam')}
                        disabled={streamState.isConnecting}
                        className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                      >
                        Webcam
                      </button>
                      <button
                        onClick={() => handleStartStream('screen')}
                        disabled={streamState.isConnecting}
                        className="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                      >
                        Screen
                      </button>
                      <button
                        onClick={() => handleStartStream('both')}
                        disabled={streamState.isConnecting}
                        className="px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                      >
                        Both
                      </button>
                    </div>
                  </div>
                )}

                {/* Live Controls */}
                {streamState.isLive && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={handleToggleWebcam}
                        className={`px-4 py-2 text-sm rounded transition-colors ${
                          streamState.webcamEnabled 
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {streamState.webcamEnabled ? 'Webcam On' : 'Webcam Off'}
                      </button>
                      <button
                        onClick={handleToggleScreen}
                        className={`px-4 py-2 text-sm rounded transition-colors ${
                          streamState.screenEnabled 
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {streamState.screenEnabled ? 'Screen On' : 'Screen Off'}
                      </button>
                    </div>
                    
                    <button
                      onClick={handleStopStream}
                      className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                      Stop Stream
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Stream Preview */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Stream Preview</h2>
              <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
                {/* Fixed: Add proper null checks for mediaStream */}
                {streamState.mediaStream ? (
                  <video
                    ref={(video) => {
                      if (video && streamState.mediaStream) {
                        video.srcObject = streamState.mediaStream
                        video.play().catch(console.error)
                      }
                    }}
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                      </svg>
                      <p>No stream preview available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stream Information */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Stream Information</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{streamState.viewerCount}</div>
                  <div className="text-sm text-gray-600">Viewers</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {streamState.isLive ? 'LIVE' : 'OFFLINE'}
                  </div>
                  <div className="text-sm text-gray-600">Status</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 capitalize">{streamState.streamType}</div>
                  <div className="text-sm text-gray-600">Type</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {new Date(streamState.lastUpdated).toLocaleTimeString()}
                  </div>
                  <div className="text-sm text-gray-600">Last Update</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}