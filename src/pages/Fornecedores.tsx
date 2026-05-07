import { useEffect, useState } from 'react'
import { Plus, Pencil, UserX, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, formatPhone } from '@/lib/utils'
import {
  Card, Button, Input, Select, Textarea, Modal, ConfirmDialog,
  PageHeader, SearchInput, EmptyState, Spinner
} from '@/components/ui'
import type { Fornecedor } from '@/types'
import toast from 'react-hot-toast'

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const CATEGORIAS_FORNECEDOR = [
  'Joias e Semijoias', 'Pedras e Gemas', 'Metais', 'Embalagens',
  'Ferramentas', 'Equipamentos', 'Serviços', 'Outros'
]

interface FornecedorForm {
  nome: string; razao_social: string; cnpj: string; cpf: string
  email: string; telefone: string; contato_nome: string
  endereco: string; numero: string; complemento: string
  bairro: string; cidade: string; estado: string; cep: string
  categoria: string; observacoes: string
}

const formEmpty = (): FornecedorForm => ({
  nome: '', razao_social: '', cnpj: '', cpf: '', email: '', telefone: '',
  contato_nome: '', endereco: '', numero: '', complemento: '', bairro: '',
  cidade: 'São Paulo', estado: 'SP', cep: '', categoria: '', observacoes: '',
})

