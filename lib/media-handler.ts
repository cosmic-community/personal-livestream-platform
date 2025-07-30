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
        // FIXED: Explicitly assign null instead of undefined for type consistency
        this.webcamStream = null
      }
      if (targetStream === this.screenStream) {
        // FIXED: Explicitly assign null instead of undefined for type consistency  
        this.screenStream = null
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