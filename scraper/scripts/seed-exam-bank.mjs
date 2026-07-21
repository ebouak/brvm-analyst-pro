// scraper/scripts/seed-exam-bank.mjs
// Seed academy_exam_questions : QCM des leçons (source=quiz) + questions inédites
// de synthèse (source=inedite). Idempotent (dédoublonnage par hash question+niveau).
// Usage : SUPABASE_URL=… KEY=<service_role> node scripts/seed-exam-bank.mjs
import crypto from 'node:crypto';

const U = process.env.SUPABASE_URL, K = process.env.KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !K) throw new Error('SUPABASE_URL / KEY manquants');
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex');

// Questions inédites de synthèse par niveau (rédigées ; complétables depuis
// git show b7c3d9d:frontend/public/academy/index.html — bloc QCM_DATA).
const INEDITES = {
  debutant: [
    { question: 'Quel est le rôle premier d’une SGI à la BRVM ?', options: ['Fixer les cours', 'Exécuter les ordres des investisseurs', 'Garantir les dividendes'], correct: 1, explication: 'La SGI est l’intermédiaire agréé qui transmet et exécute les ordres.' },
  ],
  intermediaire: [
    { question: 'Un PER faible peut être un piège quand…', options: ['le bénéfice est en baisse structurelle', 'l’action vient de monter', 'le dividende est élevé'], correct: 0, explication: 'Un PER optiquement bas sur un bénéfice qui s’effondre est un value trap.' },
  ],
  avance: [
    { question: 'Le ratio d’Amihud mesure…', options: ['la rentabilité', 'l’impact prix par unité de volume échangé', 'le rendement du dividende'], correct: 1, explication: 'Amihud = |variation| / valeur échangée : plus il est élevé, moins le titre est liquide.' },
  ],
  expert: [
    { question: 'Dans un DCF, une hausse du taux d’actualisation…', options: ['augmente la valeur', 'diminue la valeur actuelle des flux futurs', 'n’a aucun effet'], correct: 1, explication: 'Actualiser plus fort réduit la valeur présente des flux lointains.' },
  ],
};

async function main() {
  // 1) QCM des leçons par niveau.
  const courses = await (await fetch(`${U}/rest/v1/academy_courses?select=niveau,content&published=eq.true`, { headers: H })).json();
  const rows = [];
  for (const c of courses) {
    if (!c.niveau) continue;
    for (const l of (c.content?.lessons ?? [])) {
      const q = l.qcm;
      if (q && Array.isArray(q.options) && typeof q.correct === 'number') {
        rows.push({ niveau: c.niveau, question: q.question, options: q.options, correct: q.correct, explication: q.explication ?? '', source: 'quiz' });
      }
    }
  }
  // 2) Inédits.
  for (const [niveau, list] of Object.entries(INEDITES)) {
    for (const q of list) rows.push({ ...q, niveau, source: 'inedite' });
  }
  // 3) Dédoublonnage local par hash(niveau+question).
  const seen = new Set();
  const uniq = rows.filter((r) => { const h = hash(r.niveau + '|' + r.question); if (seen.has(h)) return false; seen.add(h); return true; });

  // 4) Existants (pour idempotence : on n’insère que les nouveaux).
  const existing = await (await fetch(`${U}/rest/v1/academy_exam_questions?select=niveau,question`, { headers: H })).json();
  const known = new Set((Array.isArray(existing) ? existing : []).map((e) => hash(e.niveau + '|' + e.question)));
  const toInsert = uniq.filter((r) => !known.has(hash(r.niveau + '|' + r.question)));

  if (toInsert.length === 0) { console.log('banque à jour, rien à insérer'); return; }
  const res = await fetch(`${U}/rest/v1/academy_exam_questions`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(toInsert) });
  console.log('insert:', res.status, '| nouvelles questions:', toInsert.length);
  const byNiveau = {};
  for (const r of uniq) byNiveau[r.niveau] = (byNiveau[r.niveau] ?? 0) + 1;
  console.log('total banque par niveau (après seed):', byNiveau);
}
main();
