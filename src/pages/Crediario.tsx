import { useEffect, useState } from 'react'
import { CreditCard, DollarSign, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  formatMoney, formatDate, FORMA_PAGAMENTO_LABEL,
  crediarioStatusVariant, CREDIARIO_STATUS_LABEL,
  parcelaStatusVariant, PARCELA_STATUS_LABEL
} from '@/lib/utils'
import {
  Card, Button, Input, Select, Modal, ConfirmDialog,
  PageHeader, SearchInput, EmptyState, Badge, Spinner, MetricCard
} from '@/components/ui'
import type { Crediario, CrediarioParcela, FormaPagamento } from '@/types'
import toast from 'react-hot-toast'

const FORMAS: FormaPagamento[] = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia', 'cheque']

export function CrediarioPage() {
  const { user } = useAuth()
  const [crediarios, setCrediarios] = useState<Crediario[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  const [modalParcelas, setModalParcelas] = useState(false)
  const [modalPagamento, setModalPagamento] = useState(false)
  const [crediarioSelecionado, setCrediarioSelecionado] = useState<Crediario | null>(null)
  const [parcelaSelecionada, setParcelaSelecionada] = useState<CrediarioParcela | null>(null)

  const [formaPgto, setFormaPgto] = useState<FormaPagamento>('pix')
  const [dataPgto, setDatePgto] = useState(new Date().toISOString().split('T')[0])
  const [observacoesPgto, setObservacoesPgto] = useState('')
  const [loadingPagar, setLoadingPagar] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('crediario')
      .select(`
        *,
        cliente:clientes(id, nome, telefone),
        venda:vendas(numero),
        parcelas:crediario_parcelas(*)
      `)
      .order('created_at', { ascending: false })

    if (error) toast.error('Erro ao carregar crediários')
    else setCrediarios((data || []) as unknown as Crediario[])
    setLoading(false)
  }

  const filtrados = crediarios.filter((c) => {
    const clienteNome = (c as unknown as { cliente: { nome: string } }).cliente?.nome || ''
    const match = !search || clienteNome.toLowerCase().includes(search.toLowerCase())
    return match && (!filtroStatus || c.status === filtroStatus)
  })

  const totalAberto = crediarios
    .filter((c) => c.status !== 'quitado' && c.status !== 'cancelado')
    .reduce((s, c) => s + c.saldo, 0)

  const totalVencido = crediarios
    .filter((c) => c.status === 'vencido')
    .reduce((s, c) => s + c.saldo, 0)

  function abrirParcelas(c: Crediario) {
    setCrediarioSelecionado(c)
    setModalParcelas(true)
  }

  function abrirPagamento(parcela: CrediarioParcela) {
    setParcelaSelecionada(parcela)
    setFormaPgto('pix')
    setDatePgto(new Date().toISOString().split('T')[0])
    setObservacoesPgto('')
    setModalPagamento(true)
  }

  async function registrarPagamento() {
    if (!parcelaSelecionada || !crediarioSelecionado) return
    setLoadingPagar(true)

    // Atualiza a parcela
    const { error } = await supabase
      .from('crediario_parcelas')
      .update({
        status: 'pago',
        valor_pago: parcelaSelecionada.valor,
        data_pagamento: dataPgto,
        forma_pagamento: formaPgto,
        observacoes: observacoesPgto.trim() || null,
        recebido_por: user?.id,
      })
      .eq('id', parcelaSelecionada.id)

    if (error) {
      toast.error('Erro ao registrar pagamento')
      setLoadingPagar(false)
      return
    }

    // Cria lançamento de entrada no caixa
    const clienteNome = (crediarioSelecionado as unknown as { cliente: { nome: string } }).cliente?.nome || 'Cliente'
    await supabase.from('lancamentos').insert({
      tipo: 'entrada',
      descricao: `Crediário — ${clienteNome} (Parcela ${parcelaSelecionada.numero})`,
      valor: parcelaSelecionada.valor,
      data_lancamento: dataPgto,
      categoria_nome: 'Crediário Recebido',
      forma_pagamento: FORMA_PAGAMENTO_LABEL[formaPgto],
      referencia_id: crediarioSelecionado.id,
      referencia_tipo: 'crediario',
      created_by: user?.id,
    })

    toast.success(`Parcela ${parcelaSelecionada.numero} paga!`)
    setLoadingPagar(false)
    setModalPagamento(false)
    setParcelaSelecionada(null)
    loadData()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Crediário"
        subtitle="Controle de contas a receber e parcelas"
      />

      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Total em Aberto"
          value={formatMoney(totalAberto)}
          changeType="neutral"
          change={`${crediarios.filter((c) => c.status !== 'quitado' && c.status !== 'cancelado').length} crediários ativos`}
          accent
        />
        <MetricCard
          label="Total Vencido"
          value={formatMoney(totalVencido)}
          changeType={totalVencido > 0 ? 'down' : 'up'}
          change={totalVencido > 0 ? 'Requer atenção' : 'Tudo em dia'}
        />
        <MetricCard
          label="Crediários Quitados"
          value={String(crediarios.filter((c) => c.status === 'quitado').length)}
          changeType="up"
          change="Total quitados"
        />
      </div>

      <Card>
        <div className="flex gap-3 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por cliente..." className="w-64" />
          <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-40">
            <option value="">Todos os status</option>
            <option value="em_dia">Em Dia</option>
            <option value="vencido">Vencido</option>
            <option value="quitado">Quitado</option>
            <option value="cancelado">Cancelado</option>
          </Select>
        </div>
      </Card>

      <Card padding="none">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={36} />}
            title="Nenhum crediário encontrado"
            description="Os crediários são criados automaticamente ao registrar uma venda com esta forma de pagamento."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Venda</th>
                <th>Total</th>
                <th>Entrada</th>
                <th>Saldo</th>
                <th>Parcelas</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const parcelas = (c as unknown as { parcelas: CrediarioParcela[] }).parcelas || []
                const pagas = parcelas.filter((p) => p.status === 'pago').length
                const vencidas = parcelas.filter((p) => p.status === 'pendente' && p.data_vencimento < new Date().toISOString().split('T')[0]).length

                return (
                  <tr key={c.id}>
                    <td className="font-medium text-dark-700">
                      {(c as unknown as { cliente: { nome: string } }).cliente?.nome || '—'}
                      {vencidas > 0 && (
                        <span className="ml-2">
                          <AlertCircle size={12} className="inline text-red-500" title={`${vencidas} parcela(s) vencida(s)`} />
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-xs text-gold-600">
                      #{(c as unknown as { venda: { numero: number } }).venda?.numero || '—'}
                    </td>
                    <td className="font-medium">{formatMoney(c.total)}</td>
                    <td className="text-dark-400">{formatMoney(c.entrada)}</td>
                    <td className={c.saldo > 0 ? 'font-medium text-dark-700' : 'text-green-600 font-medium'}>
                      {formatMoney(c.saldo)}
                    </td>
                    <td className="text-xs text-dark-400">
                      {pagas}/{c.num_parcelas} pagas
                    </td>
                    <td>
                      <Badge variant={crediarioStatusVariant(c.status)}>
                        {CREDIARIO_STATUS_LABEL[c.status]}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => abrirParcelas(c)}
                          disabled={c.status === 'quitado' || c.status === 'cancelado'}
                        >
                          Ver Parcelas
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Modal Parcelas */}
      <Modal
        open={modalParcelas}
        onClose={() => setModalParcelas(false)}
        title={`Parcelas — ${(crediarioSelecionado as unknown as { cliente: { nome: string } } | null)?.cliente?.nome || ''}`}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setModalParcelas(false)}>Fechar</Button>}
      >
        {crediarioSelecionado && (
          <div className="space-y-3">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-3 bg-cream-100 rounded-lg p-3">
              <div>
                <p className="text-xs text-dark-300">Total</p>
                <p className="font-medium">{formatMoney(crediarioSelecionado.total)}</p>
              </div>
              <div>
                <p className="text-xs text-dark-300">Entrada paga</p>
                <p className="font-medium">{formatMoney(crediarioSelecionado.entrada)}</p>
              </div>
              <div>
                <p className="text-xs text-dark-300">Saldo restante</p>
                <p className={`font-medium ${crediarioSelecionado.saldo <= 0 ? 'text-green-600' : 'text-dark-700'}`}>
                  {formatMoney(crediarioSelecionado.saldo)}
                </p>
              </div>
            </div>

            {/* Lista de parcelas */}
            <div className="border border-gold-100 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream-100">
                    <th className="text-left px-3 py-2 text-xs text-dark-400 font-medium">Parcela</th>
                    <th className="text-left px-3 py-2 text-xs text-dark-400 font-medium">Vencimento</th>
                    <th className="text-left px-3 py-2 text-xs text-dark-400 font-medium">Valor</th>
                    <th className="text-left px-3 py-2 text-xs text-dark-400 font-medium">Pagamento</th>
                    <th className="text-left px-3 py-2 text-xs text-dark-400 font-medium">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {((crediarioSelecionado as unknown as { parcelas: CrediarioParcela[] }).parcelas || [])
                    .sort((a, b) => a.numero - b.numero)
                    .map((p) => {
                      const isVencida = p.status === 'pendente' &&
                        p.data_vencimento < new Date().toISOString().split('T')[0]
                      return (
                        <tr key={p.id} className="border-t border-gold-50">
                          <td className="px-3 py-2 font-medium text-dark-600">
                            {p.numero}ª parcela
                          </td>
                          <td className={`px-3 py-2 text-xs ${isVencida ? 'text-red-600 font-medium' : 'text-dark-400'}`}>
                            {formatDate(p.data_vencimento)}
                            {isVencida && ' ⚠'}
                          </td>
                          <td className="px-3 py-2 font-medium">{formatMoney(p.valor)}</td>
                          <td className="px-3 py-2 text-xs text-dark-400">
                            {p.data_pagamento ? formatDate(p.data_pagamento) : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={parcelaStatusVariant(p.status)}>
                              {PARCELA_STATUS_LABEL[p.status]}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {p.status === 'pendente' && (
                              <Button
                                variant="primary"
                                size="sm"
                                leftIcon={<DollarSign size={12} />}
                                onClick={() => { setModalParcelas(false); abrirPagamento(p) }}
                              >
                                Pagar
                              </Button>
                            )}
                            {p.status === 'pago' && (
                              <CheckCircle size={16} className="text-green-600 ml-auto" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Pagamento */}
      <Modal
        open={modalPagamento}
        onClose={() => !loadingPagar && setModalPagamento(false)}
        title={`Registrar Pagamento — Parcela ${parcelaSelecionada?.numero}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalPagamento(false)} disabled={loadingPagar}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={registrarPagamento} loading={loadingPagar}>
              Confirmar Pagamento
            </Button>
          </>
        }
      >
        {parcelaSelecionada && (
          <div className="space-y-3">
            <div className="bg-gold-50 rounded-lg p-3 border border-gold-200 text-center">
              <p className="text-xs text-dark-400">Valor da parcela</p>
              <p className="font-display text-2xl text-gold-600">{formatMoney(parcelaSelecionada.valor)}</p>
              <p className="text-xs text-dark-300 mt-0.5">
                Vencimento: {formatDate(parcelaSelecionada.data_vencimento)}
              </p>
            </div>
            <Select
              label="Forma de Pagamento"
              value={formaPgto}
              onChange={(e) => setFormaPgto(e.target.value as FormaPagamento)}
            >
              {FORMAS.map((f) => <option key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f]}</option>)}
            </Select>
            <Input
              label="Data do Pagamento"
              type="date"
              value={dataPgto}
              onChange={(e) => setDatePgto(e.target.value)}
            />
            <Input
              label="Observações"
              value={observacoesPgto}
              onChange={(e) => setObservacoesPgto(e.target.value)}
              placeholder="Opcional..."
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
