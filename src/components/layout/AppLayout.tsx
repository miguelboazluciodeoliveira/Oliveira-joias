import { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, CreditCard, Diamond, Wrench,
  Users, Truck, Wallet, BarChart3, Settings, LogOut, ChevronLeft, Menu
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/cn'
import toast from 'react-hot-toast'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  section?: string
}

const navItems: NavItem[] = [
  { section: 'Principal', to: '/dashboard', icon: <LayoutDashboard size={16} />, label: 'Painel Geral' },
  { to: '/vendas',        icon: <ShoppingCart size={16} />,  label: 'Vendas' },
  { to: '/crediario',     icon: <CreditCard size={16} />,   label: 'Crediário' },
  { section: 'Cadastros', to: '/estoque',   icon: <Diamond size={16} />,  label: 'Estoque' },
  { to: '/servicos',      icon: <Wrench size={16} />,       label: 'Serviços' },
  { to: '/clientes',      icon: <Users size={16} />,        label: 'Clientes' },
  { to: '/fornecedores',  icon: <Truck size={16} />,        label: 'Fornecedores' },
  { section: 'Financeiro', to: '/caixa',   icon: <Wallet size={16} />,   label: 'Caixa & Financeiro' },
  { to: '/relatorios',    icon: <BarChart3 size={16} />,    label: 'Relatórios' },
]

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
    toast.success('Até logo!')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-cream-100">
      {/* SIDEBAR */}
      <aside className={cn(
        'flex flex-col bg-dark-800 border-r border-dark-700 transition-all duration-200 flex-shrink-0',
        collapsed ? 'w-14' : 'w-56'
      )}>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-dark-700 flex items-center justify-between">
          {!collapsed && (
            <div>
              <p className="font-display text-lg text-gold-300 leading-tight">Oliveira Joias</p>
              <p className="text-[10px] text-dark-300 tracking-widest uppercase mt-0.5">Sistema de Gestão</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="p-1 rounded-lg text-dark-300 hover:text-gold-300 hover:bg-dark-700 transition-colors ml-auto"
            aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          >
            {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {navItems.map((item) => (
            <div key={item.to}>
              {item.section && !collapsed && (
                <p className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-widest text-dark-300 select-none">
                  {item.section}
                </p>
              )}
              <NavLink
                to={item.to}
                className={({ isActive }) => cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all',
                  'text-dark-300 hover:text-gold-300 hover:bg-dark-700',
                  isActive && 'text-gold-300 bg-dark-700 border-l-2 border-gold-500 pl-2',
                  collapsed && 'justify-center px-0'
                )}
                title={collapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-2 py-3 border-t border-dark-700">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div className="w-7 h-7 rounded-full bg-gold-500 flex items-center justify-center text-xs font-medium text-dark-800 flex-shrink-0">
                {profile ? getInitials(profile.nome) : '?'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-dark-100 truncate">{profile?.nome || 'Usuário'}</p>
                <p className="text-[10px] text-dark-300 capitalize">{profile?.role}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => navigate('/configuracoes')}
                  className="p-1 rounded text-dark-300 hover:text-gold-300 transition-colors"
                  title="Configurações"
                >
                  <Settings size={13} />
                </button>
                <button
                  onClick={handleSignOut}
                  className="p-1 rounded text-dark-300 hover:text-red-400 transition-colors"
                  title="Sair"
                >
                  <LogOut size={13} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleSignOut}
              className="w-full flex justify-center p-2 text-dark-300 hover:text-red-400 transition-colors"
              title="Sair"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
