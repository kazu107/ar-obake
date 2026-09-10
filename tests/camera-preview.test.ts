import { afterEach, describe, expect, it, vi } from 'vitest';
import { startCameraPreview, type CameraPreviewOptions } from '../src/ar/camera-preview';

class FakeVideo extends EventTarget {
  isConnected = true;
  muted = false; defaultMuted = false; autoplay = false; playsInline = false;
  videoWidth = 0; videoHeight = 0; width = 0; height = 0; readyState = 0; paused = true;
  srcObject: MediaStream | null = null;
  setAttribute = vi.fn();
  play = vi.fn(async () => { this.paused = false; });
  metadata() { this.videoWidth = 640; this.videoHeight = 480; this.readyState = 2; this.dispatchEvent(new Event('loadedmetadata')); }
  element() { return this as unknown as HTMLVideoElement; }
}
function fixture() {
  const video = new FakeVideo(), abort = new AbortController();
  const track = { stop: vi.fn(), readyState: 'live', muted: false };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  const options: CameraPreviewOptions = { requestedWidth: 640, signal: abort.signal, onStage: vi.fn(), requestPlayback: vi.fn(async () => {}) };
  return { video, abort, track, stream, getUserMedia, options };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('Safari camera startup recovery', () => {
  it('waits for metadata before requesting playback', async () => {
    const f = fixture();
    f.video.play.mockImplementation(async () => { if (!f.video.videoWidth) throw new DOMException('Not ready', 'AbortError'); });
    const result = startCameraPreview(f.video.element(), f.options);
    await Promise.resolve();
    expect(f.video.srcObject).toBe(f.stream);
    expect(f.video.play).not.toHaveBeenCalled();
    f.video.metadata();
    expect(await result).toBe(f.stream);
    expect(f.video.play).toHaveBeenCalledOnce();
    expect(f.video.width).toBe(640);
    expect(f.track.stop).not.toHaveBeenCalled();
  });
  it('does not interrupt video that autoplay has already started', async () => {
    const f = fixture(); f.video.metadata(); f.video.paused = false;
    await startCameraPreview(f.video.element(), f.options);
    expect(f.video.play).not.toHaveBeenCalled();
  });
  it('retries a transient play AbortError without reacquiring camera permission', async () => {
    vi.useFakeTimers();
    const f = fixture(); f.video.metadata();
    f.video.play.mockRejectedValueOnce(new DOMException('Interrupted', 'AbortError'));
    const result = startCameraPreview(f.video.element(), f.options);
    await vi.runAllTimersAsync(); await result;
    expect(f.video.play).toHaveBeenCalledTimes(2);
    expect(f.getUserMedia).toHaveBeenCalledOnce();
    expect(f.options.requestPlayback).not.toHaveBeenCalled();
    expect(f.track.stop).not.toHaveBeenCalled();
  });
  it.each(['NotAllowedError', 'AbortError'])('keeps the camera live while waiting for a direct tap after %s', async name => {
    vi.useFakeTimers();
    const f = fixture(); f.video.metadata();
    f.video.play.mockRejectedValue(new DOMException('Playback blocked', name));
    f.options.requestPlayback = vi.fn(async () => {
      expect(f.track.stop).not.toHaveBeenCalled();
      expect(f.video.srcObject).toBe(f.stream);
      f.video.play.mockResolvedValue(undefined);
      await f.video.play();
    });
    const result = startCameraPreview(f.video.element(), f.options);
    await vi.runAllTimersAsync(); expect(await result).toBe(f.stream);
    expect(f.options.requestPlayback).toHaveBeenCalledOnce();
    expect(f.getUserMedia).toHaveBeenCalledOnce();
  });
  it('distinguishes capture permission rejection from playback rejection', async () => {
    const f = fixture();
    f.getUserMedia.mockRejectedValue(new DOMException('Capture denied', 'NotAllowedError'));
    await expect(startCameraPreview(f.video.element(), f.options)).rejects.toMatchObject({ name: 'NotAllowedError' });
    expect(f.options.onStage).toHaveBeenCalledExactlyOnceWith('camera-request', { requestedWidth: 640 });
    expect(f.options.requestPlayback).not.toHaveBeenCalled();
    expect(f.video.srcObject).toBeNull();
  });
  it('stops a late camera grant after cancellation', async () => {
    const f = fixture();
    let grant!: (stream: MediaStream) => void;
    f.getUserMedia.mockReturnValue(new Promise(resolve => { grant = resolve; }));
    const result = startCameraPreview(f.video.element(), f.options);
    f.abort.abort(); grant(f.stream);
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.video.srcObject).toBeNull();
  });
  it('releases capture on a metadata timeout', async () => {
    vi.useFakeTimers();
    const f = fixture(); f.options.metadataTimeoutMs = 100;
    const result = expect(startCameraPreview(f.video.element(), f.options)).rejects.toThrow('カメラから映像が届きません');
    await vi.runAllTimersAsync(); await result;
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.video.srcObject).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels metadata waiting immediately and releases its timer', async () => {
    vi.useFakeTimers();
    const f = fixture();
    const result = startCameraPreview(f.video.element(), f.options);
    await Promise.resolve(); f.abort.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('releases capture if the user stops during the playback prompt', async () => {
    const f = fixture(); f.video.metadata();
    f.video.play.mockRejectedValue(new DOMException('Playback blocked', 'NotAllowedError'));
    f.options.requestPlayback = async (_video, signal) => { f.abort.abort(); throw signal.reason; };
    await expect(startCameraPreview(f.video.element(), f.options)).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.track.stop).toHaveBeenCalledOnce();
    expect(f.video.srcObject).toBeNull();
  });
});
