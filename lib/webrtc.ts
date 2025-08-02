import { StreamError, MediaConstraints } from '@/types'

// Enhanced WebRTC configuration with multiple STUN/TURN servers
export const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.l.google.com:5349' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all'
}

// Optimized media constraints for different stream types
export const mediaConstraints = {
  webcam: {
    video: {
      width: { ideal: 1280, max: 1920, min: 640 },
      height: { ideal: 720, max: 1080, min: 480 },
      frameRate: { ideal: 30, max: 60, min: 15 },
      aspectRatio: { ideal: 16/9 },
      facingMode: 'user'
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

// Get user media stream with enhanced error handling and retry logic
export async function getUserMediaStream(streamType: 'webcam' | 'screen'): Promise<MediaStream | undefined> {
  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📹 Requesting ${streamType} stream (attempt ${attempt}/${maxRetries})...`)
      
      if (streamType === 'webcam') {
        // Try with optimal constraints first
        try {
          const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints.webcam)
          console.log('✅ Got webcam stream with optimal settings')
          return stream
        } catch (error) {
          console.warn(`⚠️ Optimal webcam constraints failed (attempt ${attempt}):`, error)
          
          // Try with fallback constraints
          if (attempt === maxRetries) {
            const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints.webcam)
            console.log('✅ Got webcam stream with fallback settings')
            return stream
          }
          throw error
        }
      } else {
        // Screen sharing with fallback
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints.screen)
          console.log('✅ Got screen stream with optimal settings')
          return stream
        } catch (error) {
          console.warn(`⚠️ Optimal screen constraints failed (attempt ${attempt}):`, error)
          
          // Try with fallback constraints  
          if (attempt === maxRetries) {
            const stream = await navigator.mediaDevices.getDisplayMedia(fallbackConstraints.screen)
            console.log('✅ Got screen stream with fallback settings')
            return stream
          }
          throw error
        }
      }
    } catch (error) {
      lastError = error as Error
      console.error(`❌ Error getting ${streamType} stream (attempt ${attempt}):`, error)
      
      // Don't retry for permission-related errors
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || 
            error.message.includes('Permission denied') ||
            error.name === 'AbortError') {
          break
        }
      }
      
      // Wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }
  
  // All attempts failed, log error and return undefined
  let errorMessage = `Failed to access ${streamType === 'webcam' ? 'camera' : 'screen'}.`
  
  if (lastError) {
    if (lastError.name === 'NotAllowedError' || lastError.message.includes('Permission denied')) {
      errorMessage += ` Please allow ${streamType === 'webcam' ? 'camera and microphone' : 'screen sharing'} permissions in your browser settings and try again.`
    } else if (lastError.name === 'NotFoundError') {
      errorMessage += ` No ${streamType === 'webcam' ? 'camera or microphone' : 'screen'} device found. Please check your devices and try again.`
    } else if (lastError.name === 'NotReadableError') {
      errorMessage += ` ${streamType === 'webcam' ? 'Camera or microphone' : 'Screen'} is already in use by another application. Please close other applications and try again.`
    } else if (lastError.name === 'OverconstrainedError') {
      errorMessage += ' The requested media settings are not supported by your device. Try with different settings.'
    } else if (lastError.name === 'AbortError') {
      errorMessage += ' Media access was cancelled by the user.'
    } else {
      errorMessage += ` ${lastError.message}`
    }
  }
  
  console.warn('⚠️ ' + errorMessage)
  return undefined
}

// Combine multiple streams with error handling
export async function combineStreams(streams: (MediaStream | undefined)[]): Promise<MediaStream | undefined> {
  const combinedStream = new MediaStream()
  
  try {
    const validStreams = streams.filter((stream): stream is MediaStream => 
      stream !== undefined && stream !== null && typeof stream.getTracks === 'function'
    )

    if (validStreams.length === 0) {
      console.warn('⚠️ No valid streams provided to combine')
      return undefined
    }

    validStreams.forEach((stream, index) => {
      const tracks = stream.getTracks()
      tracks.forEach(track => {
        if (track.readyState === 'live') {
          // Clone track to avoid conflicts
          const clonedTrack = track.clone()
          combinedStream.addTrack(clonedTrack)
          console.log(`➕ Added ${track.kind} track from stream ${index}: ${track.label}`)
        } else {
          console.warn(`⚠️ Skipping inactive track: ${track.label}`)
        }
      })
    })
    
    if (combinedStream.getTracks().length === 0) {
      console.warn('⚠️ No active tracks found in provided streams')
      return undefined
    }
    
    console.log(`✅ Combined ${validStreams.length} streams into one (${combinedStream.getTracks().length} tracks)`)
    return combinedStream
  } catch (error) {
    console.error('❌ Error combining streams:', error)
    return undefined
  }
}

// Create peer connection with enhanced configuration and monitoring
export function createPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onConnectionStateChange: (state: RTCPeerConnectionState) => void,
  onTrack?: (event: RTCTrackEvent) => void
): RTCPeerConnection {
  try {
    const peerConnection = new RTCPeerConnection(rtcConfiguration)
    
    // Enhanced ICE candidate handling with filtering
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Filter out problematic candidates
        if (event.candidate.candidate && 
            !event.candidate.candidate.includes('tcp') && // Prefer UDP
            event.candidate.type !== 'relay') { // Prefer direct connections
          console.log('🧊 ICE candidate generated:', event.candidate.type, event.candidate.protocol)
          onIceCandidate(event.candidate)
        }
      } else {
        console.log('🧊 ICE gathering complete')
      }
    }
    
    // Enhanced connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState
      console.log('🔗 Connection state changed:', state)
      onConnectionStateChange(state)
      
      // Handle connection failures with retry logic
      if (state === 'failed') {
        console.error('❌ Peer connection failed')
        // Try ICE restart
        setTimeout(() => {
          if (peerConnection.connectionState === 'failed') {
            console.log('🔄 Attempting ICE restart...')
            peerConnection.restartIce()
          }
        }, 1000)
      }
      
      if (state === 'disconnected') {
        console.warn('⚠️ Peer connection disconnected')
        // Give it some time to reconnect automatically
        setTimeout(() => {
          if (peerConnection.connectionState === 'disconnected') {
            console.log('🔄 Connection still disconnected, attempting ICE restart...')
            peerConnection.restartIce()
          }
        }, 5000)
      }
    }
    
    // ICE connection state monitoring
    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState
      console.log('🧊 ICE connection state:', iceState)
      
      if (iceState === 'failed') {
        console.error('❌ ICE connection failed')
        // Restart ICE gathering
        peerConnection.restartIce()
      }
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
    
    // Data channel for additional communication
    try {
      const dataChannel = peerConnection.createDataChannel('stream-metadata', {
        ordered: true,
        maxRetransmits: 3
      })
      
      dataChannel.onopen = () => {
        console.log('📡 Data channel opened')
        // Send initial metadata
        try {
          dataChannel.send(JSON.stringify({
            type: 'connection-info',
            timestamp: Date.now(),
            userAgent: navigator.userAgent
          }))
        } catch (error) {
          console.warn('⚠️ Could not send initial data channel message:', error)
        }
      }
      
      dataChannel.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('📡 Data channel message:', data.type)
        } catch (error) {
          console.log('📡 Data channel message (raw):', event.data)
        }
      }
      
      dataChannel.onerror = (error) => {
        console.warn('📡 Data channel error:', error)
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
  stream?: MediaStream
): Promise<RTCSessionDescriptionInit> {
  try {
    console.log('📤 Creating WebRTC offer...')
    
    // Add stream tracks to peer connection if stream is provided
    if (stream) {
      // Verify stream has active tracks
      const activeTracks = stream.getTracks().filter(track => track.readyState === 'live')
      if (activeTracks.length === 0) {
        console.warn('⚠️ No active tracks in stream, creating offer without media')
      } else {
        activeTracks.forEach(track => {
          console.log(`➕ Adding ${track.kind} track:`, track.label)
          const sender = peerConnection.addTrack(track, stream)
          
          // Configure encoding parameters for better quality
          if (track.kind === 'video') {
            const transceiver = peerConnection.getTransceivers().find(t => t.sender === sender)
            if (transceiver) {
              const capabilities = RTCRtpReceiver.getCapabilities('video')
              if (capabilities?.codecs) {
                transceiver.setCodecPreferences(
                  capabilities.codecs.filter(codec => codec.mimeType.includes('H264'))
                )
              }
            }
          }
        })
      }
    }
    
    // Create offer with enhanced options
    const offer = await peerConnection.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true,
      iceRestart: false
    })
    
    // Modify SDP for better performance (optional)
    if (offer.sdp) {
      // Prefer higher bitrates for video
      offer.sdp = offer.sdp.replace(
        /b=AS:(\d+)/g, 
        'b=AS:2000' // 2 Mbps max bitrate
      )
    }
    
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
    
    // Validate offer
    if (!offer || !offer.sdp) {
      throw new Error('Invalid offer received')
    }
    
    // Set remote description
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    
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

// Handle ICE candidate with validation and retry
export async function handleIceCandidate(
  peerConnection: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  try {
    if (candidate && candidate.candidate && candidate.candidate.trim() !== '') {
      // Validate candidate
      const rtcCandidate = new RTCIceCandidate(candidate)
      await peerConnection.addIceCandidate(rtcCandidate)
      console.log('✅ ICE candidate added successfully:', candidate.candidate.split(' ')[2])
    } else {
      console.log('🧊 Empty ICE candidate received (end of candidates)')
    }
  } catch (error) {
    console.error('❌ Error adding ICE candidate:', error)
    // Don't throw error for ICE candidate failures as they're not always critical
    // The connection might still work with other candidates
  }
}

// Stop media stream safely with cleanup
export function stopMediaStream(stream?: MediaStream): void {
  try {
    if (stream && stream.getTracks) {
      const tracks = stream.getTracks()
      tracks.forEach(track => {
        if (track.readyState === 'live') {
          track.stop()
          console.log(`🛑 Stopped ${track.kind} track:`, track.label)
        }
      })
      
      // Remove all tracks from stream
      tracks.forEach(track => {
        stream.removeTrack(track)
      })
    }
  } catch (error) {
    console.error('❌ Error stopping media stream:', error)
  }
}

// Enhanced WebRTC support check with detailed diagnostics
export function checkWebRTCSupport(): boolean {
  try {
    const checks = {
      navigator: typeof navigator !== 'undefined',
      mediaDevices: !!(navigator?.mediaDevices),
      getUserMedia: typeof navigator?.mediaDevices?.getUserMedia === 'function',
      getDisplayMedia: typeof navigator?.mediaDevices?.getDisplayMedia === 'function',
      RTCPeerConnection: !!(window?.RTCPeerConnection),
      RTCSessionDescription: !!(window?.RTCSessionDescription),
      RTCIceCandidate: !!(window?.RTCIceCandidate)
    }
    
    console.log('🔍 WebRTC support check:', checks)
    
    const hasBasicSupport = Object.values(checks).every(Boolean)
    
    if (!hasBasicSupport) {
      console.error('❌ WebRTC not supported - missing APIs:', 
        Object.entries(checks).filter(([, supported]) => !supported).map(([api]) => api)
      )
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
    timestamp: new Date().toISOString(),
    details: originalError,
    browserInfo: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown', 
      language: typeof navigator !== 'undefined' ? navigator.language : 'Unknown'
    }
  }
  
  return error
}

// Get enhanced media devices info with permissions
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
    // Request permissions first to get accurate device list
    let tempStream: MediaStream | undefined = undefined
    try {
      tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    } catch (error) {
      console.warn('⚠️ Could not get permission for device enumeration:', error)
    }
    
    const devices = await navigator.mediaDevices.enumerateDevices()
    
    // Clean up temp stream
    if (tempStream) {
      stopMediaStream(tempStream)
    }
    
    // Check permissions
    let cameraPermission: PermissionState | 'unknown' = 'unknown'
    let microphonePermission: PermissionState | 'unknown' = 'unknown'
    
    try {
      if (navigator.permissions) {
        const [cameraResult, micResult] = await Promise.all([
          navigator.permissions.query({ name: 'camera' as PermissionName }),
          navigator.permissions.query({ name: 'microphone' as PermissionName })
        ])
        cameraPermission = cameraResult.state
        microphonePermission = micResult.state
      }
    } catch (error) {
      console.warn('⚠️ Could not check permissions:', error)
    }
    
    const result = {
      hasCamera: devices.some(device => device.kind === 'videoinput'),
      hasMicrophone: devices.some(device => device.kind === 'audioinput'),
      hasScreen: typeof navigator.mediaDevices.getDisplayMedia === 'function',
      devices: devices.filter(device => device.deviceId !== ''),
      permissions: {
        camera: cameraPermission,
        microphone: microphonePermission
      }
    }
    
    console.log('📱 Media devices detected:', result)
    return result
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

// Enhanced connection quality monitoring with more metrics
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
    videoResolution?: { width: number; height: number };
    frameRate?: number;
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
      let videoResolution: { width: number; height: number } | undefined
      let frameRate: number | undefined
      
      stats.forEach(report => {
        if (report.type === 'inbound-rtp') {
          if (report.mediaType === 'video') {
            bytesReceived += report.bytesReceived || 0
            packetsLost += report.packetsLost || 0
            jitter += report.jitter || 0
            frameRate = report.framesPerSecond
            if (report.frameWidth && report.frameHeight) {
              videoResolution = { width: report.frameWidth, height: report.frameHeight }
            }
          } else if (report.mediaType === 'audio') {
            bytesReceived += report.bytesReceived || 0
            packetsLost += report.packetsLost || 0
            jitter += report.jitter || 0
          }
        } else if (report.type === 'outbound-rtp') {
          bytesSent += report.bytesSent || 0
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          rtt = report.currentRoundTripTime || 0
          bandwidth = report.availableOutgoingBitrate || 0
        }
      })
      
      // Calculate quality based on multiple metrics
      let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent'
      
      // More sophisticated quality calculation
      const rttScore = rtt < 0.1 ? 4 : rtt < 0.2 ? 3 : rtt < 0.3 ? 2 : 1
      const packetScore = packetsLost < 5 ? 4 : packetsLost < 20 ? 3 : packetsLost < 50 ? 2 : 1
      const jitterScore = jitter < 0.02 ? 4 : jitter < 0.05 ? 3 : jitter < 0.1 ? 2 : 1
      const bandwidthScore = bandwidth > 1000000 ? 4 : bandwidth > 500000 ? 3 : bandwidth > 100000 ? 2 : 1
      
      const avgScore = (rttScore + packetScore + jitterScore + bandwidthScore) / 4
      
      if (avgScore >= 3.5) quality = 'excellent'
      else if (avgScore >= 2.5) quality = 'good'
      else if (avgScore >= 1.5) quality = 'fair'
      else quality = 'poor'
      
      onStatsUpdate({
        bytesReceived,
        bytesSent,
        packetsLost,
        jitter,
        rtt,
        bandwidth,
        quality,
        videoResolution,
        frameRate
      })
    } catch (error) {
      console.error('❌ Error getting connection stats:', error)
    }
  }, 3000) // Update every 3 seconds for more responsive monitoring
  
  return () => clearInterval(interval)
}

// Test network connectivity with more comprehensive checks
export async function testNetworkConnectivity(): Promise<{
  online: boolean;
  latency: number;
  canReachStun: boolean;
  downloadSpeed?: number;
  connectionType?: string;
}> {
  const result = {
    online: navigator.onLine,
    latency: 0,
    canReachStun: false,
    downloadSpeed: undefined as number | undefined,
    connectionType: undefined as string | undefined
  }
  
  try {
    // Get connection info if available
    if ('connection' in navigator) {
      const conn = (navigator as any).connection
      result.connectionType = conn?.effectiveType || conn?.type
    }
    
    // Test latency with multiple endpoints
    const testUrls = [
      'https://www.google.com/favicon.ico',
      'https://www.cloudflare.com/favicon.ico',
      'https://cdn.jsdelivr.net/npm/jquery@3.6.0/package.json'
    ]
    
    const latencyTests = testUrls.map(async (url) => {
      try {
        const start = performance.now()
        await fetch(url, { 
          mode: 'no-cors',
          cache: 'no-cache'
        })
        return performance.now() - start
      } catch {
        return 5000 // High penalty for failed requests
      }
    })
    
    const latencies = await Promise.all(latencyTests)
    result.latency = Math.min(...latencies) // Use best latency
    
    // Test download speed (rough estimate)
    try {
      const start = performance.now()
      const response = await fetch('https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js', {
        cache: 'no-cache'
      })
      const data = await response.arrayBuffer()
      const duration = (performance.now() - start) / 1000 // Convert to seconds
      result.downloadSpeed = (data.byteLength * 8) / duration / 1000 // Kbps
    } catch (error) {
      console.warn('⚠️ Download speed test failed:', error)
    }
    
    // Test STUN server connectivity
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
      
      pc.createDataChannel('test')
      await pc.createOffer()
      
      // Wait for ICE gathering
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 3000)
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc.iceGatheringState === 'complete') {
            clearTimeout(timeout)
            resolve(undefined)
          }
        })
      })
      
      result.canReachStun = pc.iceGatheringState === 'complete'
      pc.close()
      
    } catch (error) {
      console.warn('⚠️ STUN connectivity test failed:', error)
    }
    
  } catch (error) {
    console.warn('⚠️ Network connectivity test failed:', error)
  }
  
  console.log('🌐 Network test results:', result)
  return result
}

// Utility to restart media stream
export async function restartMediaStream(
  currentStream?: MediaStream,
  streamType: 'webcam' | 'screen' = 'webcam'
): Promise<MediaStream | undefined> {
  console.log(`🔄 Restarting ${streamType} stream...`)
  
  // Stop current stream
  if (currentStream) {
    stopMediaStream(currentStream)
  }
  
  // Get new stream
  const newStream = await getUserMediaStream(streamType)
  
  if (newStream) {
    console.log(`✅ ${streamType} stream restarted successfully`)
  } else {
    console.warn(`⚠️ Failed to restart ${streamType} stream`)
  }
  
  return newStream
}