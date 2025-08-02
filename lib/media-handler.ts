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
  // FIXED: streams start out empty — never hold pure `undefined`
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null

  async checkDeviceSupport(): Promise<MediaDeviceCapabilities> {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return {
          hasCamera: false,
          hasMicrophone: false,
          hasScreenShare: false,
          cameraDevices: [],
          microphoneDevices: []
        }
      }

      // Get device list
      const devices = await navigator.mediaDevices.enumerateDevices()
      
      return {
        hasCamera: devices.some(device => device.kind === 'videoinput'),
        hasMicrophone: devices.some(device => device.kind === 'audioinput'),
        hasScreenShare: typeof navigator.mediaDevices.getDisplayMedia === 'function',
        cameraDevices: devices.filter(device => device.kind === 'videoinput'),
        microphoneDevices: devices.filter(device => device.kind === 'audioinput')
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

  async getCachedStream(): Promise<MediaStream | undefined> {
    // Placeholder method that might return undefined
    return this.localStream ?? undefined
  }

  async getRemoteStream(): Promise<MediaStream | undefined> {
    // Placeholder method that might return undefined - simulates API that could return undefined
    return this.remoteStream ?? undefined
  }

  async getWebcamStream(constraints?: MediaConstraints): Promise<MediaStream> {
    try {
      const defaultConstraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280, max: 1920, min: 640 },
          height: { ideal: 720, max: 1080, min: 480 },
          frameRate: { ideal: 30, max: 60, min: 15 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }

      // Apply custom constraints if provided
      const finalConstraints = constraints ? {
        video: constraints.video !== undefined ? constraints.video : defaultConstraints.video,
        audio: constraints.audio !== undefined ? constraints.audio : defaultConstraints.audio
      } : defaultConstraints

      const stream = await navigator.mediaDevices.getUserMedia(finalConstraints)
      this.webcamStream = stream
      this.localStream = stream
      
      return stream
    } catch (error) {
      console.error('Error getting webcam stream:', error)
      throw new Error(this.getMediaErrorMessage(error))
    }
  }

  async getScreenStream(): Promise<MediaStream> {
    try {
      if (!navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser')
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 3840, min: 1280 },
          height: { ideal: 1080, max: 2160, min: 720 },
          frameRate: { ideal: 30, max: 60, min: 15 }
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false
        }
      })

      this.screenStream = stream
      return stream
    } catch (error) {
      console.error('Error getting screen stream:', error)
      throw new Error(this.getMediaErrorMessage(error))
    }
  }

  async getCombinedStream(includeWebcam: boolean = true, includeScreen: boolean = true): Promise<MediaStream> {
    const streams: MediaStream[] = []

    try {
      if (includeWebcam) {
        try {
          const webcamStream = await this.getWebcamStream()
          streams.push(webcamStream)
        } catch (error) {
          console.warn('Could not get webcam stream:', error)
        }
      }

      if (includeScreen) {
        try {
          const screenStream = await this.getScreenStream()
          streams.push(screenStream)
        } catch (error) {
          console.warn('Could not get screen stream:', error)
        }
      }

      if (streams.length === 0) {
        throw new Error('No media streams available')
      }

      if (streams.length === 1) {
        this.currentStream = streams[0]
        return streams[0]
      }

      // Combine multiple streams
      const combinedStream = new MediaStream()
      streams.forEach(stream => {
        stream.getTracks().forEach(track => {
          combinedStream.addTrack(track)
        })
      })

      this.currentStream = combinedStream
      return combinedStream
    } catch (error) {
      console.error('Error getting combined stream:', error)
      throw error
    }
  }

  async startLocal() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })
    this.localStream = stream       // always a MediaStream
  }

  async startRemote() {
    // FIXED: if getRemoteStream() might return undefined, force it to null
    this.remoteStream = (await this.getRemoteStream()) ?? null
  }

  stopStream(stream?: MediaStream): void {
    const targetStream = stream || this.currentStream

    if (targetStream) {
      targetStream.getTracks().forEach(track => {
        track.stop()
      })

      if (targetStream === this.currentStream) {
        this.currentStream = null
      }
      if (targetStream === this.webcamStream) {
        this.webcamStream = null
      }
      if (targetStream === this.screenStream) {
        this.screenStream = null
      }
      if (targetStream === this.localStream) {
        this.localStream = null
      }
    }
  }

  stopAllStreams(): void {
    if (this.currentStream) {
      this.stopStream(this.currentStream)
    }
    if (this.webcamStream) {
      this.stopStream(this.webcamStream)
    }
    if (this.screenStream) {
      this.stopStream(this.screenStream)
    }
    if (this.localStream) {
      this.stopStream(this.localStream)
    }
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

  setRemoteStream(stream: MediaStream | undefined): void {
    // FIXED: Coalesce undefined into null for consistent typing
    this.remoteStream = stream ?? null
  }

  // Method to handle other potential undefined assignments
  updateRemoteStream(maybeStream: MediaStream | undefined): void {
    // FIXED: Use nullish coalescing to prevent undefined assignment
    this.remoteStream = maybeStream ?? null
  }

  /** If you use `this.localStream` or `this.remoteStream` elsewhere,
   *  always guard against null before using them. */
  
  private getMediaErrorMessage(error: any): string {
    if (!error) return 'Unknown media error'

    if (error.name === 'NotAllowedError' || error.message?.includes('Permission denied')) {
      return 'Permission denied. Please allow camera and microphone access.'
    }
    
    if (error.name === 'NotFoundError') {
      return 'No camera or microphone found. Please check your devices.'
    }
    
    if (error.name === 'NotReadableError') {
      return 'Camera or microphone is already in use by another application.'
    }
    
    if (error.name === 'OverconstrainedError') {
      return 'The requested media settings are not supported by your device.'
    }
    
    if (error.name === 'AbortError') {
      return 'Media access was cancelled.'
    }

    return error.message || 'Failed to access media devices'
  }
}

export { MediaHandler }