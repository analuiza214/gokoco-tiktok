begin;
-- Run only in the Supabase project that owns public.gokoco_gateways.
alter table public.gokoco_gateways
  drop constraint if exists gokoco_gateways_id_check;

alter table public.gokoco_gateways
  add constraint gokoco_gateways_id_check
  check (id in ('ironpay','masterfy','umbrellapag','venuspay_pix','flevopay','invictuspay'));

insert into public.gokoco_gateways (id, enabled)
values ('invictuspay', false)
on conflict (id) do nothing;

insert into public.payment_gateways (id, name, method, enabled, updated_at)
values ('invictuspay', 'InvictusPay', 'pix', false, now())
on conflict (id) do nothing;

commit;
