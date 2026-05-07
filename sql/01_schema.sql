-- ============================================================
-- OLIVEIRA JOIAS — Esquema Completo do Banco de Dados
-- Supabase / PostgreSQL
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'vendedor', 'caixa', 'visualizador');
CREATE TYPE venda_status AS ENUM ('orcamento', 'pendente', 'pago', 'crediario', 'cancelado');
CREATE TYPE venda_forma_pagamento AS ENUM ('dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'crediario', 'transferencia', 'cheque', 'misto');
CREATE TYPE crediario_status AS ENUM ('em_dia', 'vencido', 'quitado', 'cancelado');
CREATE TYPE parcela_status AS ENUM ('pendente', 'pago', 'vencido', 'cancelado');
CREATE TYPE lancamento_tipo AS ENUM ('entrada', 'saida');
CREATE TYPE servico_status AS ENUM ('orcamento', 'aguardando', 'em_andamento', 'concluido', 'entregue', 'cancelado');
CREATE TYPE estoque_movimento_tipo AS ENUM ('entrada', 'saida', 'ajuste', 'devolucao');
CREATE TYPE produto_categoria AS ENUM ('anel', 'colar', 'brinco', 'pulseira', 'alianca', 'pingente', 'relogio', 'kit', 'outro');

-- ============================================================
-- PROFILES (usuários do sistema)
-- ============================================================

CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  role          user_role NOT NULL DEFAULT 'vendedor',
  ativo         BOOLEAN NOT NULL DEFAULT true,
  avatar_url    TEXT,
  telefone      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLIENTES
-- ============================================================

CREATE TABLE clientes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome          TEXT NOT NULL,
  cpf           TEXT UNIQUE,
  rg            TEXT,
  email         TEXT,
  telefone      TEXT,
  whatsapp      TEXT,
  data_nascimento DATE,
  endereco      TEXT,
  numero        TEXT,
  complemento   TEXT,
  bairro        TEXT,
  cidade        TEXT,
  estado        TEXT DEFAULT 'MG',
  cep           TEXT,
  observacoes   TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clientes_nome ON clientes(nome);
CREATE INDEX idx_clientes_cpf ON clientes(cpf);
CREATE INDEX idx_clientes_telefone ON clientes(telefone);

-- ============================================================
-- FORNECEDORES
-- ============================================================

CREATE TABLE fornecedores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome          TEXT NOT NULL,
  razao_social  TEXT,
  cnpj          TEXT UNIQUE,
  cpf           TEXT UNIQUE,
  email         TEXT,
  telefone      TEXT,
  contato_nome  TEXT,
  endereco      TEXT,
  numero        TEXT,
  complemento   TEXT,
  bairro        TEXT,
  cidade        TEXT,
  estado        TEXT DEFAULT 'SP',
  cep           TEXT,
  categoria     TEXT,
  observacoes   TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fornecedores_nome ON fornecedores(nome);

-- ============================================================
-- PRODUTOS
-- ============================================================

CREATE TABLE produtos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo          TEXT UNIQUE NOT NULL,
  nome            TEXT NOT NULL,
  descricao       TEXT,
  categoria       produto_categoria NOT NULL DEFAULT 'outro',
  material        TEXT,
  peso_g          NUMERIC(8,3),
  fornecedor_id   UUID REFERENCES fornecedores(id),
  custo           NUMERIC(12,2) NOT NULL DEFAULT 0,
  preco_venda     NUMERIC(12,2) NOT NULL DEFAULT 0,
  preco_minimo    NUMERIC(12,2),
  imagem_url      TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  is_kit          BOOLEAN NOT NULL DEFAULT false,
  observacoes     TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_produtos_codigo ON produtos(codigo);
CREATE INDEX idx_produtos_nome ON produtos(nome);
CREATE INDEX idx_produtos_categoria ON produtos(categoria);

-- ============================================================
-- VARIAÇÕES DE PRODUTO (tamanho, cor, etc.)
-- ============================================================

CREATE TABLE produto_variacoes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id      UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,         -- ex: "Tamanho 16", "40cm"
  valor           TEXT NOT NULL,         -- ex: "16", "40cm"
  estoque_atual   INTEGER NOT NULL DEFAULT 0,
  estoque_minimo  INTEGER NOT NULL DEFAULT 1,
  custo_adicional NUMERIC(12,2) DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_variacoes_produto ON produto_variacoes(produto_id);

-- ============================================================
-- KITS (produtos compostos)
-- ============================================================

CREATE TABLE kit_itens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kit_id          UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  produto_id      UUID NOT NULL REFERENCES produtos(id),
  variacao_id     UUID REFERENCES produto_variacoes(id),
  quantidade      INTEGER NOT NULL DEFAULT 1,
  preco_unitario  NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kit_itens_kit ON kit_itens(kit_id);

-- ============================================================
-- MOVIMENTAÇÕES DE ESTOQUE
-- ============================================================

CREATE TABLE estoque_movimentacoes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variacao_id     UUID NOT NULL REFERENCES produto_variacoes(id),
  produto_id      UUID NOT NULL REFERENCES produtos(id),
  tipo            estoque_movimento_tipo NOT NULL,
  quantidade      INTEGER NOT NULL,
  quantidade_antes INTEGER NOT NULL,
  quantidade_depois INTEGER NOT NULL,
  motivo          TEXT,
  referencia_id   UUID,   -- id da venda ou compra que gerou o movimento
  referencia_tipo TEXT,   -- 'venda', 'compra', 'ajuste'
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movimentacoes_variacao ON estoque_movimentacoes(variacao_id);
CREATE INDEX idx_movimentacoes_produto ON estoque_movimentacoes(produto_id);
CREATE INDEX idx_movimentacoes_data ON estoque_movimentacoes(created_at);

-- ============================================================
-- VENDAS
-- ============================================================

CREATE TABLE vendas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero          SERIAL UNIQUE,  -- número sequencial da venda
  cliente_id      UUID REFERENCES clientes(id),
  vendedor_id     UUID REFERENCES profiles(id),
  status          venda_status NOT NULL DEFAULT 'pendente',
  forma_pagamento venda_forma_pagamento NOT NULL DEFAULT 'dinheiro',
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto        NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_pago      NUMERIC(12,2) NOT NULL DEFAULT 0,
  troco           NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes     TEXT,
  data_venda      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendas_cliente ON vendas(cliente_id);
CREATE INDEX idx_vendas_data ON vendas(data_venda);
CREATE INDEX idx_vendas_status ON vendas(status);
CREATE INDEX idx_vendas_vendedor ON vendas(vendedor_id);

-- ============================================================
-- ITENS DA VENDA
-- ============================================================

CREATE TABLE venda_itens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id        UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id      UUID NOT NULL REFERENCES produtos(id),
  variacao_id     UUID REFERENCES produto_variacoes(id),
  nome_produto    TEXT NOT NULL,   -- snapshot do nome no momento da venda
  descricao       TEXT,
  quantidade      INTEGER NOT NULL DEFAULT 1,
  preco_unitario  NUMERIC(12,2) NOT NULL,
  custo_unitario  NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto        NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(12,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_venda_itens_venda ON venda_itens(venda_id);
CREATE INDEX idx_venda_itens_produto ON venda_itens(produto_id);

-- ============================================================
-- CREDIÁRIO
-- ============================================================

CREATE TABLE crediario (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venda_id        UUID NOT NULL REFERENCES vendas(id),
  cliente_id      UUID NOT NULL REFERENCES clientes(id),
  total           NUMERIC(12,2) NOT NULL,
  entrada         NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo           NUMERIC(12,2) NOT NULL,
  num_parcelas    INTEGER NOT NULL DEFAULT 1,
  valor_parcela   NUMERIC(12,2) NOT NULL,
  dia_vencimento  INTEGER NOT NULL DEFAULT 5,   -- dia do mês
  status          crediario_status NOT NULL DEFAULT 'em_dia',
  observacoes     TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crediario_cliente ON crediario(cliente_id);
CREATE INDEX idx_crediario_venda ON crediario(venda_id);
CREATE INDEX idx_crediario_status ON crediario(status);

-- ============================================================
-- PARCELAS DO CREDIÁRIO
-- ============================================================

CREATE TABLE crediario_parcelas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crediario_id    UUID NOT NULL REFERENCES crediario(id) ON DELETE CASCADE,
  cliente_id      UUID NOT NULL REFERENCES clientes(id),
  numero          INTEGER NOT NULL,   -- 1, 2, 3...
  valor           NUMERIC(12,2) NOT NULL,
  valor_pago      NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_vencimento DATE NOT NULL,
  data_pagamento  DATE,
  forma_pagamento venda_forma_pagamento,
  status          parcela_status NOT NULL DEFAULT 'pendente',
  observacoes     TEXT,
  recebido_por    UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parcelas_crediario ON crediario_parcelas(crediario_id);
CREATE INDEX idx_parcelas_vencimento ON crediario_parcelas(data_vencimento);
CREATE INDEX idx_parcelas_status ON crediario_parcelas(status);
CREATE INDEX idx_parcelas_cliente ON crediario_parcelas(cliente_id);

-- ============================================================
-- SERVIÇOS
-- ============================================================

CREATE TABLE servicos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero          SERIAL UNIQUE,
  cliente_id      UUID REFERENCES clientes(id),
  tipo            TEXT NOT NULL,
  descricao       TEXT NOT NULL,
  observacoes_internas TEXT,
  valor           NUMERIC(12,2) NOT NULL DEFAULT 0,
  custo_estimado  NUMERIC(12,2) DEFAULT 0,
  status          servico_status NOT NULL DEFAULT 'aguardando',
  data_entrada    DATE NOT NULL DEFAULT CURRENT_DATE,
  data_previsao   DATE,
  data_conclusao  DATE,
  data_entrega    DATE,
  forma_pagamento venda_forma_pagamento,
  pago            BOOLEAN NOT NULL DEFAULT false,
  responsavel_id  UUID REFERENCES profiles(id),
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_servicos_cliente ON servicos(cliente_id);
CREATE INDEX idx_servicos_status ON servicos(status);
CREATE INDEX idx_servicos_data ON servicos(data_entrada);

-- ============================================================
-- CATEGORIAS FINANCEIRAS
-- ============================================================

CREATE TABLE categorias_financeiras (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome            TEXT NOT NULL,
  tipo            lancamento_tipo NOT NULL,
  cor             TEXT DEFAULT '#B8962E',
  ativo           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categorias padrão
INSERT INTO categorias_financeiras (nome, tipo) VALUES
  ('Venda de Produto', 'entrada'),
  ('Serviço', 'entrada'),
  ('Crediário Recebido', 'entrada'),
  ('Outras Entradas', 'entrada'),
  ('Compra de Material', 'saida'),
  ('Aluguel', 'saida'),
  ('Energia Elétrica', 'saida'),
  ('Água', 'saida'),
  ('Telefone/Internet', 'saida'),
  ('Folha de Pagamento', 'saida'),
  ('Pró-labore', 'saida'),
  ('Impostos', 'saida'),
  ('Marketing', 'saida'),
  ('Manutenção', 'saida'),
  ('Embalagens', 'saida'),
  ('Outras Despesas', 'saida');

-- ============================================================
-- LANÇAMENTOS DE CAIXA / FINANCEIRO
-- ============================================================

CREATE TABLE lancamentos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo            lancamento_tipo NOT NULL,
  descricao       TEXT NOT NULL,
  valor           NUMERIC(12,2) NOT NULL,
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria_id    UUID REFERENCES categorias_financeiras(id),
  categoria_nome  TEXT,   -- snapshot da categoria
  forma_pagamento TEXT,
  referencia_id   UUID,   -- venda_id, crediario_id, servico_id, etc.
  referencia_tipo TEXT,   -- 'venda', 'crediario', 'servico', 'manual'
  observacoes     TEXT,
  editado         BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID REFERENCES profiles(id),
  updated_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lancamentos_tipo ON lancamentos(tipo);
CREATE INDEX idx_lancamentos_data ON lancamentos(data_lancamento);
CREATE INDEX idx_lancamentos_categoria ON lancamentos(categoria_id);
CREATE INDEX idx_lancamentos_referencia ON lancamentos(referencia_id);

-- ============================================================
-- HISTÓRICO DE EDIÇÕES DOS LANÇAMENTOS
-- ============================================================

CREATE TABLE lancamentos_historico (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lancamento_id   UUID NOT NULL REFERENCES lancamentos(id) ON DELETE CASCADE,
  campo_alterado  TEXT NOT NULL,   -- ex: 'valor', 'descricao', 'tipo'
  valor_antes     TEXT,
  valor_depois    TEXT,
  motivo          TEXT,
  alterado_por    UUID REFERENCES profiles(id),
  alterado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historico_lancamento ON lancamentos_historico(lancamento_id);
CREATE INDEX idx_historico_data ON lancamentos_historico(alterado_em);

-- ============================================================
-- COMPRAS DE FORNECEDORES
-- ============================================================

CREATE TABLE compras (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero          SERIAL UNIQUE,
  fornecedor_id   UUID REFERENCES fornecedores(id),
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  forma_pagamento venda_forma_pagamento,
  data_compra     DATE NOT NULL DEFAULT CURRENT_DATE,
  data_entrega    DATE,
  status          TEXT NOT NULL DEFAULT 'pendente',
  observacoes     TEXT,
  nota_fiscal     TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE compra_itens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compra_id       UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  produto_id      UUID NOT NULL REFERENCES produtos(id),
  variacao_id     UUID REFERENCES produto_variacoes(id),
  quantidade      INTEGER NOT NULL DEFAULT 1,
  custo_unitario  NUMERIC(12,2) NOT NULL,
  subtotal        NUMERIC(12,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS E FUNÇÕES
-- ============================================================

-- Função: atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger em todas as tabelas relevantes
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON fornecedores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_variacoes_updated_at BEFORE UPDATE ON produto_variacoes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendas_updated_at BEFORE UPDATE ON vendas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_crediario_updated_at BEFORE UPDATE ON crediario FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_parcelas_updated_at BEFORE UPDATE ON crediario_parcelas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_servicos_updated_at BEFORE UPDATE ON servicos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lancamentos_updated_at BEFORE UPDATE ON lancamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_compras_updated_at BEFORE UPDATE ON compras FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função: gerar código automático de produto
CREATE OR REPLACE FUNCTION gerar_codigo_produto()
RETURNS TRIGGER AS $$
DECLARE
  prefixo TEXT;
  seq INTEGER;
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    prefixo := CASE NEW.categoria
      WHEN 'anel'     THEN 'AN'
      WHEN 'colar'    THEN 'CO'
      WHEN 'brinco'   THEN 'BR'
      WHEN 'pulseira' THEN 'PU'
      WHEN 'alianca'  THEN 'AL'
      WHEN 'pingente' THEN 'PI'
      WHEN 'relogio'  THEN 'RE'
      WHEN 'kit'      THEN 'KI'
      ELSE 'PR'
    END;
    SELECT COUNT(*) + 1 INTO seq FROM produtos WHERE categoria = NEW.categoria;
    NEW.codigo := prefixo || LPAD(seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER gerar_codigo_produto_trigger
  BEFORE INSERT ON produtos
  FOR EACH ROW EXECUTE FUNCTION gerar_codigo_produto();

-- Função: atualizar saldo do crediário ao pagar parcela
CREATE OR REPLACE FUNCTION atualizar_saldo_crediario()
RETURNS TRIGGER AS $$
DECLARE
  total_pago NUMERIC;
  total_crediario NUMERIC;
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN
    SELECT SUM(valor_pago) INTO total_pago
    FROM crediario_parcelas
    WHERE crediario_id = NEW.crediario_id AND status = 'pago';

    SELECT total INTO total_crediario
    FROM crediario WHERE id = NEW.crediario_id;

    UPDATE crediario
    SET
      saldo = total_crediario - COALESCE(total_pago, 0),
      status = CASE
        WHEN (total_crediario - COALESCE(total_pago, 0)) <= 0 THEN 'quitado'
        ELSE 'em_dia'
      END,
      updated_at = NOW()
    WHERE id = NEW.crediario_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER atualizar_saldo_crediario_trigger
  AFTER INSERT OR UPDATE ON crediario_parcelas
  FOR EACH ROW EXECUTE FUNCTION atualizar_saldo_crediario();

-- Função: atualizar estoque ao registrar movimentação
CREATE OR REPLACE FUNCTION atualizar_estoque_variacao()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE produto_variacoes
  SET estoque_atual = NEW.quantidade_depois,
      updated_at = NOW()
  WHERE id = NEW.variacao_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER atualizar_estoque_trigger
  AFTER INSERT ON estoque_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION atualizar_estoque_variacao();

-- Função: registrar histórico de edição de lançamento
CREATE OR REPLACE FUNCTION registrar_historico_lancamento()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.descricao IS DISTINCT FROM NEW.descricao THEN
    INSERT INTO lancamentos_historico (lancamento_id, campo_alterado, valor_antes, valor_depois, alterado_por)
    VALUES (NEW.id, 'descricao', OLD.descricao, NEW.descricao, NEW.updated_by);
  END IF;
  IF OLD.valor IS DISTINCT FROM NEW.valor THEN
    INSERT INTO lancamentos_historico (lancamento_id, campo_alterado, valor_antes, valor_depois, alterado_por)
    VALUES (NEW.id, 'valor', OLD.valor::TEXT, NEW.valor::TEXT, NEW.updated_by);
  END IF;
  IF OLD.tipo IS DISTINCT FROM NEW.tipo THEN
    INSERT INTO lancamentos_historico (lancamento_id, campo_alterado, valor_antes, valor_depois, alterado_por)
    VALUES (NEW.id, 'tipo', OLD.tipo::TEXT, NEW.tipo::TEXT, NEW.updated_by);
  END IF;
  IF OLD.data_lancamento IS DISTINCT FROM NEW.data_lancamento THEN
    INSERT INTO lancamentos_historico (lancamento_id, campo_alterado, valor_antes, valor_depois, alterado_por)
    VALUES (NEW.id, 'data_lancamento', OLD.data_lancamento::TEXT, NEW.data_lancamento::TEXT, NEW.updated_by);
  END IF;
  IF OLD.categoria_nome IS DISTINCT FROM NEW.categoria_nome THEN
    INSERT INTO lancamentos_historico (lancamento_id, campo_alterado, valor_antes, valor_depois, alterado_por)
    VALUES (NEW.id, 'categoria', OLD.categoria_nome, NEW.categoria_nome, NEW.updated_by);
  END IF;
  NEW.editado := true;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER registrar_historico_lancamento_trigger
  BEFORE UPDATE ON lancamentos
  FOR EACH ROW EXECUTE FUNCTION registrar_historico_lancamento();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_variacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE crediario ENABLE ROW LEVEL SECURITY;
ALTER TABLE crediario_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE compra_itens ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ler e escrever
-- (refinamento por role pode ser adicionado depois)

CREATE POLICY "authenticated_all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON produtos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON produto_variacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON kit_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON estoque_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON vendas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON venda_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON crediario FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON crediario_parcelas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON categorias_financeiras FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON lancamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON lancamentos_historico FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON compras FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON compra_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- VIEWS ÚTEIS
-- ============================================================

-- View: estoque atual com info do produto
CREATE VIEW vw_estoque_atual AS
SELECT
  pv.id AS variacao_id,
  p.id AS produto_id,
  p.codigo,
  p.nome AS produto_nome,
  p.categoria,
  p.material,
  pv.nome AS variacao_nome,
  pv.valor AS variacao_valor,
  pv.estoque_atual,
  pv.estoque_minimo,
  CASE WHEN pv.estoque_atual = 0 THEN 'esgotado'
       WHEN pv.estoque_atual <= pv.estoque_minimo THEN 'critico'
       ELSE 'normal' END AS status_estoque,
  p.custo,
  p.preco_venda,
  (p.preco_venda * pv.estoque_atual) AS valor_estoque
FROM produto_variacoes pv
JOIN produtos p ON p.id = pv.produto_id
WHERE p.ativo = true AND pv.ativo = true;

-- View: parcelas vencidas
CREATE VIEW vw_parcelas_vencidas AS
SELECT
  cp.*,
  c.nome AS cliente_nome,
  c.telefone AS cliente_telefone,
  cr.total AS crediario_total,
  CURRENT_DATE - cp.data_vencimento AS dias_atraso
FROM crediario_parcelas cp
JOIN crediario cr ON cr.id = cp.crediario_id
JOIN clientes c ON c.id = cp.cliente_id
WHERE cp.status = 'pendente' AND cp.data_vencimento < CURRENT_DATE
ORDER BY cp.data_vencimento;

-- View: resumo financeiro do mês atual
CREATE VIEW vw_resumo_financeiro_mes AS
SELECT
  tipo,
  SUM(valor) AS total,
  COUNT(*) AS qtd_lancamentos
FROM lancamentos
WHERE DATE_TRUNC('month', data_lancamento) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY tipo;

-- View: vendas com cliente e vendedor
CREATE VIEW vw_vendas_completas AS
SELECT
  v.*,
  c.nome AS cliente_nome,
  c.telefone AS cliente_telefone,
  p.nome AS vendedor_nome
FROM vendas v
LEFT JOIN clientes c ON c.id = v.cliente_id
LEFT JOIN profiles p ON p.id = v.vendedor_id;
