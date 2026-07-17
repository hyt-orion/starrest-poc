// 类型仅用于类型标注，不会进入运行时 bundle
import type * as poseDetection from '@tensorflow-models/pose-detection'

export interface NormalizedPoint {
  x: number
  y: number
}

// 单人检测器（SINGLEPOSE_LIGHTNING）与多人检测器（MULTIPOSE_LIGHTNING）分别缓存。
// 二者使用不同的模型权重，需要独立加载。
let detector: poseDetection.PoseDetector | null = null
let multiDetector: poseDetection.PoseDetector | null = null

/**
 * 初始化 MoveNet 检测器（WebGL backend，不需要 WASM）。
 * TFJS 与 pose-detection 均通过 dynamic import 加载，避免进入首屏 bundle。
 */
export async function getMoveNetDetector(
  onStatus?: (s: string) => void,
): Promise<poseDetection.PoseDetector> {
  if (detector) return detector
  onStatus?.('初始化TF.js(WebGL)...')
  // 动态导入：Vite 会把 TFJS 拆成独立 chunk，首屏不再包含 ~2.7MB 的 TFJS
  const tf = await import('@tensorflow/tfjs')
  await tf.setBackend('webgl')
  await tf.ready()
  onStatus?.('加载MoveNet模型...')
  const pd = await import('@tensorflow-models/pose-detection')
  detector = await pd.createDetector(
    pd.SupportedModels.MoveNet,
    { modelType: pd.movenet.modelType.SINGLEPOSE_LIGHTNING },
  )
  onStatus?.('看护中 · 传输中')
  return detector
}

/**
 * 初始化多人检测器（MULTIPOSE_LIGHTNING）。
 * 与单人检测器互相独立，首次调用时按需加载。
 */
async function getMultiMoveNetDetector(): Promise<poseDetection.PoseDetector> {
  if (multiDetector) return multiDetector
  const tf = await import('@tensorflow/tfjs')
  await tf.setBackend('webgl')
  await tf.ready()
  const pd = await import('@tensorflow-models/pose-detection')
  multiDetector = await pd.createDetector(
    pd.SupportedModels.MoveNet,
    { modelType: pd.movenet.modelType.MULTIPOSE_LIGHTNING },
  )
  return multiDetector
}

/** 检测姿态，返回归一化关键点（0-1） */
export async function detectPose(
  video: HTMLVideoElement,
  onStatus?: (s: string) => void,
): Promise<NormalizedPoint[] | null> {
  const det = await getMoveNetDetector(onStatus)
  const poses = await det.estimatePoses(video, { flipHorizontal: false })
  if (poses.length > 0 && poses[0].keypoints) {
    const w = video.videoWidth || 1
    const h = video.videoHeight || 1
    return poses[0].keypoints.map((kp) => ({ x: kp.x / w, y: kp.y / h }))
  }
  return null
}

/**
 * 多人检测：返回所有检测到的人的关键点数组（每人一组归一化关键点）。
 * 使用 MULTIPOSE_LIGHTNING 模型，若当前仅创建了 SINGLEPOSE 检测器，
 * 会自动创建第二个多人检测器。
 */
export async function detectPosesMulti(
  video: HTMLVideoElement,
): Promise<NormalizedPoint[][] | null> {
  const det = await getMultiMoveNetDetector()
  const poses = await det.estimatePoses(video, { flipHorizontal: false })
  if (poses.length === 0) return null
  const w = video.videoWidth || 1
  const h = video.videoHeight || 1
  return poses.map((p) =>
    p.keypoints.map((kp) => ({ x: kp.x / w, y: kp.y / h })),
  )
}
