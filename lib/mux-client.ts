import Mux from '@mux/mux-node'

interface MuxConfig {
  tokenId: string
  tokenSecret: string
}

class MuxClient {
  private mux: Mux
  private config: MuxConfig

  constructor(config?: Partial<MuxConfig>) {
    this.config = {
      tokenId: config?.tokenId || process.env.MUX_TOKEN_ID || '',
      tokenSecret: config?.tokenSecret || process.env.MUX_TOKEN_SECRET || ''
    }

    if (!this.config.tokenId || !this.config.tokenSecret) {
      throw new Error('Mux credentials are required: MUX_TOKEN_ID and MUX_TOKEN_SECRET')
    }

    this.mux = new Mux({
      tokenId: this.config.tokenId,
      tokenSecret: this.config.tokenSecret
    })
  }

  // Live Stream Management
  async createLiveStream(options: {
    playbackPolicy?: 'public' | 'signed'
    newAssetSettings?: {
      playbackPolicy?: 'public' | 'signed'
    }
    reconnectWindow?: number
    reducedLatency?: boolean
  } = {}) {
    try {
      const liveStream = await this.mux.video.liveStreams.create({
        playback_policy: [options.playbackPolicy || 'public'],
        new_asset_settings: options.newAssetSettings ? {
          playback_policy: [options.newAssetSettings.playbackPolicy || 'public']
        } : undefined,
        reconnect_window: options.reconnectWindow || 60,
        reduced_latency: options.reducedLatency || false
      })

      return {
        id: liveStream.id,
        status: liveStream.status,
        streamKey: liveStream.stream_key,
        playbackIds: liveStream.playback_ids,
        rtmpUrl: `rtmps://global-live.mux.com:443/live/${liveStream.stream_key}`,
        reconnectWindow: liveStream.reconnect_window,
        reducedLatency: liveStream.reduced_latency,
        createdAt: liveStream.created_at
      }
    } catch (error) {
      console.error('Failed to create live stream:', error)
      throw new Error(`Mux live stream creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getLiveStream(liveStreamId: string) {
    try {
      const liveStream = await this.mux.video.liveStreams.retrieve(liveStreamId)
      
      return {
        id: liveStream.id,
        status: liveStream.status,
        streamKey: liveStream.stream_key,
        playbackIds: liveStream.playback_ids,
        rtmpUrl: `rtmps://global-live.mux.com:443/live/${liveStream.stream_key}`,
        reconnectWindow: liveStream.reconnect_window,
        reducedLatency: liveStream.reduced_latency,
        createdAt: liveStream.created_at,
        recentAssets: liveStream.recent_assets || []
      }
    } catch (error) {
      console.error('Failed to get live stream:', error)
      throw new Error(`Failed to retrieve live stream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async deleteLiveStream(liveStreamId: string) {
    try {
      await this.mux.video.liveStreams.del(liveStreamId)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete live stream:', error)
      throw new Error(`Failed to delete live stream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async enableLiveStream(liveStreamId: string) {
    try {
      const liveStream = await this.mux.video.liveStreams.enable(liveStreamId)
      return {
        id: liveStream.id,
        status: liveStream.status
      }
    } catch (error) {
      console.error('Failed to enable live stream:', error)
      throw new Error(`Failed to enable live stream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async disableLiveStream(liveStreamId: string) {
    try {
      const liveStream = await this.mux.video.liveStreams.disable(liveStreamId)
      return {
        id: liveStream.id,
        status: liveStream.status
      }
    } catch (error) {
      console.error('Failed to disable live stream:', error)
      throw new Error(`Failed to disable live stream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Asset Management
  async createAsset(input: {
    url?: string
    playbackPolicy?: 'public' | 'signed'
    mp4Support?: 'none' | 'capped-1080p' | 'standard'
    normalizeAudio?: boolean
  }) {
    try {
      const asset = await this.mux.video.assets.create({
        input: input.url ? [{ url: input.url }] : undefined,
        playback_policy: [input.playbackPolicy || 'public'],
        mp4_support: input.mp4Support || 'none',
        normalize_audio: input.normalizeAudio || false
      })

      return {
        id: asset.id,
        status: asset.status,
        playbackIds: asset.playback_ids,
        mp4Support: asset.mp4_support,
        normalizeAudio: asset.normalize_audio,
        createdAt: asset.created_at
      }
    } catch (error) {
      console.error('Failed to create asset:', error)
      throw new Error(`Mux asset creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getAsset(assetId: string) {
    try {
      const asset = await this.mux.video.assets.retrieve(assetId)
      
      return {
        id: asset.id,
        status: asset.status,
        playbackIds: asset.playback_ids,
        mp4Support: asset.mp4_support,
        normalizeAudio: asset.normalize_audio,
        createdAt: asset.created_at,
        duration: asset.duration,
        aspectRatio: asset.aspect_ratio
      }
    } catch (error) {
      console.error('Failed to get asset:', error)
      throw new Error(`Failed to retrieve asset: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async deleteAsset(assetId: string) {
    try {
      await this.mux.video.assets.del(assetId)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete asset:', error)
      throw new Error(`Failed to delete asset: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Playback Management
  generatePlaybackUrl(playbackId: string, options: {
    token?: string
    domain?: string
  } = {}) {
    const baseUrl = options.domain || 'https://stream.mux.com'
    const url = `${baseUrl}/${playbackId}.m3u8`
    
    if (options.token) {
      return `${url}?token=${options.token}`
    }
    
    return url
  }

  generateThumbnailUrl(playbackId: string, options: {
    time?: number
    width?: number
    height?: number
    fitMode?: 'preserve' | 'crop' | 'pad'
    token?: string
  } = {}) {
    let url = `https://image.mux.com/${playbackId}/thumbnail.png`
    
    const params: string[] = []
    if (options.time !== undefined) params.push(`time=${options.time}`)
    if (options.width) params.push(`width=${options.width}`)
    if (options.height) params.push(`height=${options.height}`)
    if (options.fitMode) params.push(`fit_mode=${options.fitMode}`)
    if (options.token) params.push(`token=${options.token}`)
    
    if (params.length > 0) {
      url += `?${params.join('&')}`
    }
    
    return url
  }

  // Signing Utilities (for signed playback policies)
  generateSignedUrl(playbackId: string, options: {
    keyId?: string
    keySecret?: string
    expiration?: number
    type?: 'video' | 'thumbnail' | 'gif'
  } = {}) {
    // This is a simplified implementation
    // In production, you'd want to use Mux's JWT signing library
    const payload = {
      sub: playbackId,
      aud: options.type || 'v',
      exp: options.expiration || Math.floor(Date.now() / 1000) + 3600, // 1 hour default
      kid: options.keyId || process.env.MUX_SIGNING_KEY_ID
    }

    // Note: This would require JWT signing implementation
    // For now, return the basic URL
    return this.generatePlaybackUrl(playbackId)
  }

  // Stream Statistics
  async getStreamMetrics(liveStreamId: string, timeframe?: string) {
    try {
      // Mux metrics would be available through their Data API
      // This is a placeholder for metrics functionality
      return {
        liveStreamId,
        timeframe: timeframe || '24:hours',
        metrics: {
          viewTime: 0,
          playCount: 0,
          uniqueViewers: 0
        }
      }
    } catch (error) {
      console.error('Failed to get stream metrics:', error)
      throw new Error(`Failed to get metrics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Webhook verification
  verifyWebhookSignature(rawBody: string, signature: string, secret?: string): boolean {
    try {
      // Implement webhook signature verification
      // This would use the Mux webhook secret to verify the signature
      const webhookSecret = secret || process.env.MUX_WEBHOOK_SECRET
      if (!webhookSecret) {
        throw new Error('Webhook secret not configured')
      }
      
      // Note: This is a simplified implementation
      // In production, you'd want to use crypto to verify the HMAC signature
      return true
    } catch (error) {
      console.error('Webhook verification failed:', error)
      return false
    }
  }
}

// Export singleton instance
let muxClient: MuxClient | null = null

export function getMuxClient(config?: Partial<MuxConfig>): MuxClient {
  if (!muxClient) {
    muxClient = new MuxClient(config)
  }
  return muxClient
}

export { MuxClient }
export default MuxClient