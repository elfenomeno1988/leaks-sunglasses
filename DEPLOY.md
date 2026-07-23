# LEAKS — Mise en production

Le projet est prêt pour des centaines de clients : serveur Fastify durci
(rate-limit, helmet, cache statique), Postgres migré automatiquement au
démarrage, notifications WhatsApp en file d'attente avec reprises, et
paiements PayDunya vérifiés côté serveur.

---

## Option A — Railway (recommandé : le plus simple)

1. **railway.app** → New Project → **Deploy from GitHub repo**
   (poussez d'abord le repo sur GitHub : `git remote add origin … && git push`).
   Railway détecte le `Dockerfile` tout seul.
2. **+ New → Database → PostgreSQL.** Railway crée la base et expose
   `DATABASE_URL` — référencez-la dans le service app
   (Variables → Add Reference → `DATABASE_URL`).
3. **Variables du service app** (Settings → Variables) :

   ```
   NODE_ENV=production
   PUBLIC_SITE_URL=https://votre-domaine.ci
   COOKIE_SECRET=<64 caractères aléatoires>
   PAYDUNYA_MODE=live
   PAYDUNYA_MASTER_KEY=…      # clés LIVE PayDunya
   PAYDUNYA_PRIVATE_KEY=…
   PAYDUNYA_TOKEN=…
   WHATSAPP_NUMBER=2250173891404
   DELIVERY_ABIDJAN_FEE=1000
   WHATSAPP_CLOUD_TOKEN=…     # jeton PERMANENT (voir GUIDE-WHATSAPP.md §5)
   WHATSAPP_PHONE_NUMBER_ID=…
   WHATSAPP_CONCIERGE_NUMBER=2250173891404
   WHATSAPP_TEMPLATE_BOOKING=leaks_confirmation_rdv
   WHATSAPP_TEMPLATE_ORDER=leaks_confirmation_commande
   WHATSAPP_TEMPLATE_BOOKING_UPDATE=leaks_suivi_rdv
   WHATSAPP_TEMPLATE_ORDER_UPDATE=leaks_suivi_commande
   WHATSAPP_TEMPLATE_CONCIERGE_ALERT=leaks_alerte_concierge
   WHATSAPP_TEMPLATE_LANG=fr
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=<mot de passe de votre choix>
   WHATSAPP_APP_SECRET=<Paramètres de l'app Meta → Général → Clé secrète>
   ```

4. **Domaine** : Settings → Networking → Custom Domain →
   `www.leaks-sunglasses.com` (ou autre) → ajoutez le CNAME chez votre
   registrar. HTTPS est automatique.
   Puis Meta for Developers → Paramètres de l'app → Général → URL de la
   politique de confidentialité : `https://votre-domaine/privacy.html`.
5. **Compte admin** : Railway → service app → Shell :
   `node server/scripts/create-admin.mjs admin@leaks.ci <mot-de-passe>`
6. Vérifiez `https://votre-domaine/health` → `{"ok":true}`.

---

## Option B — VPS Hostinger (pas-à-pas, ~20 min)

1. **hpanel.hostinger.com** → **VPS** → choisissez un **KVM 1** (suffisant :
   1 vCPU / 4 Go). Lors de la configuration, prenez le template
   **« Ubuntu 24.04 with Docker »** (sinon Ubuntu 24.04 simple — le script
   installera Docker). Notez le **mot de passe root** et l'**adresse IP**.
2. **DNS** : hPanel → Domaines → votre domaine → Zone DNS →
   ajoutez/modifiez l'enregistrement **A** : `@` → l'IP du VPS
   (et `www` → même IP). Propagation : quelques minutes à quelques heures.
3. **Connexion** : depuis le Terminal de votre Mac :
   `ssh root@IP_DU_VPS`
4. **Déploiement** :
   ```bash
   git clone https://github.com/elfenomeno1988/leaks-sunglasses.git
   cd leaks-sunglasses
   cp .env.example .env
   nano .env        # collez les valeurs de production (voir liste Option A)
   bash deploy/vps-setup.sh votre-domaine.ci
   ```
   Le script installe Docker s'il manque, lance l'app + Postgres,
   et met Caddy devant pour le HTTPS automatique.
5. **Compte admin** :
   `docker compose exec app node server/scripts/create-admin.mjs admin@leaks.ci <mot-de-passe>`
6. Vérifiez `https://votre-domaine.ci/health` → `{"ok":true}`.
   Utilisez ensuite `https://votre-domaine.ci/privacy.html` comme URL de
   politique de confidentialité dans Meta for Developers → Paramètres → Général.
   Ensuite, webhook Meta + PayDunya live + numéro WhatsApp réel :
   voir « Après le premier déploiement » ci-dessous.

Mises à jour futures depuis ce workspace : `npm run deploy:production`.
Le harness teste, pousse, sauvegarde PostgreSQL, construit une image immuable,
contrôle `/health` et remet l'image précédente si nécessaire. Voir
[`deploy/HARNESS.md`](deploy/HARNESS.md).

---

## Après le premier déploiement (15 min, une seule fois)

1. **Webhook Meta** — developers.facebook.com → WhatsApp → Configuration :
   - Callback URL : `https://votre-domaine/api/whatsapp/webhook`
   - Verify token : la valeur de `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - Champ abonné : **messages**.
   - `WHATSAPP_APP_SECRET` doit contenir la clé secrète de l'app Meta ; le
     serveur refuse en production tout webhook dont la signature est absente.
   Dès lors, les accusés (délivré / lu) remplissent la colonne
   `delivery_status` des notifications.
2. **Templates WhatsApp** — vérifiez que les cinq modèles LEAKS listés dans
   GUIDE-WHATSAPP.md §5 sont `Actif`. Ils couvrent confirmations, rappels,
   suivi de commande et alertes concierge hors de la fenêtre de 24 h.
3. **PayDunya** — passez `PAYDUNYA_MODE=live` avec les clés live, et
   déclarez l'IPN : `https://votre-domaine/api/payments/paydunya/ipn`.
4. **Numéro réel** — remplacez le numéro de test Meta par le numéro
   business vérifié (GUIDE-WHATSAPP.md §5) : la limite des 5 destinataires
   saute, l'envoi devient illimité (facturation Meta par conversation).

## Ce que « grande échelle » veut dire ici

- **File d'attente** : chaque message (confirmation, alerte, rappel,
  commande payée / prête / expédiée / livrée) est écrit en base puis envoyé
  par un worker — reprises exponentielles (1, 2, 4… 6 h, 12 essais),
  aucun envoi ne bloque une requête client, aucun doublon possible
  (dédoublonnage par référence).
- **Rappels automatiques** : le matin du rendez-vous, chaque client reçoit
  son rappel — sans intervention.
- **Traçabilité** : `select kind, status, delivery_status, count(*) from
  notifications group by 1,2,3;` — l'état de chaque message, envoyé, délivré, lu.
- **Statique en cache** : images immuables 7 jours, HTML toujours frais.
- Un seul conteneur tient largement des centaines de clients/jour ;
  Postgres managé fait le reste.
