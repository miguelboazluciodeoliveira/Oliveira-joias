import { useEffect, useState } from 'react'
import { Plus, Pencil, Eye, UserX } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, formatPhone } from '@/lib/utils'
import {
  Card, Button, Input, Select, Textarea, Modal, ConfirmDialog,
  PageHeader, SearchInput, EmptyState, Badge, Spinner
} from '@/components/ui'
import type { Cliente } from '@/types'
import toast from 'react-hot-toast'

interface ClienteForm {
  nome: string; cpf: string; email: string; telefone: string; whatsapp: string
  data_nascimento: string; endereco: string; numero: string; complemento: string
  bairro: string; cidade: string; estado: string; cep: string; observacoes: string
}

const formEmpty = (): ClienteForm => ({
  nome: '', cpf: '', email: '', telefone: '', whatsapp: '',
  data_nascimento: '', endereco: '', numero: '', complemento: '',
  bairro: '', cidade: 'Uberlândia', estado: 'MG', cep: '', observacoes: '',
})

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export function ClientesPage() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [loadingSave, setLoadingSave] = useState(false)
  const [confirmInativar, setConfirmInativar] = useState(false)
  const [inativandoId, setInativandoId] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<ClienteForm>(formEmpty())
  const [formErrors, setFormErrors] = useState<Partial<ClienteForm>>({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('ativo', true)
      .order('nome')
    if (error) toast.error('Erro ao carregar clientes')
    else setClientes((data || []) as Cliente[])
    setLoading(false)
  }

  const filtrados = clientes.filter((c) =>
    !search || c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone?.includes(search) || c.cpf?.includes(search)
  )

  function validate(): boolean {
    const e: Partial<ClienteForm> = {}
    if (!form.nome.trim()) e.nome = 'Nome obrigatório'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  function abrirNovo() {
    setEditandoId(null)
    setForm(formEmpty())
    setFormErrors({})
    setModalAberto(true)
  }

  function abrirEditar(c: Cliente) {
    setEditandoId(c.id)
    setForm({
      nome: c.nome, cpf: c.cpf || '', email: c.email || '',
      telefone: c.telefone || '', whatsapp: c.whatsapp || '',
      data_nascimento: c.data_nascimento || '', endereco: c.endereco || '',
      numero: c.numero || '', complemento: c.complemento || '',
      bairro: c.bairro || '', cidade: c.cidade || 'Uberlândia',
      estado: c.estado || 'MG', cep: c.cep || '', observacoes: c.observacoes || '',
    })
    setFormErrors({})
    setModalAberto(true)
  }

  function f(field: keyof ClienteForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function salvar() {
    if (!validate()) return
    setLoadingSave(true)
    const payload = {
      nome: form.nome.trim(),
      cpf: form.cpf.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      data_nascimento: form.data_nascimento || null,
      endereco: form.endereco.trim() || null,
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado || null,
      cep: form.cep.trim() || null,
      observacoes: form.observacoes.trim() || null,
    }

    if (editandoId) {
      const { error } = await supabase.from('clientes').update(payload).eq('id', editandoId)
      if (error) { toast.error('Erro ao atualizar cliente'); setLoadingSave(false); return }
      toast.success('Cliente atualizado!')
    } else {
      const { error } = await supabase.from('clientes').insert({ ...payload, created_by: user?.id })
      if (error) { toast.error('Erro ao cadastrar cliente'); setLoadingSave(false); return }
      toast.success('Cliente cadastrado!')
    }

    setLoadingSave(false)
    setModalAberto(false)
    loadData()
  }

  async function inativar() {
    if (!inativandoId) return
    const { error } = await supabase.from('clientes').update({ ativo: false }).eq('id', inativandoId)
    if (error) toast.error('Erro ao inativar cliente')
    else { toast.success('Cliente inativado'); loadData() }
    setConfirmInativar(false)
    setInativandoId(null)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        subtitle={`${filtrados.length} cliente${filtrados.length !== 1 ? 's' : ''} cadastrado${filtrados.length !== 1 ? 's' : ''}`}
        actions={<Button variant="primary" leftIcon={<Plus size={15} />} onClick={abrirNovo}>Novo Cliente</Button>}
      />

      <Card>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, CPF, e-mail..." className="w-72" />
      </Card>

      <Card padding="none">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<Eye size={36} />}
            title="Nenhum cliente encontrado"
            action={<Button variant="primary" leftIcon={<Plus size={14} />} onClick={abrirNovo}>Novo Cliente</Button>}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th><th>CPF</th><th>Telefone</th><th>E-mail</th>
                <th>Cidade</th><th>Cadastro</th><th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-dark-700">{c.nome}</td>
                  <td className="text-dark-400 text-xs">{c.cpf || '—'}</td>
                  <td className="text-dark-400">{c.telefone ? formatPhone(c.telefone) : '—'}</td>
                  <td className="text-dark-400 text-xs">{c.email || '—'}</td>
                  <td className="text-dark-400 text-xs">{c.cidade ? `${c.cidade}/${c.estado}` : '—'}</td>
                  <td className="text-dark-300 text-xs">{formatDate(c.created_at)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => abrirEditar(c)} title="Editar">
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => { setInativandoId(c.id); setConfirmInativar(true) }}
                        title="Inativar cliente"
                      >
                        <UserX size={14} className="text-red-500" />
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
        open={modalAberto} onClose={() => !loadingSave && setModalAberto(false)}
        title={editandoId ? 'Editar Cliente' : 'Novo Cliente'} size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalAberto(false)} disabled={loadingSave}>Cancelar</Button>
            <Button variant="primary" onClick={salvar} loading={loadingSave}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome Completo *" value={form.nome} onChange={f('nome')} placeholder="Nome do cliente" error={formErrors.nome} />
            <Input label="CPF" value={form.cpf} onChange={f('cpf')} placeholder="000.000.000-00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Telefone" value={form.telefone} onChange={f('telefone')} placeholder="(34) 99999-9999" />
            <Input label="WhatsApp" value={form.whatsapp} onChange={f('whatsapp')} placeholder="(34) 99999-9999" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="E-mail" type="email" value={form.email} onChange={f('email')} placeholder="email@exemplo.com" />
            <Input label="Data de Nascimento" type="date" value={form.data_nascimento} onChange={f('data_nascimento')} />
          </div>
          <hr className="border-gold-100" />
          <div className="grid grid-cols-3 gap-3">
            <Input label="CEP" value={form.cep} onChange={f('cep')} placeholder="38400-000" className="col-span-1" />
            <Input label="Endereço" value={form.endereco} onChange={f('endereco')} placeholder="Rua, Av..." className="col-span-2" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Número" value={form.numero} onChange={f('numero')} placeholder="123" />
            <Input label="Complemento" value={form.complemento} onChange={f('complemento')} placeholder="Ap 10" />
            <Input label="Bairro" value={form.bairro} onChange={f('bairro')} placeholder="Centro" />
            <Input label="Cidade" value={form.cidade} onChange={f('cidade')} placeholder="Uberlândia" />
          </div>
          <Select label="Estado" value={form.estado} onChange={f('estado')} className="w-32">
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </Select>
          <Textarea label="Observações" value={form.observacoes} onChange={f('observacoes')} placeholder="Preferências, histórico..." />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmInativar}
        onClose={() => setConfirmInativar(false)}
        onConfirm={inativar}
        title="Inativar Cliente"
        description="O cliente será inativado mas seu histórico de compras será preservado. Deseja continuar?"
        confirmLabel="Inativar"
        variant="warning"
      />
    </div>
  )
}
