import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/Login'
import { DashboardPage } from '@/pages/Dashboard'
import { VendasPage } from '@/pages/Vendas'
import { CrediarioPage } from '@/pages/Crediario'
import { EstoquePage } from '@/pages/Estoque'
import { ServicosPage } from '@/pages/Servicos'
import { ClientesPage } from '@/pages/Clientes'
import { FornecedoresPage } from '@/pages/Fornecedores'
import { CaixaPage } from '@/pages/Caixa'
import { RelatoriosPage } from '@/pages/Relatorios'
import { ConfiguracoesPage } from '@/pages/Configuracoes'
import { Spinner } from '@/components/ui'

// Protege rotas que exigem autenticação
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100">
        <Spinner size={36} />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

// Redireciona usuários já logados da tela de login
function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-800">
        <Spinner size={36} />
      </div>
    )
  }

  if (session) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Rota pública */}
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />

      {/* Rotas protegidas dentro do layout */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/vendas" element={<VendasPage />} />
        <Route path="/crediario" element={<CrediarioPage />} />
        <Route path="/estoque" element={<EstoquePage />} />
        <Route path="/servicos" element={<ServicosPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/fornecedores" element={<FornecedoresPage />} />
        <Route path="/caixa" element={<CaixaPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
      </Route>

      {/* Qualquer rota desconhecida → dashboard ou login */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#fff',
              color: '#2C2318',
              border: '1px solid #EBD9A4',
              borderRadius: '10px',
              fontSize: '13px',
              fontFamily: '"DM Sans", sans-serif',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            },
            success: {
              iconTheme: { primary: '#B8962E', secondary: '#FAF6EE' },
            },
            error: {
              iconTheme: { primary: '#dc2626', secondary: '#fff' },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
