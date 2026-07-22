# LEAKS — Harness de mise en production

Le harness transforme une modification locale en release vérifiée sans toucher
manuellement à la base de données ni recopier les secrets.

## Flux quotidien depuis ce workspace

```bash
npm run deploy:production
```

Cette commande :

1. refuse un workspace non validé ;
2. exécute les tests et l'audit des dépendances de production ;
3. pousse exactement le commit testé sur `origin/main` ;
4. demande au VPS de créer une sauvegarde PostgreSQL privée ;
5. construit une image Docker identifiée par le SHA Git ;
6. redémarre l'application et attend `/health` ;
7. remet automatiquement l'image précédente si le contrôle échoue.

Le Mac doit connaître un hôte SSH `leaks-production`. La configuration SSH et
la clé sont installées une fois, sans mot de passe stocké dans le dépôt.

## Release directe depuis le VPS

```bash
cd /root/leaks-sunglasses
bash deploy/release.sh main
```

Les sauvegardes de release sont dans `/var/backups/leaks/releases`, permissions
privées. Les secrets restent uniquement dans `/root/leaks-sunglasses/.env`.

## Domaine et HTTPS

Après avoir pointé les enregistrements A `@` et `www` vers le VPS :

```bash
cd /root/leaks-sunglasses
bash deploy/domain-setup.sh leaksthebrand.com
```

Le script vérifie le DNS avant de démarrer Caddy, passe `PUBLIC_SITE_URL` en
HTTPS et rend le port applicatif 3000 local au VPS. Caddy renouvelle ensuite
automatiquement les certificats.

## WhatsApp

Contrôle non destructif :

```bash
docker compose exec -T app npm run wa:ready
```

Alignement guidé des identifiants et modèles (saisie masquée des secrets
manquants) :

```bash
bash deploy/whatsapp-configure.sh
```

Contrôle complet après la configuration Meta :

```bash
docker compose exec -T app npm run wa:ready -- --strict
docker compose exec -T app npm run wa:test -- 2250173891404
```

Le test envoie le vrai modèle `leaks_confirmation_rdv`. `hello_world` n'est
utilisable qu'avec les numéros de test publics de Meta :

```bash
docker compose exec -T app npm run wa:test -- 2250173891404 --hello-world
```

## Rollback manuel

Le script de release affiche le SHA précédent. Si une inspection métier impose
un retour après un health check pourtant vert :

```bash
APP_IMAGE_TAG=<sha-précédent> docker compose up -d --no-build app
```

Ne restaurez une sauvegarde SQL que si une analyse confirme que la base doit
elle aussi revenir en arrière.
