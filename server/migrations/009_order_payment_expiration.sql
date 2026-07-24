alter table orders
  add column if not exists payment_expires_at timestamptz;

update orders
set payment_expires_at = created_at + interval '30 minutes'
where payment_expires_at is null
  and payment_provider = 'paydunya'
  and payment_status = 'pending';

update orders
set payment_expires_at = created_at + interval '24 hours'
where payment_expires_at is null
  and payment_provider = 'manual'
  and payment_status in ('pending', 'manual_review');

create index if not exists orders_payment_expires_at_idx
  on orders (payment_expires_at)
  where payment_status = 'pending';
