-- Les conversations initiees par LEAKS utilisent des modeles Meta approuves.
-- Le corps lisible reste stocke pour l'admin et sert de repli, tandis que
-- ces champs conservent le modele exact a envoyer par le worker.

alter table notifications
  add column if not exists template_name text,
  add column if not exists template_parameters jsonb;
