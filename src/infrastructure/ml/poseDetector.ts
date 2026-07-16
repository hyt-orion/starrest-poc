import {
  PoseLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision'

export type { NormalizedLandmark }

let detector: PoseLandmarker | null = null

const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/'
const MODEL_PATH = `${window.location.origin}${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`

/** 单例 PoseLandmarker，端侧推理，模型和WASM均本地加载（不依赖外部CDN） */
export async function getPoseDetector(onStatus?: (s: string) => void): Promise<PoseLandmarker> {
  if (detector) return detector
  onStatus?.('加载WASM(11MB)...')
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
  onStatus?.('WASM完成,加载模型(5MB)...')
  detector = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  })
  return detector
}
