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
    try {
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
    } catch (error) {
      console.error('Error checking device support:', error)
      return {
        hasCamera: false,
        hasMicrophone: false,
        hasScreenShare: false,
        cameraDevices: [],
        microphoneDevices: []
      }
    }
  }

  /** Return the last local stream, or null */
  async getCachedStream(): Promise<MediaStream | null> {
    return this.localStream
  }

  /** Return the last remote stream, or null */
  async getRemoteStream(): Promise<MediaStream | null> {
    return this.remoteStream
  }

  /** Acquire camera + mic using optional constraints */
  async getWebcamStream(constraints?: MediaConstraints): Promise<MediaStream> {
    try {
      const defaults: MediaStreamConstraints = {
        video: true,
        audio: true
      }
      const finalConstraints = constraints
        ? {
            video: constraints.video ?? defaults.video,
            audio: constraints.audio ?? defaults.audio
          }
        : defaults

      const stream = await navigator.mediaDevices.getUserMedia(finalConstraints)
      this.webcamStream = stream
      this.localStream = stream
      return stream
    } catch (error: any) {
      throw new Error(this.getMediaErrorMessage(error))
    }
  }

  /** Acquire a screen share (with optional audio) */
  async getScreenStream(): Promise<MediaStream> {
    try {
      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing not supported')
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })
      this.screenStream = stream
      return stream
    } catch (error: any) {
      throw new Error(this.getMediaErrorMessage(error))
    }
  }

  /** Merge webcam + screen into a single MediaStream */
  async getCombinedStream(
    includeWebcam: boolean = true,
    includeScreen: boolean = true
  ): Promise<MediaStream> {
    try {
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

      const combined =
        streams.length === 1
          ? streams[0]
          : streams.reduce((acc, s) => {
              s.getTracks().forEach(track => acc.addTrack(track))
              return acc
            }, new MediaStream())

      this.currentStream = combined
      return combined
    } catch (error) {
      throw error
    }
  }

  /** Start a fresh camera+mic stream */
  async startLocal(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })
    this.localStream = stream
  }

  /** Load whatever was last set as the remote stream */
  async startRemote(): Promise<void> {
    this.remoteStream = await this.getRemoteStream()
  }

  stopStream(stream?: MediaStream | null): void {
    const target = stream ?? this.currentStream
    if (!target) return

    target.getTracks().forEach(t => t.stop())
    if (target === this.currentStream) this.currentStream = null
    if (target === this.webcamStream) this.webcamStream = null
    if (target === this.screenStream) this.screenStream = null
    if (target === this.localStream) this.localStream = null
  }

  stopAllStreams(): void {
    ;[
      this.currentStream,
      this.webcamStream,
      this.screenStream,
      this.localStream
    ].forEach(s => {
      if (s) this.stopStream(s)
    })
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
        return 'Permission denied—please allow camera/microphone.'
      case 'NotFoundError':
        return 'No camera or microphone found.'
      case 'NotReadableError':
        return 'Device in use by another application.'
      case 'OverconstrainedError':
        return 'Requested media constraints not supported.'
      case 'AbortError':
        return 'Media access was canceled.'
      default:
        return error.message || 'Failed to access media devices'
    }
  }
}

export { MediaHandler }