import { socketManager } from '@/lib/socket'
import { connectionManager } from '@/lib/connection-manager'
import { 
  getUserMediaStream, 
  createPeerConnection, 
  createOffer, 
  createAnswer,
  handleIceCandidate,
  stopMediaStream,
  combineStreams,
  monitorConnectionQuality
} from '@/lib/webrtc'
import { StreamType, StreamState, StreamError } from '@/types'
import { STREAM_CONFIG, log } from '@/lib/stream-config'

interface StreamManagerConfig {
  onStateChange?: (state: StreamState) => void
  onError?: (error: StreamError) => void
  onViewerCountChange?: (count: number) => void
  onStreamQualityChange?: (quality: string) => void
}

class StreamManager {
  private currentStream: MediaStream | null = null
  private webcamStream: MediaStream | null = null
  private screenStream: MediaStream | null = null
  private peerConnections: Map<string, RTCPeerConnection> = new Map()
  private isStreaming = false
  private sessionId: string | null = null
  private streamType: StreamType = 'webcam'
  private config: StreamManagerConfig = {}
  private qualityMonitors: Map<string, () => void> = new Map()
  private streamStats = {
    startTime: null as Date | null,
    bytesTransmitted: 0,
    packetsLost: 0,
    averageLatency: 0,
    peakViewers: 0,
    currentViewers: 0
  }

  constructor(config: StreamManagerConfig = {}) {
    this.config = config
    this.initializeEventListeners()
  }

  private initializeEventListeners(): void {
    // Socket event listeners
    socketManager.onStreamStarted((data) => {
      log('info', '✅ Stream started successfully', data)
      this.sessionId = data.sessionId
      this.isStreaming = true
      this.streamStats.startTime = new Date()
      this.emitStateChange()
    })

    socketManager.onStreamEnded((data) => {
      log('info', '🛑 Stream ended', data)
      this.handleStreamEnd()
    })

    socketManager.onViewerCount((count) => {
      this.streamStats.currentViewers = count
      this.streamStats.peakViewers = Math.max(this.streamStats.peakViewers, count)
      this.config.onViewerCountChange?.(count)
    })

    socketManager.onStreamOffer(async (offer) => {
      await this.handleIncomingOffer(offer)
    })

    socketManager.onStreamAnswer(async (answer) => {
      await this.handleIncomingAnswer(answer)
    })

    socketManager.onIceCandidate(async (candidate) => {
      await this.handleIncomingIceCandidate(candidate)
    })

    socketManager.onStreamError((error) => {
      log('error', '❌ Stream error', error)
      this.config.onError?.(error)
    })

    // Connection health monitoring
    connectionManager.on('connection-status-changed', (health) => {
      log('info', '🔄 Connection status changed', health)
      if (health.status === 'disconnected' && this.isStreaming) {
        this.handleConnectionLoss()
      }
    })
  }

  // Start streaming with specified type
  async startStream(streamType: StreamType): Promise<void> {
    try {
      log('info', `🚀 Starting ${streamType} stream`)
      
      // Check connection first
      if (!socketManager.isConnected()) {
        throw new Error('Not connected to streaming server')
      }

      // Get media streams based on type
      await this.acquireMediaStreams(streamType)

      // Start broadcasting via socket
      await socketManager.startBroadcast(streamType)

      this.streamType = streamType
      this.emitStateChange()

      log('info', '✅ Stream started successfully')

    } catch (error) {
      log('error', '❌ Failed to start stream', error)
      await this.cleanup()
      throw error
    }
  }

  // Stop streaming
  async stopStream(): Promise<void> {
    try {
      log('info', '🛑 Stopping stream')
      
      // Stop socket broadcast
      socketManager.stopBroadcast()

      // Handle cleanup
      this.handleStreamEnd()

      log('info', '✅ Stream stopped successfully')

    } catch (error) {
      log('error', '❌ Error stopping stream', error)
      throw error
    }
  }

  // Toggle webcam on/off during live stream
  async toggleWebcam(): Promise<void> {
    if (!this.isStreaming) return

    try {
      if (this.webcamStream) {
        // Turn off webcam
        stopMediaStream(this.webcamStream)
        this.webcamStream = null
        
        // Remove webcam tracks from combined stream
        if (this.currentStream) {
          const videoTracks = this.currentStream.getVideoTracks()
          videoTracks.forEach(track => {
            if (track.label.toLowerCase().includes('camera')) {
              track.stop()
              this.currentStream?.removeTrack(track)
            }
          })
        }
        
        log('info', '📹 Webcam disabled')
      } else {
        // Turn on webcam
        this.webcamStream = await getUserMediaStream('webcam')
        
        // Add webcam tracks to combined stream
        if (this.currentStream) {
          this.webcamStream.getTracks().forEach(track => {
            this.currentStream?.addTrack(track)
          })
        }
        
        log('info', '📹 Webcam enabled')
      }

      // Update peer connections with new stream
      await this.updatePeerConnections()
      this.emitStateChange()

    } catch (error) {
      log('error', '❌ Error toggling webcam', error)
      throw error
    }
  }

