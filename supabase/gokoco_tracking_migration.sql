-- O rastreio da entrega usa o JSON `tracking` que já existe em gokoco_orders.
-- Esta migração mantém os pedidos atuais e garante os campos básicos sem
-- alterar os dados de atribuição de anúncios que também vivem nesse JSON.
alter table public.gokoco_orders
  add column if not exists tracking jsonb not null default '{}'::jsonb;

create index if not exists gokoco_orders_shipping_tracking_code_idx
  on public.gokoco_orders ((tracking #>> '{shipping,code}'))
  where status = 'paid';
