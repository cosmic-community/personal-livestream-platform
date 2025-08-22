import { getMuxClient } from './mux-client'
import { StreamState, StreamError, createStreamState } from '@/types'

interface MuxStreamConfig {
  playbackPolicy?: 'public' | 'signed'
  reducedLatency?: boolean
  reconnectWindow?: number
  newAssetSettings?: {
    playbackPolicy?: 'public' | 'signed'
    mp4Support?: 'none' | 'standard' // Fixed: Remove invalid option
    normalizeAudio?: boolean
  }
}

interface MuxStreamSession {
  id: string
  streamKey: string
  playbackIds: Array<{ id: string; policy: string }>
  status: string
  rtmpUrl: string
  hlsUrl?: string
  dashUrl?: string
  thumbnailUrl?: string
  createdAt: string
  reducedLatency?: boolean
  reconnectWindow?: number
}

export class MuxStreamingService {
  private muxClient = getMuxClient()
  private currentSession: MuxStreamSession | null = null
  private config: MuxStreamConfig
  private listeners: {
    onStateChange?: (state: StreamState) => void
    onError?: (error: StreamError) => void
    onSessionCreated?: (session: MuxStreamSession) => void
    onSessionEnded?: (sessionId: string) => void
  } = {}

  constructor(config: MuxStreamConfig = {}) {
    this.config = {
      playbackPolicy: config.playbackPolicy || 'public',
      reducedLatency: config.reducedLatency || true,
      reconnectWindow: config.reconnectWindow || 60,
      newAssetSettings: config.newAssetSettings || {
        playbackPolicy: 'public',
        mp4Support: 'standard', // Fixed: Use valid option
        normalizeAudio: true
      }
    }
  }

  async createStreamSession(): Promise<MuxStreamSession> {
    try {
      console.log('🎥 Creating Mux live stream session...')

      const liveStream = await this.muxClient.createLiveStream({
        playbackPolicy: this.config.playbackPolicy,
        reducedLatency: this.config.reducedLatency,
        reconnectWindow: this.config.reconnectWindow,
        newAssetSettings: this.config.newAssetSettings
      })

      // Fixed: Add proper null checks for all potentially undefined values
      const session: MuxStreamSession = {
        id: liveStream.id || '',
        streamKey: liveStream.streamKey || '',
        playbackIds: liveStream.playbackIds || [],
        status: liveStream.status || 'idle',
        rtmpUrl: liveStream.rtmpUrl || '',
        createdAt: liveStream.createdAt || new Date().toISOString(),
        reducedLatency: liveStream.reducedLatency,
        reconnectWindow: liveStream.reconnectWindow
      }

      // Generate playback URLs if playback IDs exist
      if (session.playbackIds.length > 0) {
        const primaryPlaybackId = session.playbackIds[0]?.id
        if (primaryPlaybackId) {
          session.hlsUrl = this.muxClient.generatePlaybackUrl(primaryPlaybackId)
          session.dashUrl = session.hlsUrl.replace('.m3u8', '.mpd')
          session.thumbnailUrl = this.muxClient.generateThumbnailUrl(primaryPlaybackId)
        }
      }

      this.currentSession = session
      this.listeners.onSessionCreated?.(session)

      console.log('✅ Mux stream session created:', session.id)
      return session

    } catch (error) {
      console.error('❌ Failed to create Mux stream session:', error)
      
      const streamError: StreamError = {
        code: 'MUX_SESSION_CREATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to create streaming session',
        timestamp: new Date().toISOString(),
        details: { error }
      }
      
      this.listeners.onError?.(streamError)
      throw error
    }
  }

