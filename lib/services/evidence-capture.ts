export function requestCameraStream(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("Camera capture is not supported by this browser."));
  }
  return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
}

export function requestAudioStream(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    return Promise.reject(new Error("Audio recording is not supported by this browser."));
  }
  return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}

export function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function capturePhoto(video: HTMLVideoElement): Promise<Blob> {
  if (typeof document === "undefined" || video.videoWidth === 0 || video.videoHeight === 0) {
    return Promise.reject(new Error("Camera is not ready yet. Please wait and try again."));
  }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) return Promise.reject(new Error("This browser cannot capture an image from the camera."));
  context.drawImage(video, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The image could not be captured.")), "image/jpeg", 0.85));
}
