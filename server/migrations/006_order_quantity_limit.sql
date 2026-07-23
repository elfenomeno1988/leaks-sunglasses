alter table orders drop constraint if exists orders_quantity_check;

alter table orders add constraint orders_quantity_check
  check (quantity between 1 and 2) not valid;
