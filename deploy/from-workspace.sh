#!/usr/bin/env bash
# LEAKS — depuis le Mac : teste, publie main, puis lance le release VPS.
# Pré-requis : accès SSH configuré dans LEAKS_DEPLOY_HOST ou ~/.ssh/config.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEPLOY_HOST="${LEAKS_DEPLOY_HOST:-leaks-production}"
DEPLOY_BRANCH="${LEAKS_DEPLOY_BRANCH:-main}"
DEPLOY_PATH="${LEAKS_DEPLOY_PATH:-/root/leaks-sunglasses}"

[ -z "$(git status --porcelain)" ] || {
  echo "Le workspace contient des modifications non validées." >&2
  git status --short
  exit 1
}

echo "→ Tests"
npm test
echo "→ Audit dépendances de production"
npm audit --omit=dev

head_sha="$(git rev-parse HEAD)"
echo "→ Publication ${head_sha:0:7} sur origin/$DEPLOY_BRANCH"
git push origin "HEAD:$DEPLOY_BRANCH"

remote_sha="$(git ls-remote origin "refs/heads/$DEPLOY_BRANCH" | awk '{print $1}')"
[ "$remote_sha" = "$head_sha" ] || {
  echo "Le SHA distant ne correspond pas au commit testé." >&2
  exit 1
}

echo "→ Release VPS"
ssh -o BatchMode=yes "$DEPLOY_HOST" \
  "cd '$DEPLOY_PATH' && bash deploy/release.sh '$DEPLOY_BRANCH'"

echo "✔ Workspace → GitHub → production terminé."
