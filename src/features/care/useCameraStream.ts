import { useEffect, useRef, useState } from 'react'

/** 获取摄像头+麦克风流，数据仅本地使用，不上传 */
export function useCameraStream() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    let active = true
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = s
        setStream(s)
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().then(() => setReady(true))
          }
        }
      })
      .catch((e) => setError(e?.message ?? String(e)))

    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return { videoRef, stream, error, ready }
}