  async getStreamSession(sessionId?: string): Promise<MuxStreamSession | null> {
    const targetId = sessionId || this.currentSession?.id
    if (!targetId) {
      return null
    }

    try {
      const liveStream = await this.muxClient.getLiveStream(targetId)
      
      // Fixed: Add proper null checks for all potentially undefined values
      const session: MuxStreamSession = {
        id: liveStream.id || '',
        streamKey: liveStream.streamKey || '',
        playbackIds: liveStream.playbackIds || [],
        status: liveStream.status || 'idle',
        rtmpUrl: liveStream.rtmpUrl || '',
        createdAt: liveStream.createdAt || new Date().toISOString(),
        reducedLatency: liveStream.reducedLatency,
        reconnectWindow: liveStream.reconnectWindow
      }

      // Generate playback URLs
      if (session.playbackIds.length > 0) {
        const primaryPlaybackId = session.playbackIds[0]?.id
        if (primaryPlaybackId) {
          session.hlsUrl = this.muxClient.generatePlaybackUrl(primaryPlaybackId)
          session.dashUrl = session.hlsUrl.replace('.m3u8', '.mpd')
          session.thumbnailUrl = this.muxClient.generateThumbnailUrl(primaryPlaybackId)
        }
      }

      if (!sessionId) {
        this.currentSession = session
      }

      return session

    } catch (error) {
      console.error('❌ Failed to get stream session:', error)
      return null
    }
  }

  async endStreamSession(sessionId?: string): Promise<void> {
    const targetId = sessionId || this.currentSession?.id
    if (!targetId) {
      throw new Error('No active stream session to end')
    }

    try {
      console.log('🛑 Ending Mux stream session:', targetId)
      
      // Disable the live stream
      await this.muxClient.disableLiveStream(targetId)
      
      this.listeners.onSessionEnded?.(targetId)
      
      if (!sessionId || sessionId === this.currentSession?.id) {
        this.currentSession = null
      }

      console.log('✅ Mux stream session ended successfully')

    } catch (error) {
      console.error('❌ Failed to end stream session:', error)
      
      const streamError: StreamError = {
        code: 'MUX_SESSION_END_FAILED',
        message: error instanceof Error ? error.message : 'Failed to end streaming session',
        timestamp: new Date().toISOString(),
        details: { error, sessionId: targetId }
      }
      
      this.listeners.onError?.(streamError)
      throw error
    }
  }

  async deleteStreamSession(sessionId?: string): Promise<void> {
    const targetId = sessionId || this.currentSession?.id
    if (!targetId) {
      throw new Error('No stream session to delete')
    }

    try {
      console.log('🗑️ Deleting Mux stream session:', targetId)
      
      await this.muxClient.deleteLiveStream(targetId)
      
      if (!sessionId || sessionId === this.currentSession?.id) {
        this.currentSession = null
      }

      console.log('✅ Mux stream session deleted successfully')

    } catch (error) {
      console.error('❌ Failed to delete stream session:', error)
      throw error
    }
  }

  async getStreamingInstructions(sessionId?: string): Promise<{
    rtmpUrl: string
    streamKey: string
    software: {
      obs: {
        server: string
        streamKey: string
      }
      streamlabs: {
        server: string
        streamKey: string
      }
    }
    mobile: {
      rtmpUrl: string
      streamKey: string
    }
  } | null> {
    const session = sessionId ? await this.getStreamSession(sessionId) : this.currentSession
    if (!session) {
      return null
    }

    return {
      rtmpUrl: session.rtmpUrl,
      streamKey: session.streamKey,
      software: {
        obs: {
          server: 'rtmps://global-live.mux.com:443/live',
          streamKey: session.streamKey
        },
        streamlabs: {
          server: 'rtmps://global-live.mux.com:443/live',
          streamKey: session.streamKey
        }
      },
      mobile: {
        rtmpUrl: session.rtmpUrl,
        streamKey: session.streamKey
      }
    }
  }

  async getPlaybackInfo(sessionId?: string): Promise<{
    hlsUrl?: string
    dashUrl?: string
    thumbnailUrl?: string
    playbackIds: Array<{ id: string; policy: string }>
    isLive: boolean
  } | null> {
    const session = sessionId ? await this.getStreamSession(sessionId) : this.currentSession
    if (!session) {
      return null
    }

    return {
      hlsUrl: session.hlsUrl,
      dashUrl: session.dashUrl,
      thumbnailUrl: session.thumbnailUrl,
      playbackIds: session.playbackIds,
      isLive: session.status === 'active'
    }
  }

