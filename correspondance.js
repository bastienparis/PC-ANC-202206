// ════════════════════════════════════════════════════════════
//   CORRESPONDANCE — ÉTAT
// ════════════════════════════════════════════════════════════

let corrActiveType    = 'all';
let corrActiveVersion = 'both'; // 'both' | 'old' | 'new'
let corrRendered      = false;
let corrSearchTimer   = null;

// ════════════════════════════════════════════════════════════
//   MÉTADONNÉES DES TYPES
// ════════════════════════════════════════════════════════════

const TYPE_META = {
  i: { label: 'Inchangé',        cls: 'badge-i' },
  l: { label: 'Libellé modifié', cls: 'badge-l' },
  n: { label: 'N° modifié',      cls: 'badge-n' },
  s: { label: 'Supprimé',        cls: 'badge-s' },
  r: { label: 'Répartition',     cls: 'badge-r' },
};

const CLASS_LABELS = {
  '1': 'Comptes de capitaux',
  '2': 'Comptes d\'immobilisations',
  '3': 'Comptes de stocks et en-cours',
  '4': 'Comptes de tiers',
  '5': 'Comptes financiers',
  '6': 'Comptes de charges',
  '7': 'Comptes de produits',
};

// ════════════════════════════════════════════════════════════
//   NAVIGATION PAR ONGLETS
// ════════════════════════════════════════════════════════════

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;

    // Activer l'onglet
    document.querySelectorAll('.tab-btn').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    document.querySelectorAll('.tab-view').forEach(v =>
      v.classList.remove('active')
    );
    document.getElementById('view-' + tab).classList.add('active');

    // Adapter le placeholder selon l'onglet (sans effacer la valeur)
    const searchInput = document.getElementById('search-input');
    const currentQ = searchInput.value.trim();
    searchInput.placeholder = tab === 'corr'
      ? 'Numéro ou libellé…'
      : 'Numéro ou libellé de compte…';

    if (tab === 'corr') {
      if (!corrRendered) {
        renderCorrespondance();
        corrRendered = true;
      }
      // Appliquer immédiatement la recherche en cours dans la vue correspondance
      filterCorrespondance(currentQ);
    } else {
      // Appliquer immédiatement la recherche en cours dans la vue plan
      runSearch(currentQ);
    }
  });
});

// ════════════════════════════════════════════════════════════
//   RENDU DU TABLEAU
// ════════════════════════════════════════════════════════════

function renderCorrespondance() {
  const body = document.getElementById('corr-body');
  const frag = document.createDocumentFragment();
  let lastClass = '';

  MAPPING.forEach(row => {
    const firstChar = row.nA.charAt(0);

    // Séparateur de classe quand le premier chiffre change
    if (/[1-7]/.test(firstChar) && firstChar !== lastClass) {
      const sep = document.createElement('div');
      sep.className   = 'corr-class-sep';
      sep.dataset.cls = firstChar;
      sep.innerHTML   =
        `<span class="corr-class-badge">Classe ${firstChar}</span>` +
        `<span class="corr-class-label">${CLASS_LABELS[firstChar] || ''}</span>`;
      frag.appendChild(sep);
      lastClass = firstChar;
    }

    // Ligne de correspondance
    const el  = document.createElement('div');
    el.className = `corr-row row-${row.t}`;
    el.dataset.type   = row.t;
    el.dataset.numOld = row.nA.toLowerCase();
    el.dataset.libOld = row.lA.toLowerCase();
    el.dataset.numNew = (row.nN || '').toLowerCase();
    el.dataset.libNew = (row.lN || '').toLowerCase();

    const meta = TYPE_META[row.t];

    // Numéro nouveau : cliquable si un compte PCG existe avec ce numéro
    let numNewHtml;
    if (!row.nN) {
      numNewHtml = '<span class="corr-num-new">—</span>';
    } else if (row.nN.includes(' ')) {
      // Cas répartition : "467 ou 468" — pas cliquable
      numNewHtml = `<span class="corr-num-new">${escC(row.nN)}</span>`;
    } else {
      numNewHtml =
        `<span class="corr-num-new clickable" data-num="${escC(row.nN)}">${escC(row.nN)}</span>`;
    }

    // Libellé nouveau
    let libNewHtml;
    if (row.t === 's' && !row.lN) {
      libNewHtml = '<em class="corr-deleted">Compte supprimé</em>';
    } else if (row.lN && row.lN.length > 80) {
      libNewHtml = `<span class="corr-lib-note">${escC(row.lN)}</span>`;
    } else {
      libNewHtml = row.lN ? escC(row.lN) : '—';
    }

    el.innerHTML =
      `<div class="corr-num">${escC(row.nA)}</div>` +
      `<div class="corr-lib">${escC(row.lA)}</div>` +
      `<div class="badge-cell"><span class="type-badge ${meta.cls}">${meta.label}</span></div>` +
      `<div>${numNewHtml}</div>` +
      `<div class="corr-lib-new">${libNewHtml}</div>`;

    // Clic sur le numéro nouveau → ouvre la modale du plan ANC 2022-06
    if (row.nN && !row.nN.includes(' ')) {
      el.querySelector('.corr-num-new.clickable')
        ?.addEventListener('click', () => openModalByNum(row.nN));
    }

    frag.appendChild(el);
  });

  body.appendChild(frag);
}

