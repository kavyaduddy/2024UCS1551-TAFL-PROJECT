// ═══════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════
let faType        = 'DFA';
let states        = [];
let alphabet      = [];
let startState    = '';
let acceptStates  = [];
let transitions   = {};

let simSteps      = [];
let simPos        = 0;
let simChars      = [];
let visitedEdges  = new Set();
let visitedStates = new Set();

// Graph
let nodePos    = {};   // nodePos[state] = {x, y}
let graphScale = 1;
let graphOffX  = 0;
let graphOffY  = 0;
let isPanning  = false;
let panStart   = { x: 0, y: 0 };
let redrawTimer = null;

const NODE_R = 26;

// ═══════════════════════════════════════════════════════════════
//  BUILT-IN EXAMPLES
// ═══════════════════════════════════════════════════════════════
const EXAMPLES = [
  {
    id: 'ex1',
    name: 'Ends with 1',
    desc: 'Accepts binary strings ending in 1',
    tag: 'DFA · Σ={0,1}',
    type: 'DFA',
    states: ['q0','q1'],
    alphabet: ['0','1'],
    start: 'q0',
    accept: ['q1'],
    trans: {
      q0: { '0':'q0', '1':'q1' },
      q1: { '0':'q0', '1':'q1' }
    },
    testInput: '1011'
  },
  {
    id: 'ex2',
    name: 'Even number of 0s',
    desc: 'Accepts strings with even count of 0s',
    tag: 'DFA · Σ={0,1}',
    type: 'DFA',
    states: ['q0','q1'],
    alphabet: ['0','1'],
    start: 'q0',
    accept: ['q0'],
    trans: {
      q0: { '0':'q1', '1':'q0' },
      q1: { '0':'q0', '1':'q1' }
    },
    testInput: '0011'
  },
  {
    id: 'ex3',
    name: 'Starts with ab',
    desc: 'Accepts strings starting with "ab"',
    tag: 'DFA · Σ={a,b}',
    type: 'DFA',
    states: ['q0','q1','q2','dead'],
    alphabet: ['a','b'],
    start: 'q0',
    accept: ['q2'],
    trans: {
      q0:  { 'a':'q1',  'b':'dead' },
      q1:  { 'a':'dead','b':'q2'   },
      q2:  { 'a':'q2',  'b':'q2'   },
      dead:{ 'a':'dead','b':'dead' }
    },
    testInput: 'abba'
  },
  {
    id: 'ex4',
    name: 'Divisible by 3',
    desc: 'Accepts binary numbers divisible by 3',
    tag: 'DFA · Σ={0,1}',
    type: 'DFA',
    states: ['q0','q1','q2'],
    alphabet: ['0','1'],
    start: 'q0',
    accept: ['q0'],
    trans: {
      q0: { '0':'q0', '1':'q1' },
      q1: { '0':'q2', '1':'q0' },
      q2: { '0':'q1', '1':'q2' }
    },
    testInput: '110'
  },
  {
    id: 'ex5',
    name: 'Contains "ab"',
    desc: 'NFA — accepts strings containing "ab"',
    tag: 'NFA · Σ={a,b}',
    type: 'NFA',
    states: ['q0','q1','q2'],
    alphabet: ['a','b'],
    start: 'q0',
    accept: ['q2'],
    trans: {
      q0: { 'a':['q0','q1'], 'b':['q0'] },
      q1: { 'b':['q2'] },
      q2: { 'a':['q2'], 'b':['q2'] }
    },
    testInput: 'baab'
  },
  {
    id: 'ex6',
    name: 'Ends with 01',
    desc: 'NFA — accepts binary strings ending in 01',
    tag: 'NFA · Σ={0,1}',
    type: 'NFA',
    states: ['q0','q1','q2'],
    alphabet: ['0','1'],
    start: 'q0',
    accept: ['q2'],
    trans: {
      q0: { '0':['q0','q1'], '1':['q0'] },
      q1: { '1':['q2'] },
      q2: {}
    },
    testInput: '10001'
  }
];

let activeExId = null;

function renderExamples() {
  const grid = document.getElementById('examples-grid');
  grid.innerHTML = EXAMPLES.map(ex => `
    <button class="ex-btn${activeExId===ex.id?' active-ex':''}" onclick="loadExample('${ex.id}')">
      <span class="ex-name">${ex.name}</span>
      <span class="ex-desc">${ex.desc}</span>
      <span class="ex-tag">${ex.tag}</span>
    </button>
  `).join('');
}

