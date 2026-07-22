# LEAKS — Activer l'envoi WhatsApp automatique (API officielle Meta)

Le serveur envoie automatiquement les confirmations de rendez-vous et de
commande au client, ainsi qu'une copie privée au concierge. Les identifiants
Meta et les modèles approuvés doivent être présents dans l'environnement de
production.

---

## Étape 1 — Créer l'app Meta (une fois)

1. Allez sur **developers.facebook.com** → connectez-vous avec le compte
   Facebook/Meta de l'entreprise.
2. **My Apps → Create App** → type **Business** → nommez-la `LEAKS` →
   créez l'app.
3. Dans le tableau de bord de l'app, carte **WhatsApp** → **Set up**.
   Meta crée automatiquement un **numéro de test** gratuit.

## Étape 2 — Récupérer les deux identifiants

Dans **WhatsApp → API Setup** :

- **Temporary access token** → c'est `WHATSAPP_CLOUD_TOKEN`
  (valable 24 h — parfait pour tester ; voir Étape 5 pour le permanent)
- **Phone number ID** (sous le numéro de test) → c'est `WHATSAPP_PHONE_NUMBER_ID`

Toujours dans API Setup, section **To** : ajoutez votre propre numéro
(« Manage phone number list ») — en mode test, seuls les numéros
enregistrés peuvent recevoir.

## Étape 3 — Brancher LEAKS

Dans `.env` :

```
WHATSAPP_CLOUD_TOKEN=EAAG...votre-jeton
WHATSAPP_PHONE_NUMBER_ID=1239914522534675
WHATSAPP_BUSINESS_ACCOUNT_ID=821478214384181
META_GRAPH_VERSION=v25.0
WHATSAPP_CONCIERGE_NUMBER=2250173891404
WHATSAPP_TEMPLATE_BOOKING=leaks_confirmation_rdv
WHATSAPP_TEMPLATE_ORDER=leaks_confirmation_commande
WHATSAPP_TEMPLATE_BOOKING_UPDATE=leaks_suivi_rdv
WHATSAPP_TEMPLATE_ORDER_UPDATE=leaks_suivi_commande
WHATSAPP_TEMPLATE_CONCIERGE_ALERT=leaks_alerte_concierge
WHATSAPP_TEMPLATE_LANG=fr
```

Puis testez avec votre numéro :

```
npm run wa:ready
npm run wa:test -- 2250700000000
```

`wa:ready` vérifie le jeton, le numéro professionnel et l'abonnement webhook
sans afficher de secret. Si le message « LEAKS ✦ Votre essayage privé est retenu » arrive sur votre
WhatsApp : c'est branché. Toute réservation sur le site enverra désormais
les messages toute seule (l'écran du client dira « votre confirmation est
déjà dans votre WhatsApp »).

## Étape 4 — Le webhook (recommandé)

Pour recevoir les réponses des clients et les accusés de livraison :

1. Choisissez un mot de passe quelconque → `WHATSAPP_WEBHOOK_VERIFY_TOKEN=...`
   dans `.env`.
2. Copiez la **clé secrète de l'app** depuis Paramètres → Général dans
   `WHATSAPP_APP_SECRET`. Elle permet de vérifier cryptographiquement chaque
   événement envoyé par Meta.
3. Meta → WhatsApp → **Configuration** → Webhook :
   - Callback URL : `https://leaksthebrand.com/api/whatsapp/webhook`
   - Verify token : le même mot de passe
   - Abonnez le champ **messages**.

Contrôle final sur le VPS :

```
docker compose exec -T app npm run wa:ready -- --strict
```

Le mode strict exige : numéro lisible via Graph, cinq noms de modèles,
clé secrète, jeton de vérification et abonnement de l'app au compte WhatsApp.

## Étape 5 — Passer en production (quand le drop approche)

1. **Jeton permanent** : Business Settings → Users → **System Users** →
   créez-en un, générez un token avec la permission `whatsapp_business_messaging`.
   Remplacez `WHATSAPP_CLOUD_TOKEN`.
2. **Votre vrai numéro** : WhatsApp → API Setup → « Add phone number »
   (le numéro ne doit pas être déjà lié à une app WhatsApp classique).
   Mettez à jour `WHATSAPP_PHONE_NUMBER_ID`.
3. **Modèles de production** : WhatsApp Manager → Message templates. Les
   cinq modèles utilitaires utilisés par le serveur sont :

   - `leaks_confirmation_rdv` : confirmation client (date, heure, référence)
   - `leaks_confirmation_commande` : confirmation client (modèle, variation,
     référence, numéro de série, mode de réception)
   - `leaks_suivi_rdv` : confirmation manuelle et rappel de rendez-vous
   - `leaks_suivi_commande` : paire prête, expédiée ou livrée
   - `leaks_alerte_concierge` : copie privée envoyée au numéro du concierge

   Le modèle de rendez-vous contient :

   > LEAKS ✦ Votre essayage privé est retenu.
   >
   > {{1}} à {{2}} — LEAKS Studio, Abidjan.
   > Référence {{3}}.
   >
   > Pour toute modification, contactez votre concierge LEAKS.

   Une fois approuvé (quelques heures en général) :

   ```
   WHATSAPP_TEMPLATE_BOOKING=leaks_confirmation_rdv
   WHATSAPP_TEMPLATE_ORDER=leaks_confirmation_commande
   WHATSAPP_TEMPLATE_BOOKING_UPDATE=leaks_suivi_rdv
   WHATSAPP_TEMPLATE_ORDER_UPDATE=leaks_suivi_commande
   WHATSAPP_TEMPLATE_CONCIERGE_ALERT=leaks_alerte_concierge
   WHATSAPP_TEMPLATE_LANG=fr
   ```

   Sans template, Meta n'autorise l'envoi libre que dans les 24 h suivant
   un message du client ; avec le template, la confirmation part toujours.

## Étape 6 — Passer des 5 testeurs aux centaines de clients

La limite de 5 destinataires n'est pas payante : c'est le **mode test**.
On en sort en trois gestes, tous gratuits :

### 6.1 Enregistrer votre vrai numéro
WhatsApp → **API Setup** → « Étape 5 : Ajoutez un numéro de téléphone ».
⚠ Le numéro ne doit **pas** être connecté à l'app WhatsApp/WhatsApp
Business classique (déconnectez-le d'abord, ou prenez une SIM dédiée).
Une fois vérifié par SMS : la limite des 5 disparaît, remplacée par le
palier de départ (250 conversations/24 h).

### 6.2 Vérification d'entreprise (débloque les grands paliers)
**business.facebook.com** → Paramètres → Centre de sécurité →
**Démarrer la vérification**. Fournissez un document officiel
(registre de commerce, facture au nom de l'entreprise…). Gratuit,
quelques jours d'attente.

### 6.3 Les paliers montent tout seuls
250 → 1 000 → 10 000 → 100 000 → illimité conversations/jour.
La montée est automatique quand vous envoyez avec une bonne qualité
(pas de spam, clients qui répondent). Aucun paiement.

### Combien ça coûte à l'usage ?

Meta peut facturer les messages initiés par l'entreprise selon la catégorie du
modèle, le pays du destinataire et la fenêtre de service. Un moyen de paiement
est donc requis en production, même lorsque certains messages bénéficient d'un
tarif nul. Consultez toujours la grille Meta en vigueur avant un envoi massif.
