export interface WebRTCConfig {
  iceServers: RTCIceServer[]
  iceCandidatePoolSize?: number
  bundlePolicy?: RTCBundlePolicy
  rtcpMuxPolicy?: RTCRtcpMuxPolicy
}

export interface PeerConnectionCallbacks {
  onIceCandidate: (candidate: RTCIceCandidate) => void
  onConnectionStateChange: (state: RTCPeerConnectionState) => void
  onTrack: (event: RTCTrackEvent) => void
}

const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
}

export function checkWebRTCSupport(): boolean {
  return !!(
    window.RTCPeerConnection &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  )
}

export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onConnectionStateChange: (state: RTCPeerConnectionState) => void,
  onTrack: (event: RTCTrackEvent) => void,
  config: WebRTCConfig = DEFAULT_WEBRTC_CONFIG
): RTCPeerConnection {
  if (!checkWebRTCSupport()) {
    throw new Error('WebRTC is not supported in this browser')
  }

  const peerConnection = new RTCPeerConnection(config)

  // Set up event handlers
  peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      onIceCandidate(event.candidate)
    }
  }

  peerConnection.onconnectionstatechange = () => {
    onConnectionStateChange(peerConnection.connectionState)
  }

  peerConnection.ontrack = onTrack

  return peerConnection
}

export async function createOffer(peerConnection: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  const offer = await peerConnection.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
  })
  
  await peerConnection.setLocalDescription(offer)
  return offer
}

export async function createAnswer(
  peerConnection: RTCPeerConnection, 
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  await peerConnection.setRemoteDescription(offer)
  
  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)
  
  return answer
}

export async function handleIceCandidate(
  peerConnection: RTCPeerConnection, 
  candidate: RTCIceCandidateInit
): Promise<void> {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
  } catch (error) {
    console.error('Error adding ICE candidate:', error)
    throw error
  }
}

export async function getUserMediaStream(constraints?: MediaStreamConstraints): Promise<MediaStream> {
  const defaultConstraints: MediaStreamConstraints = {
    video: true,
    audio: true
  }
  
  try {
    return await navigator.mediaDevices.getUserMedia(constraints || defaultConstraints)
  } catch (error) {
    console.error('Error accessing user media:', error)
    throw error
  }
}

export async function getDisplayMediaStream(constraints?: DisplayMediaStreamOptions): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getDisplayMedia(constraints)
  } catch (error) {
    console.error('Error accessing display media:', error)
    throw error
  }
}

export function stopMediaStream(stream: MediaStream): void {
  stream.getTracks().forEach(track => {
    track.stop()
  })
}

export function combineStreams(streams: MediaStream[]): MediaStream {
  const combinedStream = new MediaStream()
  
  streams.forEach(stream => {
    stream.getTracks().forEach(track => {
      combinedStream.addTrack(track)
    })
  })
  
  return combinedStream
}

export function monitorConnectionQuality(
  peerConnection: RTCPeerConnection,
  callback: (stats: RTCStatsReport) => void
): () => void {
  let intervalId: NodeJS.Timeout | null = null
  
  const startMonitoring = async () => {
    try {
      const stats = await peerConnection.getStats()
      callback(stats)
    } catch (error) {
      console.error('Error getting connection stats:', error)
    }
  }
  
  intervalId = setInterval(startMonitoring, 5000)
  
  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}