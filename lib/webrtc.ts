import { StreamError, MediaConstraints } from '@/types'

// Enhanced WebRTC configuration with multiple STUN/TURN servers
export const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.l.google.com:5349' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
}

// Optimized media constraints for different stream types
export const mediaConstraints = {
  webcam: {
    video: {
      width: { ideal: 1280, max: 1920, min: 640 },
      height: { ideal: 720, max: 1080, min: 480 },
      frameRate: { ideal: 30, max: 60, min: 15 },
      aspectRatio: { ideal: 16/9 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: { ideal: 44100 },
      channelCount: { ideal: 2 }
    }
  } as MediaConstraints,
  
  screen: {
    video: {
      width: { ideal: 1920, max: 3840, min: 1280 },
      height: { ideal: 1080, max: 2160, min: 720 },
      frameRate: { ideal: 30, max: 60, min: 15 },
      cursor: 'always',
      displaySurface: 'monitor'
    },
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  } as MediaConstraints
}

// Fallback constraints for older browsers or limited devices
export const fallbackConstraints = {
  webcam: {
    video: {
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
      frameRate: { ideal: 15, max: 30 }
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true
    }
  } as MediaConstraints,
  
  screen: {
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 15, max: 30 }
    },
    audio: true
  } as MediaConstraints
}

// Get user media stream with enhanced error handling
export async function getUserMediaStream(streamType: 'webcam' | 'screen'): Promise<MediaStream> {
  try {
    console.log(`📹 Requesting ${streamType} stream...`)
    
    if (streamType === 'webcam') {
      // Try with optimal constraints first
      try {
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints.webcam)
        console.log('✅ Got webcam stream with optimal settings')
        return stream
      } catch (error) {
        console.warn('⚠️ Optimal webcam constraints failed, trying fallback:', error)
        // Fallback to basic constraints
        const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints.webcam)
        console.log('✅ Got webcam stream with fallback settings')
        return stream
      }
    } else {
      // Screen sharing with fallback
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints.screen)
        console.log('✅ Got screen stream with optimal settings')
        return stream
      } catch (error) {
        console.warn('⚠️ Optimal screen constraints failed, trying fallback:', error)
        const stream = await navigator.mediaDevices.getDisplayMedia(fallbackConstraints.screen)
        console.log('✅ Got screen stream with fallback settings')
        return stream
      }
    }
  } catch (error) {
    console.error(`❌ Error getting ${streamType} stream:`, error)
    
    // Provide specific error messages
    let errorMessage = `Failed to access ${streamType === 'webcam' ? 'camera' : 'screen'}.`
    
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
        errorMessage += ` Please allow ${streamType === 'webcam' ? 'camera and microphone' : 'screen sharing'} permissions and try again.`
      } else if (error.name === 'NotFoundError') {
        errorMessage += ` No ${streamType === 'webcam' ? 'camera or microphone' : 'screen'} device found.`
      } else if (error.name === 'NotReadableError') {
        errorMessage += ` ${streamType === 'webcam' ? 'Camera or microphone' : 'Screen'} is already in use by another application.`
      } else if (error.name === 'OverconstrainedError') {
        errorMessage += ' The requested media settings are not supported by your device.'
      } else if (error.name === 'AbortError') {
        errorMessage += ' Media access was cancelled.'
      } else {
        errorMessage += ` ${error.message}`
      }
    }
    
    throw createStreamError('MEDIA_ACCESS_DENIED', errorMessage, error)
  }
}

// Combine multiple streams with error handling
export async function combineStreams(streams: MediaStream[]): Promise<MediaStream> {
  const combinedStream = new MediaStream()
  
  try {
    streams.forEach(stream => {
      if (stream && stream.getTracks) {
        stream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            combinedStream.addTrack(track)
          }
        })
      }
    })
    
    if (combinedStream.getTracks().length === 0) {
      throw new Error('No active tracks found in provided streams')
    }
    
    console.log(`✅ Combined ${streams.length} streams into one (${combinedStream.getTracks().length} tracks)`)
    return combinedStream
  } catch (error) {
    console.error('❌ Error combining streams:', error)
    throw createStreamError('STREAM_COMBINE_FAILED', 'Failed to combine multiple streams', error)
  }
}