  async getStreamMetrics(sessionId?: string, timeframe?: string) {
    const targetId = sessionId || this.currentSession?.id
    if (!targetId) {
      return null
    }

    try {
      return await this.muxClient.getStreamMetrics(targetId, timeframe)
    } catch (error) {
      console.error('❌ Failed to get stream metrics:', error)
      return null
    }
  }

  // Webhook handling for Mux events
  handleWebhook(payload: any, signature: string): boolean {
    try {
      const isValid = this.muxClient.verifyWebhookSignature(
        JSON.stringify(payload),
        signature
      )

      if (!isValid) {
        console.error('❌ Invalid webhook signature')
        return false
      }

      console.log('📡 Received Mux webhook:', payload.type)

      switch (payload.type) {
        case 'video.live_stream.active':
          this.handleStreamActive(payload.data)
          break
        case 'video.live_stream.idle':
          this.handleStreamIdle(payload.data)
          break
        case 'video.live_stream.disconnected':
          this.handleStreamDisconnected(payload.data)
          break
        case 'video.asset.ready':
          this.handleAssetReady(payload.data)
          break
        case 'video.asset.errored':
          this.handleAssetError(payload.data)
          break
        default:
          console.log('🔄 Unhandled webhook type:', payload.type)
      }

      return true

    } catch (error) {
      console.error('❌ Webhook handling error:', error)
      return false
    }
  }

  private handleStreamActive(data: any) {
    console.log('🟢 Stream became active:', data.id)
    
    // Fixed: Use createStreamState with proper overrides
    const streamState: StreamState = createStreamState({
      isLive: true,
      isConnecting: false,
      streamType: 'webcam',
      webcamEnabled: false,
      screenEnabled: false,
      viewerCount: 0,
      sessionId: data.id
    })
    
    this.listeners.onStateChange?.(streamState)
  }

  private handleStreamIdle(data: any) {
    console.log('🟡 Stream became idle:', data.id)
    
    // Fixed: Use createStreamState with proper overrides
    const streamState: StreamState = createStreamState({
      isLive: false,
      isConnecting: false,
      streamType: 'webcam',
      webcamEnabled: false,
      screenEnabled: false,
      viewerCount: 0,
      sessionId: data.id
    })
    
    this.listeners.onStateChange?.(streamState)
  }

  private handleStreamDisconnected(data: any) {
    console.log('🔴 Stream disconnected:', data.id)
    
    // Fixed: Use createStreamState with proper overrides
    const streamState: StreamState = createStreamState({
      isLive: false,
      isConnecting: false,
      streamType: 'webcam',
      webcamEnabled: false,
      screenEnabled: false,
      viewerCount: 0,
      sessionId: data.id
    })
    
    this.listeners.onStateChange?.(streamState)
  }

  private handleAssetReady(data: any) {
    console.log('📹 Asset ready:', data.id)
    // Handle asset ready event (e.g., recorded stream is available)
  }

  private handleAssetError(data: any) {
    console.log('❌ Asset error:', data.id)
    
    const streamError: StreamError = {
      code: 'MUX_ASSET_ERROR',
      message: 'Asset processing failed',
      timestamp: new Date().toISOString(),
      details: data
    }
    
    this.listeners.onError?.(streamError)
  }

  // Event listeners
  onStateChange(callback: (state: StreamState) => void) {
    this.listeners.onStateChange = callback
  }

  onError(callback: (error: StreamError) => void) {
    this.listeners.onError = callback
  }

  onSessionCreated(callback: (session: MuxStreamSession) => void) {
    this.listeners.onSessionCreated = callback
  }

  onSessionEnded(callback: (sessionId: string) => void) {
    this.listeners.onSessionEnded = callback
  }

  // Utility methods
  getCurrentSession(): MuxStreamSession | null {
    return this.currentSession
  }

  isSessionActive(): boolean {
    return this.currentSession?.status === 'active'
  }

  getSessionId(): string | null {
    return this.currentSession?.id || null
  }
}

// Export singleton instance
let muxStreamingService: MuxStreamingService | null = null

export function getMuxStreamingService(config?: MuxStreamConfig): MuxStreamingService {
  if (!muxStreamingService) {
    muxStreamingService = new MuxStreamingService(config)
  }
  return muxStreamingService
}

export default MuxStreamingService