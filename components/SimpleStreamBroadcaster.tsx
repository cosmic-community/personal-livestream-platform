'use client'

import { useState, useEffect, useRef } from 'react'
import { useStreaming } from '@/components/StreamingProvider'

export default function SimpleStreamBroadcaster() {
  const {
    streamState,
    error,
    isSupported,
    startStream,
    stopStream,
    toggleWebcam,
    toggleScreen,
    clearError,
    isConnected,
    getCurrentStream
  } = useStreaming()

  const [isInitializing, setIsInitializing] = useState(true)
  const previewVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // Wait for initialization
    const timer = setTimeout(() => {
      setIsInitializing(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Update video preview when stream changes
    const stream = getCurrentStream()
    if (previewVideoRef.current && stream) {
      previewVideoRef.current.srcObject = stream
      previewVideoRef.current.play().catch(console.error)
    } else if (previewVideoRef.current && !stream) {
      previewVideoRef.current.srcObject = null
    }
  }, [streamState.isLive, getCurrentStream])

  const handleStartStream = async (streamType: 'webcam' | 'screen' | 'both') => {
    try {
      clearError()
      await startStream(streamType)
    } catch (err) {
      console.error('Failed to start stream:', err)
    }
  }

  const handleStopStream = async () => {
    try {
      await stopStream()
    } catch (err) {
      console.error('Failed to stop stream:', err)
    }
  }

  const handleToggleWebcam = async () => {
    try {
      await toggleWebcam()
    } catch (err) {
      console.error('Failed to toggle webcam:', err)
    }
  }

  const handleToggleScreen = async () => {
    try {
      await toggleScreen()
    } catch (err) {
      console.error('Failed to toggle screen:', err)
    }
  }

  if (!isSupported) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-red-800 mb-2">WebRTC Not Supported</h2>
          <p className="text-red-700">
            Your browser doesn't support WebRTC streaming. Please use a modern browser like Chrome, Firefox, or Safari.
          </p>
        </div>
      </div>
    )
  }

  if (isInitializing) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing streaming system...</p>
        </div>
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
              isConnected() ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="font-medium">
              {isConnected() ? 'Connected' : 'Disconnected'}
            </span>
            {streamState.isLive && (
              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-medium">
                LIVE
              </span>
            )}
            {streamState.isConnecting && (
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-sm font-medium">
                Connecting...
              </span>
            )}
          </div>
          
          {streamState.isLive && (
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

      {/* Stream Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Broadcasting Controls</h2>
        
        {!streamState.isLive ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => handleStartStream('webcam')}
                disabled={!isConnected() || streamState.isConnecting}
                className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                <span>Start with Webcam</span>
              </button>

              <button
                onClick={() => handleStartStream('screen')}
                disabled={!isConnected() || streamState.isConnecting}
                className="flex items-center justify-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 8V5h12v7H4z" clipRule="evenodd" />
                </svg>
                <span>Start with Screen</span>
              </button>

              <button
                onClick={() => handleStartStream('both')}
                disabled={!isConnected() || streamState.isConnecting}
                className="flex items-center justify-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                <span>Start with Both</span>
              </button>
            </div>
            
            {!isConnected() && (
              <p className="text-gray-500 text-center">
                Please wait for connection before starting stream...
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Live Controls */}
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={handleToggleWebcam}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  streamState.webcamEnabled 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
                <span>{streamState.webcamEnabled ? 'Webcam On' : 'Webcam Off'}</span>
              </button>

              <button
                onClick={handleToggleScreen}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  streamState.screenEnabled 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 8V5h12v7H4z" clipRule="evenodd" />
                </svg>
                <span>{streamState.screenEnabled ? 'Screen On' : 'Screen Off'}</span>
              </button>
            </div>

            {/* Stop Button */}
            <div className="text-center">
              <button
                onClick={handleStopStream}
                className="flex items-center justify-center space-x-2 bg-red-600 text-white px-8 py-3 rounded-lg hover:bg-red-700 mx-auto transition-colors"
              >
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                <span>Stop Stream</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stream Preview */}
      {streamState.isLive && (
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
            <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded">
              <span className="text-sm">{streamState.viewerCount} watching</span>
            </div>
          </div>
        </div>
      )}

      {/* Stream Information */}
      {streamState.isLive && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Stream Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {streamState.viewerCount}
              </div>
              <div className="text-gray-600">Current Viewers</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {streamState.streamType.toUpperCase()}
              </div>
              <div className="text-gray-600">Stream Type</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {isConnected() ? 'Online' : 'Offline'}
              </div>
              <div className="text-gray-600">Connection Status</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}