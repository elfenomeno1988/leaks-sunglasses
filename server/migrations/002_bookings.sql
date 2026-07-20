create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  booking_date date not null,
  booking_time text not null
    check (booking_time in ('10:00','11:00','12:00','14:00','15:00','16:00','17:00','18:00')),
  customer_name text not null,
  customer_phone text not null,
  customer_note text,
  models jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'honored', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un créneau actif ne peut être tenu que par une seule réservation.
create unique index if not exists bookings_slot_active_idx
  on bookings (booking_date, booking_time)
  where status <> 'cancelled';

create index if not exists bookings_date_idx on bookings (booking_date desc, booking_time);
create index if not exists bookings_status_idx on bookings (status);

drop trigger if exists set_bookings_updated_at on bookings;
create trigger set_bookings_updated_at
before update on bookings
for each row execute function set_updated_at();
