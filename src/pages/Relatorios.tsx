import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { formatMoney, PRODUTO_CATEGORIA_LABEL, FORMA_PAGAMENTO_LABEL } from '@/lib/utils'
import { Card, CardHeader, Select, Spinner, MetricCard } from '@/components/ui'
import type { ProdutoCategoria, FormaPagamento } from '@/types'

const COLORS = ['#B8962E', '#D4AF5A', '#9A7B22', '#EBD9A4', '#7A5C10', '#3D2B05', '#C49A35', '#5C4208']

interface FaturamentoMes {
  mes: string
  entradas: number
  saidas: number
  saldo: number
}

interface CategoriaData { name: string; value: number }
interface FormaPgtoData { name: string; value: number; total: number }
interface ProdutoTopData { nome: string; quantidade: number; total: number }

export function RelatoriosPage() {
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('6')

  // Chart data
  const [faturamentoMeses, setFaturamentoMeses] = useState<FaturamentoMes[]>([])
  const [categoriaVendas, setCategoriaVendas] = useState<CategoriaData[]>([])
  const [formasPagamento, setFormasPagamento] = useState<FormaPgtoData[]>([])
  const [topProdutos, setTopProdutos] = useState<ProdutoTopData[]>([])

  // Summary stats
  const [receitaTotal, setReceitaTotal] = useState(0)
  const [despesaTotal, setDespesaTotal] = useState(0)
  const [ticketMedio, setTicketMedio] = useState(0)
  const [totalVendas, setTotalVendas] = useState(0)

  useEffect(() => { loadData() }, [periodo])

  async function loadData() {
    setLoading(true)
    try {
      const meses = parseInt(periodo)
      const now = new Date()
      const dataInicio = new Date(now.getFullYear(), now.getMonth() - meses + 1, 1)
        .toISOString().split('T')[0]

      const [lancamentosRes, vendasRes, vendaItensRes] = await Promise.all([
        supabase.from('lancamentos').select('tipo, valor, data_lancamento').gte('data_lancamento', dataInicio),
        supabase.from('vendas').select('total, forma_pagamento, data_venda, status').gte('data_venda', dataInicio).neq('status', 'cancelado'),
        supabase.from('venda_itens').select('quantidade, subtotal, produto:produtos(categoria)').gte('created_at', `${dataInicio}T00:00:00`),
      ])

      const lancamentos = lancamentosRes.data || []
      const vendas = vendasRes.data || []
      const itens = vendaItensRes.data || []

      // Resumo
      const rec = lancamentos.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0)
      const desp = lancamentos.filter((l) => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0)
      setReceitaTotal(rec)
      setDespesaTotal(desp)
      setTotalVendas(vendas.length)
      setTicketMedio(vendas.length ? vendas.reduce((s, v) => s + v.total, 0) / vendas.length : 0)

      // Faturamento por mês
      buildFaturamentoMeses(lancamentos, meses)

      // Categorias de produtos vendidos
      buildCategorias(itens)

      // Formas de pagamento
      buildFormasPagamento(vendas)

      // Top produtos
      await buildTopProdutos(dataInicio)
    } finally {
      setLoading(false)
    }
  }

  function buildFaturamentoMeses(
    lancamentos: { tipo: string; valor: number; data_lancamento: string }[],
    meses: number
  ) {
    const now = new Date()
    const resultado: FaturamentoMes[] = []

    for (let i = meses - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const inicio = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]

      const mesLanc = lancamentos.filter((l) => l.data_lancamento >= inicio && l.data_lancamento <= fim)
      const entradas = mesLanc.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0)
      const saidas = mesLanc.filter((l) => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0)

      resultado.push({
        mes: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        entradas: Math.round(entradas),
        saidas: Math.round(saidas),
        saldo: Math.round(entradas - saidas),
      })
    }
    setFaturamentoMeses(resultado)
  }

  function buildCategorias(itens: { quantidade: number; subtotal: number; produto: { categoria: string } | null }[]) {
    const map: Record<string, number> = {}
    itens.forEach((item) => {
      const cat = item.produto?.categoria || 'outro'
      map[cat] = (map[cat] || 0) + item.subtotal
    })
    const data: CategoriaData[] = Object.entries(map)
      .map(([k, v]) => ({ name: PRODUTO_CATEGORIA_LABEL[k as ProdutoCategoria] || k, value: Math.round(v) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
    setCategoriaVendas(data)
  }

  function buildFormasPagamento(vendas: { total: number; forma_pagamento: string }[]) {
    const map: Record<string, { count: number; total: number }> = {}
    vendas.forEach((v) => {
      const key = v.forma_pagamento
      if (!map[key]) map[key] = { count: 0, total: 0 }
      map[key].count += 1
      map[key].total += v.total
    })
    const total = vendas.length || 1
    const data: FormaPgtoData[] = Object.entries(map)
      .map(([k, v]) => ({
        name: FORMA_PAGAMENTO_LABEL[k as FormaPagamento] || k,
        value: Math.round((v.count / total) * 100),
        total: Math.round(v.total),
      }))
      .sort((a, b) => b.total - a.total)
    setFormasPagamento(data)
  }

  async function buildTopProdutos(dataInicio: string) {
    const { data } = await supabase
      .from('venda_itens')
      .select('nome_produto, quantidade, subtotal')
      .gte('created_at', `${dataInicio}T00:00:00`)

    if (!data) return

    const map: Record<string, { quantidade: number; total: number }> = {}
    data.forEach((item) => {
      if (!map[item.nome_produto]) map[item.nome_produto] = { quantidade: 0, total: 0 }
      map[item.nome_produto].quantidade += item.quantidade
      map[item.nome_produto].total += item.subtotal
    })

    const top: ProdutoTopData[] = Object.entries(map)
      .map(([nome, v]) => ({ nome, quantidade: v.quantidade, total: Math.round(v.total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    setTopProdutos(top)
  }

  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 8,
    border: '1px solid #EBD9A4',
    backgroundColor: '#fff',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-dark-800">Relatórios</h1>
          <p className="text-xs text-dark-300 mt-0.5">Análise de desempenho do negócio</p>
        </div>
        <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-40">
          <option value="3">Últimos 3 meses</option>
          <option value="6">Últimos 6 meses</option>
          <option value="12">Último ano</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={36} /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="Receita Total" value={formatMoney(receitaTotal)} changeType="up" change={`${parseInt(periodo)} meses`} accent />
            <MetricCard label="Despesa Total" value={formatMoney(despesaTotal)} changeType="down" change="Saídas de caixa" />
            <MetricCard
              label="Lucro do Período"
              value={formatMoney(receitaTotal - despesaTotal)}
              changeType={receitaTotal - despesaTotal >= 0 ? 'up' : 'down'}
              change="Receita − Despesa"
            />
            <MetricCard label="Ticket Médio" value={formatMoney(ticketMedio)} changeType="neutral" change={`${totalVendas} vendas`} />
          </div>

          {/* Faturamento Mensal */}
          <Card>
            <CardHeader title="Faturamento Mensal" subtitle="Entradas, saídas e saldo por mês" />
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={faturamentoMeses} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5EFD8" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9C8B72' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatMoney(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="entradas" name="Entradas" fill="#B8962E" radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar dataKey="saidas" name="Saídas" fill="#EBD9A4" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Evolução do Saldo */}
          <Card>
            <CardHeader title="Evolução do Saldo" subtitle="Saldo acumulado mês a mês" />
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={faturamentoMeses} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5EFD8" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9C8B72' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatMoney(v), 'Saldo']} />
                <Line dataKey="saldo" name="Saldo" stroke="#B8962E" strokeWidth={2.5} dot={{ r: 4, fill: '#B8962E' }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            {/* Categorias */}
            <Card>
              <CardHeader title="Vendas por Categoria" subtitle="Receita por tipo de produto" />
              {categoriaVendas.length === 0 ? (
                <p className="text-xs text-dark-300 text-center py-8">Sem dados no período</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={categoriaVendas}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {categoriaVendas.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatMoney(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Formas de pagamento */}
            <Card>
              <CardHeader title="Formas de Pagamento" subtitle="% das vendas por forma" />
              {formasPagamento.length === 0 ? (
                <p className="text-xs text-dark-300 text-center py-8">Sem dados no período</p>
              ) : (
                <div className="space-y-2 mt-1">
                  {formasPagamento.map((fp, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-dark-600">{fp.name}</span>
                          <span className="text-xs text-dark-400">{fp.value}% — {formatMoney(fp.total)}</span>
                        </div>
                        <div className="h-1.5 bg-cream-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${fp.value}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Top produtos */}
          <Card>
            <CardHeader title="Top 10 Produtos Mais Vendidos" subtitle="Por receita gerada no período" />
            {topProdutos.length === 0 ? (
              <p className="text-xs text-dark-300 text-center py-8">Sem dados de vendas no período</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={topProdutos}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9C8B72' }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis
                    type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#6B5B45' }}
                    axisLine={false} tickLine={false} width={160}
                    tickFormatter={(v: string) => v.length > 22 ? v.substring(0, 22) + '…' : v}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatMoney(v), 'Receita']} />
                  <Bar dataKey="total" name="Receita" fill="#B8962E" radius={[0, 4, 4, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