// Create peer connection with enhanced configuration
export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onConnectionStateChange: (state: RTCPeerConnectionState) => void,
  onTrack?: (event: RTCTrackEvent) => void
): RTCPeerConnection {
  try {
    const peerConnection = new RTCPeerConnection(rtcConfiguration)
    
    // Enhanced ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate generated:', event.candidate.type)
        onIceCandidate(event.candidate)
      } else {
        console.log('🧊 ICE gathering complete')
      }
    }
    
    // Connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState
      console.log('🔗 Connection state changed:', state)
      onConnectionStateChange(state)
      
      // Handle connection failures
      if (state === 'failed') {
        console.error('❌ Peer connection failed, attempting restart')
        peerConnection.restartIce()
      }
    }
    
    // ICE connection state monitoring
    peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', peerConnection.iceConnectionState)
    }
    
    // ICE gathering state monitoring
    peerConnection.onicegatheringstatechange = () => {
      console.log('🧊 ICE gathering state:', peerConnection.iceGatheringState)
    }
    
    // Handle incoming tracks (for viewers)
    if (onTrack) {
      peerConnection.ontrack = (event) => {
        console.log('📺 Received remote track:', event.track.kind, event.track.label)
        onTrack(event)
      }
    }
    
    // Data channel for additional communication (optional)
    try {
      const dataChannel = peerConnection.createDataChannel('status', {
        ordered: true,
        maxRetransmits: 3
      })
      
      dataChannel.onopen = () => {
        console.log('📡 Data channel opened')
      }
      
      dataChannel.onmessage = (event) => {
        console.log('📡 Data channel message:', event.data)
      }
    } catch (error) {
      console.warn('⚠️ Could not create data channel:', error)
    }
    
    return peerConnection
  } catch (error) {
    console.error('❌ Failed to create peer connection:', error)
    throw createStreamError('PEER_CONNECTION_FAILED', 'Failed to create WebRTC peer connection', error)
  }
}

// Create offer for broadcaster with retry logic
export async function createOffer(
  peerConnection: RTCPeerConnection,
  stream: MediaStream
): Promise<RTCSessionDescriptionInit> {
  try {
    console.log('📤 Creating WebRTC offer...')
    
    // Add stream tracks to peer connection
    stream.getTracks().forEach(track => {
      console.log(`➕ Adding ${track.kind} track:`, track.label)
      peerConnection.addTrack(track, stream)
    })
    
    // Create offer with enhanced options
    const offer = await peerConnection.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true,
      iceRestart: false
    })
    
    // Set local description
    await peerConnection.setLocalDescription(offer)
    
    console.log('✅ WebRTC offer created successfully')
    return offer
  } catch (error) {
    console.error('❌ Error creating offer:', error)
    throw createStreamError('OFFER_CREATION_FAILED', 'Failed to create WebRTC offer', error)
  }
}

// Create answer for viewer with enhanced error handling
export async function createAnswer(
  peerConnection: RTCPeerConnection,
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  try {
    console.log('📥 Creating WebRTC answer for offer...')
    
    // Set remote description
    await peerConnection.setRemoteDescription(offer)
    
    // Create answer
    const answer = await peerConnection.createAnswer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true
    })
    
    // Set local description
    await peerConnection.setLocalDescription(answer)
    
    console.log('✅ WebRTC answer created successfully')
    return answer
  } catch (error) {
    console.error('❌ Error creating answer:', error)
    throw createStreamError('ANSWER_CREATION_FAILED', 'Failed to create WebRTC answer', error)
  }
}

// Handle ICE candidate with validation
export async function handleIceCandidate(
  peerConnection: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  try {
    if (candidate && candidate.candidate) {
      await peerConnection.addIceCandidate(candidate)
      console.log('✅ ICE candidate added successfully')
    }
  } catch (error) {
    console.error('❌ Error adding ICE candidate:', error)
    // Don't throw error for ICE candidate failures as they're not always critical
  }
}

// Stop media stream safely
export function stopMediaStream(stream: MediaStream): void {
  try {
    if (stream && stream.getTracks) {
      stream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop()
          console.log(`🛑 Stopped ${track.kind} track:`, track.label)
        }
      })
    }
  } catch (error) {
    console.error('❌ Error stopping media stream:', error)
  }
}

// Enhanced WebRTC support check
export function checkWebRTCSupport(): boolean {
  try {
    const hasWebRTC = !!(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function' &&
      typeof window !== 'undefined' &&
      window.RTCPeerConnection &&
      typeof window.RTCPeerConnection === 'function'
    )
    
    if (!hasWebRTC) {
      console.error('❌ WebRTC not supported in this browser')
      return false
    }
    
    // Test creating a peer connection
    try {
      const testPc = new RTCPeerConnection()
      testPc.close()
      console.log('✅ WebRTC support confirmed')
      return true
    } catch (error) {
      console.error('❌ WebRTC peer connection test failed:', error)
      return false
    }
  } catch (error) {
    console.error('❌ WebRTC support check failed:', error)
    return false
  }
}

