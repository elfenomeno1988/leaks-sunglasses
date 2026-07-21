-- File d'attente de notifications WhatsApp (motif « outbox »).
-- Chaque événement écrit ici ; un worker envoie, réessaie avec recul
-- exponentiel, et le webhook Meta vient marquer delivered / read.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  recipient text not null,
  body text not null,
  reference text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  meta_message_id text,
  delivery_status text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists notifications_queue_idx
  on notifications (status, next_attempt_at)
  where status = 'queued';

create index if not exists notifications_meta_id_idx on notifications (meta_message_id);

-- Un même événement (genre + référence) ne part jamais deux fois.
create unique index if not exists notifications_dedup_idx
  on notifications (kind, reference)
  where reference is not null;
