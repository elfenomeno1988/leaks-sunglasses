# LEAKS — état réel du lancement

Le site public est servi sur `https://leaksthebrand.com`. Le catalogue,
la réservation, le parcours de commande WhatsApp, le suivi privé et le
tableau d’administration sont hébergés sur le VPS Hostinger.

## Prêt côté site

- Domaine et HTTPS actifs.
- Catalogue synchronisé : 12 montures, 2 accessoires, prix et images vérifiés.
- Commandes ouvertes à partir du 24.07.2026.
- Deux exemplaires maximum par coloris, avec stock bloqué côté serveur contre
  les achats simultanés.
- Quantité maximale de deux articles par commande.
- Livraison à Abidjan : 1 000 F CFA, offerte pour LEAKS Exclusive.
- Réservation sur créneaux uniques, numéro ivoirien normalisé et repli WhatsApp.
- Pages confidentialité et mentions légales publiques, sans texte provisoire.
- Affichage vérifié sous Chromium, WebKit/Safari et mobile.

## Dépendances externes encore à surveiller

| Point | État constaté | Effet |
|---|---|---|
| Modèles WhatsApp Meta | Les cinq noms sont configurés ; leur approbation finale reste pilotée par Meta | Tant qu'un modèle n'est pas `APPROVED`, le site ouvre automatiquement une carte WhatsApp préremplie au lieu de prétendre que le message a été livré |
| Signature du webhook Meta | L'URL publique existe ; `WHATSAPP_APP_SECRET` doit être présent en production | Sans secret, les événements entrants signés ne sont pas activés |
| PayDunya live | Non activé sur la dernière vérification publique | Le site masque Wave/Mobile Money/carte et conserve le parcours WhatsApp |
| Vérification de l'entreprise Meta | Décision externe à Meta Business | Peut limiter le nom affiché et les paliers de messagerie |

## Règle de sécurité du numéro

Ne pas connecter le +225 01 73 89 14 04, utilisé par le concierge dans
l'application WhatsApp, à l'API Cloud. Le numéro API Business reste séparé
afin que le numéro personnel continue de recevoir les messages dans l'app.
