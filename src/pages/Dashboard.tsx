import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, AlertCircle, Package,
  ShoppingCart, Wrench, CreditCard
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate, VENDA_STATUS_LABEL, vendaStatusVariant } from '@/lib/utils'
import { Card, CardHeader, Badge, MetricCard, Spinner } from '@/components/ui'
import type { Venda, VwEstoqueAtual, Servico, CrediarioParcela } from '@/types'

interface DashboardStats {
  faturamentoMes: number
  faturamentoMesAnterior: number
  saldoCaixa: number
  crediarioAberto: number
  servicosAndamento: number
  parcelasVencidas: number
}

interface FaturamentoMes {
  mes: string
  total: number
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [vendasRecentes, setVendasRecentes] = useState<Venda[]>([])
  const [estoqueCritico, setEstoqueCritico] = useState<VwEstoqueAtual[]>([])
  const [servicosAtivos, setServicosAtivos] = useState<Servico[]>([])
  const [parcelasVencidas, setParcelasVencidas] = useState<CrediarioParcela[]>([])
  const [faturamentoMeses, setFaturamentoMeses] = useState<FaturamentoMes[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const now = new Date()
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
      const fimMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]

      const [vendasRes, lancamentosRes, servicosRes, estoqueCriticoRes, parcelasRes] = await Promise.all([
        supabase
          .from('vendas')
          .select('*, cliente:clientes(nome, telefone)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('lancamentos')
          .select('tipo, valor, data_lancamento'),
        supabase
          .from('servicos')
          .select('*, cliente:clientes(nome)')
          .in('status', ['aguardando', 'em_andamento'])
          .order('created_at', { ascending: false }),
        supabase
          .from('vw_estoque_atual')
          .select('*')
          .in('status_estoque', ['critico', 'esgotado'])
          .order('estoque_atual', { ascending: true }),
        supabase
          .from('crediario_parcelas')
          .select('*, cliente:clientes(nome, telefone)')
          .eq('status', 'pendente')
          .lt('data_vencimento', now.toISOString().split('T')[0])
          .order('data_vencimento', { ascending: true })
          .limit(5),
      ])

      // Faturamento mês atual
      const vendasMes = lancamentosRes.data?.filter(
        (l) => l.tipo === 'entrada' && l.data_lancamento >= inicioMes
      ) || []
      const faturamentoMes = vendasMes.reduce((s, l) => s + (l.valor || 0), 0)

      // Faturamento mês anterior
      const vendasMesAnterior = lancamentosRes.data?.filter(
        (l) => l.tipo === 'entrada' &&
          l.data_lancamento >= inicioMesAnterior &&
          l.data_lancamento <= fimMesAnterior
      ) || []
      const faturamentoMesAnterior = vendasMesAnterior.reduce((s, l) => s + (l.valor || 0), 0)

      // Saldo de caixa total
      const entradas = lancamentosRes.data?.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0) || 0
      const saidas = lancamentosRes.data?.filter((l) => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0) || 0

      setStats({
        faturamentoMes,
        faturamentoMesAnterior,
        saldoCaixa: entradas - saidas,
        crediarioAberto: 0, // preenchido abaixo
        servicosAndamento: servicosRes.data?.length || 0,
        parcelasVencidas: parcelasRes.data?.length || 0,
      })

      setVendasRecentes((vendasRes.data || []) as unknown as Venda[])
      setEstoqueCritico((estoqueCriticoRes.data || []) as VwEstoqueAtual[])
      setServicosAtivos((servicosRes.data || []) as unknown as Servico[])
      setParcelasVencidas((parcelasRes.data || []) as unknown as CrediarioParcela[])

      // Faturamento dos últimos 6 meses
      buildFaturamentoMeses(lancamentosRes.data || [])
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  function buildFaturamentoMeses(lancamentos: { tipo: string; valor: number; data_lancamento: string }[]) {
    const meses: FaturamentoMes[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const inicio = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
      const total = lancamentos
        .filter((l) => l.tipo === 'entrada' && l.data_lancamento >= inicio && l.data_lancamento <= fim)
        .reduce((s, l) => s + l.valor, 0)
      meses.push({
        mes: d.toLocaleDateString('pt-BR', { month: 'short' }),
        total,
      })
    }
    setFaturamentoMeses(meses)
  }