// Create stream error with enhanced details
function createStreamError(code: string, message: string, originalError?: any): StreamError {
  const error: StreamError = {
    code,
    message,
    details: originalError,
    browserInfo: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown', 
      language: typeof navigator !== 'undefined' ? navigator.language : 'Unknown'
    }
  }
  
  return error
}

// Get enhanced media devices info
export async function getMediaDevices(): Promise<{
  hasCamera: boolean;
  hasMicrophone: boolean;
  hasScreen: boolean;
  devices: MediaDeviceInfo[];
  permissions: {
    camera: PermissionState | 'unknown';
    microphone: PermissionState | 'unknown';
  };
}> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    
    // Check permissions
    let cameraPermission: PermissionState | 'unknown' = 'unknown'
    let microphonePermission: PermissionState | 'unknown' = 'unknown'
    
    try {
      if (navigator.permissions) {
        const cameraResult = await navigator.permissions.query({ name: 'camera' as PermissionName })
        const micResult = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        cameraPermission = cameraResult.state
        microphonePermission = micResult.state
      }
    } catch (error) {
      console.warn('⚠️ Could not check permissions:', error)
    }
    
    return {
      hasCamera: devices.some(device => device.kind === 'videoinput'),
      hasMicrophone: devices.some(device => device.kind === 'audioinput'),
      hasScreen: typeof navigator.mediaDevices.getDisplayMedia === 'function',
      devices: devices.filter(device => device.deviceId !== ''),
      permissions: {
        camera: cameraPermission,
        microphone: microphonePermission
      }
    }
  } catch (error) {
    console.error('❌ Error getting media devices:', error)
    return {
      hasCamera: false,
      hasMicrophone: false,
      hasScreen: false,
      devices: [],
      permissions: {
        camera: 'unknown',
        microphone: 'unknown'
      }
    }
  }
}

// Enhanced connection quality monitoring
export function monitorConnectionQuality(
  peerConnection: RTCPeerConnection,
  onStatsUpdate: (stats: {
    bytesReceived: number;
    bytesSent: number;
    packetsLost: number;
    jitter: number;
    rtt: number;
    bandwidth: number;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
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
      let bandwidth = 0
      
      stats.forEach(report => {
        if (report.type === 'inbound-rtp') {
          bytesReceived += report.bytesReceived || 0
          packetsLost += report.packetsLost || 0
          jitter += report.jitter || 0
        } else if (report.type === 'outbound-rtp') {
          bytesSent += report.bytesSent || 0
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          rtt = report.currentRoundTripTime || 0
          bandwidth = report.availableOutgoingBitrate || 0
        }
      })
      
      // Calculate quality based on metrics
      let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent'
      
      if (rtt > 0.3 || packetsLost > 50 || jitter > 0.1) {
        quality = 'poor'
      } else if (rtt > 0.2 || packetsLost > 20 || jitter > 0.05) {
        quality = 'fair'
      } else if (rtt > 0.1 || packetsLost > 5 || jitter > 0.02) {
        quality = 'good'
      }
      
      onStatsUpdate({
        bytesReceived,
        bytesSent,
        packetsLost,
        jitter,
        rtt,
        bandwidth,
        quality
      })
    } catch (error) {
      console.error('❌ Error getting connection stats:', error)
    }
  }, 5000) // Update every 5 seconds
  
  return () => clearInterval(interval)
}

// Test network connectivity
export async function testNetworkConnectivity(): Promise<{
  online: boolean;
  latency: number;
  canReachStun: boolean;
}> {
  const result = {
    online: navigator.onLine,
    latency: 0,
    canReachStun: false
  }
  
  try {
    // Test latency with a simple request
    const start = Date.now()
    await fetch('https://www.google.com/favicon.ico', { 
      mode: 'no-cors',
      cache: 'no-cache'
    })
    result.latency = Date.now() - start
    
    // Test STUN server connectivity
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })
    
    pc.createDataChannel('test')
    await pc.createOffer()
    
    // Wait a bit for ICE gathering
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    result.canReachStun = pc.iceGatheringState === 'complete'
    pc.close()
    
  } catch (error) {
    console.warn('⚠️ Network connectivity test failed:', error)
  }
  
  return result
}