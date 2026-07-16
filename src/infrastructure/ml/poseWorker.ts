/// <reference lib="webworker" />
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

let detector: PoseLandmarker | null = null

const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

async function ensureDetector(): Promise<PoseLandmarker> {
  if (detector) return detector
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
  detector = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  })
  return detector
}

self.onmessage = async (e: MessageEvent) => {
  const { type, bitmap, timestamp } = e.data
  if (type === 'init') {
    try {
      await ensureDetector()
      ;(self as unknown as Worker).postMessage({ type: 'ready' })
    } catch (err) {
      ;(self as unknown as Worker).postMessage({ type: 'error', error: String(err) })
    }
    return
  }
  if (type === 'detect' && bitmap && timestamp) {
    try {
      const det = await ensureDetector()
      const result = det.detectForVideo(bitmap, timestamp)
      bitmap.close()
      const landmarks = result.landmarks?.[0] ?? null
      ;(self as unknown as Worker).postMessage({ type: 'result', landmarks })
    } catch {
      try { bitmap.close() } catch { /* noop */ }
      ;(self as unknown as Worker).postMessage({ type: 'result', landmarks: null })
    }
  }
}

export {}
