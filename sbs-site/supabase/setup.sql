-- Run this ONCE in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz not null default now(),
  status text not null default 'pending_verification'
    check (status in ('pending_verification','in_progress','awaiting_balance','ready_to_ship','shipped','cancelled')),
  size text not null check (size in ('5R','A4')),
  framed boolean not null,
  template int not null,
  colors jsonb not null,
  items jsonb not null default '[]',
  calendar jsonb,
  customer_name text not null,
  ig text not null,
  recipient_name text not null,
  recipient_phone text not null,
  recipient_address text not null,
  is_gift boolean not null default false,
  tracking_pref text not null check (tracking_pref in ('show','surprise')),
  price_base int not null,
  price_extras jsonb,
  total int not null,
  downpayment int not null,
  balance int not null,
  preview_path text,
  photo_path text,
  proof_path text,
  tracking_number text,
  owner_note text
);

alter table public.orders enable row level security;

-- Anyone (a customer) can place an order, but only as "pending_verification".
drop policy if exists "customers can place orders" on public.orders;
create policy "customers can place orders" on public.orders
  for insert to anon with check (status = 'pending_verification' and tracking_number is null and owner_note is null);

-- Only you (logged in) can read, edit, delete orders.
drop policy if exists "owner reads" on public.orders;
create policy "owner reads" on public.orders for select to authenticated using (true);
drop policy if exists "owner updates" on public.orders;
create policy "owner updates" on public.orders for update to authenticated using (true) with check (true);
drop policy if exists "owner deletes" on public.orders;
create policy "owner deletes" on public.orders for delete to authenticated using (true);

-- Customers check their order with code + Instagram username. Returns only safe fields.
create or replace function public.order_status(p_code text, p_ig text)
returns table (code text, status text, size text, framed boolean, total int, downpayment int, balance int,
               tracking_pref text, tracking_number text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select o.code, o.status, o.size, o.framed, o.total, o.downpayment, o.balance, o.tracking_pref,
         case when o.tracking_pref = 'show' and o.status = 'shipped' then o.tracking_number end,
         o.created_at
  from public.orders o
  where o.code = upper(trim(p_code)) and lower(o.ig) = lower(trim(both '@' from trim(p_ig)))
  limit 1;
$$;
grant execute on function public.order_status(text, text) to anon, authenticated;

-- Private file storage (design, photo, payment proof)
insert into storage.buckets (id, name, public) values ('orders', 'orders', false) on conflict (id) do nothing;

drop policy if exists "customers upload files" on storage.objects;
create policy "customers upload files" on storage.objects
  for insert to anon with check (bucket_id = 'orders');
drop policy if exists "owner reads files" on storage.objects;
create policy "owner reads files" on storage.objects for select to authenticated using (bucket_id = 'orders');
drop policy if exists "owner deletes files" on storage.objects;
create policy "owner deletes files" on storage.objects for delete to authenticated using (bucket_id = 'orders');
