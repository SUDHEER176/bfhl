const devHosts = ['localhost', '127.0.0.1', ''];
const apiRoot  = devHosts.includes(location.hostname) ? 'http://localhost:3001' : 'https://bfhl-a65n.onrender.com';

const DEMO_INPUT = [
  "A->B", "A->C", "B->D", "C->E", "E->F",
  "X->Y", "Y->Z", "Z->X",
  "P->Q", "Q->R",
  "G->H", "G->H", "G->I",
  "hello", "1->2", "A->"
].join('\n');

const q = id => document.getElementById(id);

const inputBox   = q('input');
const btnSubmit  = q('submitBtn');
const btnClear   = q('clearBtn');
const btnExample = q('exampleBtn');
const errBox     = q('error');
const resultPane = q('results');
const btnCopy    = q('copyBtn');

function flashError(msg) {
  errBox.textContent = msg;
  errBox.classList.remove('hidden');
}
function clearError() { errBox.classList.add('hidden'); }

function toggleSpinner(active) {
  btnSubmit.disabled    = active;
  btnSubmit.textContent = active ? 'Working…' : 'Analyse →';
}

function splitInput(raw) {
  return raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
}

function makeTreeHTML(obj, depth = 0) {
  const pairs = Object.entries(obj);
  if (!pairs.length) return '';

  const rows = pairs.map(([label, subtree]) => {
    const hasChildren = Object.keys(subtree).length > 0;
    const styleClass  = depth === 0 ? 'node-root'
                      : hasChildren  ? 'node-mid'
                      :                'node-leaf';

    return `<li>
      <span class="tree-node">
        <span class="node-circle ${styleClass}">${label}</span>
        <span class="node-label">${hasChildren ? 'parent' : 'leaf'}</span>
      </span>
      ${hasChildren ? makeTreeHTML(subtree, depth + 1) : ''}
    </li>`;
  }).join('');

  return `<ul>${rows}</ul>`;
}

function makeHierarchyCard(h, autoOpen) {
  const isCycle  = !!h.has_cycle;
  const card     = document.createElement('div');
  card.className = 'h-item';

  const bodyContent = isCycle
    ? `<div class="cycle-msg">⟳ Cycle detected — no tree structure available.</div>`
    : `<div class="tree-view">${makeTreeHTML(h.tree)}</div>`;

  card.innerHTML = `
    <div class="h-header">
      <div class="h-badge ${isCycle ? 'cycle-badge' : 'tree-badge'}">${h.root}</div>
      <div class="h-meta">
        <div class="h-title">Root: <strong>${h.root}</strong></div>
        <div class="h-sub">${isCycle ? 'Cyclic group' : `Depth: ${h.depth}`}</div>
      </div>
      <span class="chip ${isCycle ? 'chip-cycle' : 'chip-tree'}">
        ${isCycle ? '⟳ Cycle' : `Depth ${h.depth}`}
      </span>
      <span class="chevron">▼</span>
    </div>
    <div class="h-body ${autoOpen ? 'open' : ''}">${bodyContent}</div>
  `;

  card.querySelector('.h-header').onclick = () =>
    card.querySelector('.h-body').classList.toggle('open');

  return card;
}

function fillTags(targetId, list, style) {
  const box = q(targetId);
  box.innerHTML = list.length
    ? list.map(t => `<span class="tag ${style}">${t}</span>`).join('')
    : '<span class="empty">None</span>';
}

function paintResponse(payload) {
  q('userId').textContent = payload.user_id;
  q('email').textContent  = payload.email_id;
  q('roll').textContent   = payload.college_roll_number;

  q('totalTrees').textContent  = payload.summary.total_trees;
  q('totalCycles').textContent = payload.summary.total_cycles;
  q('largestRoot').textContent = payload.summary.largest_tree_root || '—';

  const hContainer = q('hierarchies');
  hContainer.innerHTML = '';
  payload.hierarchies.forEach((h, i) =>
    hContainer.appendChild(makeHierarchyCard(h, i === 0))
  );

  fillTags('invalids', payload.invalid_entries, 'tag-warn');
  fillTags('dupes',    payload.duplicate_edges,  'tag-info');

  q('json').textContent = JSON.stringify(payload, null, 2);

  resultPane.classList.remove('hidden');
  resultPane.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function runQuery() {
  clearError();

  const lines = splitInput(inputBox.value);
  if (!lines.length) { flashError('Please enter at least one node edge.'); return; }

  toggleSpinner(true);
  try {
    const resp = await fetch(`${apiRoot}/bfhl`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ data: lines }),
    });
    if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
    paintResponse(await resp.json());
  } catch (err) {
    flashError(`API Error: ${err.message}. Make sure the server is running.`);
  } finally {
    toggleSpinner(false);
  }
}

btnSubmit.addEventListener('click', runQuery);

inputBox.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runQuery();
});

btnClear.addEventListener('click', () => {
  inputBox.value = '';
  resultPane.classList.add('hidden');
  clearError();
});

btnExample.addEventListener('click', () => {
  inputBox.value = DEMO_INPUT;
  clearError();
});

btnCopy.addEventListener('click', () => {
  navigator.clipboard.writeText(q('json').textContent).then(() => {
    btnCopy.textContent = 'Copied!';
    setTimeout(() => btnCopy.textContent = 'Copy', 2000);
  });
});
