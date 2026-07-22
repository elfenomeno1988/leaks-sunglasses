# LEAKS — État réel avant le lancement public

Le site tourne sur le VPS (http://187.127.232.88:3000). Le numéro WhatsApp
Business +225 07 18 68 25 37, le jeton serveur permanent et le moyen de
paiement Meta sont configurés. Voici les derniers verrous externes.

| # | Point | Conséquence si ignoré | Remède |
|---|-------|----------------------|--------|
| 1 | 5 modèles WhatsApp en cours d'examen le 22/07/2026 | Les messages initiés par LEAKS attendent leur activation | Attendre l'examen Meta, annoncé jusqu'à 24 h ; contrôler `Actif` dans le Gestionnaire WhatsApp |
| 2 | Webhook public non branché | Les réponses et accusés délivré/lu ne remontent pas au tableau de bord | Domaine + HTTPS, puis URL `/api/whatsapp/webhook` chez Meta |
| 3 | Vérification d'entreprise éligible mais non démarrée | Nom « LEAKS » et augmentation des paliers peuvent rester limités | Meta demande nom, adresse, téléphone, e-mail, site web et éventuellement un document officiel |
| 4 | App Meta `Non publiée` | Le bouton Publier reste désactivé sans URL de confidentialité | `privacy.html` est prêt ; après HTTPS, saisir `https://domaine/privacy.html` dans Paramètres de l'app → Général |
| 5 | PayDunya live à confirmer | Le site masque automatiquement Wave/Mobile Money/carte si le mode live ou les clés manquent | `PAYDUNYA_MODE=live`, clés live, puis IPN public HTTPS |
| 6 | VPS inaccessible par SSH et HTTP intermittent le 22/07/2026 | La version publiée sur GitHub ne peut pas encore remplacer l'ancien build | Se connecter à hPanel, rétablir le VPS/SSH, puis `git pull && docker compose up -d --build` |
| 7 | `legal.html` contient `[À COMPLÉTER]` | Mentions légales incomplètes | Fournir raison sociale, RCCM et politique de retour réelles |

## Ne JAMAIS faire
- Ne pas connecter le +225 01 73 89 14 04 (WhatsApp du concierge) à l'API Cloud :
  un numéro API est déconnecté de l'application WhatsApp — il resterait muet
  dans l'app. L'API a besoin de SON propre numéro.

## L'ordre conseillé
1. Domaine + HTTPS (débloque webhook et IPN)
2. Vérifier l'activation des cinq modèles et le statut de l'app Meta
3. PayDunya live
4. Mentions légales et vérification d'entreprise
