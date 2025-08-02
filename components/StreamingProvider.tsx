'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { StreamingCore } from '@/lib/streaming-core'
import { StreamState, StreamType, StreamError } from '@/types'

interface StreamingContextType {
  // State
  streamState: StreamState
  error: StreamError | null
  isSupported: boolean
  
  // Actions
  startStream: (type: StreamType) => Promise<void>
  stopStream: () => Promise<void>
  toggleWebcam: () => Promise<void>
  toggleScreen: () => Promise<void>
  clearError: () => void
  
  // Connection
  connect: () => Promise<boolean>
  disconnect: () => void
  isConnected: () => boolean
  
  // Stream access
  getCurrentStream: () => MediaStream | null
  getStreamStats: () => any
}

const StreamingContext = createContext<StreamingContextType | null>(null)

interface StreamingProviderProps {
  children: ReactNode
  serverUrl?: string
  autoConnect?: boolean
  debug?: boolean
}

export function StreamingProvider({ 
  children, 
  serverUrl = 'ws://localhost:3001',
  autoConnect = true,
  debug = false 
}: StreamingProviderProps) {
  const [streamingCore] = useState(() => new StreamingCore({ serverUrl, debug }))
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

  useEffect(() => {
    // Initialize streaming core
    const initialize = async () => {
      try {
        const supported = await streamingCore.initialize()
        setIsSupported(supported)

        // Set up event listeners
        streamingCore.onStateChange((state) => {
          setStreamState(state)
        })

        streamingCore.onError((err) => {
          setError(err)
        })

        // Auto-connect if enabled
        if (autoConnect && supported) {
          await streamingCore.connect()
        }

      } catch (err) {
        setError({
          code: 'INITIALIZATION_FAILED',
          message: err instanceof Error ? err.message : 'Failed to initialize streaming',
          timestamp: new Date().toISOString()
        })
      }
    }

    initialize()

    return () => {
      streamingCore.destroy()
    }
  }, [streamingCore, autoConnect])

  const contextValue: StreamingContextType = {
    // State
    streamState,
    error,
    isSupported,
    
    // Actions
    startStream: async (type: StreamType) => {
      try {
        setError(null)
        await streamingCore.startStream(type)
      } catch (err) {
        const streamError: StreamError = {
          code: 'STREAM_START_FAILED',
          message: err instanceof Error ? err.message : 'Failed to start stream',
          timestamp: new Date().toISOString()
        }
        setError(streamError)
        throw streamError
      }
    },

    stopStream: async () => {
      try {
        await streamingCore.stopStream()
        setError(null)
      } catch (err) {
        const streamError: StreamError = {
          code: 'STREAM_STOP_FAILED',
          message: err instanceof Error ? err.message : 'Failed to stop stream',
          timestamp: new Date().toISOString()
        }
        setError(streamError)
        throw streamError
      }
    },

    toggleWebcam: async () => {
      try {
        await streamingCore.toggleWebcam()
        setError(null)
      } catch (err) {
        const streamError: StreamError = {
          code: 'WEBCAM_TOGGLE_FAILED',
          message: err instanceof Error ? err.message : 'Failed to toggle webcam',
          timestamp: new Date().toISOString()
        }
        setError(streamError)
        throw streamError
      }
    },

    toggleScreen: async () => {
      try {
        await streamingCore.toggleScreen()
        setError(null)
      } catch (err) {
        const streamError: StreamError = {
          code: 'SCREEN_TOGGLE_FAILED',
          message: err instanceof Error ? err.message : 'Failed to toggle screen share',
          timestamp: new Date().toISOString()
        }
        setError(streamError)
        throw streamError
      }
    },

    clearError: () => {
      setError(null)
    },

    // Connection
    connect: () => streamingCore.connect(),
    disconnect: () => streamingCore.disconnect(),
    isConnected: () => streamingCore.isConnected(),
    
    // Stream access - Fix: Convert undefined to null for type consistency
    getCurrentStream: () => streamingCore.getCurrentStream() ?? null,
    getStreamStats: () => streamingCore.getStreamStats()
  }

  return (
    <StreamingContext.Provider value={contextValue}>
      {children}
    </StreamingContext.Provider>
  )
}

export function useStreaming(): StreamingContextType {
  const context = useContext(StreamingContext)
  if (!context) {
    throw new Error('useStreaming must be used within a StreamingProvider')
  }
  return context
}