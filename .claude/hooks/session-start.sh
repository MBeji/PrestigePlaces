#!/bin/bash
# Prépare la session cloud : dépendances de l'application, base SQLite de développement, données.
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"
python3 -c "import openpyxl" 2>/dev/null || python3 -m pip install --quiet openpyxl >/dev/null 2>&1 || true
if [ -f app/package.json ] && [ "${PP_HOOK_SKIP_APP:-}" != "1" ]; then
  cd app
  npm install --no-audit --no-fund --loglevel=error
  if [ ! -f .env ] && [ -f .env.example ]; then cp .env.example .env; fi
  if grep -q '"db:push"' package.json; then npm run db:push --silent >/dev/null 2>&1 || npm run db:push; fi
  if grep -q '"db:seed"' package.json; then npm run db:seed --silent >/dev/null 2>&1 || npm run db:seed; fi
  cd ..
fi
echo "PrestigePlaces : environnement prêt"