function loadExample(id) {
  const ex = EXAMPLES.find(e => e.id === id);
  if (!ex) return;
  activeExId = id;

  // Reset everything
  states = []; alphabet = []; startState = ''; acceptStates = []; transitions = {};
  nodePos = {}; visitedEdges = new Set(); visitedStates = new Set();
  simSteps = []; simPos = 0; simChars = [];

  // Switch type
  faType = ex.type;
  document.getElementById('btn-dfa').classList.toggle('active', ex.type === 'DFA');
  document.getElementById('btn-nfa').classList.toggle('active', ex.type === 'NFA');
  document.getElementById('eps-btn').style.display = ex.type === 'NFA' ? '' : 'none';

  // Load data
  states       = [...ex.states];
  alphabet     = [...ex.alphabet];
  startState   = ex.start;
  acceptStates = [...ex.accept];

  // Deep copy transitions
  states.forEach(s => {
    transitions[s] = {};
    if (ex.trans[s]) {
      alphabet.forEach(sym => {
        if (ex.trans[s][sym] !== undefined) {
          transitions[s][sym] = Array.isArray(ex.trans[s][sym])
            ? [...ex.trans[s][sym]]
            : ex.trans[s][sym];
        }
      });
    }
  });

  // Set test input
  document.getElementById('input-string').value = ex.testInput;

  // Re-render everything
  renderStates();
  renderSymbols();
  rebuildTable();
  layoutGraph();
  scheduleRedraw();
  renderExamples();

  // Hide sim panels, show placeholder
  ['tape-card','states-card','controls-card','history-card'].forEach(id =>
    document.getElementById(id).style.display = 'none');
  document.getElementById('placeholder').style.display = '';
  document.getElementById('result').textContent = '';
  document.getElementById('result').className = 'result';
  document.getElementById('sim-hint').style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  renderExamples();
  setupPan();
  setTimeout(() => { layoutGraph(); drawGraph(); }, 120);
});
window.addEventListener('resize', () => scheduleRedraw());

// ═══════════════════════════════════════════════════════════════
//  TYPE TOGGLE
// ═══════════════════════════════════════════════════════════════
function setType(t) {
  faType = t;
  document.getElementById('btn-dfa').classList.toggle('active', t === 'DFA');
  document.getElementById('btn-nfa').classList.toggle('active', t === 'NFA');
  document.getElementById('eps-btn').style.display = t === 'NFA' ? '' : 'none';
  transitions = {};
  states.forEach(s => transitions[s] = {});
  rebuildTable();
  scheduleRedraw();
  resetSim();
}

// ═══════════════════════════════════════════════════════════════
//  STATES
// ═══════════════════════════════════════════════════════════════
function addState() {
  const inp = document.getElementById('state-input');
  const s = inp.value.trim();
  if (!s || states.includes(s)) { inp.focus(); return; }
  states.push(s);
  transitions[s] = {};
  inp.value = '';
  inp.focus();
  renderStates();
  rebuildTable();
  layoutGraph();
  scheduleRedraw();
  checkReady();
}

function removeState(s) {
  states = states.filter(x => x !== s);
  delete transitions[s];
  delete nodePos[s];
  if (startState === s) startState = '';
  acceptStates = acceptStates.filter(x => x !== s);
  renderStates();
  rebuildTable();
  layoutGraph();
  scheduleRedraw();
  checkReady();
}

function renderStates() {
  document.getElementById('states-tags').innerHTML = states.length
    ? states.map(s => `<span class="tag">${s}<button class="remove" onclick="removeState('${esc(s)}')">×</button></span>`).join('')
    : '<span style="font-size:0.73rem;color:var(--text3);font-family:var(--mono)">No states yet.</span>';

  const ss = document.getElementById('start-select');
  ss.innerHTML = '<option value="">— none —</option>' +
    states.map(s => `<option value="${s}"${s===startState?' selected':''}>${s}</option>`).join('');

  document.getElementById('accept-select').innerHTML =
    '<option value="">— select —</option>' +
    states.map(s => `<option value="${s}">${s}</option>`).join('');

  document.getElementById('accept-tags').innerHTML =
    acceptStates.map(s =>
      `<span class="tag accept">★ ${s}<button class="remove" onclick="removeAccepting('${esc(s)}')">×</button></span>`
    ).join('');
}

function addAccepting() {
  const s = document.getElementById('accept-select').value;
  if (!s || acceptStates.includes(s)) return;
  acceptStates.push(s);
  renderStates(); rebuildTable(); scheduleRedraw(); checkReady();
}