// ════════════════════════════════════════════════════════════
//   OUVRIR MODALE PAR NUMÉRO (pont vers le plan ANC 2022-06)
// ════════════════════════════════════════════════════════════

function findInPCG(num) {
  for (const cls of PCG.classes) {
    for (const sc of cls.sousclasses) {
      for (const acc of sc.comptes) {
        if (acc.num === num) return { acc, sc, cls };
      }
    }
  }
  return null;
}

function openModalByNum(num) {
  const found = findInPCG(num);
  if (!found) return;
  const { acc, sc, cls } = found;
  const comment = acc.comment || sc.comment;
  if (!comment) return;
  openModal({
    num: acc.num, lib: acc.lib,
    cls: { num: cls.num, lib: cls.lib },
    sc:  { num: sc.num,  lib: sc.lib  },
    comment,
    type: acc.comment ? 'account' : 'subclass',
  });
}

// ════════════════════════════════════════════════════════════
//   FILTRES TYPE (pills)
// ════════════════════════════════════════════════════════════

document.querySelectorAll('.pill-btn[data-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    corrActiveType = btn.dataset.type;
    document.querySelectorAll('.pill-btn[data-type]').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    filterCorrespondance();
  });
});

// ════════════════════════════════════════════════════════════
//   FILTRE VERSION (sélecteur segmenté)
// ════════════════════════════════════════════════════════════

document.querySelectorAll('.version-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    corrActiveVersion = btn.dataset.version;
    document.querySelectorAll('.version-btn').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    filterCorrespondance();
  });
});

// ════════════════════════════════════════════════════════════
//   CONNEXION À LA BARRE DE RECHERCHE PARTAGÉE
// ════════════════════════════════════════════════════════════

document.getElementById('search-input').addEventListener('input', function () {
  if (!document.getElementById('view-corr').classList.contains('active')) return;
  clearTimeout(corrSearchTimer);
  corrSearchTimer = setTimeout(() => {
    filterCorrespondance(this.value.trim());
  }, 120);
});

// ════════════════════════════════════════════════════════════
//   LOGIQUE DE FILTRAGE
// ════════════════════════════════════════════════════════════

function filterCorrespondance(q) {
  if (q === undefined) {
    q = document.getElementById('search-input').value.trim();
  }
  const lcq  = q.toLowerCase();
  const rows = document.querySelectorAll('#corr-body .corr-row');
  const seps = document.querySelectorAll('#corr-body .corr-class-sep');
  let visible = 0;

  rows.forEach(el => {
    // Filtre type
    const typeOk = corrActiveType === 'all' || el.dataset.type === corrActiveType;

    // Filtre recherche + version
    let searchOk = true;
    if (lcq) {
      const inOld = corrActiveVersion !== 'new';
      const inNew = corrActiveVersion !== 'old';
      const matchOld = inOld && (
        el.dataset.numOld.includes(lcq) ||
        el.dataset.libOld.includes(lcq)
      );
      const matchNew = inNew && (
        el.dataset.numNew.includes(lcq) ||
        el.dataset.libNew.includes(lcq)
      );
      searchOk = matchOld || matchNew;
    }

    const show = typeOk && searchOk;
    el.classList.toggle('hidden', !show);
    if (show) visible++;
  });

  // Masquer les séparateurs de classe sans lignes visibles
  seps.forEach(sep => {
    let next  = sep.nextElementSibling;
    let found = false;
    while (next && !next.classList.contains('corr-class-sep')) {
      if (next.classList.contains('corr-row') && !next.classList.contains('hidden')) {
        found = true;
        break;
      }
      next = next.nextElementSibling;
    }
    sep.classList.toggle('hidden', !found);
  });

  // No-results
  const noRes = document.getElementById('corr-no-results');
  const table = document.getElementById('corr-table');
  noRes.style.display = visible === 0 ? 'block' : 'none';
  table.style.display  = visible === 0 ? 'none'  : '';

  updateCorrStats(visible);
}

// ════════════════════════════════════════════════════════════
//   MISE À JOUR DE LA STATS-BAR
// ════════════════════════════════════════════════════════════

function updateCorrStats(visible) {
  const counts = { i: 0, l: 0, n: 0, s: 0, r: 0 };
  MAPPING.forEach(r => { if (counts[r.t] !== undefined) counts[r.t]++; });

  const total   = visible !== undefined ? visible : MAPPING.length;
  const modif   = counts.n + counts.l + counts.r;
  const supprim = counts.s;

  document.getElementById('stat-total').innerHTML =
    `<strong>${total.toLocaleString('fr-FR')}</strong> correspondance${total !== 1 ? 's' : ''}`;

  document.getElementById('stat-acc').innerHTML =
    `<span class="stat-dot" style="background:#f97316"></span>` +
    `<strong>${modif}</strong> compte${modif !== 1 ? 's' : ''} modifiés`;

  document.getElementById('stat-sc').innerHTML =
    `<span class="stat-dot" style="background:#ef4444"></span>` +
    `<strong>${supprim}</strong> compte${supprim !== 1 ? 's' : ''} supprimés`;
}

// ════════════════════════════════════════════════════════════
//   HELPER : ÉCHAPPEMENT HTML (local, sans dépendance à esc())
// ════════════════════════════════════════════════════════════

function escC(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
