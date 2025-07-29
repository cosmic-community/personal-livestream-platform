import { getWebRTCConfig, log } from '@/lib/stream-config'

export interface PeerConnectionConfig {
  onIceCandidate: (candidate: RTCIceCandidate) => void
  onConnectionStateChange: (state: RTCPeerConnectionState) => void
  onTrack?: (event: RTCTrackEvent) => void
  onDataChannel?: (channel: RTCDataChannel) => void
}

export interface ConnectionStats {
  bytesReceived: number
  bytesSent: number
  packetsLost: number
  jitter: number
  rtt: number
  bandwidth: number
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  videoResolution?: { width: number; height: number }
  frameRate?: number
}

export class PeerConnectionManager {
  private peerConnection: RTCPeerConnection
  private dataChannel: RTCDataChannel | null = null
  private statsInterval: NodeJS.Timeout | null = null
  private config: PeerConnectionConfig
  private connectionId: string
  private lastStats: RTCStatsReport | null = null

  constructor(config: PeerConnectionConfig, connectionId?: string) {
    this.config = config
    this.connectionId = connectionId || `peer-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    
    this.peerConnection = this.createPeerConnection()
    this.setupEventHandlers()
    this.createDataChannel()
  }

  private createPeerConnection(): RTCPeerConnection {
    try {
      const rtcConfig = getWebRTCConfig()
      const pc = new RTCPeerConnection(rtcConfig)
      
      log('info', `🔗 Created peer connection: ${this.connectionId}`)
      return pc
      
    } catch (error) {
      log('error', '❌ Failed to create peer connection', error)
      throw new Error('Failed to create peer connection')
    }
  }

  private setupEventHandlers(): void {
    // ICE candidate handling
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        log('info', `🧊 ICE candidate generated for ${this.connectionId}:`, event.candidate.type)
        this.config.onIceCandidate(event.candidate)
      } else {
        log('info', `🧊 ICE gathering complete for ${this.connectionId}`)
      }
    }

    // Connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState
      log('info', `🔗 Connection state changed for ${this.connectionId}: ${state}`)
      
      this.config.onConnectionStateChange(state)
      
      // Handle connection failures
      if (state === 'failed') {
        log('error', `❌ Peer connection failed for ${this.connectionId}`)
        this.handleConnectionFailure()
      } else if (state === 'connected') {
        log('info', `✅ Peer connection established for ${this.connectionId}`)
        this.startStatsMonitoring()
      } else if (state === 'disconnected') {
        log('warn', `⚠️ Peer connection disconnected for ${this.connectionId}`)
        this.stopStatsMonitoring()
      }
    }

    // ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection.iceConnectionState
      log('info', `🧊 ICE connection state for ${this.connectionId}: ${iceState}`)
      
      if (iceState === 'failed') {
        log('error', `❌ ICE connection failed for ${this.connectionId}`)
        this.restartIce()
      }
    }

    // ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      log('info', `🧊 ICE gathering state for ${this.connectionId}: ${this.peerConnection.iceGatheringState}`)
    }

    // Track handling (for receiving media)
    if (this.config.onTrack) {
      this.peerConnection.ontrack = (event) => {
        log('info', `📺 Received track for ${this.connectionId}:`, event.track.kind)
        this.config.onTrack!(event)
      }
    }

    // Data channel handling
    this.peerConnection.ondatachannel = (event) => {
      log('info', `📡 Data channel received for ${this.connectionId}`)
      this.setupDataChannelHandlers(event.channel)
      this.config.onDataChannel?.(event.channel)
    }
  }

  private createDataChannel(): void {
    try {
      this.dataChannel = this.peerConnection.createDataChannel('stream-control', {
        ordered: true,
        maxRetransmits: 3
      })

      this.setupDataChannelHandlers(this.dataChannel)
      log('info', `📡 Data channel created for ${this.connectionId}`)

    } catch (error) {
      log('warn', `⚠️ Could not create data channel for ${this.connectionId}:`, error)
    }
  }

  private setupDataChannelHandlers(channel: RTCDataChannel): void {
    channel.onopen = () => {
      log('info', `📡 Data channel opened for ${this.connectionId}`)
      this.sendControlMessage({
        type: 'connection-established',
        timestamp: Date.now(),
        connectionId: this.connectionId
      })
    }

    channel.onclose = () => {
      log('info', `📡 Data channel closed for ${this.connectionId}`)
    }

    channel.onerror = (error) => {
      log('warn', `📡 Data channel error for ${this.connectionId}:`, error)
    }

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        this.handleControlMessage(message)
      } catch (error) {
        log('info', `📡 Data channel message for ${this.connectionId}:`, event.data)
      }
    }
  }

  private handleControlMessage(message: any): void {
    switch (message.type) {
      case 'quality-feedback':
        log('info', `📊 Quality feedback from ${this.connectionId}:`, message.quality)
        break
      
      case 'buffer-status':
        log('info', `📊 Buffer status from ${this.connectionId}:`, message.status)
        break
      
      case 'viewer-action':
        log('info', `👤 Viewer action from ${this.connectionId}:`, message.action)
        break
      
      default:
        log('info', `📡 Unknown control message from ${this.connectionId}:`, message.type)
    }
  }

  private sendControlMessage(message: any): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(message))
      } catch (error) {
        log('warn', `📡 Failed to send control message for ${this.connectionId}:`, error)
      }
    }
  }

  private handleConnectionFailure(): void {
    log('warn', `🔄 Handling connection failure for ${this.connectionId}`)
    
    // Try ICE restart first
    setTimeout(() => {
      if (this.peerConnection.connectionState === 'failed') {
        this.restartIce()
      }
    }, 1000)
  }

  private restartIce(): void {
    try {
      log('info', `🔄 Restarting ICE for ${this.connectionId}`)
      this.peerConnection.restartIce()
    } catch (error) {
      log('error', `❌ ICE restart failed for ${this.connectionId}:`, error)
    }
  }

  private startStatsMonitoring(): void {
    if (this.statsInterval) return

    this.statsInterval = setInterval(async () => {
      try {
        const stats = await this.getConnectionStats()
        // You can emit these stats or handle them as needed
        // For now, we'll just log them periodically
        if (stats.quality === 'poor') {
          log('warn', `📊 Poor connection quality for ${this.connectionId}`, {
            quality: stats.quality,
            rtt: stats.rtt,
            packetsLost: stats.packetsLost
          })
        }
      } catch (error) {
        log('error', `❌ Error getting stats for ${this.connectionId}:`, error)
      }
    }, 5000) // Every 5 seconds
  }

  private stopStatsMonitoring(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
      this.statsInterval = null
    }
  }

  // Public methods

  async createOffer(stream?: MediaStream): Promise<RTCSessionDescriptionInit> {
    try {
      log('info', `📤 Creating offer for ${this.connectionId}`)
      
      if (stream) {
        stream.getTracks().forEach(track => {
          this.peerConnection.addTrack(track, stream)
        })
      }

      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      })

      await this.peerConnection.setLocalDescription(offer)
      
      log('info', `✅ Offer created for ${this.connectionId}`)
      return offer

    } catch (error) {
      log('error', `❌ Failed to create offer for ${this.connectionId}:`, error)
      throw error
    }
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    try {
      log('info', `📥 Creating answer for ${this.connectionId}`)
      
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      
      const answer = await this.peerConnection.createAnswer()
      await this.peerConnection.setLocalDescription(answer)
      
      log('info', `✅ Answer created for ${this.connectionId}`)
      return answer

    } catch (error) {
      log('error', `❌ Failed to create answer for ${this.connectionId}:`, error)
      throw error
    }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      log('info', `📥 Handling answer for ${this.connectionId}`)
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
      log('info', `✅ Answer handled for ${this.connectionId}`)
    } catch (error) {
      log('error', `❌ Failed to handle answer for ${this.connectionId}:`, error)
      throw error
    }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      if (candidate && candidate.candidate) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        log('info', `✅ ICE candidate added for ${this.connectionId}`)
      }
    } catch (error) {
      log('warn', `⚠️ Failed to add ICE candidate for ${this.connectionId}:`, error)
      // Don't throw - ICE candidates can fail without breaking the connection
    }
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender {
    return this.peerConnection.addTrack(track, stream)
  }

  removeTrack(sender: RTCRtpSender): void {
    this.peerConnection.removeTrack(sender)
  }

  getSenders(): RTCRtpSender[] {
    return this.peerConnection.getSenders()
  }

  getReceivers(): RTCRtpReceiver[] {
    return this.peerConnection.getReceivers()
  }

  async getConnectionStats(): Promise<ConnectionStats> {
    try {
      const stats = await this.peerConnection.getStats()
      this.lastStats = stats

      let bytesReceived = 0
      let bytesSent = 0
      let packetsLost = 0
      let jitter = 0
      let rtt = 0
      let bandwidth = 0
      let videoResolution: { width: number; height: number } | undefined
      let frameRate: number | undefined

      stats.forEach(report => {
        if (report.type === 'inbound-rtp') {
          if (report.mediaType === 'video') {
            bytesReceived += report.bytesReceived || 0
            packetsLost += report.packetsLost || 0
            jitter += report.jitter || 0
            frameRate = report.framesPerSecond
            if (report.frameWidth && report.frameHeight) {
              videoResolution = { width: report.frameWidth, height: report.frameHeight }
            }
          } else if (report.mediaType === 'audio') {
            bytesReceived += report.bytesReceived || 0
            packetsLost += report.packetsLost || 0
            jitter += report.jitter || 0
          }
        } else if (report.type === 'outbound-rtp') {
          bytesSent += report.bytesSent || 0
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          rtt = report.currentRoundTripTime || 0
          bandwidth = report.availableOutgoingBitrate || 0
        }
      })

      // Calculate quality score
      const rttScore = rtt < 0.1 ? 4 : rtt < 0.2 ? 3 : rtt < 0.3 ? 2 : 1
      const packetScore = packetsLost < 5 ? 4 : packetsLost < 20 ? 3 : packetsLost < 50 ? 2 : 1
      const jitterScore = jitter < 0.02 ? 4 : jitter < 0.05 ? 3 : jitter < 0.1 ? 2 : 1
      const bandwidthScore = bandwidth > 1000000 ? 4 : bandwidth > 500000 ? 3 : bandwidth > 100000 ? 2 : 1

      const avgScore = (rttScore + packetScore + jitterScore + bandwidthScore) / 4
      
      let quality: 'excellent' | 'good' | 'fair' | 'poor'
      if (avgScore >= 3.5) quality = 'excellent'
      else if (avgScore >= 2.5) quality = 'good'
      else if (avgScore >= 1.5) quality = 'fair'
      else quality = 'poor'

      return {
        bytesReceived,
        bytesSent,
        packetsLost,
        jitter,
        rtt,
        bandwidth,
        quality,
        videoResolution,
        frameRate
      }

    } catch (error) {
      log('error', `❌ Failed to get connection stats for ${this.connectionId}:`, error)
      throw error
    }
  }

  sendQualityFeedback(quality: string, metrics: any): void {
    this.sendControlMessage({
      type: 'quality-feedback',
      quality,
      metrics,
      timestamp: Date.now()
    })
  }

  get connectionState(): RTCPeerConnectionState {
    return this.peerConnection.connectionState
  }

  get iceConnectionState(): RTCIceConnectionState {
    return this.peerConnection.iceConnectionState
  }

  get id(): string {
    return this.connectionId
  }

  close(): void {
    log('info', `🔌 Closing peer connection: ${this.connectionId}`)
    
    this.stopStatsMonitoring()
    
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }
    
    this.peerConnection.close()
  }
}