  const variacao =
    stats && stats.faturamentoMesAnterior > 0
      ? ((stats.faturamentoMes - stats.faturamentoMesAnterior) / stats.faturamentoMesAnterior) * 100
      : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Page title */}
      <div>
        <h1 className="font-display text-2xl font-medium text-dark-800">Painel Geral</h1>
        <p className="text-xs text-dark-300 mt-0.5">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Faturamento do Mês"
          value={formatMoney(stats?.faturamentoMes)}
          change={
            variacao !== 0
              ? `${variacao > 0 ? '+' : ''}${variacao.toFixed(1)}% vs mês anterior`
              : 'Primeiro mês'
          }
          changeType={variacao >= 0 ? 'up' : 'down'}
          accent
        />
        <MetricCard
          label="Saldo em Caixa"
          value={formatMoney(stats?.saldoCaixa)}
          change="Entradas − saídas"
          changeType="neutral"
        />
        <MetricCard
          label="Parcelas Vencidas"
          value={String(stats?.parcelasVencidas || 0)}
          change={stats?.parcelasVencidas ? 'Requer atenção' : 'Tudo em dia'}
          changeType={stats?.parcelasVencidas ? 'down' : 'up'}
        />
        <MetricCard
          label="Serviços em Andamento"
          value={String(stats?.servicosAndamento || 0)}
          change="Aguardando ou em trabalho"
          changeType="neutral"
        />
      </div>

      {/* Charts + Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico */}
        <Card>
          <CardHeader title="Faturamento — Últimos 6 Meses" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={faturamentoMeses} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9C8B72' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => [formatMoney(v), 'Faturamento']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #EBD9A4' }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {faturamentoMeses.map((_, i) => (
                  <Cell key={i} fill={i === faturamentoMeses.length - 1 ? '#B8962E' : '#EBD9A4'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Vendas Recentes */}
        <Card>
          <CardHeader
            title="Últimas Vendas"
            actions={
              <button
                onClick={() => navigate('/vendas')}
                className="text-xs text-gold-600 hover:text-gold-500"
              >
                Ver todas →
              </button>
            }
          />
          <div className="space-y-0.5">
            {vendasRecentes.length === 0 && (
              <p className="text-sm text-dark-300 text-center py-6">Nenhuma venda registrada.</p>
            )}
            {vendasRecentes.map((v) => (
              <div key={v.id}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-cream-100 transition-colors cursor-pointer"
                onClick={() => navigate('/vendas')}
              >
                <div className="w-8 h-8 rounded-lg bg-gold-50 flex items-center justify-center text-gold-600 flex-shrink-0">
                  <ShoppingCart size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dark-700 truncate">
                    {(v as unknown as { cliente: { nome: string } }).cliente?.nome || 'Consumidor Final'}
                  </p>
                  <p className="text-xs text-dark-300">{formatDate(v.data_venda)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge variant={vendaStatusVariant(v.status)}>
                    {VENDA_STATUS_LABEL[v.status]}
                  </Badge>
                  <p className="text-xs font-medium text-dark-600 mt-0.5">{formatMoney(v.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Estoque crítico */}
        <Card>
          <CardHeader
            title="Estoque Crítico"
            subtitle="Itens esgotados ou abaixo do mínimo"
            actions={<Package size={16} className="text-gold-400" />}
          />
          {estoqueCritico.length === 0 ? (
            <p className="text-xs text-dark-300 text-center py-4">Estoque normalizado ✓</p>
          ) : (
            <div className="space-y-2">
              {estoqueCritico.slice(0, 5).map((e) => (
                <div key={e.variacao_id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-dark-600 truncate">{e.produto_nome}</p>
                    <p className="text-xs text-dark-300">{e.variacao_nome}</p>
                  </div>
                  <Badge variant={e.status_estoque === 'esgotado' ? 'danger' : 'warning'}>
                    {e.status_estoque === 'esgotado' ? 'Esgotado' : `${e.estoque_atual} un`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Serviços em andamento */}
        <Card>
          <CardHeader
            title="Serviços Ativos"
            actions={<Wrench size={16} className="text-gold-400" />}
          />
          {servicosAtivos.length === 0 ? (
            <p className="text-xs text-dark-300 text-center py-4">Nenhum serviço ativo.</p>
          ) : (
            <div className="space-y-2">
              {servicosAtivos.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-dark-600 truncate">{s.tipo}</p>
                    <p className="text-xs text-dark-300 truncate">
                      {(s as unknown as { cliente: { nome: string } }).cliente?.nome || '—'}
                    </p>
                  </div>
                  <Badge variant={s.status === 'em_andamento' ? 'info' : 'warning'}>
                    {s.status === 'em_andamento' ? 'Andamento' : 'Aguardando'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Parcelas vencidas */}
        <Card>
          <CardHeader
            title="Parcelas Vencidas"
            actions={<CreditCard size={16} className="text-red-400" />}
          />
          {parcelasVencidas.length === 0 ? (
            <p className="text-xs text-dark-300 text-center py-4">Nenhuma parcela vencida ✓</p>
          ) : (
            <div className="space-y-2">
              {parcelasVencidas.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-dark-600 truncate">
                      {(p as unknown as { cliente: { nome: string } }).cliente?.nome || '—'}
                    </p>
                    <p className="text-xs text-red-400">
                      <AlertCircle size={10} className="inline mr-0.5" />
                      Venc. {formatDate(p.data_vencimento)}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-red-600 flex-shrink-0">
                    {formatMoney(p.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
