-- Run only in the Supabase project that owns public.gokoco_gateways.
alter table public.gokoco_gateways
  drop constraint if exists gokoco_gateways_id_check;

alter table public.gokoco_gateways
  add constraint gokoco_gateways_id_check
  check (id in ('ironpay','masterfy','umbrellapag','venuspay_pix','flevopay'));

insert into public.gokoco_gateways (id, enabled)
values ('flevopay', false)
on conflict (id) do nothing;
