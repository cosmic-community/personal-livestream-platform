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

  /** Returns which devices are available on this machine */
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
      cameraDevices: devices.filter(d => d.kind === 'videoinput'),
      microphoneDevices: devices.filter(d => d.kind === 'audioinput')
    }
  }

  /** Returns the previously-acquired local stream, or null if none */
  async getCachedStream(): Promise<MediaStream | null> {
    return this.localStream
  }

  /** Returns the previously-acquired remote stream, or null if none */
  async getRemoteStream(): Promise<MediaStream | null> {
    return this.remoteStream
  }

  /** Opens camera+mic with optional constraints */
  async getWebcamStream(constraints?: MediaConstraints): Promise<MediaStream> {
    const defaultConstraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 1280, max: 1920, min: 640 },
        height:{ ideal:  720, max: 1080, min: 480 },
        frameRate:{ ideal:  30, max:   60, min:  15 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    }

    const finalConstraints = constraints
      ? {
          video: constraints.video ?? defaultConstraints.video,
          audio: constraints.audio ?? defaultConstraints.audio
        }
      : defaultConstraints

    const stream = await navigator.mediaDevices.getUserMedia(finalConstraints)
    this.webcamStream = stream
    this.localStream  = stream
    return stream
  }

  /** Opens a screen‐share + optional audio */
  async getScreenStream(): Promise<MediaStream> {
    if (!navigator.mediaDevices.getDisplayMedia) {
      throw new Error('Screen sharing is not supported in this browser')
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920, max: 3840, min: 1280 },
        height:{ ideal: 1080, max: 2160, min:  720 },
        frameRate:{ ideal:  30, max:   60, min:  15 }
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false
      }
    })
    this.screenStream = stream
    return stream
  }

  /** Combines webcam + screen into one merged stream */
  async getCombinedStream(
    includeWebcam: boolean = true,
    includeScreen: boolean = true
  ): Promise<MediaStream> {
    const streams: MediaStream[] = []

    if (includeWebcam) {
      try {
        streams.push(await this.getWebcamStream())
      } catch {
        console.warn('Webcam unavailable')
      }
    }
    if (includeScreen) {
      try {
        streams.push(await this.getScreenStream())
      } catch {
        console.warn('Screen share unavailable')
      }
    }

    if (streams.length === 0) {
      throw new Error('No media streams available')
    }

    const combined = streams.length === 1
      ? streams[0]
      : streams.reduce((acc, s) => {
          s.getTracks().forEach(track => acc.addTrack(track))
          return acc
        }, new MediaStream())

    this.currentStream = combined
    return combined
  }

  /** Grabs a fresh local camera+mic stream */
  async startLocal(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })
    this.localStream = stream
  }

  /** Loads the cached remote stream (or null) */
  async startRemote(): Promise<void> {
    this.remoteStream = await this.getRemoteStream()
  }

  stopStream(stream?: MediaStream | null): void {
    const target = stream ?? this.currentStream
    if (!target) return

    target.getTracks().forEach(t => t.stop())
    if (target === this.currentStream) this.currentStream = null
    if (target === this.webcamStream)  this.webcamStream  = null
    if (target === this.screenStream)  this.screenStream  = null
    if (target === this.localStream)   this.localStream   = null
  }

  stopAllStreams(): void {
    [this.currentStream, this.webcamStream, this.screenStream, this.localStream]
      .forEach(s => s && this.stopStream(s))
  }

  getCurrentStream(): MediaStream | null {
    return this.currentStream
  }
  getActiveWebcamStream(): MediaStream | null {
    return this.webcamStream
  }
  getActiveScreenStream(): MediaStream | null {
    return this.screenStream
  }
  getLocalStream(): MediaStream | null {
    return this.localStream
  }
  getRemoteStreamSync(): MediaStream | null {
    return this.remoteStream
  }

  /** Replace the remote stream (or clear it by passing `null`) */
  setRemoteStream(stream: MediaStream | null): void {
    this.remoteStream = stream
  }

  private getMediaErrorMessage(error: any): string {
    if (!error) return 'Unknown media error'
    switch (error.name) {
      case 'NotAllowedError':
        return 'Permission denied. Please allow camera and microphone access.'
      case 'NotFoundError':
        return 'No camera or microphone found. Please check your devices.'
      case 'NotReadableError':
        return 'Camera or microphone is already in use by another application.'
      case 'OverconstrainedError':
        return 'The requested media settings are not supported by your device.'
      case 'AbortError':
        return 'Media access was cancelled.'
      default:
        return error.message || 'Failed to access media devices'
    }
  }
}

export { MediaHandler }
