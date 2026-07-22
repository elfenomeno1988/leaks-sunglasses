-- Éditions limitées : taille de l'édition figée sur la commande,
-- numéro de série attribué au paiement (unique par coloris).

alter table orders add column if not exists edition_size integer;
alter table orders add column if not exists serial_number integer;

create unique index if not exists orders_serial_idx
  on orders (product_id, variant_id, serial_number)
  where serial_number is not null;
