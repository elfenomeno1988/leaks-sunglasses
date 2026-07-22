# LEAKS — Ce qui reste avant le lancement public

Le site tourne (http://187.127.232.88:3000), la machinerie est finale.
Voici, sans détour, ce qui n'est PAS encore définitif et pourquoi ça compte.

| # | Point | Conséquence si ignoré | Remède |
|---|-------|----------------------|--------|
| 1 | Émetteur WhatsApp = +1 555 (numéro test Meta) | Les clients verraient « +1 555 Test Number » ; max 5 destinataires enregistrés | SIM +225 dédiée, jamais connectée à WhatsApp (~2 000 F) → GUIDE-WHATSAPP §6.1 |
| 2 | Réponses au numéro API invisibles | « Répondez à ce message » sans effet tant que le webhook n'est pas branché | Webhook → vient avec le domaine + HTTPS |
| 3 | Template `leaks_confirmation_rdv` non soumis | Sur le vrai numéro, premier message à un client hors fenêtre 24 h → refusé par Meta | Soumettre le template (GUIDE-WHATSAPP §5, gratuit, ~24 h d'approbation) |
| 4 | Vérification d'entreprise non faite | Nom « LEAKS » non affiché comme expéditeur ; palier bloqué à 250 conversations/jour | business.facebook.com → Centre de sécurité → document RCCM (gratuit) |
| 5 | App Meta « Non publiée » (mode développement) | L'envoi reste limité aux testeurs | Bouton « Publier » dans le tableau de bord Meta au moment du vrai numéro |
| 6 | Clés PayDunya en placeholders | Paiements Wave / Mobile Money / carte en ligne inactifs (seule la commande WhatsApp marche) | Clés live PayDunya dans le .env du VPS + IPN |
| 7 | Pas de domaine / HTTPS | URL http://IP:3000 peu crédible ; webhook Meta impossible (exige HTTPS) | Domaine → DNS A vers 187.127.232.88 → bash deploy/vps-setup.sh domaine |
| 8 | legal.html avec [À COMPLÉTER] | Mentions légales incomplètes | Raison sociale + RCCM à insérer |

## Ne JAMAIS faire
- Ne pas connecter le +225 01 73 89 14 04 (WhatsApp du concierge) à l'API Cloud :
  un numéro API est déconnecté de l'application WhatsApp — il resterait muet
  dans l'app. L'API a besoin de SON propre numéro.

## L'ordre conseillé
1. Domaine + HTTPS (débloque le webhook) 
2. SIM +225 → enregistrer chez Meta → publier l'app → template → vérification entreprise
3. PayDunya live
4. Mentions légales
