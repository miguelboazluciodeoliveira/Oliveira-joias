import { useEffect, useState } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  formatMoney, formatDate, VENDA_STATUS_LABEL, FORMA_PAGAMENTO_LABEL,
  vendaStatusVariant, gerarDatasParcelas, round2
} from '@/lib/utils'
import {
  Card, Button, Input, Select, Textarea, Modal, ConfirmDialog,
  PageHeader, SearchInput, EmptyState, Badge, Spinner, Divider
} from '@/components/ui'
import type { Venda, Cliente, VwEstoqueAtual, FormaPagamento, VendaStatus } from '@/types'
import toast from 'react-hot-toast'

const FORMAS: FormaPagamento[] = ['dinheiro','pix','cartao_debito','cartao_credito','crediario','transferencia','cheque','misto']

interface ItemForm {
  produto_id: string; variacao_id: string; nome_produto: string
  quantidade: number; preco_unitario: number; custo_unitario: number
  desconto: number; subtotal: number
}

export function VendasPage() {
  const { user } = useAuth()
  const [vendas, setVendas] = useState<Venda[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<VwEstoqueAtual[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('')

  const [modalAberto, setModalAberto] = useState(false)
  const [loadingSave, setLoadingSave] = useState(false)
  const [confirmCancelar, setConfirmCancelar] = useState(false)
  const [cancelandoId, setCelanlandoId] = useState<string | null>(null)

  // Form state
  const [clienteId, setClienteId] = useState('')
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().split('T')[0])
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix')
  const [desconto, setDesconto] = useState('0')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([])
  // Crediário
  const [numParcelas, setNumParcelas] = useState(3)
  const [entrada, setEntrada] = useState('0')
  const [diaVencimento, setDiaVencimento] = useState(5)
  // Busca de produto
  const [buscaProduto, setBuscaProduto] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [vendasRes, clientesRes, produtosRes] = await Promise.all([
      supabase
        .from('vendas')
        .select('*, cliente:clientes(nome)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('clientes').select('id,nome,telefone').eq('ativo', true).order('nome'),
      supabase.from('vw_estoque_atual').select('*').order('produto_nome'),
    ])
    if (vendasRes.error) toast.error('Erro ao carregar vendas')
    setVendas((vendasRes.data || []) as unknown as Venda[])
    setClientes((clientesRes.data || []) as Cliente[])
    setProdutos((produtosRes.data || []) as VwEstoqueAtual[])
    setLoading(false)
  }

  const filtrados = vendas.filter((v) => {
    const clienteNome = (v as unknown as { cliente?: { nome: string } }).cliente?.nome || ''
    const match = !search || clienteNome.toLowerCase().includes(search.toLowerCase()) ||
      String(v.numero).includes(search)
    return match && (!filtroStatus || v.status === filtroStatus)
  })

  // ── Cálculos da venda ────────────────────────────────────────
  const subtotal = itens.reduce((s, i) => s + i.subtotal, 0)
  const descontoVal = parseFloat(desconto) || 0
  const total = round2(Math.max(0, subtotal - descontoVal))

  // ── Adicionar item ───────────────────────────────────────────
  function adicionarItem(produto: VwEstoqueAtual) {
    const existe = itens.find((i) => i.variacao_id === produto.variacao_id)
    if (existe) {
      setItens(itens.map((i) =>
        i.variacao_id === produto.variacao_id
          ? { ...i, quantidade: i.quantidade + 1, subtotal: round2((i.quantidade + 1) * i.preco_unitario - i.desconto) }
          : i
      ))
    } else {
      setItens([...itens, {
        produto_id: produto.produto_id,
        variacao_id: produto.variacao_id,
        nome_produto: `${produto.produto_nome} (${produto.variacao_valor})`,
        quantidade: 1,
        preco_unitario: produto.preco_venda,
        custo_unitario: produto.custo,
        desconto: 0,
        subtotal: produto.preco_venda,
      }])
    }
    setBuscaProduto('')
  }

  function removerItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx))
  }

  function atualizarItem(idx: number, field: 'quantidade' | 'preco_unitario' | 'desconto', val: number) {
    setItens(itens.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: val }
      updated.subtotal = round2(updated.quantidade * updated.preco_unitario - updated.desconto)
      return updated
    }))
  }

  function abrirNova() {
    setClienteId(''); setDataVenda(new Date().toISOString().split('T')[0])
    setFormaPagamento('pix'); setDesconto('0'); setObservacoes('')
    setItens([]); setNumParcelas(3); setEntrada('0'); setDiaVencimento(5)
    setBuscaProduto(''); setClienteSearch('')
    setModalAberto(true)
  }

  async function salvarVenda() {
    if (itens.length === 0) { toast.error('Adicione pelo menos um item'); return }
    setLoadingSave(true)

    const status: VendaStatus = formaPagamento === 'crediario' ? 'crediario' : 'pago'

    // 1. Criar venda
    const { data: novaVenda, error: vendaErr } = await supabase
      .from('vendas')
      .insert({
        cliente_id: clienteId || null,
        vendedor_id: user?.id,
        status,
        forma_pagamento: formaPagamento,
        subtotal,
        desconto: descontoVal,
        total,
        valor_pago: formaPagamento !== 'crediario' ? total : parseFloat(entrada) || 0,
        troco: 0,
        observacoes: observacoes.trim() || null,
        data_venda: dataVenda,
      })
      .select()
      .single()

    if (vendaErr || !novaVenda) {
      toast.error('Erro ao criar venda')
      setLoadingSave(false)
      return
    }

    // 2. Criar itens
    const { error: itensErr } = await supabase.from('venda_itens').insert(
      itens.map((item) => ({
        venda_id: novaVenda.id,
        produto_id: item.produto_id,
        variacao_id: item.variacao_id || null,
        nome_produto: item.nome_produto,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        custo_unitario: item.custo_unitario,
        desconto: item.desconto,
        subtotal: item.subtotal,
      }))
    )

    if (itensErr) {
      toast.error('Venda criada mas erro nos itens')
      setLoadingSave(false)
      setModalAberto(false)
      loadData()
      return
    }

    // 3. Baixar estoque para cada item
    for (const item of itens) {
      if (!item.variacao_id) continue
      const prod = produtos.find((p) => p.variacao_id === item.variacao_id)
      if (!prod) continue
      const depois = prod.estoque_atual - item.quantidade
      await supabase.from('estoque_movimentacoes').insert({
        variacao_id: item.variacao_id,
        produto_id: item.produto_id,
        tipo: 'saida',
        quantidade: item.quantidade,
        quantidade_antes: prod.estoque_atual,
        quantidade_depois: Math.max(0, depois),
        motivo: `Venda #${novaVenda.numero}`,
        referencia_id: novaVenda.id,
        referencia_tipo: 'venda',
        created_by: user?.id,
      })
    }

    // 4. Criar crediário se necessário
    if (formaPagamento === 'crediario' && clienteId) {
      const entradaVal = parseFloat(entrada) || 0
      const saldo = round2(total - entradaVal)
      const valorParcela = round2(saldo / numParcelas)
      const datas = gerarDatasParcelas(numParcelas, diaVencimento)

      const { data: novoCrediario, error: credErr } = await supabase
        .from('crediario')
        .insert({
          venda_id: novaVenda.id,
          cliente_id: clienteId,
          total,
          entrada: entradaVal,
          saldo,
          num_parcelas: numParcelas,
          valor_parcela: valorParcela,
          dia_vencimento: diaVencimento,
          created_by: user?.id,
        })
        .select()
        .single()

      if (!credErr && novoCrediario) {
        await supabase.from('crediario_parcelas').insert(
          datas.map((data, i) => ({
            crediario_id: novoCrediario.id,
            cliente_id: clienteId,
            numero: i + 1,
            valor: valorParcela,
            data_vencimento: data,
            status: 'pendente',
          }))
        )
      }
    }

    // 5. Lançamento automático no caixa
    await supabase.from('lancamentos').insert({
      tipo: 'entrada',
      descricao: `Venda #${novaVenda.numero}${clienteId ? ` — ${clientes.find((c) => c.id === clienteId)?.nome}` : ''}`,
      valor: formaPagamento === 'crediario' ? (parseFloat(entrada) || 0) : total,
      data_lancamento: dataVenda,
      categoria_nome: 'Venda de Produto',
      forma_pagamento: FORMA_PAGAMENTO_LABEL[formaPagamento],
      referencia_id: novaVenda.id,
      referencia_tipo: 'venda',
      created_by: user?.id,
    })

    toast.success(`Venda #${novaVenda.numero} registrada!`)
    setLoadingSave(false)
    setModalAberto(false)
    loadData()
  }

  async function cancelarVenda() {
    if (!cancelandoId) return
    const { error } = await supabase.from('vendas').update({ status: 'cancelado' }).eq('id', cancelandoId)
    if (error) toast.error('Erro ao cancelar venda')
    else { toast.success('Venda cancelada'); loadData() }
    setConfirmCancelar(false)
    setCelanlandoId(null)
  }

  // Produtos filtrados pela busca
  const produtosFiltrados = produtos.filter((p) =>
    buscaProduto.length >= 2 &&
    (p.produto_nome.toLowerCase().includes(buscaProduto.toLowerCase()) ||
     p.codigo.toLowerCase().includes(buscaProduto.toLowerCase()))
  ).slice(0, 8)

  const clientesFiltrados = clientes.filter((c) =>
    !clienteSearch || c.nome.toLowerCase().includes(clienteSearch.toLowerCase())
  ).slice(0, 8)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendas"
        subtitle={`${filtrados.length} venda${filtrados.length !== 1 ? 's' : ''}`}
        actions={<Button variant="primary" leftIcon={<Plus size={15} />} onClick={abrirNova}>Nova Venda</Button>}
      />

      <Card>
        <div className="flex gap-3 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por cliente ou nº..." className="w-64" />
          <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-40">
            <option value="">Todos os status</option>
            {(Object.entries(VENDA_STATUS_LABEL) as [VendaStatus, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card padding="none">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<Search size={36} />}
            title="Nenhuma venda encontrada"
            action={<Button variant="primary" leftIcon={<Plus size={14} />} onClick={abrirNova}>Nova Venda</Button>}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Cliente</th><th>Data</th><th>Forma de Pagamento</th>
                <th>Status</th><th className="text-right">Total</th><th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((v) => (
                <tr key={v.id}>
                  <td className="font-mono text-xs text-gold-600 font-medium">#{v.numero}</td>
                  <td className="font-medium text-dark-700">
                    {(v as unknown as { cliente?: { nome: string } }).cliente?.nome || 'Consumidor Final'}
                  </td>
                  <td className="text-dark-400 text-xs">{formatDate(v.data_venda)}</td>
                  <td className="text-dark-400 text-xs">{FORMA_PAGAMENTO_LABEL[v.forma_pagamento]}</td>
                  <td><Badge variant={vendaStatusVariant(v.status)}>{VENDA_STATUS_LABEL[v.status]}</Badge></td>
                  <td className="text-right font-medium">{formatMoney(v.total)}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {v.status !== 'cancelado' && (
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => { setCelanlandoId(v.id); setConfirmCancelar(true) }}
                          title="Cancelar venda"
                        >
                          <Trash2 size={13} className="text-red-500" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Modal Nova Venda */}
      <Modal
        open={modalAberto} onClose={() => !loadingSave && setModalAberto(false)}
        title="Nova Venda" size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalAberto(false)} disabled={loadingSave}>Cancelar</Button>
            <Button variant="primary" onClick={salvarVenda} loading={loadingSave}>
              Confirmar Venda {total > 0 ? `— ${formatMoney(total)}` : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Busca cliente */}
            <div>
              <label className="label-base">Cliente</label>
              <div className="relative">
                <input
                  type="text"
                  className="input-base"
                  placeholder="Buscar cliente..."
                  value={clienteSearch || clientes.find((c) => c.id === clienteId)?.nome || ''}
                  onChange={(e) => { setClienteSearch(e.target.value); setClienteId('') }}
                />
                {clienteSearch && clientesFiltrados.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gold-200 rounded-lg shadow-lg mt-1 overflow-y-auto max-h-48">
                    {clientesFiltrados.map((c) => (
                      <button key={c.id} type="button"
                        onClick={() => { setClienteId(c.id); setClienteSearch('') }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-cream-100 transition-colors"
                      >
                        {c.nome}
                        {c.telefone && <span className="text-xs text-dark-300 ml-2">{c.telefone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Input label="Data da Venda" type="date" value={dataVenda} onChange={(e) => setDataVenda(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="Forma de Pagamento" value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}>
              {FORMAS.map((f) => <option key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f]}</option>)}
            </Select>
            <Input label="Desconto (R$)" type="number" min="0" step="0.01" value={desconto}
              onChange={(e) => setDesconto(e.target.value)} />
          </div>

          {/* Crediário options */}
          {formaPagamento === 'crediario' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-700 mb-2">Configuração do Crediário</p>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Entrada (R$)" type="number" min="0" step="0.01" value={entrada}
                  onChange={(e) => setEntrada(e.target.value)} />
                <Input label="Nº de Parcelas" type="number" min="1" max="36" value={numParcelas}
                  onChange={(e) => setNumParcelas(parseInt(e.target.value) || 1)} />
                <Input label="Dia de Vencimento" type="number" min="1" max="28" value={diaVencimento}
                  onChange={(e) => setDiaVencimento(parseInt(e.target.value) || 5)} />
              </div>
              {total > 0 && (
                <p className="text-xs text-blue-600 mt-2">
                  Saldo: {formatMoney(round2(total - (parseFloat(entrada) || 0)))} em {numParcelas}× de{' '}
                  {formatMoney(round2((total - (parseFloat(entrada) || 0)) / numParcelas))}
                </p>
              )}
            </div>
          )}

          <Divider />

          {/* Busca e adição de produtos */}
          <div>
            <label className="label-base">Adicionar Produtos</label>
            <div className="relative">
              <input
                type="text"
                className="input-base"
                placeholder="Buscar produto por nome ou código (mín. 2 letras)..."
                value={buscaProduto}
                onChange={(e) => setBuscaProduto(e.target.value)}
              />
              {produtosFiltrados.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gold-200 rounded-lg shadow-lg mt-1 overflow-y-auto max-h-56">
                  {produtosFiltrados.map((p) => (
                    <button key={p.variacao_id} type="button"
                      onClick={() => adicionarItem(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-cream-100 transition-colors flex items-center justify-between"
                      disabled={p.estoque_atual === 0}
                    >
                      <div>
                        <span className="font-medium">{p.produto_nome}</span>
                        <span className="text-xs text-dark-400 ml-2">{p.variacao_nome}: {p.variacao_valor}</span>
                        {p.estoque_atual === 0 && <span className="text-xs text-red-500 ml-2">Esgotado</span>}
                      </div>
                      <span className="font-medium text-gold-600">{formatMoney(p.preco_venda)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lista de itens */}
          {itens.length > 0 && (
            <div className="border border-gold-100 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream-100">
                    <th className="text-left px-3 py-2 text-xs text-dark-400 font-medium">Produto</th>
                    <th className="text-center px-3 py-2 text-xs text-dark-400 font-medium w-20">Qtd</th>
                    <th className="text-right px-3 py-2 text-xs text-dark-400 font-medium w-28">Preço Unit.</th>
                    <th className="text-right px-3 py-2 text-xs text-dark-400 font-medium w-24">Desconto</th>
                    <th className="text-right px-3 py-2 text-xs text-dark-400 font-medium w-28">Subtotal</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, i) => (
                    <tr key={i} className="border-t border-gold-50">
                      <td className="px-3 py-2 text-dark-700">{item.nome_produto}</td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" min="1" value={item.quantidade}
                          onChange={(e) => atualizarItem(i, 'quantidade', parseInt(e.target.value) || 1)}
                          className="w-16 text-center input-base py-1" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" min="0" step="0.01" value={item.preco_unitario}
                          onChange={(e) => atualizarItem(i, 'preco_unitario', parseFloat(e.target.value) || 0)}
                          className="w-24 text-right input-base py-1" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" min="0" step="0.01" value={item.desconto}
                          onChange={(e) => atualizarItem(i, 'desconto', parseFloat(e.target.value) || 0)}
                          className="w-20 text-right input-base py-1" />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{formatMoney(item.subtotal)}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => removerItem(i)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-gold-200 bg-cream-50 px-3 py-2 flex justify-end gap-6 text-sm">
                <span className="text-dark-400">Subtotal: {formatMoney(subtotal)}</span>
                {descontoVal > 0 && <span className="text-red-600">Desconto: -{formatMoney(descontoVal)}</span>}
                <span className="font-medium text-dark-800">Total: {formatMoney(total)}</span>
              </div>
            </div>
          )}

          <Textarea label="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações da venda..." />
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmCancelar} onClose={() => setConfirmCancelar(false)}
        onConfirm={cancelarVenda}
        title="Cancelar Venda"
        description="A venda será marcada como cancelada. O estoque NÃO será revertido automaticamente. Deseja continuar?"
        confirmLabel="Cancelar Venda"
      />
    </div>
  )
}
