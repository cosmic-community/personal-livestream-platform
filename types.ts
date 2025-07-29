// Base Cosmic object interface
export interface CosmicObject {
  id: string;
  slug: string;
  title: string;
  content?: string;
  metadata: Record<string, any>;
  type: string;
  created_at: string;
  modified_at: string;
}

// Stream session tracking
export interface StreamSession extends CosmicObject {
  type: 'stream-sessions';
  metadata: {
    start_time: string;
    end_time?: string;
    stream_type: StreamType;
    viewer_count: number;
    peak_viewers: number;
    duration: number;
    status: StreamStatus;
    thumbnail_url?: string;
    stream_quality?: StreamQuality;
  };
}

// Stream analytics data
export interface StreamAnalytics extends CosmicObject {
  type: 'stream-analytics';
  metadata: {
    session_id: string;
    viewer_joined_at: string;
    viewer_left_at?: string;
    watch_duration: number;
    user_agent?: string;
    ip_address?: string;
    country?: string;
  };
}

// Stream settings and configuration
export interface StreamSettings extends CosmicObject {
  type: 'stream-settings';
  metadata: {
    default_stream_type: StreamType;
    auto_start_enabled: boolean;
    max_viewers?: number;
    stream_quality: StreamQuality;
    enable_analytics: boolean;
    notification_settings: {
      email_on_stream_start: boolean;
      email_on_viewer_milestone: boolean;
    };
  };
}

// Type literals for stream properties
export type StreamType = 'webcam' | 'screen' | 'both';
export type StreamStatus = 'live' | 'ended' | 'starting' | 'error';
export type StreamQuality = 'low' | 'medium' | 'high' | 'auto';

// WebRTC connection interfaces
export interface PeerConnection {
  id: string;
  peer: any; // SimplePeer instance
  connected: boolean;
  dataChannel?: RTCDataChannel;
}

export interface StreamState {
  isLive: boolean;
  isConnecting: boolean;
  streamType: StreamType;
  webcamEnabled: boolean;
  screenEnabled: boolean;
  viewerCount: number;
  error?: string;
  sessionId?: string;
}

export interface ViewerState {
  isConnected: boolean;
  isConnecting: boolean;
  streamAvailable: boolean;
  viewerCount: number;
  streamQuality: StreamQuality;
  error?: string;
}

// Socket.io event types
export interface ServerToClientEvents {
  'stream-started': (data: { sessionId: string; streamType: StreamType }) => void;
  'stream-ended': (data: { sessionId: string }) => void;
  'viewer-count': (count: number) => void;
  'stream-offer': (offer: RTCSessionDescriptionInit) => void;
  'stream-answer': (answer: RTCSessionDescriptionInit) => void;
  'ice-candidate': (candidate: RTCIceCandidateInit) => void;
  'stream-error': (error: string) => void;
}

export interface ClientToServerEvents {
  'start-broadcast': (data: { streamType: StreamType }) => void;
  'stop-broadcast': () => void;
  'join-stream': () => void;
  'leave-stream': () => void;
  'stream-offer': (offer: RTCSessionDescriptionInit) => void;
  'stream-answer': (answer: RTCSessionDescriptionInit) => void;
  'ice-candidate': (candidate: RTCIceCandidateInit) => void;
}

// API response types
export interface CosmicResponse<T> {
  objects: T[];
  total: number;
  limit: number;
  skip: number;
}

// Utility types
export type CreateStreamSessionData = Omit<StreamSession, 'id' | 'created_at' | 'modified_at'>;
export type UpdateStreamSessionData = Partial<StreamSession['metadata']>;

// Type guards
export function isStreamSession(obj: CosmicObject): obj is StreamSession {
  return obj.type === 'stream-sessions';
}

export function isStreamAnalytics(obj: CosmicObject): obj is StreamAnalytics {
  return obj.type === 'stream-analytics';
}

export function isStreamSettings(obj: CosmicObject): obj is StreamSettings {
  return obj.type === 'stream-settings';
}

// WebRTC constraints and configuration
export interface MediaConstraints {
  video: boolean | MediaTrackConstraints;
  audio: boolean | MediaTrackConstraints;
}

export interface RTCConfiguration {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize?: number;
}

// Error types
export interface StreamError {
  code: string;
  message: string;
  details?: any;
}

// Component prop interfaces
export interface StreamControlsProps {
  streamState: StreamState;
  onStartStream: (streamType: StreamType) => void;
  onStopStream: () => void;
  onToggleWebcam: () => void;
  onToggleScreen: () => void;
}

export interface StreamPlayerProps {
  viewerState: ViewerState;
  onConnect: () => void;
  onDisconnect: () => void;
}

export interface StreamStatsProps {
  session?: StreamSession;
  isLive: boolean;
  viewerCount: number;
}