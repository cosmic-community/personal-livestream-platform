export type StreamType = 'webcam' | 'screen' | 'combined'

export interface StreamSession {
  id: string
  title: string
  description?: string
  streamType: StreamType
  startTime: string
  endTime?: string
  status: 'active' | 'ended' | 'scheduled'
  viewerCount: number
  duration?: number
  thumbnailUrl?: string
  recordingUrl?: string
}

export interface StreamError {
  code: string
  message: string
  details?: any
  browserInfo?: {
    userAgent: string
    platform: string
    language: string
  }
}

export interface StreamStats {
  bytesReceived: number
  bytesSent: number
  packetsLost: number
  jitter: number
  rtt: number
  bandwidth: number
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  viewerCount: number
  duration: number
}

export interface MediaConstraints {
  video?: MediaTrackConstraints | boolean
  audio?: MediaTrackConstraints | boolean
}

export interface RTCConfiguration {
  iceServers: RTCIceServer[]
  iceCandidatePoolSize?: number
  bundlePolicy?: RTCBundlePolicy
  rtcpMuxPolicy?: RTCRtcpMuxPolicy
}

export interface BroadcasterState {
  isStreaming: boolean
  streamType: StreamType
  currentSession?: StreamSession
  mediaStream?: MediaStream
  peerConnections: Map<string, RTCPeerConnection>
  stats: StreamStats
  errors: StreamError[]
}

export interface ViewerState {
  isWatching: boolean
  currentSession?: StreamSession
  remoteStream?: MediaStream
  peerConnection?: RTCPeerConnection
  connectionState: RTCPeerConnectionState
  stats: StreamStats
}

export interface CosmicStreamSession {
  id: string
  title: string
  slug: string
  status: 'published' | 'draft'
  created_at: string
  modified_at: string
  metadata: {
    description?: string
    stream_type: StreamType
    start_time: string
    end_time?: string
    viewer_count: number
    duration?: number
    thumbnail?: {
      url: string
      imgix_url: string
    }
    recording?: {
      url: string
      imgix_url: string
    }
    status: 'active' | 'ended' | 'scheduled'
    tags?: string[]
    category?: string
    is_featured?: boolean
  }
}

export interface ConnectionQualityStats {
  bytesReceived: number
  bytesSent: number
  packetsLost: number
  jitter: number
  rtt: number
  bandwidth: number
  quality: 'excellent' | 'good' | 'fair' | 'poor'
}

export interface MediaDeviceInfo {
  deviceId: string
  kind: MediaDeviceKind
  label: string
  groupId: string
}

export interface NetworkConnectivity {
  online: boolean
  latency: number
  canReachStun: boolean
}

export interface StreamConfiguration {
  video: {
    width: { ideal: number; max: number; min: number }
    height: { ideal: number; max: number; min: number }
    frameRate: { ideal: number; max: number; min: number }
    aspectRatio?: { ideal: number }
    cursor?: string
    displaySurface?: string
  }
  audio: {
    echoCancellation: boolean
    noiseSuppression: boolean
    autoGainControl: boolean
    sampleRate?: { ideal: number }
    channelCount?: { ideal: number }
  } | boolean
}

export interface StreamingCapabilities {
  hasCamera: boolean
  hasMicrophone: boolean
  hasScreen: boolean
  devices: MediaDeviceInfo[]
  permissions: {
    camera: PermissionState | 'unknown'
    microphone: PermissionState | 'unknown'
  }
  webrtcSupported: boolean
  networkQuality: NetworkConnectivity
}