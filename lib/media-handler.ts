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
  // streams are either a MediaStream or undefined
  private currentStream?: MediaStream
  private webcamStream?: MediaStream
  private screenStream?: MediaStream
  private localStream?: MediaStream
  private remoteStream?: MediaStream

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
    } catch {
      return {
        hasCamera: false,
        hasMicrophone: false,
        hasScreenShare: false,
        cameraDevices: [],
        microphoneDevices: []
      }
    }
  }

  /** Return the last local stream, or undefined */
  async getCachedStream(): Promise<MediaStream | undefined> {
    return this.localStream
  }

  /** Return the last remote stream, or undefined */
  async getRemoteStream(): Promise<MediaStream | undefined> {
    return this.remoteStream
  }

  /** Acquire camera+mic using optional constraints */
  async getWebcamStream(constraints?: MediaConstraints): Promise<MediaStream> {
    try {
      const defaults: MediaStreamConstraints = { video: true, audio: true }
      const finalC = constraints
        ? {
          video: constraints.video ?? defaults.video,
          audio: constraints.audio ?? defaults.audio
        }
        : defaults

      const stream = await navigator.mediaDevices.getUserMedia(finalC)
      this.webcamStream = stream
      this.localStream = stream
      return stream
    } catch (err: any) {
      throw new Error(this.getMediaErrorMessage(err))
    }
  }

  /** Acquire screen-share (with audio) - optional */
  async getScreenStream(): Promise<MediaStream | undefined> {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        console.warn('Screen sharing not supported')
        return undefined
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      this.screenStream = stream
      return stream
    } catch (err: any) {
      console.warn('Screen sharing failed:', this.getMediaErrorMessage(err))
      return undefined
    }
  }

  /** Combine webcam + screen into one merged MediaStream - all optional */
  async getCombinedStream(
    includeWebcam = true,
    includeScreen = true
  ): Promise<MediaStream | undefined> {
    const streams: MediaStream[] = []
    
    if (includeWebcam) {
      try { 
        const webcamStream = await this.getWebcamStream()
        if (webcamStream) streams.push(webcamStream)
      } catch (err) {
        console.warn('Webcam stream failed:', err)
      }
    }
    
    if (includeScreen) {
      try { 
        const screenStream = await this.getScreenStream()
        if (screenStream) streams.push(screenStream)
      } catch (err) {
        console.warn('Screen stream failed:', err)
      }
    }
    
    if (streams.length === 0) {
      console.warn('No media streams available')
      return undefined
    }

    const combined = streams.length === 1
      ? streams[0]
      : streams.reduce((acc, s) => {
        s.getTracks().forEach(t => acc.addTrack(t))
        return acc
      }, new MediaStream())

    this.currentStream = combined
    return combined
  }

  /** Fresh camera+mic - optional */
  async startLocal(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      this.localStream = stream
      return true
    } catch (err) {
      console.warn('Failed to start local stream:', err)
      return false
    }
  }

  /** Load whatever remote stream was last set - optional */
  async startRemote(): Promise<boolean> {
    try {
      const remoteStream = await this.getRemoteStream()
      // Fix: Only assign if stream exists and handle undefined properly
      if (remoteStream) {
        this.remoteStream = remoteStream
        return true
      }
      return false
    } catch (err) {
      console.warn('Failed to start remote stream:', err)
      return false
    }
  }

  stopStream(stream?: MediaStream): void {
    const t = stream ?? this.currentStream
    if (!t) return
    t.getTracks().forEach(track => track.stop())
    if (t === this.currentStream) this.currentStream = undefined
    if (t === this.webcamStream) this.webcamStream = undefined
    if (t === this.screenStream) this.screenStream = undefined
    if (t === this.localStream) this.localStream = undefined
  }

  stopAllStreams(): void {
    [this.currentStream, this.webcamStream, this.screenStream, this.localStream]
      .forEach(s => s && this.stopStream(s))
  }

  getCurrentStream(): MediaStream | undefined { return this.currentStream }
  getActiveWebcamStream(): MediaStream | undefined { return this.webcamStream }
  getActiveScreenStream(): MediaStream | undefined { return this.screenStream }
  getLocalStream(): MediaStream | undefined { return this.localStream }
  getRemoteStreamSync(): MediaStream | undefined { return this.remoteStream }

  setRemoteStream(stream?: MediaStream): void {
    this.remoteStream = stream
  }

  /** Check if streaming is available on this device */
  isStreamingSupported(): boolean {
    return !!(navigator.mediaDevices?.getUserMedia)
  }

  /** Check if any streams are currently active */
  hasActiveStreams(): boolean {
    return !!(this.currentStream || this.webcamStream || this.screenStream || this.localStream)
  }

  private getMediaErrorMessage(error: any): string {
    if (!error) return 'Unknown media error'
    switch (error.name) {
      case 'NotAllowedError': return 'Permission denied—allow camera/mic.'
      case 'NotFoundError': return 'No camera or microphone found.'
      case 'NotReadableError': return 'Device in use by another app.'
      case 'OverconstrainedError': return 'Requested media constraints unsupported.'
      case 'AbortError': return 'Media access was canceled.'
      default: return error.message || 'Failed to access media devices'
    }
  }
}

export { MediaHandler }