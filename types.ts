export interface StreamState {
  isLive: boolean
  isConnecting: boolean
  streamType: 'webcam' | 'screen' | 'both'
  webcamEnabled: boolean
  screenEnabled: boolean
  viewerCount: number
  sessionId?: string
  error?: string
  lastUpdated: string
  // Additional properties for extended functionality
  isStreaming?: boolean
  streamQuality?: string
  currentSession?: StreamSession | null
  mediaStream?: MediaStream | null
  peerConnections?: Map<string, RTCPeerConnection>
  stats?: StreamStats
  errors?: StreamError[]
}

export type StreamType = 'webcam' | 'screen' | 'both'

export interface StreamError {
  code: string
  message: string
  timestamp: string
  details?: any
  context?: any
}

export interface BroadcasterState extends StreamState {
  isStreaming: boolean
  streamQuality: string
  currentSession: StreamSession | null
  mediaStream: MediaStream | null
  peerConnections: Map<string, RTCPeerConnection>
  stats: StreamStats
  errors: StreamError[]
}

export interface StreamStats {
  totalBytesReceived: number
  totalBytesSent: number
  packetLoss: number
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor'
  averageBitrate: number
  frameRate: number
  resolution: string
  latency: number
}

export interface StreamStatsProps {
  session: StreamSession | null
  isLive: boolean
  viewerCount: number
  stats?: StreamStats
}

export interface ViewerState {
  isConnected: boolean
  isConnecting: boolean
  streamAvailable: boolean
  viewerCount: number
  streamQuality: string
  error?: string
}

export interface WebRTCOffer {
  offer: RTCSessionDescriptionInit
  from?: string
  socketId?: string
}

export interface WebRTCAnswer {
  answer: RTCSessionDescriptionInit
  from?: string
  socketId?: string
}

export interface WebRTCIceCandidate {
  candidate: RTCIceCandidateInit
  from?: string
  socketId?: string
}

export function createStreamState(overrides?: Partial<StreamState>): StreamState {
  return {
    isLive: false,
    isConnecting: false,
    streamType: 'webcam',
    webcamEnabled: false,
    screenEnabled: false,
    viewerCount: 0,
    lastUpdated: new Date().toISOString(),
    isStreaming: false,
    streamQuality: 'medium',
    currentSession: null,
    mediaStream: null,
    peerConnections: new Map<string, RTCPeerConnection>(),
    stats: {
      totalBytesReceived: 0,
      totalBytesSent: 0,
      packetLoss: 0,
      connectionQuality: 'good',
      averageBitrate: 0,
      frameRate: 0,
      resolution: '720p',
      latency: 0
    },
    errors: [],
    ...overrides
  }
}

// Cosmic CMS types
export interface CosmicObject {
  id: string
  title: string
  slug: string
  content?: string
  metadata?: any
  created_at: string
  modified_at: string
  status: string
}

export interface CosmicResponse<T = any> {
  object?: T
  objects: T[]
  total: number
}

export interface StreamSession extends CosmicObject {
  metadata: {
    start_time: string
    end_time?: string
    stream_type: StreamType
    viewer_count: number
    peak_viewers: number
    duration: number
    status: 'starting' | 'live' | 'ended'
  }
}

export interface StreamAnalytics extends CosmicObject {
  metadata: {
    session_id: string
    viewer_joined_at: string
    viewer_left_at?: string
    watch_duration: number
    user_agent: string
    ip_address: string
  }
}

export interface StreamSettings extends CosmicObject {
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