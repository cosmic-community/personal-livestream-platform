export type StreamType = 'webcam' | 'screen' | 'combined' | 'both'

export interface StreamSession {
  id: string
  title: string
  slug?: string
  type: string
  created_at: string
  modified_at?: string
  description?: string
  streamType?: StreamType
  startTime?: string
  endTime?: string
  status: 'active' | 'ended' | 'scheduled' | 'published' | 'draft'
  viewerCount?: number
  duration?: number
  thumbnailUrl?: string
  recordingUrl?: string
  metadata: {
    description?: string
    stream_type: StreamType
    start_time: string
    end_time?: string
    viewer_count: number
    peak_viewers?: number
    duration?: number
    thumbnail?: {
      url: string
      imgix_url: string
    }
    recording?: {
      url: string
      imgix_url: string
    }
    status: 'active' | 'ended' | 'scheduled' | 'starting' | 'live'
    tags?: string[]
    category?: string
    is_featured?: boolean
  }
}

export interface StreamError {
  code: string
  message: string
  timestamp: string
  details?: any
  browserInfo?: {
    userAgent: string
    platform: string
    language: string
  }
  context?: any
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

export interface StreamState {
  isLive: boolean
  isConnecting: boolean
  streamType: StreamType
  webcamEnabled: boolean
  screenEnabled: boolean
  viewerCount: number
  sessionId?: string
  error?: string
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
  isWatching?: boolean
  isConnected: boolean
  isConnecting: boolean
  streamAvailable: boolean
  viewerCount: number
  streamQuality: string
  error?: string
  currentSession?: StreamSession
  remoteStream?: MediaStream
  peerConnection?: RTCPeerConnection
  connectionState?: RTCPeerConnectionState
  stats?: StreamStats
}

export interface StreamControlsProps {
  streamState: StreamState
  onStartStream: (type: StreamType) => void
  onStopStream: () => void
  onToggleWebcam: () => void
  onToggleScreen: () => void
}

export interface StreamStatsProps {
  session?: StreamSession
  isLive: boolean
  viewerCount: number
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

export interface StreamAnalytics {
  id: string
  title: string
  type: string
  created_at: string
  metadata: {
    session_id: string
    viewer_joined_at: string
    viewer_left_at?: string
    watch_duration: number
    user_agent: string
    ip_address: string
  }
}

export interface StreamSettings {
  id: string
  title: string
  type: string
  metadata: {
    default_stream_type: StreamType
    auto_start_enabled: boolean
    stream_quality: 'low' | 'medium' | 'high'
    enable_analytics: boolean
    notification_settings: {
      email_on_stream_start: boolean
      email_on_viewer_milestone: boolean
    }
  }
}

export interface CosmicResponse<T = any> {
  object?: T
  objects?: T[]
  total?: number
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
  downloadSpeed?: number
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

// Custom WebRTC message interfaces
export interface WebRTCOffer extends RTCSessionDescriptionInit {
  offer?: RTCSessionDescriptionInit
  from?: string
}

export interface WebRTCAnswer extends RTCSessionDescriptionInit {
  answer?: RTCSessionDescriptionInit
  from?: string
}

export interface WebRTCIceCandidate extends RTCIceCandidateInit {
  from?: string
}