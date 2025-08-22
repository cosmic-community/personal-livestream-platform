import { useState, useEffect, useRef, useCallback } from 'react'
import { StreamState, StreamType, StreamError, BroadcasterState, createStreamState } from '@/types'
import { StreamManager } from '@/lib/stream-manager'
import { checkWebRTCSupport } from '@/lib/webrtc'
import { socketManager } from '@/lib/socket'

interface UseStreamConfig {
  autoConnect?: boolean
  onError?: (error: StreamError) => void
  onStateChange?: (state: BroadcasterState) => void
  onViewerCountChange?: (count: number) => void
}

export function useStream(config: UseStreamConfig = {}) {
  const [streamState, setStreamState] = useState<StreamState>(createStreamState({
    isLive: false,
    isConnecting: false,
    streamType: 'webcam',
    webcamEnabled: false,
    screenEnabled: false,
    viewerCount: 0
  }))

  const [error, setError] = useState<StreamError | null>(null)
  const [isSupported, setIsSupported] = useState(true)
  const streamManagerRef = useRef<StreamManager | null>(null)

  useEffect(() => {
    const supported = checkWebRTCSupport()
    setIsSupported(supported)

    if (!supported) {
      setError({
        code: 'WEBRTC_NOT_SUPPORTED',
        message: 'WebRTC is not supported in your browser',
        timestamp: new Date().toISOString(),
        context: { userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown' }
      })
      return
    }

    if (!streamManagerRef.current) {
      streamManagerRef.current = new StreamManager({
        onStateChange: (state: BroadcasterState) => {
          const streamState: StreamState = {
            isLive: state.isLive,
            isConnecting: state.isConnecting,
            streamType: state.streamType,
            webcamEnabled: state.webcamEnabled,
            screenEnabled: state.screenEnabled,
            viewerCount: state.viewerCount,
            sessionId: state.currentSession?.id,
            error: state.errors.length > 0 ? state.errors[state.errors.length - 1]?.message : undefined,
            lastUpdated: state.lastUpdated,
            isStreaming: state.isStreaming,
            streamQuality: state.streamQuality,
            currentSession: state.currentSession,
            mediaStream: state.mediaStream,
            peerConnections: state.peerConnections,
            stats: state.stats,
            errors: state.errors
          }
          setStreamState(streamState)
          if (config.onStateChange) {
            config.onStateChange(state)
          }
        },
        onError: (err: StreamError) => {
          setError(err)
          if (config.onError) {
            config.onError(err)
          }
        },
        onViewerCountChange: (count: number) => {
          setStreamState(prev => ({ ...prev, viewerCount: count }))
          if (config.onViewerCountChange) {
            config.onViewerCountChange(count)
          }
        }
      })
    }

    if (config.autoConnect) {
      socketManager.connect()
    }

    return () => {
      if (streamManagerRef.current) {
        streamManagerRef.current.destroy()
      }
    }
  }, [config.autoConnect])

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

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const getCurrentStream = useCallback((): MediaStream | null => {
    return streamManagerRef.current?.stream ?? null
  }, [])

  const getStatistics = useCallback(() => {
    return streamManagerRef.current?.statistics ?? null
  }, [])

  const isStreamingAvailable = useCallback(() => {
    return isSupported && socketManager.isConnected()
  }, [isSupported])

  return {
    streamState,
    error,
    isSupported,
    
    startStream,
    stopStream,
    toggleWebcam,
    toggleScreen,
    clearError,
    
    getCurrentStream,
    getStatistics,
    isStreamingAvailable,
    
    isLive: streamState.isLive,
    isConnecting: streamState.isConnecting,
    viewerCount: streamState.viewerCount,
    hasWebcam: streamState.webcamEnabled,
    hasScreen: streamState.screenEnabled,
    streamType: streamState.streamType
  }
}