  // Toggle screen share on/off during live stream
  async toggleScreen(): Promise<void> {
    if (!this.isStreaming) return

    try {
      if (this.screenStream) {
        // Turn off screen share
        stopMediaStream(this.screenStream)
        this.screenStream = null
        
        // Remove screen tracks from combined stream
        if (this.currentStream) {
          const videoTracks = this.currentStream.getVideoTracks()
          videoTracks.forEach(track => {
            if (!track.label.toLowerCase().includes('camera')) {
              track.stop()
              this.currentStream?.removeTrack(track)
            }
          })
        }
        
        log('info', '🖥️ Screen share disabled')
      } else {
        // Turn on screen share
        this.screenStream = await getUserMediaStream('screen')
        
        // Add screen tracks to combined stream
        if (this.currentStream) {
          this.screenStream.getTracks().forEach(track => {
            this.currentStream?.addTrack(track)
          })
        }
        
        log('info', '🖥️ Screen share enabled')
      }

      // Update peer connections with new stream
      await this.updatePeerConnections()
      this.emitStateChange()

    } catch (error) {
      log('error', '❌ Error toggling screen share', error)
      throw error
    }
  }

  // Get media streams based on type
  private async acquireMediaStreams(streamType: StreamType): Promise<void> {
    const streams: MediaStream[] = []

    try {
      switch (streamType) {
        case 'webcam':
          this.webcamStream = await getUserMediaStream('webcam')
          streams.push(this.webcamStream)
          break

        case 'screen':
          this.screenStream = await getUserMediaStream('screen')
          streams.push(this.screenStream)
          break

        case 'both':
        case 'combined':
          // Get both streams
          const [webcam, screen] = await Promise.allSettled([
            getUserMediaStream('webcam'),
            getUserMediaStream('screen')
          ])

          if (webcam.status === 'fulfilled') {
            this.webcamStream = webcam.value
            streams.push(this.webcamStream)
          }

          if (screen.status === 'fulfilled') {
            this.screenStream = screen.value
            streams.push(this.screenStream)
          }

          if (streams.length === 0) {
            throw new Error('Failed to acquire any media streams')
          }
          break

        default:
          throw new Error(`Unsupported stream type: ${streamType}`)
      }

      // Combine streams if multiple
      if (streams.length > 1) {
        this.currentStream = await combineStreams(streams)
      } else {
        this.currentStream = streams[0]
      }

      log('info', `✅ Acquired ${streamType} stream with ${this.currentStream.getTracks().length} tracks`)

    } catch (error) {
      // Cleanup any partially created streams
      streams.forEach(stream => stopMediaStream(stream))
      this.webcamStream = null
      this.screenStream = null
      this.currentStream = null
      throw error
    }
  }

  // Handle incoming WebRTC offer (for viewers connecting)
  private async handleIncomingOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      log('info', '📥 Handling incoming WebRTC offer')

      if (!this.currentStream) {
        throw new Error('No active stream to offer')
      }

