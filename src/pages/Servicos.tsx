import { useEffect, useState } from 'react'
import { Plus, Pencil, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  formatMoney, formatDate, FORMA_PAGAMENTO_LABEL,
  servicoStatusVariant, SERVICO_STATUS_LABEL
} from '@/lib/utils'
import {
  Card, Button, Input, Select, Textarea, Modal,
  PageHeader, SearchInput, EmptyState, Badge, Spinner, MetricCard, Divider
} from '@/components/ui'
import type { Servico, ServicoStatus, FormaPagamento, Cliente, Profile } from '@/types'
import toast from 'react-hot-toast'

const TIPOS_SERVICO = [
  'Redimensionamento', 'Limpeza e polimento', 'Soldagem', 'Troca de pedra',
  'Gravação', 'Restauração', 'Banho de ouro/prata', 'Conserto de fecho',
  'Ajuste de aliança', 'Avaliação', 'Outro'
]

const STATUS_OPTIONS: ServicoStatus[] = [
  'orcamento', 'aguardando', 'em_andamento', 'concluido', 'entregue', 'cancelado'
]

const FORMAS: FormaPagamento[] = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia']

interface ServicoForm {
  cliente_id: string
  tipo: string
  descricao: string
  observacoes_internas: string
  valor: string
  custo_estimado: string
  status: ServicoStatus
  data_entrada: string
  data_previsao: string
  forma_pagamento: FormaPagamento
  pago: boolean
  responsavel_id: string
}

const formEmpty = (): ServicoForm => ({
  cliente_id: '', tipo: TIPOS_SERVICO[0], descricao: '',
  observacoes_internas: '', valor: '', custo_estimado: '',
  status: 'aguardando', data_entrada: new Date().toISOString().split('T')[0],
  data_previsao: '', forma_pagamento: 'pix', pago: false, responsavel_id: '',
})

