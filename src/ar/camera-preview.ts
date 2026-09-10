export type CameraStage = 'camera-request' | 'camera-granted' | 'video-attached' | 'video-metadata' | 'video-play' | 'video-play-retry' | 'video-play-tap-required' | 'video-playing';
export interface CameraPreviewOptions {
  requestedWidth: number;
  signal: AbortSignal;
  onStage: (stage: CameraStage, details: Record<string, unknown>) => void;
  requestPlayback: (video: HTMLVideoElement, signal: AbortSignal) => Promise<void>;
  metadataTimeoutMs?: number;
}

export function mediaError(error: unknown): { name: string; message: string } {
  if (error && typeof error === 'object' && 'name' in error && 'message' in error) {
    return { name: String(error.name), message: String(error.message) };
  }
  return { name: 'Error', message: String(error) };
}

function checkCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Camera startup cancelled', 'AbortError');
}

function waitForMetadata(video: HTMLVideoElement, signal: AbortSignal, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata', loaded);
      video.removeEventListener('resize', loaded);
      video.removeEventListener('error', failed);
      signal.removeEventListener('abort', cancelled);
    };
    const loaded = () => { if (video.videoWidth > 0 && video.videoHeight > 0) { cleanup(); resolve(); } };
    const failed = () => { cleanup(); reject(new Error('カメラ映像を読み込めませんでした。')); };
    const cancelled = () => { cleanup(); reject(new DOMException('Camera startup cancelled', 'AbortError')); };
    video.addEventListener('loadedmetadata', loaded);
    video.addEventListener('resize', loaded);
    video.addEventListener('error', failed);
    signal.addEventListener('abort', cancelled, { once: true });
    timer = setTimeout(() => { cleanup(); reject(new Error('カメラから映像が届きません。Safariを開き直して試してください。')); }, timeoutMs);
    if (signal.aborted) cancelled(); else loaded();
  });
}

function retryDelay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancelled = () => { clearTimeout(timer); reject(new DOMException('Camera startup cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancelled); resolve(); }, 120);
    signal.addEventListener('abort', cancelled, { once: true });
    if (signal.aborted) cancelled();
  });
}

/** Keep capture permission and HTML video playback as distinct, logged steps. */
export async function startCameraPreview(video: HTMLVideoElement, options: CameraPreviewOptions): Promise<MediaStream> {
  const { signal, onStage } = options;
  checkCancelled(signal);
  // The element must be connected and inline before Safari sees its MediaStream.
  if (!video.isConnected) throw new Error('カメラの表示領域が用意されていません。');
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');

  onStage('camera-request', { requestedWidth: options.requestedWidth });
  const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
    facingMode: { ideal: 'environment' }, width: { ideal: options.requestedWidth }, height: { ideal: options.requestedWidth * .75 },
  } });
  const release = () => {
    stream.getTracks().forEach(track => track.stop());
    if (video.srcObject === stream) video.srcObject = null;
  };
  try {
    checkCancelled(signal);
    onStage('camera-granted', { tracks: stream.getVideoTracks().map(track => ({ readyState: track.readyState, muted: track.muted })) });
    video.srcObject = stream;
    onStage('video-attached', { readyState: video.readyState, paused: video.paused });
    await waitForMetadata(video, signal, options.metadataTimeoutMs ?? 15000);
    checkCancelled(signal);
    video.width = video.videoWidth;
    video.height = video.videoHeight;
    onStage('video-metadata', { width: video.videoWidth, height: video.videoHeight, readyState: video.readyState });

    // Do not interrupt an autoplay already in progress by requesting play again.
    // Safari 15 may abort a play request during the stream's initial transition.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!video.paused && video.readyState >= 2) break;
      checkCancelled(signal);
      onStage('video-play', { attempt: attempt + 1, readyState: video.readyState });
      try {
        await video.play();
        break;
      } catch (error) {
        checkCancelled(signal);
        const detail = mediaError(error);
        if (detail.name === 'AbortError' && attempt === 0) {
          onStage('video-play-retry', detail);
          await retryDelay(signal);
          continue;
        }
        if (detail.name !== 'AbortError' && detail.name !== 'NotAllowedError') throw error;
        onStage('video-play-tap-required', detail);
        // This button lives in the same document as the video, so play() runs
        // directly in a real user gesture, not a delayed postMessage callback.
        await options.requestPlayback(video, signal);
        break;
      }
    }
    checkCancelled(signal);
    onStage('video-playing', { width: video.videoWidth, height: video.videoHeight, readyState: video.readyState, paused: video.paused });
    return stream;
  } catch (error) {
    release();
    throw error;
  }
}
