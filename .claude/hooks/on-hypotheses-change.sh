#!/bin/bash
# PostToolUse (Write|Edit) : si data/hypotheses.json change, régénère situation.json, la maquette et la base de l'application.
set -uo pipefail
input="$(cat)"
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null || true)"
case "$file" in
  */data/hypotheses.json|data/hypotheses.json) ;;
  *) exit 0 ;;
esac
root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$root"
out="$(python3 -I scripts/apply_hypotheses.py 2>&1)" || { printf '%s\n' "$out" >&2; echo '{"systemMessage":"Hypothèses : échec de scripts/apply_hypotheses.py, voir la sortie."}'; exit 2; }
seed="non lancé (application absente ou dépendances non installées)"
if [ -f app/package.json ] && [ -d app/node_modules ] && [ "${PP_HOOK_SKIP_APP:-}" != "1" ] && grep -q '"db:seed"' app/package.json; then
  if (cd app && npm run db:seed --silent >/dev/null 2>&1); then seed="base de l'application réensemencée"; else seed="échec du réensemencement de l'application (npm run db:seed)"; fi
fi
summary="$(printf '%s' "$out" | head -8 | sed 's/"/\\"/g' | tr '\n' ' ')"
cat <<JSON
{"systemMessage":"Hypothèses appliquées : situation.json et prototype/index.html régénérés ; $seed.","hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"data/hypotheses.json a changé. Résultat de scripts/apply_hypotheses.py : $summary. Étapes restantes : vérifier ces quotas, republier la maquette (Artifact, url https://claude.ai/artifact/S5dwPRLWJgmsrA7WN6uZsA), mettre à jour l'étude (document Claude et docs/etude-dispatching.md), commiter et pousser."}}
JSON
