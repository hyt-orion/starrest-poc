import * as tf from '@tensorflow/tfjs'
import * as poseDetection from '@tensorflow-models/pose-detection'

let detector: poseDetection.PoseDetector | null = null

export interface NormalizedPoint {
  x: number
  y: number
}

/** 初始化 MoveNet 检测器（WebGL backend，不需要 WASM） */
export async function getMoveNetDetector(
  onStatus?: (s: string) => void,
): Promise<poseDetection.PoseDetector> {
  if (detector) return detector
  onStatus?.('初始化TF.js(WebGL)...')
  await tf.setBackend('webgl')
  await tf.ready()
  onStatus?.('加载MoveNet模型...')
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING },
  )
  onStatus?.('看护中 · 传输中')
  return detector
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
