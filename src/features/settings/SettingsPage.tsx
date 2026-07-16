import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { logout } from '../auth/authStore'
import { getSettings, saveSettings, clearAllData, type Sensitivity } from './settingsStore'

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout: logoutState } = useAuth()
  const initial = getSettings()
  const [alertSensitivity, setAlertSensitivity] = useState<Sensitivity>(initial.alertSensitivity)
  const [pushEnabled, setPushEnabled] = useState(initial.pushEnabled)

  const phoneDisplay =
    user?.phone?.startsWith('wechat_') || user?.phone?.startsWith('qq_')
      ? '未绑定'
      : user?.phone

  function handleLogout() {
    logout()
    logoutState()
    navigate('/login')
  }

  function handleClearData() {
    if (confirm('确认清除所有本地数据？包括账号、看护基线和设置。')) {
      clearAllData()
      logoutState()
      navigate('/login')
    }
  }

  function handleSensitivity(s: Sensitivity) {
    setAlertSensitivity(s)
    saveSettings({ alertSensitivity: s })
  }

  function handlePushToggle() {
    const next = !pushEnabled
    setPushEnabled(next)
    saveSettings({ pushEnabled: next })
  }

  return (
    <div className="min-h-full bg-slate-950 text-white">
      <div className="flex items-center gap-3 border-b border-slate-800 p-4">
        <button onClick={() => navigate('/care')} className="text-white/60 hover:text-white">← 返回</button>
        <h1 className="text-lg font-medium">设置</h1>
      </div>

      <Section title="账号">
        <Row label="手机号" value={phoneDisplay} />
        <Row label="微信" value={user?.wechatBound ? '已绑定' : '未绑定'} />
        <Row label="QQ" value={user?.qqBound ? '已绑定' : '未绑定'} />
      </Section>

      <Section title="看护偏好">
        <div className="p-4">
          <p className="mb-3 text-sm text-white/70">预警灵敏度</p>
          <div className="flex gap-2">
            {(['low', 'normal', 'high'] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleSensitivity(s)}
                className={`flex-1 rounded-lg p-2 text-sm ${alertSensitivity === s ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white/60'}`}
              >
                {s === 'low' ? '低' : s === 'normal' ? '标准' : '高'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/40">影响基线 z-score 阈值（k 值），高灵敏度更容易触发预警</p>
        </div>
      </Section>

      <Section title="隐私">
        <Row label="视频数据处理" value="仅本地处理" />
        <Row label="数据存储" value="不上传云端" />
        <button onClick={handleClearData} className="w-full p-4 text-left text-sm text-red-400 hover:bg-slate-800">
          清除本地数据
        </button>
      </Section>

      <Section title="通知">
        <div className="flex items-center justify-between p-4">
          <span className="text-sm text-white/70">干预级强提醒</span>
          <button
            onClick={handlePushToggle}
            className={`relative h-6 w-11 rounded-full transition ${pushEnabled ? 'bg-emerald-600' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-0.5 block h-5 w-5 rounded-full bg-white transition ${pushEnabled ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </Section>

      <Section title="关于">
        <Row label="版本" value="POC 0.1.0" />
        <Row label="隐私政策" value="查看 →" />
        <Row label="用户协议" value="查看 →" />
      </Section>

      <div className="p-4">
        <button onClick={handleLogout} className="w-full rounded-xl bg-red-900/30 py-3 text-sm text-red-400 hover:bg-red-900/50">
          退出登录
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="px-4 pb-2 text-xs text-white/40">{title}</p>
      <div className="divide-y divide-slate-800 border-y border-slate-800">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between p-4">
      <span className="text-sm text-white/70">{label}</span>
      <span className="text-sm text-white/40">{value}</span>
    </div>
  )
}
