import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { loginWithPhonePassword, loginWithWechat, loginWithQQ } from './authStore'
import { OnboardingOverlay } from './OnboardingOverlay'

const ONBOARDED_KEY = 'starrest_onboarded'

type Tab = 'phone' | 'wechat' | 'qq'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [tab, setTab] = useState<Tab>('phone')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem(ONBOARDED_KEY),
  )

  function handleOnboardingDone() {
    localStorage.setItem(ONBOARDED_KEY, '1')
    setShowOnboarding(false)
  }

  if (showOnboarding) {
    return <OnboardingOverlay onDone={handleOnboardingDone} />
  }

  function handlePhoneLogin() {
    if (!/^1\d{10}$/.test(phone)) {
      setError('请输入正确的 11 位手机号')
      return
    }
    const result = loginWithPhonePassword(phone, password)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.user) {
      login(result.user)
      navigate('/care')
    }
  }

  function handleWechatLogin() {
    login(loginWithWechat())
    navigate('/care')
  }

  function handleQQLogin() {
    login(loginWithQQ())
    navigate('/care')
  }

  return (
    <Shell>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">星憩时刻</h1>
          <p className="mt-2 text-sm text-white/50">让家长喘口气</p>
        </div>

        {/* Tab */}
        <div className="flex gap-2 rounded-xl bg-slate-800/50 p-1">
          {(['phone', 'wechat', 'qq'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={`flex-1 rounded-lg py-2 text-sm transition ${tab === t ? 'bg-slate-700 text-white' : 'text-white/50'}`}
            >
              {t === 'phone' ? '手机号' : t === 'wechat' ? '微信' : 'QQ'}
            </button>
          ))}
        </div>

        {/* 手机号 + 密码 */}
        {tab === 'phone' && (
          <div className="space-y-4">
            <input
              type="tel"
              placeholder="手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
            />
            <input
              type="password"
              placeholder="密码（至少 6 位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePhoneLogin()}
              className="input"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button onClick={handlePhoneLogin} className="btn-primary">登录</button>
            <p className="text-center text-xs text-white/40">首次输入手机号和密码将自动注册</p>
          </div>
        )}

        {/* 微信 */}
        {tab === 'wechat' && (
          <div className="space-y-4 text-center">
            <div className="flex h-40 items-center justify-center rounded-xl bg-slate-800/50">
              <div>
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/20 text-3xl">💬</div>
                <p className="text-sm text-white/50">POC 模拟微信扫码</p>
              </div>
            </div>
            <button onClick={handleWechatLogin} className="btn-primary">模拟微信登录</button>
            <p className="text-xs text-white/30">上线后替换为真实微信 OAuth</p>
          </div>
        )}

        {/* QQ */}
        {tab === 'qq' && (
          <div className="space-y-4 text-center">
            <div className="flex h-40 items-center justify-center rounded-xl bg-slate-800/50">
              <div>
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/20 text-3xl">🐧</div>
                <p className="text-sm text-white/50">POC 模拟 QQ 扫码</p>
              </div>
            </div>
            <button onClick={handleQQLogin} className="btn-primary !bg-blue-600 hover:!bg-blue-500">模拟 QQ 登录</button>
            <p className="text-xs text-white/30">上线后替换为真实 QQ OAuth</p>
          </div>
        )}

        <p className="text-center text-xs text-white/30">登录即表示同意 隐私政策 和 用户协议</p>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center px-6"
      style={{
        backgroundImage: `url(${import.meta.env.BASE_URL}bg.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {children}
    </div>
  )
}