      // Create peer connection for this viewer
      const viewerId = `viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      const peerConnection = createPeerConnection(
        (candidate) => {
          socketManager.sendIceCandidate(candidate, viewerId)
        },
        (state) => {
          log('info', `🔗 Peer connection state for ${viewerId}: ${state}`)
          if (state === 'disconnected' || state === 'failed') {
            this.removePeerConnection(viewerId)
          }
        }
      )

      // Add stream to peer connection
      this.currentStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.currentStream!)
      })

      // Set remote description and create answer
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await createAnswer(peerConnection, offer)

      // Store peer connection
      this.peerConnections.set(viewerId, peerConnection)

      // Start quality monitoring for this connection
      this.startQualityMonitoring(viewerId, peerConnection)

      // Send answer back
      socketManager.sendAnswer(answer, viewerId)

      log('info', `✅ WebRTC offer handled for ${viewerId}`)

    } catch (error) {
      log('error', '❌ Error handling WebRTC offer', error)
      throw error
    }
  }

  // Handle incoming WebRTC answer
  private async handleIncomingAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      log('info', '📥 Handling incoming WebRTC answer')

      // Find the appropriate peer connection
      // In this case, we're the broadcaster, so we don't expect answers
      // This would be used if we were implementing bidirectional communication

    } catch (error) {
      log('error', '❌ Error handling WebRTC answer', error)
    }
  }

  // Handle incoming ICE candidate
  private async handleIncomingIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      // Apply candidate to all peer connections
      const promises = Array.from(this.peerConnections.values()).map(pc =>
        handleIceCandidate(pc, candidate)
      )

      await Promise.allSettled(promises)

    } catch (error) {
      log('error', '❌ Error handling ICE candidate', error)
    }
  }

  // Update all peer connections with new stream
  private async updatePeerConnections(): Promise<void> {
    if (!this.currentStream) return

    try {
      const promises = Array.from(this.peerConnections.entries()).map(async ([viewerId, pc]) => {
        // Remove old tracks
        pc.getSenders().forEach(sender => pc.removeTrack(sender))

        // Add new tracks
        this.currentStream!.getTracks().forEach(track => {
          pc.addTrack(track, this.currentStream!)
        })

        // Create new offer with updated stream
        const offer = await createOffer(pc, this.currentStream!)
        socketManager.sendOffer(offer, viewerId)
      })

      await Promise.allSettled(promises)
      log('info', '✅ Updated all peer connections')

    } catch (error) {
      log('error', '❌ Error updating peer connections', error)
    }
  }

  // Start quality monitoring for a peer connection
  private startQualityMonitoring(viewerId: string, peerConnection: RTCPeerConnection): void {
    const stopMonitoring = monitorConnectionQuality(peerConnection, (stats) => {
      // Update stream statistics
      this.streamStats.bytesTransmitted += stats.bytesSent
      this.streamStats.packetsLost += stats.packetsLost
      this.streamStats.averageLatency = stats.rtt

      // Emit quality changes
      this.config.onStreamQualityChange?.(stats.quality)

      log('info', `📊 Connection quality for ${viewerId}:`, {
        quality: stats.quality,
        latency: Math.round(stats.rtt),
        packetsLost: stats.packetsLost,
        bandwidth: Math.round(stats.bandwidth / 1000) + ' kbps'
      })
    })

    this.qualityMonitors.set(viewerId, stopMonitoring)
  }

  // Remove peer connection and cleanup
  private removePeerConnection(viewerId: string): void {
    const peerConnection = this.peerConnections.get(viewerId)
    if (peerConnection) {
      peerConnection.close()
      this.peerConnections.delete(viewerId)
    }

    const qualityMonitor = this.qualityMonitors.get(viewerId)
    if (qualityMonitor) {
      qualityMonitor()
      this.qualityMonitors.delete(viewerId)
    }

    log('info', `🧹 Removed peer connection for ${viewerId}`)
  }

  // Handle connection loss during streaming
  private handleConnectionLoss(): void {
    log('warn', '⚠️ Connection lost during streaming')
    
    // Keep streams alive but mark as connection issues
    this.config.onError?.({
      code: 'CONNECTION_LOST',
      message: 'Connection to streaming server lost. Attempting to reconnect...',
      timestamp: new Date().toISOString(),
      context: { isStreaming: this.isStreaming }
    })

    // The connection manager will handle reconnection
    // When reconnected, we'll need to re-establish the stream
  }

  // Handle stream end
  private handleStreamEnd(): void {
    this.isStreaming = false
    this.sessionId = null
    
    // Close all peer connections
    this.peerConnections.forEach((pc, viewerId) => {
      this.removePeerConnection(viewerId)
    })
    this.peerConnections.clear()

    // Stop quality monitoring
    this.qualityMonitors.forEach(stop => stop())
    this.qualityMonitors.clear()

    this.cleanup()
    this.emitStateChange()
  }

  // Cleanup all streams
  private async cleanup(): Promise<void> {
    if (this.currentStream) {
      stopMediaStream(this.currentStream)
      this.currentStream = null
    }

    if (this.webcamStream) {
      stopMediaStream(this.webcamStream)
      this.webcamStream = null
    }

    if (this.screenStream) {
      stopMediaStream(this.screenStream)
      this.screenStream = null
    }

    log('info', '🧹 Stream cleanup completed')
  }

  // Emit state change
  private emitStateChange(): void {
    const state: StreamState = {
      isLive: this.isStreaming,
      isConnecting: false,
      streamType: this.streamType,
      webcamEnabled: !!this.webcamStream,
      screenEnabled: !!this.screenStream,
      viewerCount: this.streamStats.currentViewers,
      sessionId: this.sessionId || undefined
    }

    this.config.onStateChange?.(state)
  }

  // Public getters
  get isLive(): boolean {
    return this.isStreaming
  }

  get currentStreamType(): StreamType {
    return this.streamType
  }

  get stream(): MediaStream | null {
    return this.currentStream
  }

  get statistics() {
    return {
      ...this.streamStats,
      duration: this.streamStats.startTime ? 
        Date.now() - this.streamStats.startTime.getTime() : 0,
      activePeerConnections: this.peerConnections.size
    }
  }

  get hasWebcam(): boolean {
    return !!this.webcamStream
  }

  get hasScreen(): boolean {
    return !!this.screenStream
  }

  // Destroy stream manager
  destroy(): void {
    this.handleStreamEnd()
    log('info', '🧹 Stream manager destroyed')
  }
}

export { StreamManager }