/// <reference types="vite/client" />
declare module 'mind-ar/dist/mindar-image.prod.js' {
  export class Controller {
    constructor(options: { inputWidth: number; inputHeight: number; maxTrack: number; warmupTolerance?: number; missTolerance?: number; filterMinCF?: number; filterBeta?: number; onUpdate: (event: { type: string; targetIndex: number; worldMatrix: number[] | null }) => void });
    addImageTargetsFromBuffer(data: ArrayBuffer): { dimensions: [number, number][] };
    getProjectionMatrix(): number[];
    dummyRun(video: HTMLVideoElement): void;
    processVideo(video: HTMLVideoElement): void;
    stopProcessVideo(): void;
  }
}
