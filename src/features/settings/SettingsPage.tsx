import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { logout } from '../auth/authStore'
import { getSettings, saveSettings as saveSettingsAsync, clearAllData, type Sensitivity } from './settingsStore'

export function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout: logoutState } = useAuth()
  const initial = getSettings()
  const [alertSensitivity, setAlertSensitivity] = useState<Sensitivity>(initial.alertSensitivity)
  const [pushEnabled, setPushEnabled] = useState(initial.pushEnabled)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)

  function handleLogout() {
    logout(); logoutState(); navigate('/login')
  }
  function handleClearData() {
    if (confirm('确认清除所有本地数据？包括账号、看护基线和设置。')) { clearAllData(); logoutState(); navigate('/login') }
  }
  function handleSensitivity(s: Sensitivity) { setAlertSensitivity(s); void saveSettingsAsync({ alertSensitivity: s }) }
  function handlePushToggle() { const n = !pushEnabled; setPushEnabled(n); void saveSettingsAsync({ pushEnabled: n }) }

  if (showPrivacy) return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />
  if (showTerms) return <UserTerms onBack={() => setShowTerms(false)} />

  return (
    <div className="min-h-full bg-slate-950 text-white">
      <div className="flex items-center gap-3 border-b border-slate-800 p-4">
        <button onClick={() => navigate('/care')} className="text-white/60 hover:text-white">← 返回</button>
        <h1 className="text-lg font-medium">设置</h1>
      </div>

      <Section title="账号">
        <Row label="手机号" value={user?.phone ?? '未登录'} />
      </Section>

      <Section title="看护偏好">
        <div className="p-4">
          <p className="mb-3 text-sm text-white/70">预警灵敏度</p>
          <div className="flex gap-2">
            {(['low', 'normal', 'high'] as const).map((s) => (
              <button key={s} onClick={() => handleSensitivity(s)}
                className={`flex-1 rounded-lg p-2 text-sm ${alertSensitivity === s ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white/60'}`}>
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
        <button onClick={handleClearData} className="w-full p-4 text-left text-sm text-red-400 hover:bg-slate-800">清除本地数据</button>
      </Section>

      <Section title="通知">
        <div className="flex items-center justify-between p-4">
          <span className="text-sm text-white/70">干预级强提醒</span>
          <button onClick={handlePushToggle} aria-label="强提醒开关"
            className={`relative h-6 w-11 rounded-full transition ${pushEnabled ? 'bg-emerald-600' : 'bg-slate-700'}`}>
            <span className={`absolute top-0.5 block h-5 w-5 rounded-full bg-white transition ${pushEnabled ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </Section>

      <Section title="关于">
        <Row label="版本" value="POC 0.1.0" />
        <button onClick={() => setShowPrivacy(true)} className="flex w-full items-center justify-between p-4 hover:bg-slate-800">
          <span className="text-sm text-white/70">隐私政策</span><span className="text-sm text-white/40">查看 →</span>
        </button>
        <button onClick={() => setShowTerms(true)} className="flex w-full items-center justify-between p-4 hover:bg-slate-800">
          <span className="text-sm text-white/70">用户协议</span><span className="text-sm text-white/40">查看 →</span>
        </button>
      </Section>

      <div className="p-4">
        <button onClick={handleLogout} className="w-full rounded-xl bg-red-900/30 py-3 text-sm text-red-400 hover:bg-red-900/50">退出登录</button>
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

function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-full bg-slate-950 text-white">
      <div className="flex items-center gap-3 border-b border-slate-800 p-4 sticky top-0 bg-slate-950 z-10">
        <button onClick={onBack} className="text-white/60 hover:text-white">← 返回</button>
        <h1 className="text-lg font-medium">隐私政策</h1>
      </div>
      <div className="space-y-4 p-6 text-sm leading-relaxed text-white/70">
        <p className="text-xs text-white/40">最后更新：2026年7月16日</p>
        <div>
          <h2 className="mb-2 font-medium text-white">一、数据收集</h2>
          <p>星憩时刻仅收集以下数据：手机号（用于账号标识）、活跃指数（基于视频和音频分析生成的数字）、看护基线数据（活跃指数历史记录）、喘息活动记录（完成次数和连续打卡天数）、匿名树洞内容（仅存储在本地设备）。</p>
        </div>
        <div>
          <h2 className="mb-2 font-medium text-white">二、视频与音频处理</h2>
          <p>摄像头采集的视频和麦克风采集的音频<strong className="text-emerald-300">仅在您的设备本地处理</strong>，不会上传到任何云端服务器。视频帧截取后转换为低分辨率图片传输给家长端，传输过程不经过服务器中转（POC 阶段通过浏览器本地存储通信）。AI 推理（姿态检测、行为分类）全部在设备端完成。</p>
        </div>
        <div>
          <h2 className="mb-2 font-medium text-white">三、数据存储</h2>
          <p>所有数据存储在您的设备本地（localStorage / IndexedDB），不上传云端。您可以在设置中随时清除所有本地数据，清除后不可恢复。</p>
        </div>
        <div>
          <h2 className="mb-2 font-medium text-white">四、数据共享</h2>
          <p>我们不会将您的数据共享给任何第三方。活跃指数和视频帧仅在家长端和星宝端之间传输，不经过服务器。</p>
        </div>
        <div>
          <h2 className="mb-2 font-medium text-white">五、未成年人保护</h2>
          <p>本产品涉及未成年人（星宝）的视频和音频数据。我们采取以下保护措施：视频/音频不出设备；视频帧传输时降低分辨率；不存储原始视频/音频；家长有权随时查看和删除数据。</p>
        </div>
        <div>
          <h2 className="mb-2 font-medium text-white">六、您的权利</h2>
          <p>依据《个人信息保护法》，您有权：知情（了解数据如何处理）、查阅（查看本地存储的数据）、删除（一键清除所有本地数据）、撤回同意（清除数据即视为撤回）。</p>
        </div>
        <div>
          <h2 className="mb-2 font-medium text-white">七、安全措施</h2>
          <p>数据仅在设备本地存储，不通过网络传输（视频帧传输为设备间直传）。AI 推理在设备端完成，不依赖云端算力。</p>
        </div>
        <div>
          <h2 className="mb-2 font-medium text-white">八、免责声明</h2>
          <p>本产品是陪伴辅助工具，不能替代专业医疗和康复服务。干预级提醒仍需家长人工确认。因网络、设备或 AI 误判导致的任何后果，本产品不承担责任。</p>
        </div>
      </div>
    </div>
  )
}

function UserTerms({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-full bg-slate-950 text-white">
      <div className="flex items-center gap-3 border-b border-slate-800 p-4 sticky top-0 bg-slate-950 z-10">
        <button onClick={onBack} className="text-white/60 hover:text-white">← 返回</button>
        <h1 className="text-lg font-medium">用户协议</h1>
      </div>
      <div className="space-y-4 p-6 text-sm leading-relaxed text-white/70">
        <p className="text-xs text-white/40">最后更新：2026年7月16日</p>
        <div>
          <h2 className="mb-2 font-medium text-white">一、服务说明</h2>
          <p>星憩时刻是一款面向星宝（孤独症儿童）家长的 AI 看护辅助产品。核心功能包括：AI 活跃指数监测、分级预警、家长喘息活动、行为分类。本产品是陪伴辅助工具，不提供医疗诊断或康复治疗服务。</p>
        </div>
        <div>
          <h2 className="mb-2 font-medium text-white">二、账号注册</h2>
          <p>用户通过手机号和密码注册账号。首次输入手机号和密码将自动注册。账号信息存储在设备本地，不上传云端。</p>
        </div>
        <div>
          <h2 className="mb-2 font-medium text-white">三、使用规范</h2>
          <p>用户应确保在使用本产品时，星宝处于安全环境中。干预级提醒仅作为辅助提示，不能替代家长的人工看护。用户不得利用本产品进行任何违法活动。</p>
        </div>
        <div>
          <h2 className="mb-2 font-medium text-white">四、免责条款</h2>
          <p>1. 本产品不替代专业医疗和康复服务。<br />2. AI 活跃指数和行为分类可能存在误判，用户应结合实际情况判断。<br />3. 因网络中断、设备故障、AI 误判导致的任何后果，本产品不承担责任。<br />4. 用户应自行承担使用本产品期间星宝的安全责任。</p>
        </div>
        <div>
          <h2 className="mb-2 font-medium text-white">五、知识产权</h2>
          <p>本产品的软件代码、界面设计、AI 模型等知识产权归开发者所有。用户不得反向工程、复制或分发。</p>
        </div>
        <div>
          <h2 className="mb-2 font-medium text-white">六、协议变更</h2>
          <p>本协议可能随产品迭代而更新，更新后将在应用内通知用户。继续使用即视为同意更新后的协议。</p>
        </div>
      </div>
    </div>
  )
}
