export function checkWebRTCSupport(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const hasRTCPeerConnection = !!(
    window.RTCPeerConnection ||
    window.webkitRTCPeerConnection ||
    (window as any).mozRTCPeerConnection
  )

  const hasGetUserMedia = !!(
    navigator?.mediaDevices?.getUserMedia ||
    navigator?.getUserMedia ||
    (navigator as any)?.webkitGetUserMedia ||
    (navigator as any)?.mozGetUserMedia
  )

  const hasGetDisplayMedia = !!(
    navigator?.mediaDevices?.getDisplayMedia
  )

  return hasRTCPeerConnection && hasGetUserMedia
}

export async function getUserMediaStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia is not supported')
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    console.log('✅ User media stream acquired:', stream.getTracks().length, 'tracks')
    return stream
  } catch (error) {
    console.error('❌ Failed to get user media stream:', error)
    throw new Error(`Failed to access camera/microphone: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function getDisplayMediaStream(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (typeof window === 'undefined' || !navigator?.mediaDevices?.getDisplayMedia) {
    throw new Error('getDisplayMedia is not supported')
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia(constraints)
    console.log('✅ Display media stream acquired:', stream.getTracks().length, 'tracks')
    return stream
  } catch (error) {
    console.error('❌ Failed to get display media stream:', error)
    throw new Error(`Failed to access screen: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onConnectionStateChange: (state: RTCPeerConnectionState) => void,
  onTrack: (event: RTCTrackEvent) => void
): RTCPeerConnection {
  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  }

  const peerConnection = new RTCPeerConnection(configuration)

  peerConnection.addEventListener('icecandidate', (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate)
    }
  })

  peerConnection.addEventListener('connectionstatechange', () => {
    onConnectionStateChange(peerConnection.connectionState)
  })

  peerConnection.addEventListener('track', onTrack)

  return peerConnection
}

export async function createOffer(peerConnection: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
  try {
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    })
    
    await peerConnection.setLocalDescription(offer)
    return offer
  } catch (error) {
    console.error('❌ Failed to create offer:', error)
    throw new Error(`Failed to create offer: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function createAnswer(
  peerConnection: RTCPeerConnection,
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  try {
    await peerConnection.setRemoteDescription(offer)
    
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    
    return answer
  } catch (error) {
    console.error('❌ Failed to create answer:', error)
    throw new Error(`Failed to create answer: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function handleIceCandidate(
  peerConnection: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
  } catch (error) {
    console.error('❌ Failed to handle ICE candidate:', error)
  }
}

export function stopMediaStream(stream: MediaStream): void {
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop()
      console.log('🛑 Stopped track:', track.kind)
    })
  }
}

export function combineStreams(streams: MediaStream[]): MediaStream {
  const combinedStream = new MediaStream()
  
  streams.forEach(stream => {
    stream.getTracks().forEach(track => {
      combinedStream.addTrack(track)
    })
  })
  
  console.log('✅ Combined streams:', combinedStream.getTracks().length, 'tracks')
  return combinedStream
}

export function monitorConnectionQuality(
  peerConnection: RTCPeerConnection,
  onStats: (stats: RTCStatsReport) => void
): () => void {
  let intervalId: NodeJS.Timeout

  const getStats = async () => {
    try {
      const stats = await peerConnection.getStats()
      onStats(stats)
    } catch (error) {
      console.error('❌ Failed to get connection stats:', error)
    }
  }

  intervalId = setInterval(getStats, 5000)

  // Return cleanup function
  return () => {
    if (intervalId) {
      clearInterval(intervalId)
    }
  }
}