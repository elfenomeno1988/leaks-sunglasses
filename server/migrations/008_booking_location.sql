-- L'essayage privé se déroule chez le client : l'adresse est obligatoire.
-- Les coordonnées restent optionnelles lorsque le client refuse la
-- géolocalisation, mais elles sont toujours enregistrées ensemble.
alter table bookings
  add column if not exists customer_address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table bookings
  drop constraint if exists bookings_location_coordinates_check;

alter table bookings
  add constraint bookings_location_coordinates_check check (
    (latitude is null and longitude is null)
    or (
      latitude between -90 and 90
      and longitude between -180 and 180
    )
  );
