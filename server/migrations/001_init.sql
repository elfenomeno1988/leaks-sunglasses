create extension if not exists pgcrypto;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  tracking_token uuid not null default gen_random_uuid(),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'confirmed', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'cancelled', 'manual_review', 'refunded')),
  payment_method text not null
    check (payment_method in ('wave', 'mobile_money', 'card', 'all', 'whatsapp_wave')),
  payment_provider text not null default 'paydunya',
  provider_token text unique,
  payment_url text,
  provider_response jsonb not null default '{}'::jsonb,
  receipt_url text,
  product_id text not null,
  product_sku text not null,
  product_name text not null,
  variant_id text not null,
  variant_name text not null,
  unit_price integer not null check (unit_price > 0),
  quantity integer not null default 1 check (quantity between 1 and 3),
  delivery_method text not null check (delivery_method in ('pickup', 'abidjan_delivery')),
  delivery_fee integer not null default 0 check (delivery_fee >= 0),
  total_amount integer not null check (total_amount > 0),
  currency text not null default 'XOF' check (currency = 'XOF'),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  delivery_address text,
  customer_note text,
  admin_note text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists orders_payment_status_idx on orders (payment_status);
create index if not exists orders_status_idx on orders (status);

create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_sessions_expires_at_idx on admin_sessions (expires_at);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_orders_updated_at on orders;
create trigger set_orders_updated_at
before update on orders
for each row execute function set_updated_at();
