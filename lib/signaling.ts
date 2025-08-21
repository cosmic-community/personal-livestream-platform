import { socketManager } from '@/lib/socket'
import { log } from '@/lib/stream-config'
import { WebRTCOffer, WebRTCAnswer, WebRTCIceCandidate } from '@/types'

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'error'
  data: any
  from?: string
  to?: string
  timestamp: number
}

export interface SignalingConfig {
  onOffer?: (offer: RTCSessionDescriptionInit, from: string) => void
  onAnswer?: (answer: RTCSessionDescriptionInit, from: string) => void
  onIceCandidate?: (candidate: RTCIceCandidateInit, from: string) => void
  onPeerJoined?: (peerId: string) => void
  onPeerLeft?: (peerId: string) => void
  onError?: (error: any) => void
}

class SignalingManager {
  private config: SignalingConfig = {}
  private isInitialized = false
  private messageQueue: SignalingMessage[] = []
  private connectedPeers: Set<string> = new Set()

  constructor(config: SignalingConfig = {}) {
    this.config = config
    this.initialize()
  }

  private initialize(): void {
    if (this.isInitialized) return

    log('info', '📡 Initializing signaling manager')

    // Setup socket event listeners for WebRTC signaling
    this.setupSocketListeners()
    
    this.isInitialized = true
    this.processMessageQueue()
  }

  private setupSocketListeners(): void {
    // WebRTC Offer
    socketManager.onStreamOffer((data: WebRTCOffer) => {
      const offer = data.offer || data
      const from = data.from || 'unknown'
      log('info', `📥 Received WebRTC offer from ${from}`)
      
      if (this.config.onOffer && offer) {
        this.config.onOffer(offer, from)
      }
    })

    // WebRTC Answer
    socketManager.onStreamAnswer((data: WebRTCAnswer) => {
      const answer = data.answer || data
      const from = data.from || 'unknown'
      log('info', `📥 Received WebRTC answer from ${from}`)
      
      if (this.config.onAnswer && answer) {
        this.config.onAnswer(answer, from)
      }
    })

    // ICE Candidate - Fixed parameter type handling
    socketManager.onIceCandidate((data: { candidate: RTCIceCandidateInit; socketId: string }) => {
      const from = data.socketId || 'unknown'
      log('info', `📥 Received ICE candidate from ${from}`)
      
      if (this.config.onIceCandidate && data.candidate) {
        // Create proper RTCIceCandidateInit from the data
        const iceCandidate: RTCIceCandidateInit = {
          candidate: typeof data.candidate === 'string' ? data.candidate : data.candidate.candidate,
          sdpMLineIndex: data.candidate.sdpMLineIndex,
          sdpMid: data.candidate.sdpMid,
          usernameFragment: data.candidate.usernameFragment
        }
        this.config.onIceCandidate(iceCandidate, from)
      }
    })

    // Peer joined
    socketManager.on('peer-joined', (data) => {
      const { peerId } = data
      log('info', `👤 Peer joined: ${peerId}`)
      
      this.connectedPeers.add(peerId)
      if (this.config.onPeerJoined) {
        this.config.onPeerJoined(peerId)
      }
    })

    // Peer left
    socketManager.on('peer-left', (data) => {
      const { peerId } = data
      log('info', `👤 Peer left: ${peerId}`)
      
      this.connectedPeers.delete(peerId)
      if (this.config.onPeerLeft) {
        this.config.onPeerLeft(peerId)
      }
    })

    // Signaling errors
    socketManager.onStreamError((error) => {
      log('error', '❌ Signaling error:', error)
      if (this.config.onError) {
        this.config.onError(error)
      }
    })

    log('info', '✅ Signaling listeners setup complete')
  }

