import { useState, useEffect, useRef, useCallback } from 'react'
import { StreamState, StreamType, StreamError } from '@/types'
import { StreamManager } from '@/lib/stream-manager'
import { checkWebRTCSupport } from '@/lib/webrtc'
import { socketManager } from '@/lib/socket'

interface UseStreamConfig {
  autoConnect?: boolean
  onError?: (error: StreamError) => void
  onStateChange?: (state: StreamState) => void
}

export function useStream(config: UseStreamConfig = {}) {
  const [streamState, setStreamState] = useState<StreamState>({
    isLive: false,
    isConnecting: false,
    streamType: 'webcam',
    webcamEnabled: false,
    screenEnabled: false,
    viewerCount: 0
  })

  const [error, setError] = useState<StreamError | null>(null)
  const [isSupported, setIsSupported] = useState(true)
  const streamManagerRef = useRef<StreamManager | null>(null)

  // Initialize stream manager
  useEffect(() => {
    const supported = checkWebRTCSupport()
    setIsSupported(supported)

    if (!supported) {
      setError({
        code: 'WEBRTC_NOT_SUPPORTED',
        message: 'WebRTC is not supported in your browser',
        timestamp: new Date().toISOString(),
        context: { userAgent: navigator.userAgent }
      })
      return
    }

    // Create stream manager
    streamManagerRef.current = new StreamManager({
      onStateChange: (state) => {
        setStreamState(state)
        config.onStateChange?.(state)
      },
      onError: (err) => {
        setError(err)
        config.onError?.(err)
      },
      onViewerCountChange: (count) => {
        setStreamState(prev => ({ ...prev, viewerCount: count }))
      }
    })

    // Auto-connect if enabled
    if (config.autoConnect) {
      socketManager.connect()
    }

    return () => {
      streamManagerRef.current?.destroy()
    }
  }, [config.autoConnect])

  // Start streaming
  const startStream = useCallback(async (streamType: StreamType) => {
    if (!streamManagerRef.current) {
      throw new Error('Stream manager not initialized')
    }

    try {
      setError(null)
      await streamManagerRef.current.startStream(streamType)
    } catch (err) {
      const streamError: StreamError = {
        code: 'STREAM_START_FAILED',
        message: err instanceof Error ? err.message : 'Failed to start stream',
        timestamp: new Date().toISOString(),
        context: { streamType }
      }
      setError(streamError)
      throw streamError
    }
  }, [])

  // Stop streaming  
  const stopStream = useCallback(async () => {
    if (!streamManagerRef.current) return

    try {
      await streamManagerRef.current.stopStream()
      setError(null)
    } catch (err) {
      const streamError: StreamError = {
        code: 'STREAM_STOP_FAILED',
        message: err instanceof Error ? err.message : 'Failed to stop stream',
        timestamp: new Date().toISOString(),
        context: {}
      }
      setError(streamError)
      throw streamError
    }
  }, [])

  // Toggle webcam
  const toggleWebcam = useCallback(async () => {
    if (!streamManagerRef.current) return

    try {
      await streamManagerRef.current.toggleWebcam()
      setError(null)
    } catch (err) {
      const streamError: StreamError = {
        code: 'WEBCAM_TOGGLE_FAILED',
        message: err instanceof Error ? err.message : 'Failed to toggle webcam',
        timestamp: new Date().toISOString(),
        context: {}
      }
      setError(streamError)
      throw streamError
    }
  }, [])

  // Toggle screen share
  const toggleScreen = useCallback(async () => {
    if (!streamManagerRef.current) return

    try {
      await streamManagerRef.current.toggleScreen()
      setError(null)
    } catch (err) {
      const streamError: StreamError = {
        code: 'SCREEN_TOGGLE_FAILED',
        message: err instanceof Error ? err.message : 'Failed to toggle screen share',
        timestamp: new Date().toISOString(),
        context: {}
      }
      setError(streamError)
      throw streamError
    }
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Get current stream
  const getCurrentStream = useCallback(() => {
    return streamManagerRef.current?.stream || null
  }, [])

  // Get stream statistics
  const getStatistics = useCallback(() => {
    return streamManagerRef.current?.statistics || null
  }, [])

  // Check if streaming is available
  const isStreamingAvailable = useCallback(() => {
    return isSupported && socketManager.isConnected()
  }, [isSupported])

  return {
    // State
    streamState,
    error,
    isSupported,
    
    // Actions
    startStream,
    stopStream,
    toggleWebcam,
    toggleScreen,
    clearError,
    
    // Getters
    getCurrentStream,
    getStatistics,
    isStreamingAvailable,
    
    // Computed values
    isLive: streamState.isLive,
    isConnecting: streamState.isConnecting,
    viewerCount: streamState.viewerCount,
    hasWebcam: streamState.webcamEnabled,
    hasScreen: streamState.screenEnabled,
    streamType: streamState.streamType
  }
}