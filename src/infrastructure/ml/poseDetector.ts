import {
  PoseLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'

export type { NormalizedLandmark }

let detector: PoseLandmarker | null = null

const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_PATH = `${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`

/** 单例 PoseLandmarker，端侧推理，视频不出设备 */
export async function getPoseDetector(): Promise<PoseLandmarker> {
  if (detector) return detector
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
  detector = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  })
  return detector
}
