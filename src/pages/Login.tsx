import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button, Input } from '@/components/ui'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.')
      return
    }
    setError(null)
    setLoading(true)
    const { error: err } = await signIn(email.trim(), password)
    setLoading(false)
    if (err) {
      setError('E-mail ou senha incorretos. Verifique e tente novamente.')
      return
    }
    toast.success('Bem-vindo!')
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-800 p-4">
      {/* Background texture */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #B8962E 0%, transparent 50%), radial-gradient(circle at 80% 20%, #D4AF5A 0%, transparent 40%)' }}
        aria-hidden="true"
      />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold-500/20 border border-gold-500/30 mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                stroke="#B8962E" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(184,150,46,0.15)" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-medium text-gold-300">Oliveira Joias</h1>
          <p className="text-dark-300 text-sm mt-1">Sistema de Gestão</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-dark-700 rounded-2xl border border-dark-600 p-6 space-y-4"
          noValidate
        >
          <h2 className="text-sm font-medium text-dark-100 mb-1">Entrar na sua conta</h2>

          <div className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-xs text-dark-300 mb-1">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                className="w-full px-3 py-2 text-sm rounded-lg bg-dark-600 border border-dark-500
                           text-dark-100 placeholder:text-dark-400 outline-none transition-colors
                           focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs text-dark-300 mb-1">Senha</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3 py-2 pr-10 text-sm rounded-lg bg-dark-600 border border-dark-500
                             text-dark-100 placeholder:text-dark-400 outline-none transition-colors
                             focus:border-gold-500 focus:ring-1 focus:ring-gold-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200 transition-colors"
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full"
          >
            Entrar
          </Button>
        </form>

        <p className="text-center text-xs text-dark-400 mt-4">
          Oliveira Joias © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
