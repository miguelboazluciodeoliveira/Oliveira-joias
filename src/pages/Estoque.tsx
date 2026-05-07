import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Package, ArrowUpDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatMoney, PRODUTO_CATEGORIA_LABEL } from '@/lib/utils'
import {
  Card, Button, Input, Select, Textarea, Modal, ConfirmDialog,
  PageHeader, SearchInput, EmptyState, Badge, Spinner, Divider
} from '@/components/ui'
import type { VwEstoqueAtual, Produto, ProdutoVariacao, ProdutoCategoria } from '@/types'
import toast from 'react-hot-toast'

const CATEGORIAS = Object.entries(PRODUTO_CATEGORIA_LABEL) as [ProdutoCategoria, string][]

interface ProdutoForm {
  codigo: string; nome: string; descricao: string; categoria: ProdutoCategoria
  material: string; peso_g: string; custo: string; preco_venda: string
  preco_minimo: string; observacoes: string; is_kit: boolean
}

interface VariacaoForm { nome: string; valor: string; estoque_atual: string; estoque_minimo: string }

const produtoEmpty = (): ProdutoForm => ({
  codigo: '', nome: '', descricao: '', categoria: 'anel',
  material: '', peso_g: '', custo: '', preco_venda: '',
  preco_minimo: '', observacoes: '', is_kit: false,
})

