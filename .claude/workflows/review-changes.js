export const meta = {
  name: 'review-changes',
  description: 'Revue du diff courant de PrestigePlaces par dimensions (règles métier, correctness, sécurité, données personnelles), chaque constat vérifié par un agent adverse',
  phases: [{ title: 'Revue' }, { title: 'Vérification' }],
}
const FINDINGS = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, line: { type: 'integer' }, title: { type: 'string' }, detail: { type: 'string' }, severity: { type: 'string', enum: ['bloquant', 'important', 'mineur'] } }, required: ['file', 'title', 'detail', 'severity'] } } }, required: ['findings'] }
const VERDICT = { type: 'object', properties: { real: { type: 'boolean' }, reason: { type: 'string' } }, required: ['real', 'reason'] }
const DIMENSIONS = [
  { key: 'metier', model: 'opus', prompt: 'règles métier de CLAUDE.md : support hors équation, zone à libérer, postes fixes, quota ≥ postes fixes, arrondi, recrutements avec source' },
  { key: 'correctness', model: 'opus', prompt: 'bugs de logique, cas limites, erreurs de types, tests manquants' },
  { key: 'securite', model: 'opus', prompt: 'droits (requireRole), validation zod, injection, secrets, journalisation' },
  { key: 'donnees', model: 'sonnet', prompt: 'données personnelles : rien de nominatif dans le dépôt, hashage des matricules, gitignore' },
]
const results = await pipeline(DIMENSIONS,
  d => agent(`Dépôt /home/user/PrestigePlaces. Exécute git diff origin/claude/quirky-volta-30ojwb...HEAD (ou git diff HEAD~1 si la base n'existe pas) et relis le diff sous l'angle : ${d.prompt}. Rapporte uniquement des constats concrets avec fichier et ligne.`, { label: `revue:${d.key}`, phase: 'Revue', schema: FINDINGS, model: d.model }),
  (r, d) => parallel((r ? r.findings : []).map(f => () => agent(`Essaie de réfuter ce constat de revue sur /home/user/PrestigePlaces : ${f.title} — ${f.detail} (${f.file}:${f.line || '?'}). Lis le code réel. En cas de doute, real=false.`, { label: `verif:${d.key}`, phase: 'Vérification', schema: VERDICT, model: 'sonnet' }).then(v => ({ ...f, verdict: v })))),
)
const confirmed = results.flat().filter(Boolean).filter(f => f.verdict && f.verdict.real)
return { confirmed, total: results.flat().filter(Boolean).length }