export function ServicosPage() {
  const { user } = useAuth()
  const [servicos, setServicos] = useState<Servico[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [usuarios, setUsuarios] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('')

  const [modalAberto, setModalAberto] = useState(false)
  const [loadingSave, setLoadingSave] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<ServicoForm>(formEmpty())
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ServicoForm, string>>>({})
  const [tipoCustom, setTipoCustom] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [servicosRes, clientesRes, usuariosRes] = await Promise.all([
      supabase
        .from('servicos')
        .select('*, cliente:clientes(nome, telefone)')
        .order('created_at', { ascending: false }),
      supabase.from('clientes').select('id, nome, telefone').eq('ativo', true).order('nome'),
      supabase.from('profiles').select('id, nome').eq('ativo', true).order('nome'),
    ])

    if (servicosRes.error) toast.error('Erro ao carregar serviços')
    setServicos((servicosRes.data || []) as unknown as Servico[])
    setClientes((clientesRes.data || []) as Cliente[])
    setUsuarios((usuariosRes.data || []) as Profile[])
    setLoading(false)
  }

  const filtrados = servicos.filter((s) => {
    const clienteNome = (s as unknown as { cliente?: { nome: string } }).cliente?.nome || ''
    const match = !search ||
      s.tipo.toLowerCase().includes(search.toLowerCase()) ||
      s.descricao.toLowerCase().includes(search.toLowerCase()) ||
      clienteNome.toLowerCase().includes(search.toLowerCase()) ||
      String(s.numero).includes(search)
    return match && (!filtroStatus || s.status === filtroStatus)
  })

  // Stats
  const emAndamento = servicos.filter((s) => s.status === 'em_andamento').length
  const aguardando = servicos.filter((s) => s.status === 'aguardando').length
  const concluidos = servicos.filter((s) => s.status === 'concluido').length
  const receitaEstimada = servicos
    .filter((s) => !['cancelado', 'orcamento'].includes(s.status))
    .reduce((acc, s) => acc + s.valor, 0)

  function validate(): boolean {
    const e: Partial<Record<keyof ServicoForm, string>> = {}
    if (!form.descricao.trim()) e.descricao = 'Descrição obrigatória'
    if (!form.valor || parseFloat(form.valor) < 0) e.valor = 'Valor inválido'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  function f(field: keyof ServicoForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value
      setForm((prev) => ({ ...prev, [field]: val }))
    }
  }

  function abrirNovo() {
    setEditandoId(null)
    setForm({ ...formEmpty(), responsavel_id: user?.id || '' })
    setFormErrors({})
    setTipoCustom(false)
    setModalAberto(true)
  }

  function abrirEditar(s: Servico) {
    setEditandoId(s.id)
    setForm({
      cliente_id: s.cliente_id || '',
      tipo: TIPOS_SERVICO.includes(s.tipo) ? s.tipo : 'Outro',
      descricao: s.descricao,
      observacoes_internas: s.observacoes_internas || '',
      valor: String(s.valor),
      custo_estimado: s.custo_estimado ? String(s.custo_estimado) : '',
      status: s.status,
      data_entrada: s.data_entrada,
      data_previsao: s.data_previsao || '',
      forma_pagamento: s.forma_pagamento || 'pix',
      pago: s.pago,
      responsavel_id: s.responsavel_id || '',
    })
    setTipoCustom(!TIPOS_SERVICO.includes(s.tipo))
    setFormErrors({})
    setModalAberto(true)
  }

  async function salvar() {
    if (!validate()) return
    setLoadingSave(true)

    const tipoFinal = tipoCustom ? form.tipo : form.tipo
    const payload = {
      cliente_id: form.cliente_id || null,
      tipo: tipoFinal.trim(),
      descricao: form.descricao.trim(),
      observacoes_internas: form.observacoes_internas.trim() || null,
      valor: parseFloat(form.valor) || 0,
      custo_estimado: form.custo_estimado ? parseFloat(form.custo_estimado) : null,
      status: form.status,
      data_entrada: form.data_entrada,
      data_previsao: form.data_previsao || null,
      forma_pagamento: form.forma_pagamento,
      pago: form.pago,
      responsavel_id: form.responsavel_id || null,
    }

    if (editandoId) {
      // Se concluído agora, registra data_conclusao
      const original = servicos.find((s) => s.id === editandoId)
      const extra: Record<string, unknown> = {}
      if (form.status === 'concluido' && original?.status !== 'concluido') {
        extra.data_conclusao = new Date().toISOString().split('T')[0]
      }
      if (form.status === 'entregue' && original?.status !== 'entregue') {
        extra.data_entrega = new Date().toISOString().split('T')[0]
      }

      const { error } = await supabase.from('servicos').update({ ...payload, ...extra }).eq('id', editandoId)
      if (error) { toast.error('Erro ao atualizar serviço'); setLoadingSave(false); return }

      // Se concluído/entregue e pago, cria lançamento no caixa
      if (form.pago && !original?.pago) {
        const clienteNome = clientes.find((c) => c.id === form.cliente_id)?.nome || 'Cliente'
        await supabase.from('lancamentos').insert({
          tipo: 'entrada',
          descricao: `Serviço #${original?.numero} — ${tipoFinal} — ${clienteNome}`,
          valor: parseFloat(form.valor) || 0,
          data_lancamento: new Date().toISOString().split('T')[0],
          categoria_nome: 'Serviço',
          forma_pagamento: FORMA_PAGAMENTO_LABEL[form.forma_pagamento],
          referencia_id: editandoId,
          referencia_tipo: 'servico',
          created_by: user?.id,
        })
      }

      toast.success('Serviço atualizado!')
    } else {
      const { error } = await supabase.from('servicos').insert({ ...payload, created_by: user?.id })
      if (error) { toast.error('Erro ao criar serviço'); setLoadingSave(false); return }
      toast.success('Serviço cadastrado!')
    }

    setLoadingSave(false)
    setModalAberto(false)
    loadData()
  }

  // Avanço rápido de status
  async function avancarStatus(s: Servico) {
    const fluxo: ServicoStatus[] = ['orcamento', 'aguardando', 'em_andamento', 'concluido', 'entregue']
    const idx = fluxo.indexOf(s.status)
    if (idx < 0 || idx >= fluxo.length - 1) return
    const novoStatus = fluxo[idx + 1]
    const extra: Record<string, unknown> = { status: novoStatus }
    if (novoStatus === 'concluido') extra.data_conclusao = new Date().toISOString().split('T')[0]
    if (novoStatus === 'entregue') extra.data_entrega = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('servicos').update(extra).eq('id', s.id)
    if (error) toast.error('Erro ao atualizar status')
    else {
      toast.success(`Status atualizado para "${SERVICO_STATUS_LABEL[novoStatus]}"`)
      loadData()
    }
  }

  const proximoStatus: Record<ServicoStatus, string | null> = {
    orcamento: 'Aceitar',
    aguardando: 'Iniciar',
    em_andamento: 'Concluir',
    concluido: 'Entregar',
    entregue: null,
    cancelado: null,
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Serviços"
        subtitle={`${filtrados.length} serviço${filtrados.length !== 1 ? 's' : ''}`}
        actions={<Button variant="primary" leftIcon={<Plus size={15} />} onClick={abrirNovo}>Novo Serviço</Button>}
      />

      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Em Andamento" value={String(emAndamento)} changeType="neutral" change="Ativos" />
        <MetricCard label="Aguardando" value={String(aguardando)} changeType="neutral" change="Na fila" />
        <MetricCard label="Concluídos" value={String(concluidos)} changeType="up" change="Prontos p/ entrega" />
        <MetricCard label="Receita Estimada" value={formatMoney(receitaEstimada)} changeType="neutral" change="Serviços ativos" accent />
      </div>

      <Card>
        <div className="flex gap-3 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por cliente, tipo, nº..." className="w-64" />
          <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-44">
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{SERVICO_STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card padding="none">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<ChevronRight size={36} />}
            title="Nenhum serviço encontrado"
            action={<Button variant="primary" leftIcon={<Plus size={14} />} onClick={abrirNovo}>Novo Serviço</Button>}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Tipo / Descrição</th>
                <th>Entrada</th>
                <th>Previsão</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Pago</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs text-gold-600 font-medium">#{s.numero}</td>
                  <td className="font-medium text-dark-700">
                    {(s as unknown as { cliente?: { nome: string } }).cliente?.nome || 'Sem cliente'}
                  </td>
                  <td>
                    <p className="font-medium text-dark-700 text-xs">{s.tipo}</p>
                    <p className="text-xs text-dark-300 truncate max-w-[200px]">{s.descricao}</p>
                  </td>
                  <td className="text-dark-400 text-xs">{formatDate(s.data_entrada)}</td>
                  <td className={`text-xs ${s.data_previsao && s.data_previsao < new Date().toISOString().split('T')[0] && s.status !== 'entregue' && s.status !== 'cancelado' ? 'text-red-500 font-medium' : 'text-dark-400'}`}>
                    {formatDate(s.data_previsao)}
                  </td>
                  <td className="font-medium">{formatMoney(s.valor)}</td>
                  <td>
                    <Badge variant={servicoStatusVariant(s.status)}>
                      {SERVICO_STATUS_LABEL[s.status]}
                    </Badge>
                  </td>
                  <td>
                    {s.pago ? (
                      <Badge variant="success">Pago</Badge>
                    ) : (
                      <Badge variant="gray">Pendente</Badge>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      {proximoStatus[s.status] && (
                        <Button variant="primary" size="sm" onClick={() => avancarStatus(s)}>
                          {proximoStatus[s.status]}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => abrirEditar(s)} title="Editar">
                        <Pencil size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Modal */}
      <Modal
        open={modalAberto}
        onClose={() => !loadingSave && setModalAberto(false)}
        title={editandoId ? 'Editar Serviço' : 'Novo Serviço'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalAberto(false)} disabled={loadingSave}>Cancelar</Button>
            <Button variant="primary" onClick={salvar} loading={loadingSave}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Cliente</label>
              <select
                className="input-base"
                value={form.cliente_id}
                onChange={f('cliente_id')}
              >
                <option value="">Sem cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-base">Tipo de Serviço</label>
              <select
                className="input-base"
                value={tipoCustom ? 'Outro' : form.tipo}
                onChange={(e) => {
                  if (e.target.value === 'Outro') { setTipoCustom(true); setForm((p) => ({ ...p, tipo: '' })) }
                  else { setTipoCustom(false); setForm((p) => ({ ...p, tipo: e.target.value })) }
                }}
              >
                {TIPOS_SERVICO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {tipoCustom && (
                <input
                  className="input-base mt-1"
                  placeholder="Descreva o tipo de serviço..."
                  value={form.tipo}
                  onChange={f('tipo')}
                />
              )}
            </div>
          </div>

          <Textarea
            label="Descrição do Serviço *"
            value={form.descricao}
            onChange={f('descricao')}
            placeholder="Descreva detalhadamente o serviço..."
            error={formErrors.descricao}
          />

          <Textarea
            label="Observações Internas"
            value={form.observacoes_internas}
            onChange={f('observacoes_internas')}
            placeholder="Observações internas (não visíveis ao cliente)..."
          />

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Valor Cobrado (R$) *"
              type="number"
              step="0.01"
              min="0"
              value={form.valor}
              onChange={f('valor')}
              error={formErrors.valor}
            />
            <Input
              label="Custo Estimado (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.custo_estimado}
              onChange={f('custo_estimado')}
            />
            <div>
              <label className="label-base">Responsável</label>
              <select className="input-base" value={form.responsavel_id} onChange={f('responsavel_id')}>
                <option value="">Não atribuído</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Data de Entrada" type="date" value={form.data_entrada} onChange={f('data_entrada')} />
            <Input label="Previsão de Entrega" type="date" value={form.data_previsao} onChange={f('data_previsao')} />
            <Select label="Status" value={form.status} onChange={f('status')}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{SERVICO_STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </div>

          <Divider />

          <div className="grid grid-cols-2 gap-3 items-end">
            <Select label="Forma de Pagamento" value={form.forma_pagamento} onChange={f('forma_pagamento')}>
              {FORMAS.map((f_) => (
                <option key={f_} value={f_}>{FORMA_PAGAMENTO_LABEL[f_]}</option>
              ))}
            </Select>
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={form.pago}
                onChange={(e) => setForm((p) => ({ ...p, pago: e.target.checked }))}
                className="w-4 h-4 rounded border-gold-300 text-gold-500 focus:ring-gold-400"
              />
              <span className="text-sm text-dark-600">Serviço já pago</span>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