export function EstoquePage() {
  const { user } = useAuth()
  const [estoque, setEstoque] = useState<VwEstoqueAtual[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('')
  const [filtroStatus, setFiltroStatus] = useState<string>('')

  const [modalProduto, setModalProduto] = useState(false)
  const [modalVariacoes, setModalVariacoes] = useState(false)
  const [modalMovimento, setModalMovimento] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [produtoSelecionado, setProdutoSelecionado] = useState<string | null>(null)
  const [variacaoSelecionada, setVariacaoSelecionada] = useState<VwEstoqueAtual | null>(null)
  const [deletandoId, setDeletandoId] = useState<string | null>(null)

  const [form, setForm] = useState<ProdutoForm>(produtoEmpty())
  const [variacoes, setVariacoes] = useState<VariacaoForm[]>([{ nome: 'Padrão', valor: 'Único', estoque_atual: '0', estoque_minimo: '1' }])
  const [movimentoTipo, setMovimentoTipo] = useState<'entrada' | 'saida' | 'ajuste'>('entrada')
  const [movimentoQtd, setMovimentoQtd] = useState('')
  const [movimentoMotivo, setMovimentoMotivo] = useState('')

  const [loadingSave, setLoadingSave] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ProdutoForm, string>>>({})

  useEffect(() => { loadEstoque() }, [])

  async function loadEstoque() {
    setLoading(true)
    const { data, error } = await supabase
      .from('vw_estoque_atual')
      .select('*')
      .order('produto_nome')
    if (error) toast.error('Erro ao carregar estoque')
    else setEstoque((data || []) as VwEstoqueAtual[])
    setLoading(false)
  }

  const filtrado = estoque.filter((e) => {
    const s = search.toLowerCase()
    const matchSearch = !search ||
      e.produto_nome.toLowerCase().includes(s) ||
      e.codigo.toLowerCase().includes(s) ||
      e.material?.toLowerCase().includes(s) || false
    const matchCat = !filtroCategoria || e.categoria === filtroCategoria
    const matchStatus = !filtroStatus || e.status_estoque === filtroStatus
    return matchSearch && matchCat && matchStatus
  })

  // Agrupa por produto_id para exibição
  const produtosAgrupados = filtrado.reduce<Record<string, VwEstoqueAtual[]>>((acc, item) => {
    if (!acc[item.produto_id]) acc[item.produto_id] = []
    acc[item.produto_id].push(item)
    return acc
  }, {})

  function validate(): boolean {
    const e: Partial<Record<keyof ProdutoForm, string>> = {}
    if (!form.nome.trim()) e.nome = 'Nome obrigatório'
    if (!form.preco_venda || parseFloat(form.preco_venda) <= 0) e.preco_venda = 'Preço obrigatório'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  function abrirNovoProduto() {
    setEditandoId(null)
    setForm(produtoEmpty())
    setVariacoes([{ nome: 'Tamanho', valor: '', estoque_atual: '0', estoque_minimo: '1' }])
    setFormErrors({})
    setModalProduto(true)
  }

  async function salvarProduto() {
    if (!validate()) return
    setLoadingSave(true)

    const payload = {
      nome: form.nome.trim(),
      codigo: form.codigo.trim() || undefined,
      descricao: form.descricao.trim() || null,
      categoria: form.categoria,
      material: form.material.trim() || null,
      peso_g: form.peso_g ? parseFloat(form.peso_g) : null,
      custo: parseFloat(form.custo) || 0,
      preco_venda: parseFloat(form.preco_venda),
      preco_minimo: form.preco_minimo ? parseFloat(form.preco_minimo) : null,
      observacoes: form.observacoes.trim() || null,
      is_kit: form.is_kit,
    }

    if (editandoId) {
      const { error } = await supabase.from('produtos').update(payload).eq('id', editandoId)
      if (error) { toast.error('Erro ao atualizar produto'); setLoadingSave(false); return }
      toast.success('Produto atualizado!')
    } else {
      const { data: novoP, error } = await supabase
        .from('produtos')
        .insert({ ...payload, created_by: user?.id })
        .select()
        .single()

      if (error || !novoP) { toast.error('Erro ao criar produto'); setLoadingSave(false); return }

      // Criar variações
      const vars = variacoes.filter((v) => v.valor.trim())
      if (vars.length > 0) {
        const { error: varErr } = await supabase.from('produto_variacoes').insert(
          vars.map((v) => ({
            produto_id: novoP.id,
            nome: v.nome.trim(),
            valor: v.valor.trim(),
            estoque_atual: parseInt(v.estoque_atual) || 0,
            estoque_minimo: parseInt(v.estoque_minimo) || 1,
          }))
        )
        if (varErr) toast.error('Produto criado, mas erro nas variações')
      }
      toast.success('Produto cadastrado!')
    }

    setLoadingSave(false)
    setModalProduto(false)
    loadEstoque()
  }

  async function registrarMovimento() {
    if (!variacaoSelecionada || !movimentoQtd) return
    const qtd = parseInt(movimentoQtd)
    if (isNaN(qtd) || qtd <= 0) { toast.error('Quantidade inválida'); return }

    const antes = variacaoSelecionada.estoque_atual
    const depois = movimentoTipo === 'entrada' ? antes + qtd
      : movimentoTipo === 'saida' ? antes - qtd
      : qtd  // ajuste: define o valor direto

    if (depois < 0) { toast.error('Estoque não pode ser negativo'); return }

    setLoadingSave(true)
    const { error } = await supabase.from('estoque_movimentacoes').insert({
      variacao_id: variacaoSelecionada.variacao_id,
      produto_id: variacaoSelecionada.produto_id,
      tipo: movimentoTipo,
      quantidade: qtd,
      quantidade_antes: antes,
      quantidade_depois: depois,
      motivo: movimentoMotivo.trim() || null,
      referencia_tipo: 'ajuste',
      created_by: user?.id,
    })

    if (error) { toast.error('Erro ao registrar movimento'); setLoadingSave(false); return }
    toast.success('Movimentação registrada!')
    setLoadingSave(false)
    setModalMovimento(false)
    setMovimentoQtd('')
    setMovimentoMotivo('')
    loadEstoque()
  }

  async function excluirProduto() {
    if (!deletandoId) return
    setLoadingDelete(true)
    const { error } = await supabase.from('produtos').update({ ativo: false }).eq('id', deletandoId)
    if (error) toast.error('Erro ao inativar produto')
    else { toast.success('Produto inativado'); loadEstoque() }
    setLoadingDelete(false)
    setConfirmDelete(false)
    setDeletandoId(null)
  }

  const statusBadge = (s: string) => {
    if (s === 'esgotado') return <Badge variant="danger">Esgotado</Badge>
    if (s === 'critico') return <Badge variant="warning">Crítico</Badge>
    return <Badge variant="success">Normal</Badge>
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Estoque"
        subtitle={`${Object.keys(produtosAgrupados).length} produto(s)`}
        actions={<Button variant="primary" leftIcon={<Plus size={15} />} onClick={abrirNovoProduto}>Novo Produto</Button>}
      />

      <Card>
        <div className="flex gap-3 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar produto, código..." className="w-64" />
          <Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="w-40">
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-40">
            <option value="">Todos os status</option>
            <option value="normal">Normal</option>
            <option value="critico">Crítico</option>
            <option value="esgotado">Esgotado</option>
          </Select>
        </div>
      </Card>

      <Card padding="none">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : Object.keys(produtosAgrupados).length === 0 ? (
          <EmptyState
            icon={<Package size={36} />}
            title="Nenhum produto no estoque"
            action={<Button variant="primary" leftIcon={<Plus size={14} />} onClick={abrirNovoProduto}>Novo Produto</Button>}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th><th>Produto</th><th>Categoria</th><th>Material</th>
                <th>Variação</th><th>Estoque</th><th>Custo</th><th>Preço Venda</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(Object.values(produtosAgrupados) as VwEstoqueAtual[][]).map((vars) => (
                vars.map((item, idx) => (
                  <tr key={item.variacao_id}>
                    {idx === 0 && (
                      <>
                        <td rowSpan={vars.length} className="font-mono text-xs text-gold-600 font-medium align-top pt-3">
                          {item.codigo}
                        </td>
                        <td rowSpan={vars.length} className="font-medium text-dark-700 align-top pt-3">
                          {item.produto_nome}
                        </td>
                        <td rowSpan={vars.length} className="align-top pt-3">
                          <Badge variant="gold">{PRODUTO_CATEGORIA_LABEL[item.categoria]}</Badge>
                        </td>
                        <td rowSpan={vars.length} className="text-dark-400 text-xs align-top pt-3">
                          {item.material || '—'}
                        </td>
                      </>
                    )}
                    <td className="text-xs text-dark-500">{item.variacao_nome}: {item.variacao_valor}</td>
                    <td>{statusBadge(item.status_estoque)}
                      <span className="ml-1 text-xs text-dark-400">{item.estoque_atual} un</span>
                    </td>
                    {idx === 0 && (
                      <>
                        <td rowSpan={vars.length} className="text-dark-400 align-top pt-3">
                          {formatMoney(item.custo)}
                        </td>
                        <td rowSpan={vars.length} className="font-medium align-top pt-3">
                          {formatMoney(item.preco_venda)}
                        </td>
                        <td rowSpan={vars.length} className="align-top pt-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="icon" title="Movimentar estoque"
                              onClick={() => { setVariacaoSelecionada(vars[0]); setMovimentoTipo('entrada'); setModalMovimento(true) }}
                            >
                              <ArrowUpDown size={13} className="text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" title="Editar produto"
                              onClick={() => {
                                setEditandoId(item.produto_id)
                                setForm({
                                  codigo: item.codigo, nome: item.produto_nome,
                                  descricao: '', categoria: item.categoria,
                                  material: item.material || '', peso_g: '',
                                  custo: String(item.custo), preco_venda: String(item.preco_venda),
                                  preco_minimo: '', observacoes: '', is_kit: false,
                                })
                                setModalProduto(true)
                              }}
                            >
                              <Pencil size={13} />
                            </Button>
                            <Button
                              variant="ghost" size="icon" title="Inativar produto"
                              onClick={() => { setDeletandoId(item.produto_id); setConfirmDelete(true) }}
                            >
                              <Trash2 size={13} className="text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Modal Produto */}
      <Modal
        open={modalProduto} onClose={() => !loadingSave && setModalProduto(false)}
        title={editandoId ? 'Editar Produto' : 'Novo Produto'} size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalProduto(false)} disabled={loadingSave}>Cancelar</Button>
            <Button variant="primary" onClick={salvarProduto} loading={loadingSave}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome do Produto *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} error={formErrors.nome} />
            <Select label="Categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as ProdutoCategoria })}>
              {CATEGORIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Material" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="Ouro 18k, Prata 925..." />
            <Input label="Peso (g)" type="number" step="0.01" value={form.peso_g} onChange={(e) => setForm({ ...form, peso_g: e.target.value })} />
            <Input label="Código (opcional)" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Auto gerado" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Custo (R$)" type="number" step="0.01" value={form.custo} onChange={(e) => setForm({ ...form, custo: e.target.value })} placeholder="0,00" />
            <Input label="Preço de Venda (R$) *" type="number" step="0.01" value={form.preco_venda} onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} placeholder="0,00" error={formErrors.preco_venda} />
            <Input label="Preço Mínimo (R$)" type="number" step="0.01" value={form.preco_minimo} onChange={(e) => setForm({ ...form, preco_minimo: e.target.value })} placeholder="0,00" />
          </div>
          <Textarea label="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição detalhada..." />

          {!editandoId && (
            <>
              <Divider />
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-dark-600">Variações (tamanhos, medidas)</p>
                <Button variant="ghost" size="sm" leftIcon={<Plus size={12} />}
                  onClick={() => setVariacoes([...variacoes, { nome: 'Tamanho', valor: '', estoque_atual: '0', estoque_minimo: '1' }])}>
                  Adicionar
                </Button>
              </div>
              {variacoes.map((v, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 items-end">
                  <Input label="Tipo" value={v.nome} onChange={(e) => {
                    const nv = [...variacoes]; nv[i].nome = e.target.value; setVariacoes(nv)
                  }} placeholder="Tamanho" />
                  <Input label="Valor" value={v.valor} onChange={(e) => {
                    const nv = [...variacoes]; nv[i].valor = e.target.value; setVariacoes(nv)
                  }} placeholder="16, 40cm..." />
                  <Input label="Qtd inicial" type="number" value={v.estoque_atual} onChange={(e) => {
                    const nv = [...variacoes]; nv[i].estoque_atual = e.target.value; setVariacoes(nv)
                  }} />
                  <Button variant="danger-ghost" size="sm"
                    onClick={() => setVariacoes(variacoes.filter((_, j) => j !== i))}
                    disabled={variacoes.length === 1}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      </Modal>

      {/* Modal Movimento */}
      <Modal
        open={modalMovimento} onClose={() => !loadingSave && setModalMovimento(false)}
        title="Movimentar Estoque" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalMovimento(false)} disabled={loadingSave}>Cancelar</Button>
            <Button variant="primary" onClick={registrarMovimento} loading={loadingSave}>Registrar</Button>
          </>
        }
      >
        {variacaoSelecionada && (
          <div className="space-y-3">
            <div className="bg-gold-50 rounded-lg p-3 border border-gold-200">
              <p className="font-medium text-dark-700">{variacaoSelecionada.produto_nome}</p>
              <p className="text-xs text-dark-400">{variacaoSelecionada.variacao_nome}: {variacaoSelecionada.variacao_valor}</p>
              <p className="text-xs text-dark-500 mt-1">Estoque atual: <strong>{variacaoSelecionada.estoque_atual} un</strong></p>
            </div>
            <div>
              <label className="label-base">Tipo de Movimentação</label>
              <div className="flex gap-2">
                {(['entrada', 'saida', 'ajuste'] as const).map((t) => (
                  <button key={t} onClick={() => setMovimentoTipo(t)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors capitalize
                      ${movimentoTipo === t ? 'bg-gold-500 text-dark-800 border-gold-600' : 'bg-white text-dark-500 border-gold-200 hover:bg-cream-100'}`}>
                    {t === 'entrada' ? 'Entrada' : t === 'saida' ? 'Saída' : 'Ajuste'}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label={movimentoTipo === 'ajuste' ? 'Novo estoque total' : 'Quantidade'}
              type="number" min="0" value={movimentoQtd}
              onChange={(e) => setMovimentoQtd(e.target.value)}
              placeholder="0"
            />
            <Input label="Motivo" value={movimentoMotivo} onChange={(e) => setMovimentoMotivo(e.target.value)} placeholder="Opcional..." />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete} onClose={() => !loadingDelete && setConfirmDelete(false)}
        onConfirm={excluirProduto} loading={loadingDelete}
        title="Inativar Produto"
        description="O produto será inativado. O histórico de vendas será preservado."
        confirmLabel="Inativar"
      />
    </div>
  )
}
