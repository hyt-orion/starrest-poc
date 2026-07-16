import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { loginWithPhonePassword } from './authStore'
import { OnboardingOverlay } from './OnboardingOverlay'

const ONBOARDED_KEY = 'starrest_onboarded'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
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

  if (showOnboarding) {
    return <OnboardingOverlay onDone={handleOnboardingDone} />
  }

  return (
    <Shell>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">星憩时刻</h1>
          <p className="mt-2 text-sm text-white/50">让家长喘口气</p>
        </div>

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
