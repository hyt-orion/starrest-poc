import { Shield, Eye, Trash2, VideoOff } from 'lucide-react'

const PRIVACY_KEY = 'starrest_privacy_confirmed'

export function isPrivacyConfirmed(): boolean {
  return !!localStorage.getItem(PRIVACY_KEY)
}

export function confirmPrivacy(): void {
  localStorage.setItem(PRIVACY_KEY, '1')
}

export function PrivacyScreen({ onConfirm }: { onConfirm: () => void }) {
  const items = [
    {
      icon: VideoOff,
      title: '数据不出设备',
      desc: '摄像头和麦克风的视频、音频数据仅在本地处理，不会上传到任何云端服务器。',
    },
    {
      icon: Eye,
      title: '你可以随时查看',
      desc: '活跃指数、基线数据存储在本地，你可以在设置中查看当前基线状态和看护偏好。',
    },
    {
      icon: Trash2,
      title: '你可以随时删除',
      desc: '在设置页点"清除本地数据"可一键删除所有本地存储（账号、基线、设置），不可恢复。',
    },
    {
      icon: Shield,
      title: '看护进行时你始终知情',
      desc: '看护期间页面显示"看护中"状态，你随时知道 AI 正在工作。关闭页面即停止所有处理。',
    },
  ]

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="no-scrollbar mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600/20">
            <Shield className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">隐私保护说明</h2>
          <p className="mt-1 text-sm text-white/50">在开始看护前，请了解我们如何保护数据</p>
        </div>

        <div className="space-y-5">
          {items.map((item) => (
            <div key={item.title} className="flex gap-3">
              <item.icon className="h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="text-xs leading-relaxed text-white/50">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onConfirm}
          className="mt-8 w-full rounded-xl bg-emerald-600 py-3 font-medium text-white transition hover:bg-emerald-500"
        >
          我了解，开始看护
        </button>

        <p className="mt-4 text-center text-xs text-white/30">
          依据《个人信息保护法》，你有权知情、查阅、删除个人信息
        </p>
      </div>
    </div>
  )
}
