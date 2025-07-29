import { io, Socket } from 'socket.io-client'
import { ServerToClientEvents, ClientToServerEvents } from '@/types'

class SocketManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect(url: string = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000'): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (this.socket?.connected) {
      return this.socket
    }

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    })

    this.setupEventListeners()
    return this.socket
  }

  private setupEventListeners(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id)
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        return
      }

      this.handleReconnect()
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      this.handleReconnect()
    })
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
      this.socket?.connect()
    }, delay)
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.reconnectAttempts = 0
  }

  getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // Broadcaster methods
  startBroadcast(streamType: 'webcam' | 'screen' | 'both'): void {
    if (this.socket?.connected) {
      this.socket.emit('start-broadcast', { streamType })
    }
  }

  stopBroadcast(): void {
    if (this.socket?.connected) {
      this.socket.emit('stop-broadcast')
    }
  }

  sendStreamOffer(offer: RTCSessionDescriptionInit): void {
    if (this.socket?.connected) {
      this.socket.emit('stream-offer', offer)
    }
  }

  sendStreamAnswer(answer: RTCSessionDescriptionInit): void {
    if (this.socket?.connected) {
      this.socket.emit('stream-answer', answer)
    }
  }

  sendIceCandidate(candidate: RTCIceCandidateInit): void {
    if (this.socket?.connected) {
      this.socket.emit('ice-candidate', candidate)
    }
  }

  // Viewer methods
  joinStream(): void {
    if (this.socket?.connected) {
      this.socket.emit('join-stream')
    }
  }

  leaveStream(): void {
    if (this.socket?.connected) {
      this.socket.emit('leave-stream')
    }
  }

  // Event listener helpers
  onStreamStarted(callback: (data: { sessionId: string; streamType: 'webcam' | 'screen' | 'both' }) => void): void {
    this.socket?.on('stream-started', callback)
  }

  onStreamEnded(callback: (data: { sessionId: string }) => void): void {
    this.socket?.on('stream-ended', callback)
  }

  onViewerCount(callback: (count: number) => void): void {
    this.socket?.on('viewer-count', callback)
  }

  onStreamOffer(callback: (offer: RTCSessionDescriptionInit) => void): void {
    this.socket?.on('stream-offer', callback)
  }

  onStreamAnswer(callback: (answer: RTCSessionDescriptionInit) => void): void {
    this.socket?.on('stream-answer', callback)
  }

  onIceCandidate(callback: (candidate: RTCIceCandidateInit) => void): void {
    this.socket?.on('ice-candidate', callback)
  }

  onStreamError(callback: (error: string) => void): void {
    this.socket?.on('stream-error', callback)
  }

  // Remove event listeners
  off(event: keyof ServerToClientEvents, callback?: (data: { sessionId: string; streamType: 'webcam' | 'screen' | 'both' }) => void | ((data: { sessionId: string }) => void) | ((count: number) => void) | ((offer: RTCSessionDescriptionInit) => void) | ((answer: RTCSessionDescriptionInit) => void) | ((candidate: RTCIceCandidateInit) => void) | ((error: string) => void)): void {
    if (callback) {
      this.socket?.off(event, callback)
    } else {
      this.socket?.off(event)
    }
  }
}

// Export singleton instance
export const socketManager = new SocketManager()

// Export socket instance getter for direct access
export const getSocket = () => socketManager.getSocket()