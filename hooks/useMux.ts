'use client'

import { useState, useEffect, useCallback } from 'react'

interface MuxStreamConfig {
  playbackPolicy?: 'public' | 'signed'
  reducedLatency?: boolean
  reconnectWindow?: number
  newAssetSettings?: {
    playbackPolicy?: 'public' | 'signed'
    mp4Support?: 'none' | 'standard'
    normalizeAudio?: boolean
  }
}

interface MuxStream {
  id: string
  streamKey: string
  playbackIds: Array<{ id: string; policy: string }>
  status: string
  rtmpUrl: string
  hlsUrl?: string
  isLive: boolean
  createdAt: string
}

interface UseMuxReturn {
  streams: MuxStream[]
  activeStream: MuxStream | null
  isLoading: boolean
  error: string | null
  createStream: (config?: MuxStreamConfig) => Promise<MuxStream>
  deleteStream: (streamId: string) => Promise<void>
  getStreamStatus: (streamId: string) => Promise<'active' | 'idle' | 'disconnected'>
  refreshStreams: () => Promise<void>
  clearError: () => void
}

export function useMux(): UseMuxReturn {
  const [streams, setStreams] = useState<MuxStream[]>([])
  const [activeStream, setActiveStream] = useState<MuxStream | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing streams on mount
  useEffect(() => {
    refreshStreams()
  }, [])

  // Create a new Mux live stream
  const createStream = useCallback(async (config: MuxStreamConfig = {}): Promise<MuxStream> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/mux/streams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playbackPolicy: config.playbackPolicy || 'public',
          reducedLatency: config.reducedLatency || true,
          reconnectWindow: config.reconnectWindow || 60,
          newAssetSettings: config.newAssetSettings || {
            playbackPolicy: 'public',
            mp4Support: 'standard',
            normalizeAudio: true
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create stream')
      }

      const stream: MuxStream = await response.json()
      
      setStreams(prev => [stream, ...prev])
      setActiveStream(stream)

      console.log('✅ Mux stream created:', stream.id)
      return stream

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error creating stream'
      setError(message)
      console.error('❌ Error creating Mux stream:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Delete a Mux stream
  const deleteStream = useCallback(async (streamId: string): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/mux/streams/${streamId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete stream')
      }

      setStreams(prev => prev.filter(stream => stream.id !== streamId))
      
      if (activeStream?.id === streamId) {
        setActiveStream(null)
      }

      console.log('✅ Mux stream deleted:', streamId)

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error deleting stream'
      setError(message)
      console.error('❌ Error deleting Mux stream:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [activeStream])

  // Get stream status
  const getStreamStatus = useCallback(async (streamId: string): Promise<'active' | 'idle' | 'disconnected'> => {
    try {
      const response = await fetch(`/api/mux/streams/${streamId}/status`)
      
      if (!response.ok) {
        throw new Error('Failed to get stream status')
      }

      const { status } = await response.json()
      return status

    } catch (err) {
      console.error('❌ Error getting stream status:', err)
      return 'disconnected'
    }
  }, [])

  // Refresh streams list
  const refreshStreams = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/mux/streams')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch streams')
      }

      const streamsData: MuxStream[] = await response.json()
      setStreams(streamsData)

      // Set active stream if there's only one or find the most recent
      if (streamsData.length === 1) {
        setActiveStream(streamsData[0] || null)
      } else if (streamsData.length > 1 && !activeStream) {
        // Find most recently created stream
        const mostRecent = streamsData.reduce((latest, current) => 
          new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
        )
        setActiveStream(mostRecent || null)
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error fetching streams'
      setError(message)
      console.error('❌ Error fetching Mux streams:', err)
    } finally {
      setIsLoading(false)
    }
  }, [activeStream])

  // Clear error state
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    streams,
    activeStream,
    isLoading,
    error,
    createStream,
    deleteStream,
    getStreamStatus,
    refreshStreams,
    clearError
  }
}