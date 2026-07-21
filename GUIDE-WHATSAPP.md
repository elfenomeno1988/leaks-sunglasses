# LEAKS — Activer l'envoi WhatsApp automatique (API officielle Meta)

Le serveur sait déjà tout faire : dès qu'une réservation est créée, il envoie
la confirmation au client et l'alerte au concierge. Il ne lui manque que
**deux identifiants**, que seul le propriétaire du compte peut créer.
Comptez ~10 minutes.

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
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_CONCIERGE_NUMBER=2250173891404
```

Puis testez avec votre numéro :

```
npm run wa:test -- 2250700000000
```

Si le message « LEAKS ✦ Votre essayage privé est retenu » arrive sur votre
WhatsApp : c'est branché. Toute réservation sur le site enverra désormais
les messages toute seule (l'écran du client dira « votre confirmation est
déjà dans votre WhatsApp »).

## Étape 4 — Le webhook (recommandé)

Pour recevoir les réponses des clients et les accusés de livraison :

1. Choisissez un mot de passe quelconque → `WHATSAPP_WEBHOOK_VERIFY_TOKEN=...`
   dans `.env`.
2. Meta → WhatsApp → **Configuration** → Webhook :
   - Callback URL : `https://votre-domaine/api/whatsapp/webhook`
   - Verify token : le même mot de passe
   - Abonnez le champ **messages**.

## Étape 5 — Passer en production (quand le drop approche)

1. **Jeton permanent** : Business Settings → Users → **System Users** →
   créez-en un, générez un token avec la permission `whatsapp_business_messaging`.
   Remplacez `WHATSAPP_CLOUD_TOKEN`.
2. **Votre vrai numéro** : WhatsApp → API Setup → « Add phone number »
   (le numéro ne doit pas être déjà lié à une app WhatsApp classique).
   Mettez à jour `WHATSAPP_PHONE_NUMBER_ID`.
3. **Template de confirmation** : WhatsApp Manager → Message templates →
   créez `leaks_confirmation_rdv`, langue **fr**, catégorie **Utility**, corps :

   > LEAKS ✦ Votre essayage privé est retenu.
   >
   > {{1}} à {{2}} — LEAKS Studio, Abidjan.
   > Référence {{3}}.
   >
   > Un empêchement, une envie particulière ? Répondez à ce message —
   > votre concierge vous lit.

   Une fois approuvé (quelques heures en général) :

   ```
   WHATSAPP_TEMPLATE_BOOKING=leaks_confirmation_rdv
   WHATSAPP_TEMPLATE_LANG=fr
   ```

   Sans template, Meta n'autorise l'envoi libre que dans les 24 h suivant
   un message du client ; avec le template, la confirmation part toujours.

---

**Pourquoi je ne peux pas le faire à votre place :** la création du compte
et des jetons passe par votre identité Meta (connexion Facebook, vérification
d'entreprise). Tout le reste — l'envoi, les messages, le webhook, la reprise
wa.me en cas de panne — est déjà codé et actif.

---

## Étape 6 — Passer des 5 testeurs aux centaines de clients (gratuit)

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
- Réponses aux clients dans les 24 h : **gratuites, illimitées**
- Confirmations/rappels (« utility ») dans la fenêtre de 24 h : **gratuits**
- Hors fenêtre : template requis, facturé quelques centimes de F CFA —
  et Meta offre 1 000 conversations de service par mois.
Pour LEAKS (dizaines de RDV/commandes par jour) : **coût ≈ 0**.
