-- Preços compartilhados por todos os sites. Execute no SQL Editor do mesmo Supabase do admin.
create table if not exists public.gokoco_product_prices (
  id text primary key,
  original_price numeric(10,2) not null check (original_price > 0),
  sale_price numeric(10,2) not null check (sale_price > 0 and sale_price <= original_price),
  pix_discount_percent numeric(5,2) not null default 0 check (pix_discount_percent between 0 and 99),
  recovery_discount_percent numeric(5,2) not null default 50 check (recovery_discount_percent between 0 and 99),
  version uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now()
);
alter table public.gokoco_product_prices enable row level security;
revoke all on public.gokoco_product_prices from anon, authenticated;
grant all on public.gokoco_product_prices to service_role;
-- Sem acesso público direto: leitura pública filtrada e edição autenticada passam pelo Worker.
notify pgrst, 'reload schema';
