import { useEffect, useState } from 'react'
import { Plus, Pencil, Users, Tags } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/utils'
import {
  Card, CardHeader, Button, Input, Select, Modal, ConfirmDialog,
  PageHeader, Badge, Spinner, EmptyState, Divider
} from '@/components/ui'
import type { Profile, UserRole, CategoriaFinanceira, LancamentoTipo } from '@/types'
import toast from 'react-hot-toast'

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'visualizador', label: 'Visualizador' },
]

const ROLE_VARIANT: Record<UserRole, 'gold' | 'success' | 'info' | 'gray'> = {
  admin: 'gold',
  vendedor: 'success',
  caixa: 'info',
  visualizador: 'gray',
}

export function ConfiguracoesPage() {
  const { user, profile, updateProfile } = useAuth()

  // Usuários
  const [usuarios, setUsuarios] = useState<Profile[]>([])
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)
  const [modalUsuario, setModalUsuario] = useState(false)
  const [loadingSaveUser, setLoadingSaveUser] = useState(false)
  const [editandoUserId, setEditandoUserId] = useState<string | null>(null)
  const [userForm, setUserForm] = useState({ nome: '', role: 'vendedor' as UserRole, ativo: true })
  const [confirmInativarUser, setConfirmInativarUser] = useState(false)
  const [inativandoUserId, setInativandoUserId] = useState<string | null>(null)

  // Categorias financeiras
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([])
  const [loadingCat, setLoadingCat] = useState(true)
  const [modalCategoria, setModalCategoria] = useState(false)
  const [loadingSaveCat, setLoadingSaveCat] = useState(false)
  const [editandoCatId, setEditandoCatId] = useState<string | null>(null)
  const [catForm, setCatForm] = useState({ nome: '', tipo: 'entrada' as LancamentoTipo, cor: '#B8962E' })

  // Perfil pessoal
  const [nomeDisplay, setNomeDisplay] = useState(profile?.nome || '')
  const [telefoneDisplay, setTelefoneDisplay] = useState(profile?.telefone || '')
  const [loadingPerfil, setLoadingPerfil] = useState(false)

  useEffect(() => {
    loadUsuarios()
    loadCategorias()
    if (profile) {
      setNomeDisplay(profile.nome)
      setTelefoneDisplay(profile.telefone || '')
    }
  }, [profile])

  async function loadUsuarios() {
    setLoadingUsuarios(true)
    const { data, error } = await supabase.from('profiles').select('*').order('nome')
    if (error) toast.error('Erro ao carregar usuários')
    else setUsuarios((data || []) as Profile[])
    setLoadingUsuarios(false)
  }

  async function loadCategorias() {
    setLoadingCat(true)
    const { data } = await supabase.from('categorias_financeiras').select('*').order('tipo').order('nome')
    setCategorias((data || []) as CategoriaFinanceira[])
    setLoadingCat(false)
  }

  // ── Perfil pessoal ────────────────────────────────────────────
  async function salvarPerfil() {
    setLoadingPerfil(true)
    const { error } = await updateProfile({ nome: nomeDisplay.trim(), telefone: telefoneDisplay.trim() || null })
    if (error) toast.error('Erro ao salvar perfil')
    else toast.success('Perfil atualizado!')
    setLoadingPerfil(false)
  }

  // ── Usuários ──────────────────────────────────────────────────
  function abrirEditarUser(u: Profile) {
    setEditandoUserId(u.id)
    setUserForm({ nome: u.nome, role: u.role, ativo: u.ativo })
    setModalUsuario(true)
  }

  async function salvarUsuario() {
    if (!editandoUserId) return
    setLoadingSaveUser(true)
    const { error } = await supabase
      .from('profiles')
      .update({ nome: userForm.nome.trim(), role: userForm.role })
      .eq('id', editandoUserId)
    if (error) toast.error('Erro ao atualizar usuário')
    else { toast.success('Usuário atualizado!'); loadUsuarios() }
    setLoadingSaveUser(false)
    setModalUsuario(false)
  }

  async function inativarUsuario() {
    if (!inativandoUserId) return
    const { error } = await supabase.from('profiles').update({ ativo: false }).eq('id', inativandoUserId)
    if (error) toast.error('Erro ao inativar usuário')
    else { toast.success('Usuário inativado'); loadUsuarios() }
    setConfirmInativarUser(false)
    setInativandoUserId(null)
  }

  // ── Categorias financeiras ─────────────────────────────────────
  function abrirNovaCat() {
    setEditandoCatId(null)
    setCatForm({ nome: '', tipo: 'entrada', cor: '#B8962E' })
    setModalCategoria(true)
  }

  function abrirEditarCat(c: CategoriaFinanceira) {
    setEditandoCatId(c.id)
    setCatForm({ nome: c.nome, tipo: c.tipo, cor: c.cor })
    setModalCategoria(true)
  }

  async function salvarCategoria() {
    if (!catForm.nome.trim()) { toast.error('Nome obrigatório'); return }
    setLoadingSaveCat(true)
    if (editandoCatId) {
      const { error } = await supabase.from('categorias_financeiras')
        .update({ nome: catForm.nome.trim(), tipo: catForm.tipo, cor: catForm.cor })
        .eq('id', editandoCatId)
      if (error) { toast.error('Erro ao atualizar categoria'); setLoadingSaveCat(false); return }
      toast.success('Categoria atualizada!')
    } else {
      const { error } = await supabase.from('categorias_financeiras')
        .insert({ nome: catForm.nome.trim(), tipo: catForm.tipo, cor: catForm.cor })
      if (error) { toast.error('Erro ao criar categoria'); setLoadingSaveCat(false); return }
      toast.success('Categoria criada!')
    }
    setLoadingSaveCat(false)
    setModalCategoria(false)
    loadCategorias()
  }

  async function inativarCategoria(id: string) {
    const { error } = await supabase.from('categorias_financeiras').update({ ativo: false }).eq('id', id)
    if (error) toast.error('Erro ao inativar categoria')
    else { toast.success('Categoria inativada'); loadCategorias() }
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader title="Configurações" subtitle="Gerencie usuários, categorias e preferências do sistema" />

      {/* Meu perfil */}
      <Card>
        <CardHeader title="Meu Perfil" />
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          <Input
            label="Nome de exibição"
            value={nomeDisplay}
            onChange={(e) => setNomeDisplay(e.target.value)}
          />
          <Input
            label="Telefone"
            value={telefoneDisplay}
            onChange={(e) => setTelefoneDisplay(e.target.value)}
            placeholder="(34) 99999-9999"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" onClick={salvarPerfil} loading={loadingPerfil} size="sm">
            Salvar Perfil
          </Button>
          <span className="text-xs text-dark-300">
            E-mail: <strong>{profile?.email}</strong> — Função: <strong>{profile?.role}</strong>
          </span>
        </div>
      </Card>

      {/* Usuários */}
      <Card>
        <CardHeader
          title="Usuários do Sistema"
          subtitle="Gerencie quem tem acesso ao sistema"
          actions={
            isAdmin ? (
              <span className="text-xs text-dark-300">
                Para criar usuários, utilize o Painel do Supabase → Authentication
              </span>
            ) : undefined
          }
        />
        {loadingUsuarios ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="border border-gold-100 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream-100">
                  <th className="text-left px-3 py-2 text-xs text-dark-400 font-medium">Nome</th>
                  <th className="text-left px-3 py-2 text-xs text-dark-400 font-medium">E-mail</th>
                  <th className="text-left px-3 py-2 text-xs text-dark-400 font-medium">Função</th>
                  <th className="text-left px-3 py-2 text-xs text-dark-400 font-medium">Status</th>
                  <th className="text-left px-3 py-2 text-xs text-dark-400 font-medium">Cadastro</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-t border-gold-50">
                    <td className="px-3 py-2.5 font-medium text-dark-700">
                      {u.nome}
                      {u.id === user?.id && (
                        <span className="ml-2 text-[10px] text-gold-600 bg-gold-50 px-1.5 py-0.5 rounded-full border border-gold-200">
                          você
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-dark-400 text-xs">{u.email}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={ROLE_VARIANT[u.role]}>
                        {ROLES.find((r) => r.value === u.role)?.label || u.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={u.ativo ? 'success' : 'gray'}>
                        {u.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-dark-300 text-xs">{formatDate(u.created_at)}</td>
                    {isAdmin && (
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => abrirEditarUser(u)}>
                            <Pencil size={12} />
                          </Button>
                          {u.id !== user?.id && u.ativo && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setInativandoUserId(u.id); setConfirmInativarUser(true) }}
                            >
                              <span className="text-red-500 text-xs">Inativar</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Categorias Financeiras */}
      <Card>
        <CardHeader
          title="Categorias Financeiras"
          subtitle="Organize entradas e saídas do caixa"
          actions={
            <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} onClick={abrirNovaCat}>
              Nova Categoria
            </Button>
          }
        />
        {loadingCat ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Entradas */}
            <div>
              <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Tags size={12} /> Entradas
              </p>
              <div className="space-y-1">
                {categorias.filter((c) => c.tipo === 'entrada' && c.ativo).map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-green-50 rounded-lg border border-green-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.cor }} />
                      <span className="text-xs text-dark-600">{c.nome}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => abrirEditarCat(c)}><Pencil size={11} /></Button>
                      <button onClick={() => inativarCategoria(c.id)} className="text-xs text-red-400 hover:text-red-600 px-1">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Saídas */}
            <div>
              <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Tags size={12} /> Saídas
              </p>
              <div className="space-y-1">
                {categorias.filter((c) => c.tipo === 'saida' && c.ativo).map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.cor }} />
                      <span className="text-xs text-dark-600">{c.nome}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => abrirEditarCat(c)}><Pencil size={11} /></Button>
                      <button onClick={() => inativarCategoria(c.id)} className="text-xs text-red-400 hover:text-red-600 px-1">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Modal editar usuário */}
      <Modal
        open={modalUsuario}
        onClose={() => !loadingSaveUser && setModalUsuario(false)}
        title="Editar Usuário"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalUsuario(false)} disabled={loadingSaveUser}>Cancelar</Button>
            <Button variant="primary" onClick={salvarUsuario} loading={loadingSaveUser}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Nome" value={userForm.nome} onChange={(e) => setUserForm((p) => ({ ...p, nome: e.target.value }))} />
          <Select label="Função" value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value as UserRole }))}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </div>
      </Modal>

      {/* Modal categoria */}
      <Modal
        open={modalCategoria}
        onClose={() => !loadingSaveCat && setModalCategoria(false)}
        title={editandoCatId ? 'Editar Categoria' : 'Nova Categoria'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalCategoria(false)} disabled={loadingSaveCat}>Cancelar</Button>
            <Button variant="primary" onClick={salvarCategoria} loading={loadingSaveCat}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Nome da Categoria" value={catForm.nome} onChange={(e) => setCatForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Ex: Venda de Produto" />
          <Select label="Tipo" value={catForm.tipo} onChange={(e) => setCatForm((p) => ({ ...p, tipo: e.target.value as LancamentoTipo }))}>
            <option value="entrada">Entrada (receita)</option>
            <option value="saida">Saída (despesa)</option>
          </Select>
          <div>
            <label className="label-base">Cor</label>
            <div className="flex items-center gap-3">
              <input type="color" value={catForm.cor} onChange={(e) => setCatForm((p) => ({ ...p, cor: e.target.value }))}
                className="w-10 h-10 rounded-lg cursor-pointer border border-gold-200" />
              <span className="text-xs text-dark-400 font-mono">{catForm.cor}</span>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmInativarUser}
        onClose={() => setConfirmInativarUser(false)}
        onConfirm={inativarUsuario}
        title="Inativar Usuário"
        description="O usuário perderá acesso ao sistema. Você pode reativá-lo pelo banco de dados."
        confirmLabel="Inativar"
      />
    </div>
  )
}
