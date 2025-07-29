import { io, Socket } from 'socket.io-client'
import { StreamType } from '@/types'

interface StreamStartedEvent {
  sessionId: string
  streamType: StreamType
  timestamp: string
}

interface StreamEndedEvent {
  sessionId: string
  timestamp: string
}

interface StreamErrorEvent {
  code: string
  message: string
  details?: any
}

class SocketManager {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private isConnecting = false

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    if (this.isConnecting) {
      return this.socket as Socket
    }

    this.isConnecting = true

    try {
      // Use environment variable or fallback to localhost for development
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:3001'
      
      this.socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        retries: 3,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      })

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id)
        this.isConnecting = false
        this.reconnectAttempts = 0
      })

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason)
        this.isConnecting = false
      })

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error)
        this.isConnecting = false
        this.reconnectAttempts++

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max reconnection attempts reached')
          this.socket?.disconnect()
        }
      })

      return this.socket

    } catch (error) {
      console.error('Failed to initialize socket:', error)
      this.isConnecting = false
      throw error
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.isConnecting = false
    this.reconnectAttempts = 0
  }

  // Broadcasting events
  startBroadcast(streamType: StreamType): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'))
        return
      }

      // Set up one-time listeners for the response
      const timeout = setTimeout(() => {
        this.socket?.off('stream-started')
        this.socket?.off('stream-error')
        reject(new Error('Stream start timeout - server did not respond'))
      }, 15000) // 15 second timeout

      this.socket.once('stream-started', (data: StreamStartedEvent) => {
        clearTimeout(timeout)
        console.log('Stream started successfully:', data)
        resolve()
      })

      this.socket.once('stream-error', (error: StreamErrorEvent) => {
        clearTimeout(timeout)
        console.error('Stream start failed:', error)
        reject(new Error(error.message || 'Failed to start stream'))
      })

      // Emit the start broadcast event
      this.socket.emit('start-broadcast', {
        streamType,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        resolution: {
          width: window.screen.width,
          height: window.screen.height
        }
      })
    })
  }

  stopBroadcast(): void {
    if (this.socket?.connected) {
      this.socket.emit('stop-broadcast', {
        timestamp: new Date().toISOString()
      })
    }
  }

  // Event listeners
  onStreamStarted(callback: (data: StreamStartedEvent) => void): void {
    this.socket?.on('stream-started', callback)
  }

  onStreamEnded(callback: (data: StreamEndedEvent) => void): void {
    this.socket?.on('stream-ended', callback)
  }

  onStreamError(callback: (error: StreamErrorEvent) => void): void {
    this.socket?.on('stream-error', callback)
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

  // Send WebRTC signaling data
  sendOffer(offer: RTCSessionDescriptionInit, targetId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('stream-offer', { offer, targetId })
    }
  }

  sendAnswer(answer: RTCSessionDescriptionInit, targetId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('stream-answer', { answer, targetId })
    }
  }

  sendIceCandidate(candidate: RTCIceCandidateInit, targetId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('ice-candidate', { candidate, targetId })
    }
  }

  // Get connection status
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  getSocketId(): string | undefined {
    return this.socket?.id
  }
}

// Export singleton instance
export const socketManager = new SocketManager()