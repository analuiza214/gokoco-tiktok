-- Tabelas exclusivas da loja GOKOCO. Execute no SQL Editor do projeto Supabase.
create table if not exists public.gokoco_gateways (
  id text primary key check (id in ('ironpay','masterfy','umbrellapag','venuspay_pix')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.gokoco_orders (
  id uuid primary key default gen_random_uuid(),
  checkout_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text not null,
  document text not null,
  amount numeric(10,2) not null check (amount > 0),
  products jsonb not null default '[]',
  shipping jsonb not null default '{}',
  tracking jsonb not null default '{}',
  gateway text not null,
  client_ip_hash text,
  status text not null default 'creating',
  transaction_id text unique,
  pix_code text,
  qr_code text
);

create index if not exists gokoco_orders_created_at_idx on public.gokoco_orders (created_at desc);
create index if not exists gokoco_orders_status_idx on public.gokoco_orders (status);
create index if not exists gokoco_orders_rate_idx on public.gokoco_orders (client_ip_hash, created_at desc);

alter table public.gokoco_gateways enable row level security;
alter table public.gokoco_orders enable row level security;

-- Nenhuma policy pública: somente a chave secreta do servidor acessa os dados.
insert into public.gokoco_gateways (id, enabled) values
 ('ironpay', false), ('masterfy', false), ('umbrellapag', false), ('venuspay_pix', false)
on conflict (id) do nothing;