export function FornecedoresPage() {
  const { user } = useAuth()
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [loadingSave, setLoadingSave] = useState(false)
  const [confirmInativar, setConfirmInativar] = useState(false)
  const [inativandoId, setInativandoId] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<FornecedorForm>(formEmpty())
  const [formErrors, setFormErrors] = useState<Partial<FornecedorForm>>({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('fornecedores')
      .select('*')
      .eq('ativo', true)
      .order('nome')
    if (error) toast.error('Erro ao carregar fornecedores')
    else setFornecedores((data || []) as Fornecedor[])
    setLoading(false)
  }

  const filtrados = fornecedores.filter((f) => {
    const match = !search ||
      f.nome.toLowerCase().includes(search.toLowerCase()) ||
      f.cnpj?.includes(search) ||
      f.email?.toLowerCase().includes(search.toLowerCase()) ||
      f.contato_nome?.toLowerCase().includes(search.toLowerCase())
    return match && (!filtroCategoria || f.categoria === filtroCategoria)
  })

  function validate(): boolean {
    const e: Partial<FornecedorForm> = {}
    if (!form.nome.trim()) e.nome = 'Nome obrigatório'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  function f(field: keyof FornecedorForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  function abrirNovo() {
    setEditandoId(null)
    setForm(formEmpty())
    setFormErrors({})
    setModalAberto(true)
  }

  function abrirEditar(forn: Fornecedor) {
    setEditandoId(forn.id)
    setForm({
      nome: forn.nome, razao_social: forn.razao_social || '',
      cnpj: forn.cnpj || '', cpf: forn.cpf || '',
      email: forn.email || '', telefone: forn.telefone || '',
      contato_nome: forn.contato_nome || '',
      endereco: forn.endereco || '', numero: forn.numero || '',
      complemento: forn.complemento || '', bairro: forn.bairro || '',
      cidade: forn.cidade || 'São Paulo', estado: forn.estado || 'SP',
      cep: forn.cep || '', categoria: forn.categoria || '',
      observacoes: forn.observacoes || '',
    })
    setFormErrors({})
    setModalAberto(true)
  }

  async function salvar() {
    if (!validate()) return
    setLoadingSave(true)

    const payload = {
      nome: form.nome.trim(),
      razao_social: form.razao_social.trim() || null,
      cnpj: form.cnpj.trim() || null,
      cpf: form.cpf.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      contato_nome: form.contato_nome.trim() || null,
      endereco: form.endereco.trim() || null,
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado || null,
      cep: form.cep.trim() || null,
      categoria: form.categoria || null,
      observacoes: form.observacoes.trim() || null,
    }

    if (editandoId) {
      const { error } = await supabase.from('fornecedores').update(payload).eq('id', editandoId)
      if (error) { toast.error('Erro ao atualizar fornecedor'); setLoadingSave(false); return }
      toast.success('Fornecedor atualizado!')
    } else {
      const { error } = await supabase.from('fornecedores').insert({ ...payload, created_by: user?.id })
      if (error) { toast.error('Erro ao cadastrar fornecedor'); setLoadingSave(false); return }
      toast.success('Fornecedor cadastrado!')
    }

    setLoadingSave(false)
    setModalAberto(false)
    loadData()
  }

  async function inativar() {
    if (!inativandoId) return
    const { error } = await supabase.from('fornecedores').update({ ativo: false }).eq('id', inativandoId)
    if (error) toast.error('Erro ao inativar fornecedor')
    else { toast.success('Fornecedor inativado'); loadData() }
    setConfirmInativar(false)
    setInativandoId(null)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fornecedores"
        subtitle={`${filtrados.length} fornecedor${filtrados.length !== 1 ? 'es' : ''}`}
        actions={<Button variant="primary" leftIcon={<Plus size={15} />} onClick={abrirNovo}>Novo Fornecedor</Button>}
      />

      <Card>
        <div className="flex gap-3 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, CNPJ, contato..." className="w-64" />
          <Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="w-44">
            <option value="">Todas as categorias</option>
            {CATEGORIAS_FORNECEDOR.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </Card>

      <Card padding="none">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<Truck size={36} />}
            title="Nenhum fornecedor encontrado"
            action={<Button variant="primary" leftIcon={<Plus size={14} />} onClick={abrirNovo}>Novo Fornecedor</Button>}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome / Empresa</th>
                <th>CNPJ/CPF</th>
                <th>Contato</th>
                <th>Telefone</th>
                <th>Cidade</th>
                <th>Categoria</th>
                <th>Cadastro</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((forn) => (
                <tr key={forn.id}>
                  <td>
                    <p className="font-medium text-dark-700">{forn.nome}</p>
                    {forn.razao_social && (
                      <p className="text-xs text-dark-300">{forn.razao_social}</p>
                    )}
                  </td>
                  <td className="text-dark-400 text-xs font-mono">{forn.cnpj || forn.cpf || '—'}</td>
                  <td className="text-dark-400">{forn.contato_nome || '—'}</td>
                  <td className="text-dark-400">{forn.telefone ? formatPhone(forn.telefone) : '—'}</td>
                  <td className="text-dark-400 text-xs">
                    {forn.cidade ? `${forn.cidade}/${forn.estado}` : '—'}
                  </td>
                  <td className="text-dark-400 text-xs">{forn.categoria || '—'}</td>
                  <td className="text-dark-300 text-xs">{formatDate(forn.created_at)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => abrirEditar(forn)} title="Editar">
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => { setInativandoId(forn.id); setConfirmInativar(true) }}
                        title="Inativar fornecedor"
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
        open={modalAberto}
        onClose={() => !loadingSave && setModalAberto(false)}
        title={editandoId ? 'Editar Fornecedor' : 'Novo Fornecedor'}
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
            <Input label="Nome / Fantasia *" value={form.nome} onChange={f('nome')} error={formErrors.nome} />
            <Input label="Razão Social" value={form.razao_social} onChange={f('razao_social')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="CNPJ" value={form.cnpj} onChange={f('cnpj')} placeholder="00.000.000/0000-00" />
            <Input label="CPF (pessoa física)" value={form.cpf} onChange={f('cpf')} placeholder="000.000.000-00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Telefone / WhatsApp" value={form.telefone} onChange={f('telefone')} placeholder="(11) 99999-9999" />
            <Input label="E-mail" type="email" value={form.email} onChange={f('email')} placeholder="email@empresa.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome do Contato" value={form.contato_nome} onChange={f('contato_nome')} />
            <Select label="Categoria" value={form.categoria} onChange={f('categoria')}>
              <option value="">Selecionar...</option>
              {CATEGORIAS_FORNECEDOR.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <hr className="border-gold-100" />
          <div className="grid grid-cols-3 gap-3">
            <Input label="CEP" value={form.cep} onChange={f('cep')} placeholder="00000-000" />
            <Input label="Endereço" value={form.endereco} onChange={f('endereco')} className="col-span-2" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Input label="Número" value={form.numero} onChange={f('numero')} />
            <Input label="Complemento" value={form.complemento} onChange={f('complemento')} />
            <Input label="Bairro" value={form.bairro} onChange={f('bairro')} />
            <Input label="Cidade" value={form.cidade} onChange={f('cidade')} />
          </div>
          <Select label="Estado" value={form.estado} onChange={f('estado')} className="w-32">
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </Select>
          <Textarea label="Observações" value={form.observacoes} onChange={f('observacoes')} placeholder="Notas, prazos, condições comerciais..." />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmInativar}
        onClose={() => setConfirmInativar(false)}
        onConfirm={inativar}
        title="Inativar Fornecedor"
        description="O fornecedor será inativado. Você poderá reativá-lo posteriormente se necessário."
        confirmLabel="Inativar"
        variant="warning"
      />
    </div>
  )
}