function removeAccepting(s) {
  acceptStates = acceptStates.filter(x => x !== s);
  renderStates(); rebuildTable(); scheduleRedraw();
}

// ═══════════════════════════════════════════════════════════════
//  ALPHABET
// ═══════════════════════════════════════════════════════════════
function addSymbol() {
  const inp = document.getElementById('sym-input');
  const s = inp.value.trim();
  if (!s || alphabet.includes(s)) { inp.focus(); return; }
  alphabet.push(s);
  inp.value = ''; inp.focus();
  renderSymbols(); rebuildTable(); scheduleRedraw(); checkReady();
}

function addEpsilon() {
  if (!alphabet.includes('ε')) { alphabet.push('ε'); renderSymbols(); rebuildTable(); }
}

function removeSymbol(s) {
  alphabet = alphabet.filter(x => x !== s);
  renderSymbols(); rebuildTable(); scheduleRedraw(); checkReady();
}

function renderSymbols() {
  document.getElementById('symbols-tags').innerHTML = alphabet.length
    ? alphabet.map(s => `<span class="tag">${s}<button class="remove" onclick="removeSymbol('${esc(s)}')">×</button></span>`).join('')
    : '<span style="font-size:0.73rem;color:var(--text3);font-family:var(--mono)">No symbols yet.</span>';
}

// ═══════════════════════════════════════════════════════════════
//  TRANSITION TABLE
// ═══════════════════════════════════════════════════════════════
function rebuildTable() {
  const card = document.getElementById('trans-card');
  if (!states.length || !alphabet.length) { card.style.display = 'none'; return; }
  card.style.display = '';

  document.getElementById('trans-hint').textContent = faType === 'DFA'
    ? 'One destination state per cell. Leave blank for dead state.'
    : 'Comma-separated states (e.g. q0,q1). Blank = ∅.';

  let html = '<thead><tr><th>δ (state \\ symbol)</th>' +
    alphabet.map(a => `<th>${a}</th>`).join('') + '</tr></thead><tbody>';

  states.forEach(s => {
    const isAcc = acceptStates.includes(s);
    const pfx   = (s === startState ? '→ ' : '') + (isAcc ? '★ ' : '');
    html += `<tr${isAcc ? ' class="row-accept"' : ''}><td>${pfx}<strong>${s}</strong></td>`;
    alphabet.forEach(sym => {
      let val = '';
      const raw = transitions[s] && transitions[s][sym];
      if (raw !== undefined) val = Array.isArray(raw) ? raw.join(',') : (raw || '');
      const sid = `tip-${cssId(s)}-${cssId(sym)}`;
      html += `<td>
        <input type="text" data-state="${s}" data-sym="${sym}" value="${val}"
          placeholder="${faType==='DFA'?'—':'∅'}"
          oninput="setTrans(this)" onblur="validateCell(this)"/>
        <span class="cell-tip" id="${sid}" style="display:none"></span>
      </td>`;
    });
    html += '</tr>';
  });

  html += '</tbody>';
  document.getElementById('trans-table').innerHTML = html;
  document.querySelectorAll('#trans-table input').forEach(inp => validateCell(inp));
}

function setTrans(inp) {
  const s = inp.dataset.state, sym = inp.dataset.sym, raw = inp.value.trim();
  if (!transitions[s]) transitions[s] = {};
  transitions[s][sym] = faType === 'DFA'
    ? raw
    : (raw ? raw.split(',').map(x => x.trim()).filter(Boolean) : []);
  validateCell(inp);
  scheduleRedraw();
}

