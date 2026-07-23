-- Lien de confirmation client non devinable. La référence seule reste
-- lisible, mais ne suffit jamais à modifier le rendez-vous.
alter table bookings
  add column if not exists confirmation_token uuid;

update bookings
set confirmation_token = gen_random_uuid()
where confirmation_token is null;

alter table bookings
  alter column confirmation_token set default gen_random_uuid(),
  alter column confirmation_token set not null;

create unique index if not exists bookings_confirmation_token_idx
  on bookings (confirmation_token);
