export const meta = {
  name: 'apply-hypotheses',
  description: 'Propage une instruction d’hypothèses (effectifs, externes, recrutements, réserve, zones) à data/hypotheses.json, la maquette, l’application et l’étude, avec routage du modèle par tâche',
  phases: [
    { title: 'Traduction', detail: 'instruction → modifications de data/hypotheses.json' },
    { title: 'Propagation', detail: 'régénération, tests, application' },
    { title: 'Étude', detail: 'mise à jour du miroir markdown' },
    { title: 'Contrôle', detail: 'revue adverse des chiffres' },
  ],
}
// args = { instruction: "texte de l'utilisateur" }
const route = t => (t === 'high' ? { model: 'opus', effort: 'high' } : t === 'low' ? { model: 'haiku', effort: 'low' } : { model: 'sonnet', effort: 'medium' })
const RESULT = { type: 'object', properties: { status: { type: 'string', enum: ['done', 'partial', 'blocked'] }, summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, checks: { type: 'string' }, notes: { type: 'string' } }, required: ['status', 'summary', 'files', 'checks'] }
const instruction = (args && args.instruction) || ''
if (!instruction) return { error: 'args.instruction manquant' }
const CTX = `Dépôt /home/user/PrestigePlaces. Lire CLAUDE.md et .claude/skills/hypotheses/SKILL.md avant d'agir. Source unique : data/hypotheses.json ; ne jamais éditer data/situation.json ni prototype/index.html à la main. Pas de commit (l'orchestrateur commite).`

phase('Traduction')
const r1 = route('medium'); log(`traduction → ${r1.model}`)
const translated = await agent(`${CTX}\nINSTRUCTION DE L'UTILISATEUR : « ${instruction} »\nTâche : traduis cette instruction en modifications précises de data/hypotheses.json (tableau de correspondance du skill), applique-les avec l'outil Edit, puis lance python3 -I scripts/apply_hypotheses.py et node scripts/test_prototype.js prototype/index.html. Rapporte les quotas avant/après par direction dans summary.`, { label: 'traduction', phase: 'Traduction', schema: RESULT, model: r1.model, effort: r1.effort })
if (!translated || translated.status === 'blocked') return { stoppedAt: 'traduction', translated }

phase('Propagation')
const r2 = route('medium'); log(`propagation → ${r2.model}`)
const propagated = await agent(`${CTX}\nHypothèses déjà appliquées : ${translated.summary}\nTâche : si app/ existe avec un package.json, exécute dans app/ : npm run db:seed, npm test ; corrige ce qui échoue à cause des nouvelles hypothèses (tests de référence à mettre à jour avec les nouveaux chiffres, jamais en supprimant un test). Vérifie la maquette avec NODE_PATH=/opt/node22/lib/node_modules node scripts/check_prototype.js prototype/index.html /tmp/pp-shots.`, { label: 'propagation', phase: 'Propagation', schema: RESULT, model: r2.model, effort: r2.effort })

phase('Étude')
const r3 = route('low'); log(`étude → ${r3.model}`)
const study = await agent(`${CTX}\nChiffres à jour : ${translated.summary}\nTâche : mets à jour docs/etude-dispatching.md (sections Synthèse, Analyse, Règles d'équité, Risques, Décisions de conception) avec ces chiffres, sans toucher au reste. Le document Claude en ligne sera mis à jour par l'orchestrateur.`, { label: 'etude', phase: 'Étude', schema: RESULT, model: r3.model, effort: r3.effort })

phase('Contrôle')
const r4 = route('high'); log(`contrôle → ${r4.model}`)
const review = await agent(`${CTX}\nInstruction initiale : « ${instruction} »\nRésumés : ${translated.summary}\n${propagated ? propagated.summary : ''}\n${study ? study.summary : ''}\nTâche : relis data/hypotheses.json, data/situation.json (groupes), prototype/index.html (via node scripts/test_prototype.js) et docs/etude-dispatching.md, et cherche toute incohérence de chiffres ou toute mauvaise interprétation de l'instruction. Corrige ce qui est faux. Rapporte ce qui a été corrigé et ce qui reste à arbitrer.`, { label: 'controle', phase: 'Contrôle', schema: RESULT, model: r4.model, effort: r4.effort })
return { translated, propagated, study, review }
