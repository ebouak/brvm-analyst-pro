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
    { question: 'Un RSI(14) à 78 sur un titre BRVM signale…', options: ['une zone de surachat : la hausse récente a été rapide', 'un signal d’achat immédiat', 'que le titre va forcément baisser'], correct: 0, explication: 'Au-dessus de 70, le RSI indique un surachat : tension acheteuse élevée, pas une prédiction de baisse certaine.' },
    { question: 'Le croisement de la MA20 AU-DESSUS de la MA50 est généralement lu comme…', options: ['un signal de retournement baissier', 'un régime haussier qui s’installe', 'un signe d’illiquidité'], correct: 1, explication: 'Quand la moyenne courte passe au-dessus de la longue, la dynamique récente domine : régime haussier.' },
    { question: 'Une cassure de résistance est plus crédible quand elle s’accompagne…', options: ['d’un volume nettement supérieur à la moyenne', 'd’un volume nul', 'd’un dividende'], correct: 0, explication: 'Le volume valide la conviction : une cassure sans volume est souvent un faux signal.' },
    { question: 'Le MACD devient positif quand…', options: ['la moyenne courte dépasse la moyenne longue (dynamique haussière)', 'le cours touche son plus bas annuel', 'le PER dépasse 15'], correct: 0, explication: 'MACD = EMA12 − EMA26 : positif quand la tendance courte accélère au-dessus de la longue.' },
    { question: 'Sur un marché de fixing comme la BRVM, un « support » est…', options: ['une zone de prix où la demande a historiquement absorbé les ventes', 'le prix garanti par la bourse', 'la commission de la SGI'], correct: 0, explication: 'Support = zone où les acheteurs se sont montrés présents ; rien n’y est garanti.' },
    { question: 'L’estimateur de Roll approxime…', options: ['le spread implicite à partir des alternances de prix', 'le bénéfice par action', 'la volatilité annuelle'], correct: 0, explication: 'Roll utilise la covariance négative des variations successives pour estimer le coût d’aller-retour.' },
    { question: 'Un titre qui traite 95 % des séances mais 2 M FCFA/séance est…', options: ['très liquide', 'régulier mais peu profond : un gros ordre déplacera le cours', 'en défaut'], correct: 1, explication: 'La fréquence ne suffit pas : la profondeur (valeur échangée) fait la vraie liquidité.' },
    { question: 'Après +25 % en 3 semaines, un repli de 4 % avec RSI qui retombe de 85 à 69 est typiquement…', options: ['un krach', 'une correction saine qui détend la tension', 'une suspension de cotation'], correct: 1, explication: 'La respiration réduit le surachat sans casser la structure haussière tant que les supports tiennent.' },
    { question: 'Le « niveau d’invalidation » d’un scénario technique haussier est…', options: ['le prix sous lequel le scénario est abandonné', 'l’objectif de cours', 'le cours d’introduction'], correct: 0, explication: 'Sous ce niveau, la lecture haussière est invalidée : on coupe plutôt que d’espérer.' },
    { question: 'Les bandes de Bollinger s’écartent fortement quand…', options: ['la volatilité augmente', 'le volume baisse', 'le dividende est détaché'], correct: 0, explication: 'Les bandes = moyenne ± k·écart-type : elles s’élargissent avec la volatilité.' },
    { question: 'Un flux net vendeur (tick rule) de −80 % sur une séance signifie…', options: ['que 80 % du volume directionnel est passé sur des baisses de cours', 'que le titre a perdu 80 %', 'que 80 % des ordres ont été annulés'], correct: 0, explication: 'Le tick rule classe le volume selon le sens du cours au moment où il passe : ici pression vendeuse dominante.' },
  ],
  expert: [
    { question: 'Dans un DCF, une hausse du taux d’actualisation…', options: ['augmente la valeur', 'diminue la valeur actuelle des flux futurs', 'n’a aucun effet'], correct: 1, explication: 'Actualiser plus fort réduit la valeur présente des flux lointains.' },
    { question: 'La valeur terminale d’un DCF est très sensible à…', options: ['l’écart entre taux d’actualisation et croissance perpétuelle (g)', 'la commission de courtage', 'la date de l’assemblée générale'], correct: 0, explication: 'VT = FCF×(1+g)/(r−g) : quand r−g se resserre, la valeur explose — d’où la prudence sur g.' },
    { question: 'Pour valoriser une banque, on privilégie généralement…', options: ['l’EV/EBITDA', 'le P/B et le ROE (rentabilité des fonds propres)', 'le ratio de stock'], correct: 1, explication: 'La dette d’une banque est sa matière première : les multiples d’entreprise classiques ne s’appliquent pas ; P/B vs ROE fait référence.' },
    { question: 'Un ROE de 18 % avec un levier (actifs/fonds propres) de 12 chez une banque signifie…', options: ['une rentabilité portée en partie par le levier — à comparer au coût du risque', 'une fraude', 'un rendement du dividende de 18 %'], correct: 0, explication: 'Décomposer le ROE (DuPont) évite de confondre performance opérationnelle et simple effet de levier.' },
    { question: 'Le coût des fonds propres (Ke) sur un marché frontière comme l’UEMOA inclut typiquement…', options: ['une prime de risque pays en plus de la prime de marché', 'uniquement le taux BCEAO', 'le taux d’inflation seul'], correct: 0, explication: 'Ke = taux sans risque + β×prime marché + prime pays : le risque frontière se paie.' },
    { question: 'Une décote de holding se justifie par…', options: ['les frais de structure, la fiscalité intercalaire et la moindre liquidité', 'une erreur de marché à arbitrer sans risque', 'l’absence de dividende'], correct: 0, explication: 'La somme des parts vaut rarement le prix du holding : frictions réelles, pas anomalie gratuite.' },
    { question: 'Le duration d’une obligation mesure…', options: ['sa sensibilité aux variations de taux', 'son rendement courant', 'sa probabilité de défaut'], correct: 0, explication: 'Duration ≈ élasticité du prix au taux : plus elle est longue, plus le prix bouge quand les taux bougent.' },
    { question: 'Si les taux BCEAO montent de 100 bps, une obligation UEMOA de duration 6 voit son prix…', options: ['baisser d’environ 6 %', 'monter d’environ 6 %', 'rester inchangé'], correct: 0, explication: 'ΔPrix ≈ −Duration × ΔTaux : 6 × 1 % ≈ −6 %.' },
    { question: 'Le rendement « vrai » d’un dividende BRVM pour un résident se calcule…', options: ['net d’IRVM à la source ET déflaté de l’inflation UEMOA', 'brut affiché divisé par le cours', 'en ajoutant la plus-value espérée'], correct: 0, explication: 'Impôt à la source puis inflation : c’est le pouvoir d’achat réellement gagné qui compte.' },
    { question: 'Un backtest long-only qui bat l’indice AVEC des frais ignorés et 30 titres illiquides est…', options: ['probablement irréaliste : coûts d’exécution et impact prix non modélisés', 'une preuve de stratégie gagnante', 'toujours reproductible en réel'], correct: 0, explication: 'Sur un marché peu profond, slippage et spread mangent l’alpha théorique : un backtest honnête les intègre.' },
    { question: 'Dans une somme des parties (SOTP), le principal risque méthodologique est…', options: ['compter deux fois des actifs ou oublier les dettes croisées', 'utiliser des multiples', 'convertir en FCFA'], correct: 0, explication: 'Les participations croisées et dettes intra-groupe faussent vite une SOTP mal réconciliée.' },
    { question: 'Un PER de 5 sur un bénéfice dopé par un élément exceptionnel (cession) est…', options: ['un signal d’achat évident', 'trompeur : il faut normaliser le bénéfice récurrent', 'impossible'], correct: 1, explication: 'Le multiple doit porter sur la capacité bénéficiaire récurrente, pas sur un one-off.' },
    { question: 'La prime de contrôle payée lors d’une OPA rémunère…', options: ['la capacité à décider (synergies, gouvernance), absente d’une ligne minoritaire', 'le droit au dividende', 'la liquidité du titre'], correct: 0, explication: 'Contrôler l’allocation du capital vaut plus que suivre : d’où l’écart avec le cours minoritaire.' },
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
