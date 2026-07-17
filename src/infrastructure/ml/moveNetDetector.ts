// 类型仅用于类型标注，不会进入运行时 bundle
import type * as poseDetection from '@tensorflow-models/pose-detection'

export interface NormalizedPoint {
  x: number
  y: number
}

// 单人检测器与多人检测器分别缓存
let detector: poseDetection.PoseDetector | null = null
let multiDetector: poseDetection.PoseDetector | null = null
// 模型加载失败标记：避免每次 detect() 都重试（手机网络差时反复请求 Google Storage）
let multiLoadFailed = false

/**
 * 初始化 MoveNet 检测器（WebGL backend）。
 * TFJS 通过 dynamic import 加载，不进入首屏 bundle。
 */
export async function getMoveNetDetector(
  onStatus?: (s: string) => void,
): Promise<poseDetection.PoseDetector> {
  if (detector) return detector
  onStatus?.('初始化TF.js(WebGL)...')
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
 * 多人检测器（MULTIPOSE_LIGHTNING）。
 * 失败后标记 multiLoadFailed=true，后续 detect() 跳过不重试。
 */
async function getMultiMoveNetDetector(): Promise<poseDetection.PoseDetector> {
  if (multiDetector) return multiDetector
  if (multiLoadFailed) throw new Error('模型未加载')

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
 * 多人检测：返回所有人关键点。
 * 模型未加载或加载失败时返回 null（调用方降级为纯视频模式）。
 */
export async function detectPosesMulti(
  video: HTMLVideoElement,
): Promise<NormalizedPoint[][] | null> {
  if (multiLoadFailed) return null
  try {
    const det = await getMultiMoveNetDetector()
    const poses = await det.estimatePoses(video, { flipHorizontal: false })
    if (poses.length === 0) return null
    const w = video.videoWidth || 1
    const h = video.videoHeight || 1
    return poses.map((p) =>
      p.keypoints.map((kp) => ({ x: kp.x / w, y: kp.y / h })),
    )
  } catch (e) {
    // 标记失败，后续不再重试（避免手机网络差时反复请求 Google Storage）
    multiLoadFailed = true
    throw e
  }
}

/** 查询多人检测器是否可用 */
export function isMultiDetectorReady(): boolean {
  return !!multiDetector && !multiLoadFailed
}
