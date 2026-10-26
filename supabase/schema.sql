-- =====================================================================
-- Plataforma Maré — schema oficial (fábrica de produtos para cães)
-- Execute no SQL Editor do Supabase, nesta ordem. Seguro para rodar
-- mais de uma vez (IF NOT EXISTS). Nenhum dado existente é apagado.
-- =====================================================================

-- Perfis de acesso (espelha auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role_key text not null check (role_key in ('admin','pcp','almoxarifado','producao','leitura')),
  role_label text not null,
  sector text not null default 'Planejamento e Controle da Produção',
  registration text not null default '',
  created_at timestamptz not null default now()
);

-- Materiais e produtos (classificação oficial, sem misturar tipos)
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Za-z0-9._-]{3,20}$'),
  name text not null check (char_length(name) between 3 and 120),
  description text not null default '',
  category text not null check (category in ('Matéria-prima','Componentes','Produtos em processo','Produtos acabados','Embalagens','Materiais auxiliares')),
  available integer not null default 0 check (available >= 0),
  unit text not null check (unit in ('un','pç','m','kg','L','cx','par','rolo')),
  location text not null default '',
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  supplier text,
  cost numeric(12,2),
  active boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Movimentações de estoque (apêndice: nunca atualizar nem apagar)
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete restrict,
  type text not null check (type in ('entrada','saida','ajuste','estorno')),
  quantity integer not null check (quantity > 0),
  balance_after integer not null check (balance_after >= 0),
  reason text not null,
  actor text not null default '',
  related_request_code text,
  reversal_of uuid references public.stock_movements(id) on delete restrict,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

-- Solicitações de materiais
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  sector text not null,
  responsible text not null,
  priority text not null check (priority in ('Alta','Média','Baixa')),
  status text not null default 'Pendente'
    check (status in ('Pendente','Em análise','Aguardando materiais','Em separação','Pronta para disponibilização','Concluída','Cancelada')),
  due_date date not null,
  notes text,
  concluded_at timestamptz,
  cancel_reason text,
  cancelled_at timestamptz,
  cancelled_by text,
  created_by text not null default '',
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cancel_requires_reason check (
    (status <> 'Cancelada') or (cancel_reason is not null and char_length(cancel_reason) >= 10)
  )
);

create table if not exists public.request_items (
  request_id uuid not null references public.requests(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  requested integer not null check (requested > 0),
  separated integer not null default 0 check (separated >= 0),
  primary key (request_id, material_id),
  constraint separated_lte_requested check (separated <= requested)
);

-- Histórico de auditoria (apêndice)
create table if not exists public.history (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  request_code text,
  material_code text,
  actor text not null default '',
  action text not null,
  from_status text,
  to_status text,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  message text not null default '',
  link text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Função transacional de movimentação (saldo + idempotência no banco)
-- =====================================================================
create or replace function public.register_stock_movement(
  p_material_id uuid,
  p_type text,
  p_quantity integer,
  p_reason text,
  p_actor text,
  p_related_request_code text default null,
  p_idempotency_key text default null
) returns table (
  id uuid, material_id uuid, type text, quantity integer, balance_after integer,
  reason text, actor text, created_at timestamptz, related_request_code text,
  reversal_of uuid, idempotency_key text, is_duplicate boolean
) language plpgsql security definer set search_path = public as $$
declare
  v_current integer;
  v_new integer;
  v_existing stock_movements%rowtype;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'QUANTITY_INVALID: informe uma quantidade maior que zero.';
  end if;

  -- Idempotência: repetição com a mesma chave retorna o registro original.
  if p_idempotency_key is not null then
    select * into v_existing from stock_movements where stock_movements.idempotency_key = p_idempotency_key;
    if found then
      return query select v_existing.id, v_existing.material_id, v_existing.type, v_existing.quantity,
        v_existing.balance_after, v_existing.reason, v_existing.actor, v_existing.created_at,
        v_existing.related_request_code, v_existing.reversal_of, v_existing.idempotency_key, true;
      return;
    end if;
  end if;

  select available into v_current from materials where materials.id = p_material_id for update;
  if not found then
    raise exception 'MATERIAL_NOT_FOUND: material não encontrado.';
  end if;

  if p_type = 'saida' then
    if p_quantity > v_current then
      raise exception 'INSUFFICIENT_STOCK: saída de % excede o saldo disponível (%).', p_quantity, v_current;
    end if;
    v_new := v_current - p_quantity;
  elsif p_type in ('entrada','ajuste') then
    v_new := v_current + p_quantity;
  else
    raise exception 'TYPE_INVALID: tipo de movimentação inválido.';
  end if;

  update materials set available = v_new, updated_at = now() where materials.id = p_material_id;

  return query
  insert into stock_movements (material_id, type, quantity, balance_after, reason, actor, related_request_code, idempotency_key)
  values (p_material_id, p_type, p_quantity, v_new, p_reason, p_actor, p_related_request_code,
          coalesce(p_idempotency_key, 'auto-' || gen_random_uuid()::text))
  returning stock_movements.id, stock_movements.material_id, stock_movements.type, stock_movements.quantity,
    stock_movements.balance_after, stock_movements.reason, stock_movements.actor, stock_movements.created_at,
    stock_movements.related_request_code, stock_movements.reversal_of, stock_movements.idempotency_key, false;
end;
$$;

-- =====================================================================
-- RLS: habilita e cria políticas por perfil (backend impõe permissão)
-- Ajuste os e-mails/UUIDs conforme sua operação antes de ativar.
-- =====================================================================
alter table public.materials enable row level security;
alter table public.stock_movements enable row level security;
alter table public.requests enable row level security;
alter table public.request_items enable row level security;
alter table public.history enable row level security;
alter table public.notifications enable row level security;
alter table public.profiles enable row level security;

-- Leitura autenticada (todas as tabelas operacionais)
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'authenticated_read_materials') then
    create policy authenticated_read_materials on public.materials for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'authenticated_read_movements') then
    create policy authenticated_read_movements on public.stock_movements for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'authenticated_read_requests') then
    create policy authenticated_read_requests on public.requests for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'authenticated_read_items') then
    create policy authenticated_read_items on public.request_items for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'authenticated_read_history') then
    create policy authenticated_read_history on public.history for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'authenticated_read_notifications') then
    create policy authenticated_read_notifications on public.notifications for select to authenticated using (true);
  end if;
end $$;

-- Escrita: apenas admin/pcp/almoxarifado conforme a matriz (services/permissions.ts).
-- Exemplo para materiais (replicar o padrão nas demais tabelas):
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'stock_write_roles') then
    create policy stock_write_roles on public.materials
      for all to authenticated
      using ((select role_key from public.profiles where id = auth.uid()) in ('admin','almoxarifado'))
      with check ((select role_key from public.profiles where id = auth.uid()) in ('admin','almoxarifado'));
  end if;
end $$;

-- Movimentações e histórico: inserção via função RPC (security definer),
-- sem update/delete direto pelo frontend.
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'movements_insert_roles') then
    create policy movements_insert_roles on public.stock_movements
      for insert to authenticated
      with check ((select role_key from public.profiles where id = auth.uid()) in ('admin','almoxarifado'));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'history_insert_any') then
    create policy history_insert_any on public.history for insert to authenticated with check (true);
  end if;
end $$;
