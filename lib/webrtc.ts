import { StreamError, MediaConstraints, RTCConfiguration } from '@/types'

// WebRTC configuration with STUN servers
export const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
}

// Media constraints for different stream types
export const mediaConstraints = {
  webcam: {
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  } as MediaConstraints,
  
  screen: {
    video: {
      width: { ideal: 1920, max: 3840 },
      height: { ideal: 1080, max: 2160 },
      frameRate: { ideal: 30, max: 60 }
    },
    audio: true
  } as MediaConstraints
}

// Get user media stream
export async function getUserMediaStream(streamType: 'webcam' | 'screen'): Promise<MediaStream> {
  try {
    if (streamType === 'webcam') {
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints.webcam)
      return stream
    } else {
      // Screen sharing
      const stream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints.screen)
      return stream
    }
  } catch (error) {
    console.error('Error getting media stream:', error)
    throw createStreamError('MEDIA_ACCESS_DENIED', 'Failed to access camera or microphone', error)
  }
}

// Combine multiple streams
export async function combineStreams(streams: MediaStream[]): Promise<MediaStream> {
  const combinedStream = new MediaStream()
  
  streams.forEach(stream => {
    stream.getTracks().forEach(track => {
      combinedStream.addTrack(track)
    })
  })
  
  return combinedStream
}

// Create peer connection
export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onConnectionStateChange: (state: RTCPeerConnectionState) => void,
  onTrack?: (event: RTCTrackEvent) => void
): RTCPeerConnection {
  const peerConnection = new RTCPeerConnection(rtcConfiguration)
  
  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate)
    }
  }
  
  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    onConnectionStateChange(peerConnection.connectionState)
  }
  
  // Handle incoming tracks (for viewers)
  if (onTrack) {
    peerConnection.ontrack = onTrack
  }
  
  return peerConnection
}

// Create offer for broadcaster
export async function createOffer(
  peerConnection: RTCPeerConnection,
  stream: MediaStream
): Promise<RTCSessionDescriptionInit> {
  try {
    // Add stream tracks to peer connection
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream)
    })
    
    // Create offer
    const offer = await peerConnection.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true
    })
    
    // Set local description
    await peerConnection.setLocalDescription(offer)
    
    return offer
  } catch (error) {
    console.error('Error creating offer:', error)
    throw createStreamError('OFFER_CREATION_FAILED', 'Failed to create WebRTC offer', error)
  }
}

// Create answer for viewer
export async function createAnswer(
  peerConnection: RTCPeerConnection,
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  try {
    // Set remote description
    await peerConnection.setRemoteDescription(offer)
    
    // Create answer
    const answer = await peerConnection.createAnswer()
    
    // Set local description
    await peerConnection.setLocalDescription(answer)
    
    return answer
  } catch (error) {
    console.error('Error creating answer:', error)
    throw createStreamError('ANSWER_CREATION_FAILED', 'Failed to create WebRTC answer', error)
  }
}

// Handle ICE candidate
export async function handleIceCandidate(
  peerConnection: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  try {
    await peerConnection.addIceCandidate(candidate)
  } catch (error) {
    console.error('Error adding ICE candidate:', error)
    throw createStreamError('ICE_CANDIDATE_FAILED', 'Failed to add ICE candidate', error)
  }
}

// Stop media stream
export function stopMediaStream(stream: MediaStream): void {
  stream.getTracks().forEach(track => {
    track.stop()
  })
}

// Check WebRTC support
export function checkWebRTCSupport(): boolean {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    navigator.mediaDevices.getDisplayMedia &&
    window.RTCPeerConnection
  )
}

// Create stream error
function createStreamError(code: string, message: string, originalError?: any): StreamError {
  return {
    code,
    message,
    details: originalError
  }
}

// Get media devices info
export async function getMediaDevices(): Promise<{
  hasCamera: boolean;
  hasMicrophone: boolean;
  devices: MediaDeviceInfo[];
}> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    
    return {
      hasCamera: devices.some(device => device.kind === 'videoinput'),
      hasMicrophone: devices.some(device => device.kind === 'audioinput'),
      devices
    }
  } catch (error) {
    console.error('Error getting media devices:', error)
    return {
      hasCamera: false,
      hasMicrophone: false,
      devices: []
    }
  }
}

// Monitor connection quality
export function monitorConnectionQuality(
  peerConnection: RTCPeerConnection,
  onStatsUpdate: (stats: {
    bytesReceived: number;
    bytesSent: number;
    packetsLost: number;
    jitter: number;
    rtt: number;
  }) => void
): () => void {
  const interval = setInterval(async () => {
    try {
      const stats = await peerConnection.getStats()
      let bytesReceived = 0
      let bytesSent = 0
      let packetsLost = 0
      let jitter = 0
      let rtt = 0
      
      stats.forEach(report => {
        if (report.type === 'inbound-rtp') {
          bytesReceived += report.bytesReceived || 0
          packetsLost += report.packetsLost || 0
          jitter += report.jitter || 0
        } else if (report.type === 'outbound-rtp') {
          bytesSent += report.bytesSent || 0
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          rtt = report.currentRoundTripTime || 0
        }
      })
      
      onStatsUpdate({
        bytesReceived,
        bytesSent,
        packetsLost,
        jitter,
        rtt
      })
    } catch (error) {
      console.error('Error getting connection stats:', error)
    }
  }, 5000) // Update every 5 seconds
  
  return () => clearInterval(interval)
}