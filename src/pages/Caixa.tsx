import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, History, TrendingUp, TrendingDown,
  Filter, ChevronDown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney, formatDate, formatDateTime } from '@/lib/utils'
import {
  Card, CardHeader, Badge, Button, Input, Select, Textarea,
  Modal, ConfirmDialog, MetricCard, Spinner, EmptyState, SearchInput, Divider
} from '@/components/ui'
import type { Lancamento, LancamentoTipo, CategoriaFinanceira, LancamentoHistorico } from '@/types'
import toast from 'react-hot-toast'

// ── FORM STATE ─────────────────────────────────────────────────
interface LancamentoForm {
  tipo: LancamentoTipo
  descricao: string
  valor: string
  data_lancamento: string
  categoria_id: string
  forma_pagamento: string
  observacoes: string
}

const FORMAS = ['Dinheiro', 'Pix', 'Cartão Débito', 'Cartão Crédito', 'Transferência', 'Boleto', 'Cheque']

const formEmpty = (): LancamentoForm => ({
  tipo: 'entrada',
  descricao: '',
  valor: '',
  data_lancamento: new Date().toISOString().split('T')[0],
  categoria_id: '',
  forma_pagamento: 'Pix',
  observacoes: '',
})

export function CaixaPage() {
  const { user } = useAuth()

  // Data
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([])
  const [historico, setHistorico] = useState<LancamentoHistorico[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'' | 'entrada' | 'saida'>('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)

  // Modais
  const [modalAberto, setModalAberto] = useState(false)
  const [modalHistorico, setModalHistorico] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [loadingSave, setLoadingSave] = useState(false)

  // Estado do form
  const [form, setForm] = useState<LancamentoForm>(formEmpty())
  const [motivoEdicao, setMotivoEdicao] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [deletandoId, setDeletandoId] = useState<string | null>(null)
  const [historicoId, setHistoricoId] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof LancamentoForm, string>>>({})

  useEffect(() => {
    loadData()
    loadCategorias()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('lancamentos')
      .select('*')
      .order('data_lancamento', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Erro ao carregar lançamentos')
    } else {
      setLancamentos((data || []) as Lancamento[])
    }
    setLoading(false)
  }

  async function loadCategorias() {
    const { data } = await supabase
      .from('categorias_financeiras')
      .select('*')
      .eq('ativo', true)
      .order('nome')
    setCategorias((data || []) as CategoriaFinanceira[])
  }

  async function loadHistorico(lancamentoId: string) {
    const { data, error } = await supabase
      .from('lancamentos_historico')
      .select('*, profile:profiles(nome)')
      .eq('lancamento_id', lancamentoId)
      .order('alterado_em', { ascending: false })
    if (!error) {
      setHistorico((data || []) as LancamentoHistorico[])
    }
  }

  // ── Filtro local ────────────────────────────────────────────
  const lancamentosFiltrados = lancamentos.filter((l) => {
    const matchSearch = !search || l.descricao.toLowerCase().includes(search.toLowerCase()) ||
      l.categoria_nome?.toLowerCase().includes(search.toLowerCase()) || false
    const matchTipo = !filtroTipo || l.tipo === filtroTipo
    const matchCat = !filtroCategoria || l.categoria_id === filtroCategoria
    const matchInicio = !dataInicio || l.data_lancamento >= dataInicio
    const matchFim = !dataFim || l.data_lancamento <= dataFim
    return matchSearch && matchTipo && matchCat && matchInicio && matchFim
  })

  // ── Totais ──────────────────────────────────────────────────
  const totalEntradas = lancamentosFiltrados.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0)
  const totalSaidas = lancamentosFiltrados.filter((l) => l.tipo === 'saida').reduce((s, l) => s + l.valor, 0)
  const saldo = totalEntradas - totalSaidas

  // ── Validação ───────────────────────────────────────────────
  function validateForm(): boolean {
    const errors: Partial<Record<keyof LancamentoForm, string>> = {}
    if (!form.descricao.trim()) errors.descricao = 'Descrição obrigatória'
    if (!form.valor || isNaN(parseFloat(form.valor)) || parseFloat(form.valor) <= 0)
      errors.valor = 'Valor deve ser maior que zero'
    if (!form.data_lancamento) errors.data_lancamento = 'Data obrigatória'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Abrir modal novo lançamento ─────────────────────────────
  function abrirNovo() {
    setEditandoId(null)
    setForm(formEmpty())
    setMotivoEdicao('')
    setFormErrors({})
    setModalAberto(true)
  }

  // ── Abrir modal editar ──────────────────────────────────────
  function abrirEditar(l: Lancamento) {
    setEditandoId(l.id)
    setForm({
      tipo: l.tipo,
      descricao: l.descricao,
      valor: String(l.valor),
      data_lancamento: l.data_lancamento,
      categoria_id: l.categoria_id || '',
      forma_pagamento: l.forma_pagamento || 'Pix',
      observacoes: l.observacoes || '',
    })
    setMotivoEdicao('')
    setFormErrors({})
    setModalAberto(true)
  }

  // ── Salvar (novo ou editar) ─────────────────────────────────
  async function salvar() {
    if (!validateForm()) return
    if (editandoId && !motivoEdicao.trim()) {
      toast.error('Informe o motivo da alteração')
      return
    }

    setLoadingSave(true)

    const categoriaObj = categorias.find((c) => c.id === form.categoria_id)
    const payload = {
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      valor: parseFloat(form.valor),
      data_lancamento: form.data_lancamento,
      categoria_id: form.categoria_id || null,
      categoria_nome: categoriaObj?.nome || null,
      forma_pagamento: form.forma_pagamento,
      observacoes: form.observacoes.trim() || null,
    }

    if (editandoId) {
      // Editar existente
      const { error } = await supabase
        .from('lancamentos')
        .update({ ...payload, updated_by: user?.id })
        .eq('id', editandoId)

      if (error) {
        toast.error('Erro ao salvar alterações')
        setLoadingSave(false)
        return
      }

      // Registra motivo no histórico (campo extra não capturado pelo trigger)
      await supabase.from('lancamentos_historico').insert({
        lancamento_id: editandoId,
        campo_alterado: 'motivo_manual',
        valor_antes: null,
        valor_depois: motivoEdicao.trim(),
        motivo: motivoEdicao.trim(),
        alterado_por: user?.id,
      })

      toast.success('Lançamento atualizado!')
    } else {
      // Novo lançamento
      const { error } = await supabase
        .from('lancamentos')
        .insert({ ...payload, created_by: user?.id, referencia_tipo: 'manual' })

      if (error) {
        toast.error('Erro ao criar lançamento')
        setLoadingSave(false)
        return
      }
      toast.success('Lançamento registrado!')
    }

    setLoadingSave(false)
    setModalAberto(false)
    loadData()
  }

  // ── Excluir ─────────────────────────────────────────────────
  function confirmarExcluir(id: string) {
    setDeletandoId(id)
    setConfirmDelete(true)
  }

  async function excluir() {
    if (!deletandoId) return
    setLoadingDelete(true)
    const { error } = await supabase.from('lancamentos').delete().eq('id', deletandoId)
    if (error) {
      toast.error('Erro ao excluir lançamento')
    } else {
      toast.success('Lançamento excluído')
      setLancamentos((prev) => prev.filter((l) => l.id !== deletandoId))
    }
    setLoadingDelete(false)
    setConfirmDelete(false)
    setDeletandoId(null)
  }

  // ── Ver histórico ───────────────────────────────────────────
  async function verHistorico(l: Lancamento) {
    setHistoricoId(l.id)
    await loadHistorico(l.id)
    setModalHistorico(true)
  }

  function fecharModal() {
    if (!loadingSave) setModalAberto(false)
  }

  const lancandoDeletar = lancamentos.find((l) => l.id === deletandoId)
  const categoriasFiltradas = form.tipo ? categorias.filter((c) => c.tipo === form.tipo) : categorias

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-dark-800">Caixa & Financeiro</h1>
          <p className="text-xs text-dark-300 mt-0.5">Lançamentos de entradas e saídas</p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={15} />} onClick={abrirNovo}>
          Novo Lançamento
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Total Entradas"
          value={formatMoney(totalEntradas)}
          changeType="up"
          change={`${lancamentosFiltrados.filter((l) => l.tipo === 'entrada').length} lançamentos`}
        />
        <MetricCard
          label="Total Saídas"
          value={formatMoney(totalSaidas)}
          changeType="down"
          change={`${lancamentosFiltrados.filter((l) => l.tipo === 'saida').length} lançamentos`}
        />
        <MetricCard
          label="Saldo do Período"
          value={formatMoney(saldo)}
          changeType={saldo >= 0 ? 'up' : 'down'}
          change={saldo >= 0 ? 'Positivo' : 'Negativo'}
          accent
        />
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar lançamento..."
            className="w-60"
          />
          <Select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as '' | 'entrada' | 'saida')}
            className="w-36"
          >
            <option value="">Todos os tipos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </Select>
          <Select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="w-48"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
          <button
            onClick={() => setShowFiltros((v) => !v)}
            className="flex items-center gap-1 text-xs text-dark-400 hover:text-gold-600 transition-colors"
          >
            <Filter size={13} />
            Datas
            <ChevronDown size={12} className={showFiltros ? 'rotate-180' : ''} />
          </button>
          {(search || filtroTipo || filtroCategoria || dataInicio || dataFim) && (
            <button
              onClick={() => { setSearch(''); setFiltroTipo(''); setFiltroCategoria(''); setDataInicio(''); setDataFim('') }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {showFiltros && (
          <div className="flex gap-3 mt-3 pt-3 border-t border-gold-100">
            <Input
              label="Data inicial"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-40"
            />
            <Input
              label="Data final"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-40"
            />
          </div>
        )}
      </Card>

      {/* Tabela */}
      <Card padding="none">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : lancamentosFiltrados.length === 0 ? (
          <EmptyState
            icon={<TrendingUp size={40} />}
            title="Nenhum lançamento encontrado"
            description="Adicione entradas e saídas ou ajuste os filtros."
            action={<Button variant="primary" leftIcon={<Plus size={14} />} onClick={abrirNovo}>Novo Lançamento</Button>}
          />
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Forma</th>
                  <th>Tipo</th>
                  <th className="text-right">Valor</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lancamentosFiltrados.map((l) => (
                  <tr key={l.id}>
                    <td className="text-dark-300 whitespace-nowrap">{formatDate(l.data_lancamento)}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-dark-700">{l.descricao}</span>
                        {l.editado && (
                          <span className="text-[10px] text-gold-600 bg-gold-50 px-1.5 py-0.5 rounded-full border border-gold-200">
                            editado
                          </span>
                        )}
                      </div>
                      {l.observacoes && (
                        <p className="text-xs text-dark-300 mt-0.5 truncate max-w-xs">{l.observacoes}</p>
                      )}
                    </td>
                    <td>
                      {l.categoria_nome && (
                        <Badge variant="gray">{l.categoria_nome}</Badge>
                      )}
                    </td>
                    <td className="text-dark-400 text-xs">{l.forma_pagamento || '—'}</td>
                    <td>
                      {l.tipo === 'entrada' ? (
                        <Badge variant="success">
                          <TrendingUp size={10} className="mr-1" />Entrada
                        </Badge>
                      ) : (
                        <Badge variant="danger">
                          <TrendingDown size={10} className="mr-1" />Saída
                        </Badge>
                      )}
                    </td>
                    <td className={`text-right font-medium whitespace-nowrap ${l.tipo === 'entrada' ? 'text-green-700' : 'text-red-700'}`}>
                      {l.tipo === 'entrada' ? '+' : '-'}{formatMoney(l.valor)}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {l.editado && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => verHistorico(l)}
                            title="Ver histórico de alterações"
                          >
                            <History size={14} className="text-gold-600" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => abrirEditar(l)}
                          title="Editar lançamento"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmarExcluir(l.id)}
                          title="Excluir lançamento"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── MODAL NOVO / EDITAR ──────────────────────────────────── */}
      <Modal
        open={modalAberto}
        onClose={fecharModal}
        title={editandoId ? 'Editar Lançamento' : 'Novo Lançamento'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={fecharModal} disabled={loadingSave}>Cancelar</Button>
            <Button variant="primary" onClick={salvar} loading={loadingSave}>
              {editandoId ? 'Salvar Alterações' : 'Registrar'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {editandoId && (
            <div className="bg-gold-50 border border-gold-200 rounded-lg px-3 py-2 text-xs text-gold-700">
              <strong>Atenção:</strong> todas as alterações ficam registradas no histórico deste lançamento.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo *"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as LancamentoTipo, categoria_id: '' })}
            >
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </Select>
            <Input
              label="Data *"
              type="date"
              value={form.data_lancamento}
              onChange={(e) => setForm({ ...form, data_lancamento: e.target.value })}
              error={formErrors.data_lancamento}
            />
          </div>

          <Input
            label="Descrição *"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            placeholder="Descrição do lançamento..."
            error={formErrors.descricao}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Categoria"
              value={form.categoria_id}
              onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
              placeholder="Selecionar..."
            >
              {categoriasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
            <Select
              label="Forma de Pagamento"
              value={form.forma_pagamento}
              onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })}
            >
              {FORMAS.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </div>

          <Input
            label="Valor (R$) *"
            type="number"
            min="0.01"
            step="0.01"
            value={form.valor}
            onChange={(e) => setForm({ ...form, valor: e.target.value })}
            placeholder="0,00"
            error={formErrors.valor}
          />

          <Textarea
            label="Observações"
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            placeholder="Observações opcionais..."
          />

          {editandoId && (
            <>
              <Divider />
              <Input
                label="Motivo da alteração *"
                value={motivoEdicao}
                onChange={(e) => setMotivoEdicao(e.target.value)}
                placeholder="Ex: valor incorreto, categoria errada..."
                error={!motivoEdicao.trim() && loadingSave ? 'Motivo obrigatório' : undefined}
              />
            </>
          )}
        </div>
      </Modal>

      {/* ── MODAL HISTÓRICO ──────────────────────────────────────── */}
      <Modal
        open={modalHistorico}
        onClose={() => setModalHistorico(false)}
        title="Histórico de Alterações"
        size="md"
        footer={<Button variant="secondary" onClick={() => setModalHistorico(false)}>Fechar</Button>}
      >
        {historico.length === 0 ? (
          <EmptyState icon={<History size={32} />} title="Nenhuma alteração registrada" />
        ) : (
          <div className="space-y-3">
            {historico.map((h) => (
              <div key={h.id} className="bg-cream-100 rounded-lg p-3 border-l-2 border-gold-400">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-dark-600">
                    Campo: {h.campo_alterado}
                  </span>
                  <span className="text-xs text-dark-300">{formatDateTime(h.alterado_em)}</span>
                </div>
                {h.motivo && h.campo_alterado === 'motivo_manual' ? (
                  <p className="text-sm text-dark-600">Motivo informado: <strong>{h.motivo}</strong></p>
                ) : (
                  <div className="text-xs space-y-0.5">
                    <p className="text-dark-400">Antes: <span className="text-red-600 font-medium">{h.valor_antes || '—'}</span></p>
                    <p className="text-dark-400">Depois: <span className="text-green-700 font-medium">{h.valor_depois || '—'}</span></p>
                  </div>
                )}
                {(h as unknown as { profile: { nome: string } }).profile && (
                  <p className="text-xs text-dark-300 mt-1">
                    Por: {(h as unknown as { profile: { nome: string } }).profile.nome}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* ── CONFIRM DELETE ────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !loadingDelete && setConfirmDelete(false)}
        onConfirm={excluir}
        title="Excluir Lançamento"
        loading={loadingDelete}
        confirmLabel="Excluir Definitivamente"
        description={
          lancandoDeletar
            ? `Você está excluindo: "${lancandoDeletar.descricao}" — ${formatMoney(lancandoDeletar.valor)}. Esta ação não pode ser desfeita.`
            : 'Confirma a exclusão deste lançamento? Esta ação não pode ser desfeita.'
        }
      />
    </div>
  )
}