function validateCell(inp) {
  const s = inp.dataset.state, sym = inp.dataset.sym, raw = inp.value.trim();
  const tid = `tip-${cssId(s)}-${cssId(sym)}`;
  const tip = document.getElementById(tid);
  inp.classList.remove('cell-error', 'cell-warn');
  if (tip) { tip.style.display = 'none'; tip.className = 'cell-tip'; }
  if (!raw) return;

  if (faType === 'DFA') {
    if (raw.includes(',')) {
      inp.classList.add('cell-warn');
      if (tip) { tip.textContent = 'DFA: one state only'; tip.className = 'cell-tip warn'; tip.style.display = 'block'; }
      return;
    }
    if (!states.includes(raw)) {
      inp.classList.add('cell-error');
      if (tip) { tip.textContent = `'${raw}' not defined`; tip.className = 'cell-tip err'; tip.style.display = 'block'; }
    }
  } else {
    const dests = raw.split(',').map(x => x.trim()).filter(Boolean);
    const undef = dests.filter(d => !states.includes(d));
    if (undef.length) {
      inp.classList.add('cell-error');
      if (tip) { tip.textContent = `Undefined: ${undef.join(', ')}`; tip.className = 'cell-tip err'; tip.style.display = 'block'; }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  READY CHECK
// ═══════════════════════════════════════════════════════════════
function checkReady() {
  const hint = document.getElementById('sim-hint');
  const missing = [];
  if (!startState)          missing.push('start state');
  if (!acceptStates.length) missing.push('accepting state');
  if (!alphabet.length)     missing.push('alphabet symbols');
  if (missing.length) {
    hint.textContent = 'Still needed: ' + missing.join(', ') + '.';
    hint.className = 'hint'; hint.style.display = '';
  } else {
    hint.style.display = 'none';
  }
  resetSim();
}

// ═══════════════════════════════════════════════════════════════
//  GRAPH LAYOUT  (force-directed attempt + circle fallback)
// ═══════════════════════════════════════════════════════════════
function layoutGraph() {
  const svg  = document.getElementById('graph-svg');
  const wrap = document.getElementById('graph-wrap');
  const n    = states.length;

  // Dynamic SVG height
  const svgH = Math.max(280, Math.min(520, 100 + n * 65));
  svg.setAttribute('height', svgH);

  const W = (wrap.clientWidth  || 520);
  const H = svgH;

  if (n === 0) { nodePos = {}; return; }
  if (n === 1) { nodePos[states[0]] = { x: W/2, y: H/2 }; return; }

  // Place on circle with good padding
  const pad  = NODE_R * 3.5;
  const maxR = Math.min(W/2, H/2) - pad;
  const r    = Math.max(60, maxR);
  const cx   = W / 2, cy = H / 2;

  // Initial circle placement
  states.forEach((s, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    nodePos[s] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  // Simple force-directed relaxation (50 iterations) to push nodes apart
  const REPEL  = 3500;
  const SPRING = 0.04;
  const DAMP   = 0.6;
  const vel    = {};
  states.forEach(s => vel[s] = { x: 0, y: 0 });

  for (let iter = 0; iter < 50; iter++) {
    const force = {};
    states.forEach(s => force[s] = { x: 0, y: 0 });

    // Repulsion between all pairs
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const a = states[i], b = states[j];
        const dx = nodePos[b].x - nodePos[a].x;
        const dy = nodePos[b].y - nodePos[a].y;
        const dist = Math.max(1, Math.sqrt(dx*dx + dy*dy));
        const f = REPEL / (dist * dist);
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        force[a].x -= fx; force[a].y -= fy;
        force[b].x += fx; force[b].y += fy;
      }
    }

    // Spring attraction toward circle ring
    states.forEach(s => {
      const dx   = nodePos[s].x - cx;
      const dy   = nodePos[s].y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const diff = dist - r;
      force[s].x -= SPRING * diff * (dx / dist);
      force[s].y -= SPRING * diff * (dy / dist);
    });

    // Integrate
    states.forEach(s => {
      vel[s].x = (vel[s].x + force[s].x) * DAMP;
      vel[s].y = (vel[s].y + force[s].y) * DAMP;
      nodePos[s].x += vel[s].x;
      nodePos[s].y += vel[s].y;
      // Keep within bounds
      nodePos[s].x = Math.max(pad, Math.min(W - pad, nodePos[s].x));
      nodePos[s].y = Math.max(pad, Math.min(H - pad, nodePos[s].y));
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  DRAW GRAPH
// ═══════════════════════════════════════════════════════════════
function scheduleRedraw() {
  if (redrawTimer) clearTimeout(redrawTimer);
  redrawTimer = setTimeout(() => drawGraph(), 16);
}

function drawGraph(opts) {
  opts = opts || {};
  const edgeG    = document.getElementById('graph-edges');
  const nodeG    = document.getElementById('graph-nodes');
  const emptyTxt = document.getElementById('graph-empty');

  edgeG.innerHTML = '';
  nodeG.innerHTML = '';

  if (!states.length) {
    emptyTxt.style.display = '';
    applyTransform();
    return;
  }
  emptyTxt.style.display = 'none';

  // Build edge map: group by from→to, collect labels
  const edgeMap = {};
  states.forEach(from => {
    alphabet.forEach(sym => {
      const raw   = transitions[from] && transitions[from][sym];
      const dests = faType === 'DFA'
        ? (raw && raw !== '' && states.includes(raw) ? [raw] : [])
        : (Array.isArray(raw) ? raw.filter(d => states.includes(d)) : []);
      dests.forEach(to => {
        const key = `${from}→${to}`;
        if (!edgeMap[key]) edgeMap[key] = { from, to, syms: [] };
        edgeMap[key].syms.push(sym);
      });
    });
  });

  // Draw edges
  Object.values(edgeMap).forEach(({ from, to, syms }) => {
    const key      = `${from}→${to}`;
    const hasBoth  = !!edgeMap[`${to}→${from}`];
    const isActive = opts.activeEdges  && opts.activeEdges.has(key);
    const isDead   = opts.deadEdges    && opts.deadEdges.has(key);
    const isDone   = visitedEdges.has(key) && !isActive && !isDead;
    const isFinal  = opts.finalEdges   && opts.finalEdges.has(key);

    // Truncate label if too long
    const label = syms.length > 4
      ? syms.slice(0, 3).join(',') + '…'
      : syms.join(',');

    drawEdge(edgeG, from, to, label, { isActive, isDead, isDone, isFinal, hasBoth });
  });

  // Start arrow
  if (startState && nodePos[startState]) {
    const p = nodePos[startState];
    edgeG.appendChild(makeSVG('line', {
      x1: p.x - NODE_R - 32, y1: p.y,
      x2: p.x - NODE_R - 3,  y2: p.y,
      class: 'start-arrow'
    }));
  }

  // Draw nodes on top
  states.forEach(s => {
    const p = nodePos[s];
    if (!p) return;
    let sc = '';
    if (opts.finalResult) {
      sc = (opts.activeSet && opts.activeSet.has(s))
        ? (opts.finalResult === 'accepted' ? 'state-accepted' : 'state-rejected')
        : (visitedStates.has(s) ? 'state-visited' : '');
    } else if (opts.activeSet && opts.activeSet.has(s)) {
      sc = 'state-current';
    } else if (opts.deadSet && opts.deadSet.has(s)) {
      sc = 'state-dead';
    } else if (visitedStates.has(s)) {
      sc = 'state-visited';
    }
    drawNode(nodeG, s, p, sc);
  });

  applyTransform();
}

// ── Edge drawing ────────────────────────────────────────────────
function drawEdge(parent, from, to, label, flags) {
  const { isActive, isDead, isDone, isFinal, hasBoth } = flags;

  let cls = 'g-edge';
  if      (isActive) cls += ' edge-active';
  else if (isDead)   cls += ' edge-dead';
  else if (isFinal)  cls += ' edge-accepted';
  else if (isDone)   cls += ' edge-done';

  const marker = isActive ? 'url(#arr-active)'
    : isDead  ? 'url(#arr-dead)'
    : isFinal ? 'url(#arr-accent)'
    : isDone  ? 'url(#arr-done)'
    : 'url(#arr-normal)';

  const g = makeSVG('g', { class: cls });
  const pf = nodePos[from], pt = nodePos[to];
  if (!pf || !pt) return;

  let midX, midY, path;

  if (from === to) {
    // ── Self-loop: tall arc well above the node ──
    const lx = pf.x, ly = pf.y - NODE_R;
    const loopH = 52, loopW = 22;
    path = makeSVG('path', {
      d: `M ${lx - loopW} ${ly} C ${lx - loopW*2.8} ${ly - loopH} ${lx + loopW*2.8} ${ly - loopH} ${lx + loopW} ${ly}`,
      'marker-end': marker
    });
    // Label sits clearly above the arc peak
    midX = lx;
    midY = ly - loopH - 10;
  } else if (hasBoth) {
    // ── Bidirectional: curve away from the direct line ──
    const dx  = pt.x - pf.x, dy = pt.y - pf.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    // Perpendicular offset — stronger curve for shorter distances
    const bend = Math.max(35, Math.min(60, 2200 / len));
    const ox = -dy / len * bend, oy = dx / len * bend;
    const cpx = (pf.x + pt.x) / 2 + ox, cpy = (pf.y + pt.y) / 2 + oy;

    const ux = cpx - pf.x, uy = cpy - pf.y, ul = Math.sqrt(ux*ux+uy*uy);
    const sx = pf.x + ux/ul * NODE_R,  sy = pf.y + uy/ul * NODE_R;
    const vx = cpx - pt.x, vy = cpy - pt.y, vl = Math.sqrt(vx*vx+vy*vy);
    const ex = pt.x + vx/vl * (NODE_R + 7), ey = pt.y + vy/vl * (NODE_R + 7);

    path = makeSVG('path', { d: `M ${sx} ${sy} Q ${cpx} ${cpy} ${ex} ${ey}`, 'marker-end': marker });
    // Label offset perpendicular to midpoint so it doesn't sit on the line
    midX = cpx + ox * 0.15;
    midY = cpy + oy * 0.15;
  } else {
    // ── Straight edge ──
    const dx = pt.x - pf.x, dy = pt.y - pf.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const ux = dx/len, uy = dy/len;
    const sx = pf.x + ux * NODE_R,   sy = pf.y + uy * NODE_R;
    const ex = pt.x - ux * (NODE_R+8), ey = pt.y - uy * (NODE_R+8);

    path = makeSVG('path', { d: `M ${sx} ${sy} L ${ex} ${ey}`, 'marker-end': marker });

    // Offset label perpendicularly so it doesn't sit exactly on the line
    const perpX = -uy * 12, perpY = ux * 12;
    midX = (sx + ex) / 2 + perpX;
    midY = (sy + ey) / 2 + perpY;
  }

  const labelW = Math.max(20, label.length * 7 + 10);
  const bg = makeSVG('rect', {
    class: 'lbg',
    x: midX - labelW/2, y: midY - 9,
    width: labelW, height: 16, rx: 3,
    fill: 'var(--bg3)'
  });
  const txt = makeSVG('text', {
    x: midX, y: midY,
    'text-anchor': 'middle', 'dominant-baseline': 'central'
  });
  txt.textContent = label;

  g.appendChild(path);
  g.appendChild(bg);
  g.appendChild(txt);
  parent.appendChild(g);
}

// ── Node drawing ────────────────────────────────────────────────
function drawNode(parent, s, pos, stateCls) {
  let cls = 'g-node';
  if (s === startState)         cls += ' start-node';
  if (acceptStates.includes(s)) cls += ' accept-node';
  if (stateCls)                 cls += ' ' + stateCls;

  const g = makeSVG('g', { class: cls });
  g.appendChild(makeSVG('circle', { cx: pos.x, cy: pos.y, r: NODE_R, class: 'outer' }));
  if (acceptStates.includes(s)) {
    g.appendChild(makeSVG('circle', { cx: pos.x, cy: pos.y, r: NODE_R - 5, class: 'inner' }));
  }
  const t = makeSVG('text', { x: pos.x, y: pos.y });
  t.textContent = s;
  g.appendChild(t);
  parent.appendChild(g);
}

// ═══════════════════════════════════════════════════════════════
//  PAN & ZOOM
// ═══════════════════════════════════════════════════════════════
function setupPan() {
  const wrap = document.getElementById('graph-wrap');
  wrap.addEventListener('mousedown', e => {
    isPanning = true;
    panStart = { x: e.clientX - graphOffX, y: e.clientY - graphOffY };
    wrap.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!isPanning) return;
    graphOffX = e.clientX - panStart.x;
    graphOffY = e.clientY - panStart.y;
    applyTransform();
  });
  window.addEventListener('mouseup', () => {
    isPanning = false;
    const wrap = document.getElementById('graph-wrap');
    if (wrap) wrap.style.cursor = 'grab';
  });
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    graphScale = Math.max(0.25, Math.min(4, graphScale * (e.deltaY > 0 ? 0.9 : 1.1)));
    applyTransform();
  }, { passive: false });
}

function applyTransform() {
  const root = document.getElementById('graph-root');
  if (root) root.setAttribute('transform',
    `translate(${graphOffX},${graphOffY}) scale(${graphScale})`);
}

function zoomIn()    { graphScale = Math.min(4, graphScale * 1.2); applyTransform(); }
function zoomOut()   { graphScale = Math.max(0.25, graphScale / 1.2); applyTransform(); }
function resetZoom() { graphScale = 1; graphOffX = 0; graphOffY = 0; applyTransform(); }

// ═══════════════════════════════════════════════════════════════
//  SVG HELPER
// ═══════════════════════════════════════════════════════════════
function makeSVG(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

// ═══════════════════════════════════════════════════════════════
//  AUTOMATA LOGIC
// ═══════════════════════════════════════════════════════════════
function dfaStep(state, sym) {
  const dest = transitions[state] && transitions[state][sym];
  return (dest && dest !== '' && states.includes(dest)) ? dest : null;
}

function epsilonClosure(set) {
  const c = new Set(set); const stack = [...set];
  while (stack.length) {
    const s = stack.pop();
    ((transitions[s] && transitions[s]['ε']) || [])
      .filter(d => states.includes(d))
      .forEach(d => { if (!c.has(d)) { c.add(d); stack.push(d); } });
  }
  return [...c];
}

function nfaMove(set, sym) {
  const next = new Set();
  set.forEach(s => ((transitions[s] && transitions[s][sym]) || [])
    .filter(d => states.includes(d)).forEach(d => next.add(d)));
  return epsilonClosure([...next]);
}

// ═══════════════════════════════════════════════════════════════
//  BUILD SIMULATION STEPS
// ═══════════════════════════════════════════════════════════════
function buildDFASteps() {
  let cur = startState;
  push({ pos:-1, cur:[cur], dead:[], prev:[], aE:new Set(), dE:new Set(), sym:null,
    info:`Initial state: ${cur}`, done:false });

  if (!simChars.length) {
    const acc = acceptStates.includes(cur);
    push({ pos:-1, cur:[cur], dead:[], prev:[cur], aE:new Set(), dE:new Set(), sym:null,
      info:`Empty string — ${cur} is ${acc?'':'not '}accepting.`, done:true, accepted:acc });
    return;
  }

  for (let i = 0; i < simChars.length; i++) {
    const sym = simChars[i], next = dfaStep(cur, sym), done = i===simChars.length-1;
    if (!next) {
      push({ pos:i, cur:[], dead:[cur], prev:[cur], aE:new Set(), dE:new Set(), sym,
        info:`Read '${sym}': no transition from ${cur} — dead state.`, done:true, accepted:false });
      break;
    }
    const prev = cur; cur = next;
    push({ pos:i, cur:[cur], dead:[], prev:[prev], aE:new Set([`${prev}→${cur}`]), dE:new Set(), sym,
      info:`Read '${sym}': ${prev} → ${cur}`, done, accepted: done ? acceptStates.includes(cur) : undefined });
  }
}

function buildNFASteps() {
  let curSet = epsilonClosure([startState]);
  push({ pos:-1, cur:curSet, dead:[], prev:[], aE:new Set(), dE:new Set(), sym:null,
    info:`ε-closure({${startState}}) = {${curSet.join(', ')}}`, done:false });

  if (!simChars.length) {
    const acc = curSet.some(s => acceptStates.includes(s));
    push({ pos:-1, cur:curSet, dead:[], prev:curSet, aE:new Set(), dE:new Set(), sym:null,
      info:`Empty string. Active: {${curSet.join(', ')}}`, done:true, accepted:acc });
    return;
  }

  for (let i = 0; i < simChars.length; i++) {
    const sym  = simChars[i];
    const prev = [...curSet];
    const next = nfaMove(curSet, sym);
    const done = i === simChars.length - 1;
    const acc  = done ? next.some(s => acceptStates.includes(s)) : undefined;

    // Which states died: in prev, had no transition on sym
    const dead = prev.filter(s => {
      const dests = ((transitions[s] && transitions[s][sym]) || []).filter(d => states.includes(d));
      return dests.length === 0;
    });

    const aE = new Set(), dE = new Set();
    prev.forEach(s => {
      const dests = ((transitions[s] && transitions[s][sym]) || []).filter(d => states.includes(d));
      if (dests.length) dests.forEach(d => aE.add(`${s}→${d}`));
    });

    const infoExtra = dead.length ? ` (${dead.join(',')} died)` : '';
    push({ pos:i, cur:next, dead, prev, aE, dE, sym,
      info:`Read '${sym}': {${prev.join(',')}} → {${next.length?next.join(', '):'∅'}}${infoExtra}`,
      done, accepted:acc });

    curSet = next;
    if (!next.length) { simSteps[simSteps.length-1].info += ' — all branches dead.'; break; }
  }
}

function push(s) { simSteps.push(s); }

// ═══════════════════════════════════════════════════════════════
//  SIMULATION CONTROL
// ═══════════════════════════════════════════════════════════════
function startSimulation() {
  const inputVal = document.getElementById('input-string').value;
  const hint     = document.getElementById('sim-hint');

  // Validate input string symbols
  if (inputVal !== '' && inputVal !== 'ε') {
    const bad = [...new Set([...inputVal].filter(c => !alphabet.includes(c)))];
    if (bad.length) {
      hint.textContent = `Symbol(s) not in Σ: ${bad.map(c=>`'${c}'`).join(', ')}`;
      hint.className = 'hint error'; hint.style.display = ''; return;
    }
  }
  if (!startState || !acceptStates.length || !alphabet.length) { checkReady(); return; }

  simChars      = (inputVal===''||inputVal==='ε') ? [] : [...inputVal];
  simSteps      = []; simPos = 0;
  visitedEdges  = new Set();
  visitedStates = new Set([startState]);

  hint.style.display = 'none';
  faType === 'DFA' ? buildDFASteps() : buildNFASteps();

  ['tape-card','states-card','controls-card','history-card'].forEach(id =>
    document.getElementById(id).style.display = '');
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('history').innerHTML = '';
  document.getElementById('result').textContent = '';
  document.getElementById('result').className = 'result';
  document.getElementById('state-label-title').textContent =
    faType === 'NFA' ? 'Current States' : 'Current State';

  renderTape();
  renderStep(0);
}

function renderStep(idx) {
  if (!simSteps[idx]) return;
  const step = simSteps[idx];

  // Tape
  simChars.forEach((_, i) => {
    const el = document.getElementById('sym-' + i);
    if (!el) return;
    el.className = 'sym-cell' + (i===step.pos?' active': i<step.pos?' done':'');
  });

  // Track visited
  step.cur.forEach(s => visitedStates.add(s));
  step.aE.forEach(e => visitedEdges.add(e));

  // Graph
  const finalResult = step.done ? (step.accepted ? 'accepted' : 'rejected') : null;
  drawGraph({
    activeSet:   new Set(step.cur),
    deadSet:     new Set(step.dead),
    activeEdges: step.aE,
    deadEdges:   step.dE,
    finalEdges:  finalResult === 'accepted' ? step.aE : new Set(),
    finalResult
  });

  // State badges
  let html = '';
  if (!step.cur.length && !step.dead.length) {
    html = '<span class="state-badge dead">∅ (dead)</span>';
  } else {
    step.cur.forEach(s => {
      const isAcc = acceptStates.includes(s);
      const cls   = step.done ? (step.accepted ? 'accepted' : 'rejected') : 'active';
      html += `<span class="state-badge ${cls}">${isAcc?'★ ':''}${s}</span>`;
    });
    if (faType === 'NFA') {
      step.dead.forEach(s => {
        html += `<span class="state-badge dead-br">${s} ✗</span>`;
      });
    }
  }
  document.getElementById('cur-states').innerHTML = html;
  document.getElementById('step-info').textContent = step.info;
  document.getElementById('step-count').textContent = `Step ${idx} / ${simSteps.length-1}`;
  document.getElementById('btn-back').disabled = idx === 0;
  document.getElementById('btn-fwd').disabled  = idx >= simSteps.length - 1;

  // History
  if (idx > 0) {
    const hist = document.getElementById('history');
    if (!hist.querySelector(`[data-idx="${idx}"]`)) {
      const row = document.createElement('div');
      row.className = 'hist-row'; row.dataset.idx = idx;
      row.innerHTML = `<span class="hist-num">${idx}.</span><span>${step.info}</span>`;
      hist.appendChild(row); hist.scrollTop = hist.scrollHeight;
    }
  }

  // Result
  if (step.done) {
    const res = document.getElementById('result');
    res.textContent = step.accepted ? '✓ String ACCEPTED' : '✗ String REJECTED';
    res.className = 'result ' + (step.accepted ? 'accepted' : 'rejected');
    document.getElementById('btn-fwd').disabled = true;
  }

  simPos = idx;
}

function renderTape() {
  const tape = document.getElementById('tape');
  if (!simChars.length) { tape.innerHTML = '<div class="sym-cell" style="opacity:0.45;font-size:0.85rem">ε</div>'; return; }
  tape.innerHTML = simChars.map((c,i) => `<div class="sym-cell" id="sym-${i}">${c}</div>`).join('');
}

function stepFwd() { if (simPos < simSteps.length-1) renderStep(simPos+1); }

function stepBack() {
  if (simPos > 0) {
    visitedEdges  = new Set();
    visitedStates = new Set([startState]);
    for (let i = 0; i < simPos; i++) {
      simSteps[i].cur.forEach(s => visitedStates.add(s));
      simSteps[i].aE.forEach(e => visitedEdges.add(e));
    }
    renderStep(simPos - 1);
  }
}

function runAll() {
  for (let i = simPos+1; i < simSteps.length; i++) renderStep(i);
}

function resetSim() {
  simSteps = []; simPos = 0; simChars = [];
  visitedEdges = new Set(); visitedStates = new Set();
  ['tape-card','states-card','controls-card','history-card'].forEach(id =>
    document.getElementById(id).style.display = 'none');
  document.getElementById('placeholder').style.display = '';
  document.getElementById('result').textContent = '';
  document.getElementById('result').className = 'result';
  drawGraph();
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function esc(s)   { return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function cssId(s) { return s.replace(/[^a-zA-Z0-9]/g, '_'); }
