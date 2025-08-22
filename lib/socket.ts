import { io, Socket } from 'socket.io-client'

interface SocketEvents {
  // Broadcaster events
  'start-broadcast': (data: { type: string }) => void
  'stop-broadcast': () => void
  'offer': (data: { offer: RTCSessionDescriptionInit; socketId: string }) => void
  'ice-candidate': (data: { candidate: RTCIceCandidateInit; socketId: string }) => void
  
  // Viewer events
  'join-stream': () => void
  'leave-stream': () => void
  'answer': (data: { answer: RTCSessionDescriptionInit; socketId: string }) => void
  
  // Server events (received)
  'viewer-joined': (data: { socketId: string }) => void
  'viewer-left': (data: { socketId: string }) => void
  'offer-received': (data: { offer: RTCSessionDescriptionInit; socketId: string }) => void
  'answer-received': (data: { answer: RTCSessionDescriptionInit; socketId: string }) => void
  'ice-candidate-received': (data: { candidate: RTCIceCandidateInit; socketId: string }) => void
  'viewer-count': (count: number) => void
  'stream-started': (data: { type: string }) => void
  'stream-ended': () => void
  'error': (error: string) => void
}

class SocketManager {
  private socket: Socket | null = null
  private isConnectedState = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect(): Socket {
    if (this.socket && this.isConnectedState) {
      return this.socket
    }

    const serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:3001'
    
    this.socket = io(serverUrl, {
      transports: ['websocket'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay
    })

    this.socket.on('connect', () => {
      console.log('✅ Connected to signaling server:', this.socket?.id)
      this.isConnectedState = true
      this.reconnectAttempts = 0
    })

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from signaling server:', reason)
      this.isConnectedState = false
    })

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message)
      this.isConnectedState = false
      this.handleReconnect()
    })

    return this.socket
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      
      setTimeout(() => {
        if (!this.isConnectedState) {
          this.connect()
        }
      }, this.reconnectDelay * this.reconnectAttempts)
    } else {
      console.error('❌ Max reconnection attempts reached')
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnectedState = false
    }
  }

  isConnected(): boolean {
    return this.isConnectedState && this.socket?.connected === true
  }

  // Broadcaster methods
  async startBroadcast(type: string) {
    if (!this.socket || !this.isConnectedState) {
      throw new Error('Not connected to signaling server')
    }
    this.socket.emit('start-broadcast', { type })
  }

  stopBroadcast() {
    if (this.socket && this.isConnectedState) {
      this.socket.emit('stop-broadcast')
    }
  }

  sendOffer(offer: RTCSessionDescriptionInit, socketId: string) {
    if (this.socket && this.isConnectedState) {
      this.socket.emit('offer', { offer, socketId })
    }
  }

  sendIceCandidate(candidate: RTCIceCandidate, socketId: string) {
    if (this.socket && this.isConnectedState) {
      this.socket.emit('ice-candidate', { candidate: candidate.toJSON(), socketId })
    }
  }

  // Viewer methods
  joinStream() {
    if (this.socket && this.isConnectedState) {
      this.socket.emit('join-stream')
    }
  }

  leaveStream() {
    if (this.socket && this.isConnectedState) {
      this.socket.emit('leave-stream')
    }
  }

  sendAnswer(answer: RTCSessionDescriptionInit, socketId: string) {
    if (this.socket && this.isConnectedState) {
      this.socket.emit('answer', { answer, socketId })
    }
  }

  // Event listeners
  onViewerJoined(callback: (data: { socketId: string }) => void) {
    if (this.socket) {
      this.socket.on('viewer-joined', callback)
    }
  }

  onViewerLeft(callback: (data: { socketId: string }) => void) {
    if (this.socket) {
      this.socket.on('viewer-left', callback)
    }
  }

  onOffer(callback: (data: { offer: RTCSessionDescriptionInit; socketId: string }) => void) {
    if (this.socket) {
      this.socket.on('offer-received', callback)
    }
  }

  onAnswer(callback: (data: { answer: RTCSessionDescriptionInit; socketId: string }) => void) {
    if (this.socket) {
      this.socket.on('answer-received', callback)
    }
  }

  onIceCandidate(callback: (data: { candidate: RTCIceCandidateInit; socketId: string }) => void) {
    if (this.socket) {
      this.socket.on('ice-candidate-received', callback)
    }
  }

  onViewerCount(callback: (count: number) => void) {
    if (this.socket) {
      this.socket.on('viewer-count', callback)
    }
  }

  onStreamStarted(callback: (data: { type: string }) => void) {
    if (this.socket) {
      this.socket.on('stream-started', callback)
    }
  }

  onStreamEnded(callback: () => void) {
    if (this.socket) {
      this.socket.on('stream-ended', callback)
    }
  }

  onError(callback: (error: string) => void) {
    if (this.socket) {
      this.socket.on('error', callback)
    }
  }
}

// Export singleton instance
export const socketManager = new SocketManager()
export default socketManager