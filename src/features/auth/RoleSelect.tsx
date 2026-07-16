import { useNavigate } from 'react-router-dom'
import { User, Baby } from 'lucide-react'

export function RoleSelect() {
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-slate-950 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">选择角色</h1>
        <p className="mt-1 text-sm text-white/50">你是家长还是星宝端？</p>
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/care')}
          className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-700/40 bg-emerald-900/20 p-8 transition hover:bg-emerald-900/40"
        >
          <User className="h-12 w-12 text-emerald-400" />
          <span className="text-sm font-medium text-white">我是家长</span>
          <span className="text-xs text-white/40">看护 + 喘息</span>
        </button>
        <button
          onClick={() => navigate('/child')}
          className="flex flex-col items-center gap-3 rounded-2xl border border-blue-700/40 bg-blue-900/20 p-8 transition hover:bg-blue-900/40"
        >
          <Baby className="h-12 w-12 text-blue-400" />
          <span className="text-sm font-medium text-white">我是星宝端</span>
          <span className="text-xs text-white/40">摄像头看护</span>
        </button>
      </div>
      <p className="max-w-xs text-center text-xs text-white/30">
        家长端和星宝端可以在不同设备上打开。POC 阶段也可在同一浏览器开两个标签页模拟。
      </p>
    </div>
  )
}
