# LEAKS Sunglasses — plateforme e-commerce & archive photo Drop 001

Plateforme complète pour vendre les montures LEAKS en Côte d'Ivoire : vitrine
archive basée sur `LEAKS PHOTOS.zip`, achat direct, checkout, paiement PayDunya,
suivi client et gestion des commandes.

## Architecture

- **Storefront** : HTML/CSS/JavaScript sans framework client, afin de conserver
  le design existant, rester rapide sur mobile et éviter une migration inutile.
- **Backend** : Node.js 22 + Fastify, portable sur un VPS ou n'importe quel
  hébergeur compatible Docker.
- **Données** : PostgreSQL 17. Les prix sont recalculés côté serveur ; aucun
  montant envoyé par le navigateur n'est considéré comme fiable.
- **Paiement** : API PayDunya « Paiement avec redirection » (PAR). Les canaux
  activés pour la Côte d'Ivoire sont Wave, Orange Money, MTN, Moov, Djamo et
  carte bancaire.
- **Validation** : l'IPN PayDunya est authentifiée par son hash SHA-512, puis le
  backend confirme à nouveau la facture auprès de PayDunya avant de marquer une
  commande payée.
- **Administration** : sessions serveur par cookie `HttpOnly`, commandes,
  filtres, chiffres clés, mise à jour du traitement et export CSV.

## Parcours client

1. « Acheter » depuis le hero, la sélection archive ou une carte produit.
2. Choix de la série / variante, quantité, retrait/livraison et coordonnées.
3. Paiement Wave direct, Mobile Money/Djamo, carte, ou commande WhatsApp Wave.
4. Redirection vers PayDunya, puis retour vers le suivi privé de commande.
5. Confirmation uniquement après vérification serveur du paiement.

Le bouton WhatsApp demandé dans le feedback audio reste disponible. Il crée
d'abord la commande dans le backoffice, puis ouvre un message Wave prérempli
avec la référence, l'article et le total.

## Installation locale

Prérequis : Node.js 22+, Docker et Docker Compose.

```bash
npm install
cp .env.example .env
docker compose up -d db
npm run db:migrate
npm run admin:create -- admin@leaks.ci 'un-mot-de-passe-long-et-unique'
npm run dev
```

Ouvrir ensuite :

- Boutique : `http://localhost:3000`
- Checkout : `http://localhost:3000/checkout`
- Administration : `http://localhost:3000/admin`
- Santé du service : `http://localhost:3000/health`

## Configuration PayDunya

1. Créer et activer un compte PayDunya Business.
2. Créer une application en mode test.
3. Copier dans `.env` la Master Key, la Private Key de test et le Token.
4. Garder `PAYDUNYA_MODE=test` pendant la recette.
5. Dans PayDunya, activer les canaux Côte d'Ivoire nécessaires.
6. Après validation complète, remplacer les clés par les clés live et définir
   `PAYDUNYA_MODE=live`.

`PUBLIC_SITE_URL` doit être une URL HTTPS publique pour que PayDunya puisse
appeler `/api/payments/paydunya/ipn`. En local, utiliser un tunnel HTTPS.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL |
| `COOKIE_SECRET` | Secret de signature des sessions, minimum 32 caractères |
| `PUBLIC_SITE_URL` | URL publique canonique, sans slash final |
| `PAYDUNYA_MODE` | `test` ou `live` |
| `PAYDUNYA_MASTER_KEY` | Clé principale PayDunya, serveur uniquement |
| `PAYDUNYA_PRIVATE_KEY` | Clé privée PayDunya, serveur uniquement |
| `PAYDUNYA_TOKEN` | Token de l'application PayDunya |
| `WHATSAPP_NUMBER` | Numéro du concierge au format international sans `+` |
| `DELIVERY_ABIDJAN_FEE` | Frais de livraison à Abidjan en XOF |

Ne jamais committer `.env` ni exposer les clés PayDunya dans le JavaScript du
navigateur.

## Déploiement portable

Le `Dockerfile` lance l'application complète. Fournir un PostgreSQL managé et
les variables ci-dessus, exécuter `npm run db:migrate`, puis lancer le conteneur.
Un reverse proxy doit terminer TLS et transmettre les requêtes au port 3000.

La plateforme ne dépend pas de Netlify : le storefront, l'API, les webhooks et
l'administration sont servis par le même conteneur Node.

## Structure

```text
index.html                     vitrine et réservation d'essayage
checkout.html                  checkout e-commerce
confirmation.html              suivi privé client
admin.html                     gestion des commandes
data/catalog.json              catalogue affiché et validé côté serveur
server/app.mjs                 serveur Fastify
server/routes/                 API boutique, paiement et administration
server/payments/paydunya.mjs   intégration PayDunya
server/migrations/             schéma PostgreSQL
server/scripts/                migrations et création d'administrateur
```