  private processMessageQueue(): void {
    if (!this.isInitialized) return

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (message) {
        this.handleMessage(message)
      }
    }
  }

  private handleMessage(message: SignalingMessage): void {
    switch (message.type) {
      case 'offer':
        if (this.config.onOffer) {
          this.config.onOffer(message.data, message.from || 'unknown')
        }
        break

      case 'answer':
        if (this.config.onAnswer) {
          this.config.onAnswer(message.data, message.from || 'unknown')
        }
        break

      case 'ice-candidate':
        if (this.config.onIceCandidate) {
          this.config.onIceCandidate(message.data, message.from || 'unknown')
        }
        break

      case 'join':
        if (message.from) {
          this.connectedPeers.add(message.from)
          if (this.config.onPeerJoined) {
            this.config.onPeerJoined(message.from)
          }
        }
        break

      case 'leave':
        if (message.from) {
          this.connectedPeers.delete(message.from)
          if (this.config.onPeerLeft) {
            this.config.onPeerLeft(message.from)
          }
        }
        break

      case 'error':
        if (this.config.onError) {
          this.config.onError(message.data)
        }
        break

      default:
        log('warn', '⚠️ Unknown signaling message type:', message.type)
    }
  }

  // Public methods for sending signaling messages

  sendOffer(offer: RTCSessionDescriptionInit, targetId?: string): void {
    if (!this.isInitialized) {
      this.queueMessage({
        type: 'offer',
        data: offer,
        to: targetId,
        timestamp: Date.now()
      })
      return
    }

    log('info', `📤 Sending WebRTC offer${targetId ? ` to ${targetId}` : ''}`)
    socketManager.sendOffer(offer, targetId)
  }

  sendAnswer(answer: RTCSessionDescriptionInit, targetId: string): void {
    if (!this.isInitialized) {
      this.queueMessage({
        type: 'answer',
        data: answer,
        to: targetId,
        timestamp: Date.now()
      })
      return
    }

    log('info', `📤 Sending WebRTC answer to ${targetId}`)
    socketManager.sendAnswer(answer, targetId)
  }

  sendIceCandidate(candidate: RTCIceCandidateInit, targetId?: string): void {
    if (!this.isInitialized) {
      this.queueMessage({
        type: 'ice-candidate',
        data: candidate,
        to: targetId,
        timestamp: Date.now()
      })
      return
    }

    log('info', `📤 Sending ICE candidate${targetId ? ` to ${targetId}` : ''}`)
    socketManager.sendIceCandidate(candidate, targetId)
  }

  joinRoom(roomId: string): void {
    if (!socketManager.isConnected()) {
      log('warn', '⚠️ Cannot join room - not connected to signaling server')
      return
    }

    log('info', `🚪 Joining room: ${roomId}`)
    const socket = socketManager.connect()
    if (socket) {
      socket.emit('join-room', {
        roomId,
        timestamp: Date.now(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
      })
    }
  }

  leaveRoom(roomId: string): void {
    if (!socketManager.isConnected()) {
      return
    }

    log('info', `🚪 Leaving room: ${roomId}`)
    const socket = socketManager.connect()
    if (socket) {
      socket.emit('leave-room', {
        roomId,
        timestamp: Date.now()
      })
    }
  }

  broadcast(message: any): void {
    if (!this.isInitialized) {
      log('warn', '⚠️ Cannot broadcast - signaling not initialized')
      return
    }

    log('info', '📢 Broadcasting message to all peers')
    const socket = socketManager.connect()
    if (socket) {
      socket.emit('broadcast', {
        message,
        timestamp: Date.now(),
        from: socket.id
      })
    }
  }

  sendToPeer(peerId: string, message: any): void {
    if (!this.isInitialized) {
      log('warn', '⚠️ Cannot send message - signaling not initialized')
      return
    }

    log('info', `📤 Sending message to peer: ${peerId}`)
    const socket = socketManager.connect()
    if (socket) {
      socket.emit('peer-message', {
        to: peerId,
        message,
        timestamp: Date.now(),
        from: socket.id
      })
    }
  }

  private queueMessage(message: SignalingMessage): void {
    this.messageQueue.push(message)
    log('info', `📝 Queued signaling message: ${message.type}`)
  }

  // Configuration methods

  updateConfig(newConfig: Partial<SignalingConfig>): void {
    this.config = { ...this.config, ...newConfig }
    log('info', '⚙️ Signaling configuration updated')
  }

  on(event: keyof SignalingConfig, handler: Function): void {
    switch (event) {
      case 'onOffer':
        this.config.onOffer = handler as SignalingConfig['onOffer']
        break
      case 'onAnswer':
        this.config.onAnswer = handler as SignalingConfig['onAnswer']
        break
      case 'onIceCandidate':
        this.config.onIceCandidate = handler as SignalingConfig['onIceCandidate']
        break
      case 'onPeerJoined':
        this.config.onPeerJoined = handler as SignalingConfig['onPeerJoined']
        break
      case 'onPeerLeft':
        this.config.onPeerLeft = handler as SignalingConfig['onPeerLeft']
        break
      case 'onError':
        this.config.onError = handler as SignalingConfig['onError']
        break
    }
  }

  off(event: keyof SignalingConfig): void {
    switch (event) {
      case 'onOffer':
        this.config.onOffer = undefined
        break
      case 'onAnswer':
        this.config.onAnswer = undefined
        break
      case 'onIceCandidate':
        this.config.onIceCandidate = undefined
        break
      case 'onPeerJoined':
        this.config.onPeerJoined = undefined
        break
      case 'onPeerLeft':
        this.config.onPeerLeft = undefined
        break
      case 'onError':
        this.config.onError = undefined
        break
    }
  }

  // Status methods

  get isConnected(): boolean {
    return socketManager.isConnected()
  }

  get connectedPeersList(): string[] {
    return Array.from(this.connectedPeers)
  }

  get peerCount(): number {
    return this.connectedPeers.size
  }

  getConnectionInfo(): {
    isInitialized: boolean
    isConnected: boolean
    peerCount: number
    queuedMessages: number
    socketState: string
  } {
    return {
      isInitialized: this.isInitialized,
      isConnected: this.isConnected,
      peerCount: this.peerCount,
      queuedMessages: this.messageQueue.length,
      socketState: socketManager.getConnectionState()
    }
  }

  // Cleanup

  destroy(): void {
    log('info', '🧹 Destroying signaling manager')
    
    this.isInitialized = false
    this.messageQueue = []
    this.connectedPeers.clear()
    this.config = {}
  }
}

// Export singleton instance
export const signalingManager = new SignalingManager()

// Export class for creating additional instances if needed
export { SignalingManager }