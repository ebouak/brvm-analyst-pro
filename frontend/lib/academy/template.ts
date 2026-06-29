import {
  type CourseContent,
  NIVEAU_LABEL,
  CATEGORIE_LABEL,
  SECTION_LABEL,
} from './types';

/** Échappe le HTML — le contenu vient du LLM, jamais inséré brut. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Coupe un texte en paragraphes <p> à partir des sauts de ligne. */
function paras(s: string): string {
  return s
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
}

/** CSS charte WESTBOURSE — source unique (identique au flagship Academy). */
const CSS = `
:root{--bg:#030303;--surface:#0a1417;--surface2:#0f1f24;--text:#FCFCFC;--muted:#7a9ea8;--primary:#56D7FD;--border:rgba(86,215,253,.14);--radius:18px;--shadow:0 16px 40px rgba(0,0,0,.55);--accent:rgba(86,215,253,.10);--gold:#e0b341;--up:#3fe18b;--down:#ff6b6b}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Supreme','Satoshi',sans-serif;line-height:1.7}
a{color:var(--primary)}
.layout{display:grid;grid-template-columns:300px 1fr;min-height:100vh}
.sidebar{position:sticky;top:0;height:100vh;padding:22px 18px;background:linear-gradient(180deg,#0a1417,#050d10);border-right:1px solid var(--border);overflow-y:auto}
.main{padding:32px 36px;max-width:1100px}
.logo{font-family:'Bespoke Serif',serif;font-size:26px;font-weight:700;color:var(--primary);margin-bottom:4px;letter-spacing:-.02em}
.small{color:var(--muted);font-size:.86rem}
.nav-title{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:18px 0 6px 4px}
.nav a{display:block;text-decoration:none;color:var(--text);padding:8px 12px;border-radius:10px;margin:2px 0;font-size:.9rem;transition:background .15s,color .15s}
.nav a:hover{background:var(--accent);color:var(--primary);font-weight:600}
.hero{background:linear-gradient(135deg,#0a1f25,#050e11);border:1px solid var(--border);border-radius:28px;padding:36px;box-shadow:var(--shadow);margin-bottom:28px;position:relative;overflow:hidden}
.hero::after{content:'';position:absolute;top:-80px;right:-80px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(86,215,253,.12),transparent 70%)}
.hero h1{font-family:'Bespoke Serif',serif;font-size:clamp(2rem,4vw,3.4rem);line-height:1.06;margin:.1em 0 .3em}
.level-badge{display:inline-flex;align-items:center;gap:8px;padding:7px 15px;border-radius:999px;font-size:.8rem;font-weight:700;margin-bottom:16px;background:rgba(86,215,253,.12);color:#56D7FD;border:1px solid rgba(86,215,253,.25)}
.lesson{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:22px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.3);transition:box-shadow .2s,border-color .2s}
.lesson:hover{box-shadow:var(--shadow);border-color:rgba(86,215,253,.3)}
.lesson-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px}
.lesson h3{margin:.1rem 0 .5rem;font-size:1.18rem;font-weight:700;font-family:'Bespoke Serif',serif}
.tag{display:inline-block;padding:5px 12px;border-radius:999px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0;border:1px solid transparent}
.tag.general{background:rgba(86,215,253,.12);color:#56D7FD;border-color:rgba(86,215,253,.25)}
.tag.income{background:rgba(224,179,65,.12);color:#e0b341;border-color:rgba(224,179,65,.25)}
.tag.fundamental{background:rgba(110,168,255,.12);color:#6ea8ff;border-color:rgba(110,168,255,.25)}
.tag.technical{background:rgba(169,139,255,.12);color:#a98bff;border-color:rgba(169,139,255,.25)}
.tag.regulatory{background:rgba(224,179,65,.1);color:#d8a838;border-color:rgba(224,179,65,.22)}
.tag.evaluation{background:rgba(255,107,107,.12);color:#ff6b6b;border-color:rgba(255,107,107,.25)}
.summary{color:var(--text);margin:.4rem 0 .6rem;font-size:.96rem}
.section-block{margin-top:12px;padding:14px 16px;border-radius:12px;background:var(--surface2);border-left:3px solid var(--primary)}
.section-block h4{margin:0 0 7px;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--primary)}
.section-block p{margin:0 0 6px;font-size:.93rem;line-height:1.65}
.section-block p:last-child{margin-bottom:0}
.section-block.cas{border-left-color:var(--gold)}.section-block.cas h4{color:var(--gold)}
.section-block.piege{border-left-color:var(--down)}.section-block.piege h4{color:var(--down)}
.section-block.retenir{border-left-color:#a98bff}.section-block.retenir h4{color:#a98bff}
.section-block.lexique{border-left-color:#6ea8ff}.section-block.lexique h4{color:#6ea8ff}
.qcm-wrap{background:var(--surface2);border-radius:14px;padding:18px;margin-top:16px;border:1px solid var(--border)}
.qcm-q{font-weight:700;margin-bottom:12px;font-size:.95rem}
.qcm-opts{display:flex;flex-direction:column;gap:8px}
.qcm-opt{padding:10px 14px;border-radius:10px;border:1px solid var(--border);cursor:pointer;font-size:.9rem;background:var(--surface);transition:all .15s}
.qcm-opt:hover{border-color:var(--primary);background:var(--accent)}
.qcm-opt.correct{background:rgba(63,225,139,.14);border-color:#3fe18b;font-weight:700;color:#3fe18b}
.qcm-opt.wrong{background:rgba(255,107,107,.14);border-color:#ff6b6b;color:#ff6b6b}
.qcm-expl{margin-top:10px;padding:10px 14px;border-radius:10px;background:var(--accent);font-size:.88rem;color:var(--primary);font-weight:500;display:none}
.section-divider{font-family:'Bespoke Serif',serif;font-size:1.7rem;font-weight:700;margin:38px 0 16px;padding-bottom:10px;border-bottom:2px solid var(--border)}
.glossary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:16px}
.glos-item{padding:14px 16px;border-radius:12px;border:1px solid var(--border);background:var(--surface)}
.glos-item strong{color:var(--primary);display:block;margin-bottom:4px;font-size:.95rem}
.glos-item span{color:var(--muted);font-size:.88rem}
@media(max-width:980px){.layout{grid-template-columns:1fr}.sidebar{position:relative;height:auto;border-right:none;border-bottom:1px solid var(--border)}.glossary-grid{grid-template-columns:1fr}.main{padding:18px}}
`;

