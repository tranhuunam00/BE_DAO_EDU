#!/usr/bin/env bash
set -Eeuo pipefail

BRANCH="${1:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCK_FILE="${TMPDIR:-/tmp}/dao-edu-api-deploy.lock"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "${NVM_DIR}/nvm.sh"
fi

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "Another DAO EDU deployment is already running."
  exit 1
fi

for command in git npm pm2 curl; do
  command -v "${command}" >/dev/null 2>&1 || {
    echo "Missing required command: ${command}"
    exit 1
  }
done

[[ -d "${REPOSITORY_ROOT}/.git" ]] || {
  echo "Git repository not found: ${REPOSITORY_ROOT}"
  exit 1
}

if [[ -n "$(git -C "${REPOSITORY_ROOT}" status --porcelain --untracked-files=no)" ]]; then
  echo "Tracked files have local changes: ${REPOSITORY_ROOT}"
  exit 1
fi

echo "Updating backend from origin/${BRANCH}..."
git -C "${REPOSITORY_ROOT}" fetch --prune origin "${BRANCH}"
git -C "${REPOSITORY_ROOT}" checkout "${BRANCH}"
git -C "${REPOSITORY_ROOT}" merge --ff-only "origin/${BRANCH}"

echo "Installing and building backend..."
cd "${REPOSITORY_ROOT}"
[[ -f .env ]] || {
  echo "Missing backend environment file: ${REPOSITORY_ROOT}/.env"
  exit 1
}
npm ci
npm run build

echo "Reloading backend with PM2..."
pm2 startOrReload ecosystem.config.cjs --env production --update-env
pm2 save

API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:5000/api}"

echo "Checking backend health..."
if ! curl \
  --fail \
  --silent \
  --show-error \
  --retry 15 \
  --retry-delay 2 \
  --retry-connrefused \
  "${API_HEALTH_URL}" >/dev/null; then
  echo "Backend health check failed. Recent PM2 logs:"
  pm2 logs dao-edu-api --lines 80 --nostream
  exit 1
fi

echo "Backend deployment completed successfully."
pm2 status
