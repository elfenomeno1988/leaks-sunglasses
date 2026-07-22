#!/usr/bin/env bash
# LEAKS — mise à jour de production sûre depuis le VPS.
# Usage : bash deploy/release.sh [branche]
set -Eeuo pipefail

BRANCH="${1:-main}"
REMOTE="${LEAKS_GIT_REMOTE:-origin}"
REPO_DIR="${LEAKS_REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKUP_DIR="${LEAKS_BACKUP_DIR:-/var/backups/leaks/releases}"
HEALTH_URL="${LEAKS_HEALTH_URL:-http://127.0.0.1:3000/health}"
HEALTH_ATTEMPTS="${LEAKS_HEALTH_ATTEMPTS:-30}"
HEALTH_DELAY="${LEAKS_HEALTH_DELAY:-2}"
FORCE_RELEASE="${LEAKS_FORCE_RELEASE:-0}"

cd "$REPO_DIR"

if command -v flock >/dev/null 2>&1; then
  exec 9>"${LEAKS_RELEASE_LOCK:-/var/lock/leaks-release.lock}"
  flock -n 9 || { echo "Une autre mise à jour LEAKS est déjà en cours." >&2; exit 1; }
fi

for command_name in git docker curl gzip; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Commande requise absente : $command_name" >&2
    exit 1
  }
done

[ -f .env ] || { echo "Fichier .env de production absent." >&2; exit 1; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || {
  echo "Le checkout contient des modifications suivies. Mise à jour refusée." >&2
  git status --short
  exit 1
}

current_branch="$(git symbolic-ref --quiet --short HEAD || true)"
[ "$current_branch" = "$BRANCH" ] || {
  echo "Branche VPS attendue : $BRANCH ; branche actuelle : ${current_branch:-détachée}." >&2
  exit 1
}

previous_sha="$(git rev-parse HEAD)"
git fetch "$REMOTE" "$BRANCH:refs/remotes/$REMOTE/$BRANCH"
target_sha="$(git rev-parse "$REMOTE/$BRANCH")"
configured_image_tag="$(awk -F= '$1 == "APP_IMAGE_TAG" {print $2; exit}' .env)"

if [ "$previous_sha" = "$target_sha" ] && [ "$configured_image_tag" = "$target_sha" ] && [ "$FORCE_RELEASE" != "1" ]; then
  echo "LEAKS est déjà sur ${target_sha:0:7}. Vérification de santé uniquement."
  curl -fsS "$HEALTH_URL"
  echo
  exit 0
fi

git merge-base --is-ancestor "$previous_sha" "$target_sha" || {
  echo "La mise à jour n'est pas un fast-forward ; intervention manuelle requise." >&2
  exit 1
}

umask 077
install -d -m 700 "$BACKUP_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="$BACKUP_DIR/pre-${previous_sha:0:7}-${stamp}.sql.gz"
echo "→ Sauvegarde PostgreSQL : $backup_path"
docker compose exec -T db pg_dump -U leaks leaks | gzip -9 > "$backup_path"
[ -s "$backup_path" ] || { echo "Sauvegarde vide ; déploiement annulé." >&2; exit 1; }

old_image="$(docker compose images -q app | head -n 1)"
if [ -n "$old_image" ]; then
  docker image tag "$old_image" "leaks-sunglasses-app:$previous_sha"
fi

echo "→ Code ${previous_sha:0:7} → ${target_sha:0:7}"
git merge --ff-only "$REMOTE/$BRANCH"

set_env() {
  local key="$1" value="$2" temporary
  temporary="$(mktemp "${TMPDIR:-/tmp}/leaks-env.XXXXXX")"
  awk -v key="$key" -v value="$value" '
    BEGIN { changed = 0 }
    index($0, key "=") == 1 { print key "=" value; changed = 1; next }
    { print }
    END { if (!changed) print key "=" value }
  ' .env > "$temporary"
  chmod --reference=.env "$temporary" 2>/dev/null || chmod 600 "$temporary"
  mv "$temporary" .env
}

set_env APP_IMAGE_TAG "$target_sha"

compose_profiles=()
if grep -Eq '^LEAKS_DOMAIN=.+$' .env; then
  compose_profiles=(--profile edge)
fi

echo "→ Construction de l'image immuable"
APP_IMAGE_TAG="$target_sha" docker compose "${compose_profiles[@]}" build --pull app
echo "→ Démarrage"
APP_IMAGE_TAG="$target_sha" docker compose "${compose_profiles[@]}" up -d --remove-orphans

healthy=0
for _ in $(seq 1 "$HEALTH_ATTEMPTS"); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep "$HEALTH_DELAY"
done

if [ "$healthy" -ne 1 ]; then
  echo "Échec du contrôle de santé. Derniers journaux :" >&2
  docker compose logs --tail=120 app >&2 || true
  if [ -n "$old_image" ]; then
    echo "→ Retour automatique à l'image ${previous_sha:0:7}" >&2
    set_env APP_IMAGE_TAG "$previous_sha"
    APP_IMAGE_TAG="$previous_sha" docker compose "${compose_profiles[@]}" up -d --no-build app
  fi
  echo "Sauvegarde disponible : $backup_path" >&2
  exit 1
fi

echo "→ Vérification publique locale"
curl -fsS "$HEALTH_URL"
echo
echo "✔ LEAKS ${target_sha:0:7} déployé."
echo "  Sauvegarde : $backup_path"
echo "  Retour image : APP_IMAGE_TAG=$previous_sha docker compose up -d --no-build app"
