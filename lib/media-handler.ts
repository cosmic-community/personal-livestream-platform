export interface MediaDeviceCapabilities {
  hasCamera: boolean
  hasMicrophone: boolean
  hasScreenShare: boolean
  cameraDevices: MediaDeviceInfo[]
  microphoneDevices: MediaDeviceInfo[]
}

export interface MediaConstraints {
  video?: boolean | MediaTrackConstraints
  audio?: boolean | MediaTrackConstraints
}

class MediaHandler {
  private currentStream: MediaStream | null = null
  private webcamStream: MediaStream | null = null
  private screenStream: MediaStream | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null

  /** Which devices are available right now */
  async checkDeviceSupport(): Promise<MediaDeviceCapabilities> {
    if (!navigator.mediaDevices?.getUserMedia) {
      return {
        hasCamera: false,
        hasMicrophone: false,
        hasScreenShare: false,
        cameraDevices: [],
        microphoneDevices: []
      }
    }
    const devices = await navigator.mediaDevices.enumerateDevices()
    return {
      hasCamera: devices.some(d => d.kind === 'videoinput'),
      hasMicrophone: devices.some(d => d.kind === 'audioinput'),
      hasScreenShare: typeof navigator.mediaDevices.getDisplayMedia === 'function',
      cameraDevices:    devices.filter(d => d.kind === 'videoinput'),
      microphoneDevices: devices.filter(d => d.kind === 'audioinput')
    }
  }

  /** Return whatever local stream was last acquired, or null */
  async getCachedStream(): Promise<MediaStream | null> {
    return this.localStream
  }

  /** Return whatever remote stream was last set, or null */
  async getRemoteStream(): Promise<MediaStream | null> {
    return this.remoteStream
  }

  /** Acquire camera + mic using optional constraints */
  async getWebcamStream(constraints?: MediaConstraints): Promise<MediaStream> {
    const defaults: MediaStreamConstraints = {
      video: {
        width:     { ideal: 1280, max: 1920, min:  640 },
        height:    { ideal:  720, max: 1080, min:  480 },
        frameRate: { ideal:   30, max:   60, min:   15 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl:  true
      }
    }
    const finalConstraints = constraints
      ? {
          video: constraints.video ?? defaults.video,
          audio: constraints.audio ?? defaults.audio
        }
      : defaults

    const stream = await navigator.mediaDevices.getUserMedia(finalConstraints)
    this.webcamStream = stre