const FONTS = `<link href='https://api.fontshare.com/v2/css?f[]=bespoke-serif@400,700&f[]=supreme@400,500,700&display=swap' rel='stylesheet'>`;

/** Petit JS d'interactivité QCM (révèle bonne/mauvaise réponse au clic). */
const JS = `
document.querySelectorAll('.qcm-opt').forEach(function(opt){
  opt.addEventListener('click', function(){
    var wrap = opt.closest('.qcm-wrap');
    if (wrap.dataset.done) return;
    wrap.dataset.done = '1';
    var correct = wrap.dataset.correct;
    wrap.querySelectorAll('.qcm-opt').forEach(function(o){
      if (o.dataset.idx === correct) o.classList.add('correct');
      else if (o === opt) o.classList.add('wrong');
    });
    var expl = wrap.querySelector('.qcm-expl');
    if (expl) expl.style.display = 'block';
  });
});
`;

/**
 * Rend un cours Academy en document HTML autonome charté WESTBOURSE.
 * Pure fonction (testable, déterministe) — aucun I/O.
 */
export function renderCourseHtml(c: CourseContent): string {
  const navLessons = c.lessons
    .map((l, i) => `<a href="#lesson-${i}">${esc(l.titre)}</a>`)
    .join('');

  const lessonsHtml = c.lessons
    .map((l, i) => {
      const sections = l.sections
        .map(
          (s) =>
            `<div class="section-block ${s.type}"><h4>${esc(SECTION_LABEL[s.type] ?? s.titre)}</h4>${paras(s.contenu)}</div>`,
        )
        .join('');

      const qcm = l.qcm
        ? `<div class="qcm-wrap" data-correct="${l.qcm.correct}">
             <div class="qcm-q">${esc(l.qcm.question)}</div>
             <div class="qcm-opts">${l.qcm.options
               .map((o, oi) => `<div class="qcm-opt" data-idx="${oi}">${esc(o)}</div>`)
               .join('')}</div>
             <div class="qcm-expl">${esc(l.qcm.explication)}</div>
           </div>`
        : '';

      return `<div class="lesson" id="lesson-${i}">
        <div class="lesson-head">
          <h3>${esc(l.titre)}</h3>
          <span class="tag ${l.categorie}">${esc(CATEGORIE_LABEL[l.categorie] ?? l.categorie)}</span>
        </div>
        <p class="summary">${esc(l.resume)}</p>
        ${sections}
        ${qcm}
      </div>`;
    })
    .join('');

  const glossaire =
    c.glossaire && c.glossaire.length
      ? `<div class="section-divider" id="glossaire">📖 Glossaire</div>
         <div class="glossary-grid">${c.glossaire
           .map((g) => `<div class="glos-item"><strong>${esc(g.terme)}</strong><span>${esc(g.definition)}</span></div>`)
           .join('')}</div>`
      : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(c.titre)} — WestBourse Academy</title>
${FONTS}
<style>${CSS}</style>
</head>
<body>
<div class="layout">
  <aside class="sidebar">
    <div class="logo">WestBourse</div>
    <div class="small">Academy · ${esc(NIVEAU_LABEL[c.niveau])}</div>
    <div class="nav">
      <div class="nav-title">Leçons</div>
      ${navLessons}
      ${c.glossaire && c.glossaire.length ? '<div class="nav-title">Annexe</div><a href="#glossaire">Glossaire</a>' : ''}
    </div>
  </aside>
  <main class="main">
    <section class="hero">
      <div class="level-badge">Niveau ${esc(NIVEAU_LABEL[c.niveau])}</div>
      <h1>${esc(c.titre)}</h1>
      ${paras(c.intro)}
    </section>
    ${lessonsHtml}
    ${glossaire}
    <p class="small" style="margin-top:32px;border-top:1px solid var(--border);padding-top:14px">
      Contenu pédagogique généré par IA · WestBourse Academy. À titre informatif, ne constitue pas un conseil en investissement.
    </p>
  </main>
</div>
<script>${JS}</script>
</body>
</html>`;
}
