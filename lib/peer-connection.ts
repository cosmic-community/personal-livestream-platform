import { getWebRTCConfig } from '@/lib/stream-config'

export interface PeerConnectionEvents {
  onIceCandidate: (candidate: RTCIceCandidate) => void
  onConnectionStateChange: (state: RTCPeerConnectionState) => void
  onTrack?: (event: RTCTrackEvent) => void
  onDataChannel?: (channel: RTCDataChannel) => void
}

export class PeerConnectionManager {
  private peerConnection: RTCPeerConnection | null = null
  private events: PeerConnectionEvents
  private config: RTCConfiguration
  private localStream: MediaStream | null = null

  constructor(events: PeerConnectionEvents) {
    this.events = events
    this.config = getWebRTCConfig()
  }

  private log(message: string, data?: any): void {
    console.log(`[PeerConnection] ${message}`, data || '')
  }

  createPeerConnection(): RTCPeerConnection {
    if (this.peerConnection) {
      this.peerConnection.close()
    }

    this.log('Creating new peer connection with config:', this.config)
    this.peerConnection = new RTCPeerConnection(this.config)

    this.setupEventHandlers()
    return this.peerConnection
  }

  private setupEventHandlers(): void {
    if (!this.peerConnection) return

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.log('ICE candidate generated')
        this.events.onIceCandidate(event.candidate)
      }
    }

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState
      this.log('Connection state changed:', state)
      if (state) {
        this.events.onConnectionStateChange(state)
      }
    }

    this.peerConnection.ontrack = (event) => {
      this.log('Remote track received')
      this.events.onTrack?.(event)
    }

    this.peerConnection.ondatachannel = (event) => {
      this.log('Data channel received')
      this.events.onDataChannel?.(event.channel)
    }

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState
      this.log('ICE connection state changed:', state)
    }

    this.peerConnection.onicegatheringstatechange = () => {
      const state = this.peerConnection?.iceGatheringState
      this.log('ICE gathering state changed:', state)
    }
  }

  async addLocalStream(stream: MediaStream): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created')
    }

    this.localStream = stream
    
    stream.getTracks().forEach(track => {
      if (this.peerConnection && this.localStream) {
        this.peerConnection.addTrack(track, this.localStream)
      }
    })

    this.log('Local stream added to peer connection')
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created')
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    })

    await this.peerConnection.setLocalDescription(offer)
    this.log('Offer created and set as local description')

    return offer
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created')
    }

    await this.peerConnection.setRemoteDescription(offer)
    
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)
    
    this.log('Answer created and set as local description')
    return answer
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created')
    }

    await this.peerConnection.setRemoteDescription(description)
    this.log('Remote description set')
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not created')
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      this.log('ICE candidate added successfully')
    } catch (error) {
      console.error('Error adding ICE candidate:', error)
      throw error
    }
  }

  getStats(): Promise<RTCStatsReport> | null {
    if (!this.peerConnection) {
      return null
    }

    return this.peerConnection.getStats()
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null
  }

  close(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }

    this.log('Peer connection closed and cleaned up')
  }
}

export default PeerConnectionManager