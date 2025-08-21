export function checkWebRTCSupport(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  // Check for RTCPeerConnection support
  const RTCPeerConnection = window.RTCPeerConnection || 
                           (window as any).webkitRTCPeerConnection || 
                           (window as any).mozRTCPeerConnection

  // Check for getUserMedia support
  const getUserMedia = navigator.mediaDevices?.getUserMedia ||
                      (navigator as any).webkitGetUserMedia ||
                      (navigator as any).mozGetUserMedia ||
                      (navigator as any).msGetUserMedia

  // Check for getDisplayMedia support (screen sharing)
  const getDisplayMedia = navigator.mediaDevices?.getDisplayMedia

  return !!(RTCPeerConnection && getUserMedia)
}

export function getWebRTCCapabilities() {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      hasCamera: false,
      hasMicrophone: false,
      hasScreenShare: false
    }
  }

  const supported = checkWebRTCSupport()
  
  return {
    supported,
    hasCamera: supported && !!navigator.mediaDevices?.getUserMedia,
    hasMicrophone: supported && !!navigator.mediaDevices?.getUserMedia,
    hasScreenShare: supported && !!navigator.mediaDevices?.getDisplayMedia
  }
}