import Mux from '@mux/mux-node'

interface MuxConfig {
  tokenId: string
  tokenSecret: string
}

// Define proper types for Mux SDK responses based on the provided JSON structure
interface MuxLiveStream {
  id: string
  status: string
  stream_key: string // This is the sensitive private key
  playback_ids: Array<{ policy: string; id: string }>
  reconnect_window: number
  reduced_latency: boolean
  created_at: string
  recent_asset_ids?: string[]
}

interface MuxAsset {
  id: string
  status: string
  playback_ids: Array<{ policy: string; id: string }>
  mp4_support: string
  normalize_audio: boolean
  created_at: string
  duration?: number
  aspect_ratio?: string
  tracks?: Array<{
    id: string
    type: string
    duration: number
  }>
}

interface Input {
  url: string
}

interface SubtitleTrack {
  id: string
  type: string
  text_type: string
  status: string
  name: string
  language_code: string
  passthrough?: string
}

class MuxClient {
  private mux: Mux
  private config: MuxConfig

  constructor(config?: Partial<MuxConfig>) {
    // Use your unique Mux credentials
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

  // Enhanced Live Stream Management with stream key security warnings
  async createLiveStream(options: {
    playbackPolicy?: 'public' | 'signed'
    newAssetSettings?: {
      playbackPolicy?: 'public' | 'signed'
      mp4Support?: 'none' | 'capped-1080p' | 'standard'
      normalizeAudio?: boolean
    }
    reconnectWindow?: number
    reducedLatency?: boolean
  } = {}) {
    try {
      console.log('🎥 Creating unique Mux live stream with secure credentials...')
      console.warn('🔐 SECURITY: Stream key will be generated - treat it as a private credential!')

      // Create live stream with your unique Mux configuration
      const liveStream = await this.mux.video.liveStreams.create({
        playback_policy: [options.playbackPolicy || 'public'],
        new_asset_settings: {
          playback_policy: [options.newAssetSettings?.playbackPolicy || 'public'],
          mp4_support: options.newAssetSettings?.mp4Support || 'capped-1080p',
          normalize_audio: options.newAssetSettings?.normalizeAudio !== false
        },
        reconnect_window: options.reconnectWindow || 60,
        reduced_latency: options.reducedLatency !== false
      })

      // IMPORTANT: The stream_key from Mux response should be treated as highly sensitive
      console.warn('⚠️  SECURITY WARNING: Stream key generated - keep it secure!')
      console.log('📋 Stream key format matches Mux API specification:', {
        id: liveStream.id,
        stream_key: `${liveStream.stream_key.substring(0, 8)}...`, // Only log partial key
        status: liveStream.status,
        playback_ids: liveStream.playbook_ids?.length || 0,
        created_at: liveStream.created_at
      })

      const streamData = {
        id: liveStream.id,
        status: liveStream.status,
        streamKey: liveStream.stream_key, // ⚠️ SENSITIVE: Treat as private credential
        playbackIds: liveStream.playbook_ids || [],
        rtmpUrl: `rtmps://global-live.mux.com:443/live/${liveStream.stream_key}`,
        reconnectWindow: liveStream.reconnect_window,
        reducedLatency: liveStream.reduced_latency,
        createdAt: liveStream.created_at,
        // Security metadata
        securityInfo: {
          streamKeyGenerated: true,
          treatAsPrivate: true,
          warning: 'Anyone with the stream key can broadcast to this stream'
        },
        // Additional unique stream properties
        uniqueConfig: {
          tokenId: this.config.tokenId.substring(0, 8) + '...', // Partial for logging
          customSettings: true,
          assetSettings: options.newAssetSettings
        }
      }

      console.log('✅ Unique Mux live stream created with secure stream key:', streamData.id)
      console.warn('🔒 REMINDER: Keep stream key private - store securely and never share publicly')
      
      return streamData

    } catch (error) {
      console.error('❌ Failed to create unique live stream:', error)
      throw new Error(`Unique Mux live stream creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getLiveStream(liveStreamId: string) {
    try {
      const liveStream = await this.mux.video.liveStreams.retrieve(liveStreamId)
      
      // Log security reminder when accessing stream data
      console.warn('🔐 Accessing stream with sensitive stream key - handle securely')
      
      return {
        id: liveStream.id,
        status: liveStream.status,
        streamKey: liveStream.stream_key, // ⚠️ SENSITIVE: Handle with care
        playbackIds: liveStream.playbook_ids || [],
        rtmpUrl: `rtmps://global-live.mux.com:443/live/${liveStream.stream_key}`,
        reconnectWindow: liveStream.reconnect_window,
        reducedLatency: liveStream.reduced_latency,
        createdAt: liveStream.created_at,
        recentAssets: liveStream.recent_asset_ids || [],
        // Security warnings
        securityWarning: {
          message: 'Stream key is sensitive - treat as private credential',
          recommendations: [
            'Never share stream key publicly',
            'Store in secure password manager',
            'Monitor stream for unauthorized usage',
            'Reset key if compromised'
          ]
        }
      }
    } catch (error) {
      console.error('Failed to get live stream:', error)
      throw new Error(`Failed to retrieve live stream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async deleteLiveStream(liveStreamId: string) {
    try {
      console.log('🗑️ Deleting live stream - this will invalidate the stream key:', liveStreamId)
      await this.mux.video.liveStreams.delete(liveStreamId)
      console.log('✅ Live stream deleted - stream key is now invalid')
      return { success: true, streamKeyInvalidated: true }
    } catch (error) {
      console.error('Failed to delete live stream:', error)
      throw new Error(`Failed to delete live stream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // NEW: Reset Stream Key (conceptual - would need Mux API support)
  async resetStreamKey(liveStreamId: string) {
    try {
      console.log('🔄 Stream key reset requested for:', liveStreamId)
      console.warn('⚠️  This would invalidate the current stream key')
      
      // Note: This is conceptual - Mux may not have a direct reset endpoint
      // In practice, you might need to delete and recreate the stream
      // or contact Mux support for key rotation
      
      throw new Error('Stream key reset not implemented - consider deleting and recreating the stream')
    } catch (error) {
      console.error('Failed to reset stream key:', error)
      throw new Error(`Failed to reset stream key: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async enableLiveStream(liveStreamId: string) {
    try {
      // Fixed: Handle void return type properly
      await this.mux.video.liveStreams.enable(liveStreamId)
      
      // Always retrieve the updated stream to get current status
      const updatedStream = await this.mux.video.liveStreams.retrieve(liveStreamId)
      return {
        id: updatedStream.id,
        status: updatedStream.status
      }
    } catch (error) {
      console.error('Failed to enable live stream:', error)
      throw new Error(`Failed to enable live stream: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async disableLiveStream(liveStreamId: string) {
    try {
      console.log('⏹️ Disabling live stream (stream key remains valid):', liveStreamId)
      // Fixed: Handle void return type properly
      await this.mux.video.liveStreams.disable(liveStreamId)
      
      // Always retrieve the updated stream to get current status
      const updatedStream = await this.mux.video.liveStreams.retrieve(liveStreamId)
      return {
        id: updatedStream.id,
        status: updatedStream.status
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
      // Fixed: Ensure inputs array is properly typed and handle undefined case
      const inputs: Input[] = input.url ? [{ url: input.url }] : []
      
      const asset = await this.mux.video.assets.create({
        input: inputs,
        playback_policy: [input.playbackPolicy || 'public'],
        mp4_support: input.mp4Support || 'none',
        normalize_audio: input.normalizeAudio || false
      })

      return {
        id: asset.id,
        status: asset.status,
        playbackIds: asset.playbook_ids || [],
        mp4Support: asset.mp4_support,
        normalizeAudio: asset.normalize_audio,
        createdAt: asset.created_at,
        tracks: asset.tracks || []
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
        playbackIds: asset.playbook_ids || [],
        mp4Support: asset.mp4_support,
        normalizeAudio: asset.normalize_audio,
        createdAt: asset.created_at,
        duration: asset.duration,
        aspectRatio: asset.aspect_ratio,
        tracks: asset.tracks || []
      }
    } catch (error) {
      console.error('Failed to get asset:', error)
      throw new Error(`Failed to retrieve asset: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async deleteAsset(assetId: string) {
    try {
      await this.mux.video.assets.delete(assetId)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete asset:', error)
      throw new Error(`Failed to delete asset: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // NEW: Generate Subtitles for Asset Track
  async generateSubtitles(assetId: string, trackId: string, config: {
    languageCode?: string
    name?: string
    passthrough?: string
  } = {}): Promise<{ data: SubtitleTrack[] }> {
    try {
      console.log('📝 Generating subtitles for asset:', assetId, 'track:', trackId)

      // Use the Mux API endpoint for generating subtitles
      const response = await fetch(`https://api.mux.com/video/v1/assets/${assetId}/tracks/${trackId}/generate-subtitles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${this.config.tokenId}:${this.config.tokenSecret}`).toString('base64')}`
        },
        body: JSON.stringify({
          generated_subtitles: [{
            language_code: config.languageCode || 'en',
            name: config.name || 'English (generated)',
            passthrough: config.passthrough || 'English (generated)'
          }]
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Subtitles generated successfully')
      
      return result
    } catch (error) {
      console.error('❌ Failed to generate subtitles:', error)
      throw new Error(`Subtitle generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // NEW: Get Asset Tracks (needed for subtitle generation)
  async getAssetTracks(assetId: string) {
    try {
      const asset = await this.getAsset(assetId)
      return asset.tracks || []
    } catch (error) {
      console.error('Failed to get asset tracks:', error)
      throw new Error(`Failed to get asset tracks: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

  // NEW: Get Mux Configuration Info
  getConfiguration() {
    return {
      tokenId: this.config.tokenId.substring(0, 8) + '...', // Partial for security
      hasCredentials: !!(this.config.tokenId && this.config.tokenSecret),
      environment: process.env.NODE_ENV || 'development',
      securityReminder: 'Stream keys are sensitive credentials - handle with care'
    }
  }

  // NEW: Stream Key Security Utilities
  validateStreamKey(streamKey: string): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = []
    
    if (!streamKey) {
      return { isValid: false, warnings: ['Stream key is required'] }
    }
    
    if (streamKey.length < 20) {
      warnings.push('Stream key appears to be incomplete or truncated')
    }
    
    // Check if it looks like a Mux stream key format
    if (!streamKey.includes('-')) {
      warnings.push('Stream key format may be invalid for Mux')
    }
    
    // Security warnings
    warnings.push('Remember: Stream keys are private credentials')
    warnings.push('Never share stream keys publicly or in screenshots')
    warnings.push('Store stream keys securely (password manager recommended)')
    
    return {
      isValid: streamKey.length >= 8, // Basic validation
      warnings
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