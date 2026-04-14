// ── Global State ───────────────────────────────────────────────
let faType       = 'DFA';
let states       = [];
let alphabet     = [];
let startState   = '';
let acceptStates = [];
let transitions  = {};

let simSteps     = [];
let simPos       = 0;
let simChars     = [];
let visitedEdges = new Set();
let visitedStateSet = new Set();

// Graph pan/zoom
let graphScale   = 1;
let graphOffX    = 0;
let graphOffY    = 0;
let isPanning    = false;
let panStart     = { x: 0, y: 0 };

// Node positions
let nodePositions = {};
const NODE_R = 26;

// ── Init ───────────────────────────────────────────────────────
window.addEventListener('load', () => {
  setupPan();
  // Delay initial draw so SVG has rendered dimensions
  setTimeout(() => { layoutGraph(); drawGraph(); }, 100);
});

window.addEventListener('resize', () => {
  layoutGraph();
  drawGraph();
});

// ── Type Toggle ────────────────────────────────────────────────
function setType(t) {
  faType = t;
  document.getElementById('btn-dfa').classList.toggle('active', t === 'DFA');
  document.getElementById('btn-nfa').classList.toggle('active', t === 'NFA');
  document.getElementById('eps-btn').style.display = t === 'NFA' ? '' : 'none';
  transitions = {};
  states.forEach(s => transitions[s] = {});
  rebuildTable();
  drawGraph();
  resetSim();
}

// ── States ─────────────────────────────────────────────────────
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
  drawGraph();
  checkReady();
}

function removeState(s) {
  states = states.filter(x => x !== s);
  delete transitions[s];
  delete nodePositions[s];
  if (startState === s) startState = '';
  acceptStates = acceptStates.filter(x => x !== s);
  renderStates();
  rebuildTable();
  layoutGraph();
  drawGraph();
  checkReady();
}

function renderStates() {
  document.getElementById('states-tags').innerHTML = states.length
    ? states.map(s => `<span class="tag">${s}<button class="remove" onclick="removeState('${esc(s)}')">×</button></span>`).join('')
    : '<span style="font-size:0.75rem;color:var(--text3);font-family:var(--mono)">No states yet.</span>';

  const ss = document.getElementById('start-select');
  ss.innerHTML = '<option value="">— none —</option>' + states.map(s =>
    `<option value="${s}"${s===startState?' selected':''}>${s}</option>`).join('');

  document.getElementById('accept-select').innerHTML =
    '<option value="">— select —</option>' + states.map(s => `<option value="${s}">${s}</option>`).join('');

  document.getElementById('accept-tags').innerHTML =
    acceptStates.map(s => `<span class="tag accept">★ ${s}<button class="remove" onclick="removeAccepting('${esc(s)}')">×</button></span>`).join('');
}

function addAccepting() {
  const sel = document.getElementById('accept-select');
  const s = sel.value;
  if (!s || acceptStates.includes(s)) return;
  acceptStates.push(s);
  renderStates();
  rebuildTable();
  drawGraph();
  checkReady();
}

function removeAccepting(s) {
  acceptStates = acceptStates.filter(x => x !== s);
  renderStates();
  rebuildTable();
  drawGraph();
}

// ── Alphabet ───────────────────────────────────────────────────
function addSymbol() {
  const inp = document.getElementById('sym-input');
  const s = inp.value.trim();
  if (!s || alphabet.includes(s)) { inp.focus(); return; }
  alphabet.push(s);
  inp.value = '';
  inp.focus();
  renderSymbols();
  rebuildTable();
  drawGraph();
  checkReady();
}

function addEpsilon() {
  if (!alphabet.includes('ε')) { alphabet.push('ε'); renderSymbols(); rebuildTable(); }
}

function removeSymbol(s) {
  alphabet = alphabet.filter(x => x !== s);
  renderSymbols();
  rebuildTable();
  drawGraph();
  checkReady();
}

function renderSymbols() {
  document.getElementById('symbols-tags').innerHTML = alphabet.length
    ? alphabet.map(s => `<span class="tag">${s}<button class="remove" onclick="removeSymbol('${esc(s)}')">×</button></span>`).join('')
    : '<span style="font-size:0.75rem;color:var(--text3);font-family:var(--mono)">No symbols yet.</span>';
}

// ── Transition Table ───────────────────────────────────────────
function rebuildTable() {
  const card = document.getElementById('trans-card');
  if (states.length === 0 || alphabet.length === 0) { card.style.display = 'none'; return; }
  card.style.display = '';

  document.getElementById('trans-hint').textContent = faType === 'DFA'
    ? 'Enter a single destination state. Leave blank for dead state.'
    : 'Comma-separated states (e.g. q0,q1). Leave blank for ∅.';

  let html = '<thead><tr><th>δ (state \\ symbol)</th>' +
    alphabet.map(a => `<th>${a}</th>`).join('') + '</tr></thead><tbody>';

  states.forEach(s => {
    const isAcc   = acceptStates.includes(s);
    const isStart = s === startState;
    const prefix  = (isStart ? '→ ' : '') + (isAcc ? '★ ' : '');
    html += `<tr${isAcc ? ' class="highlight-row"' : ''}><td>${prefix}<strong>${s}</strong></td>`;
    alphabet.forEach(sym => {
      let val = '';
      if (transitions[s] && transitions[s][sym] !== undefined) {
        val = Array.isArray(transitions[s][sym])
          ? transitions[s][sym].join(',')
          : (transitions[s][sym] || '');
      }
      html += `<td>
        <input type="text" data-state="${s}" data-sym="${sym}" value="${val}"
          placeholder="${faType==='DFA'?'—':'∅'}" oninput="setTrans(this)" onblur="validateCell(this)"/>
        <span class="cell-tooltip" id="tip-${esc(s)}-${esc(sym)}" style="display:none"></span>
      </td>`;
    });
    html += '</tr>';
  });

  html += '</tbody>';
  document.getElementById('trans-table').innerHTML = html;

  // Validate all existing values
  document.querySelectorAll('#trans-table input').forEach(inp => validateCell(inp));
}

function setTrans(inp) {
  const s   = inp.dataset.state;
  const sym = inp.dataset.sym;
  const raw = inp.value.trim();
  if (!transitions[s]) transitions[s] = {};
  transitions[s][sym] = faType === 'DFA'
    ? raw
    : (raw ? raw.split(',').map(x => x.trim()).filter(Boolean) : []);
  validateCell(inp);
  drawGraph();
}

// FIX 1: Validate transition cell
function validateCell(inp) {
  const s   = inp.dataset.state;
  const sym = inp.dataset.sym;
  const raw = inp.value.trim();
  const tipId = `tip-${s}-${sym}`;
  const tip = document.getElementById(tipId);

  inp.classList.remove('cell-error', 'cell-dfa-error');
  if (tip) { tip.style.display = 'none'; tip.textContent = ''; tip.className = 'cell-tooltip'; }
  if (!raw) return;

  if (faType === 'DFA') {
    // FIX 8: DFA multiple state check
    if (raw.includes(',')) {
      inp.classList.add('cell-dfa-error');
      if (tip) { tip.textContent = 'DFA: one state only'; tip.className = 'cell-tooltip warn'; tip.style.display = 'block'; }
      return;
    }
    // FIX 1: undefined state
    if (!states.includes(raw)) {
      inp.classList.add('cell-error');
      if (tip) { tip.textContent = `'${raw}' not defined`; tip.style.display = 'block'; }
    }
  } else {
    // NFA: check each destination
    const dests = raw.split(',').map(x => x.trim()).filter(Boolean);
    const undef = dests.filter(d => !states.includes(d));
    if (undef.length > 0) {
      inp.classList.add('cell-error');
      if (tip) { tip.textContent = `Undefined: ${undef.join(', ')}`; tip.style.display = 'block'; }
    }
  }
}

// ── FIX 9: Validate input string ──────────────────────────────
function validateInputString(str) {
  if (str === '' || str === 'ε') return null;
  const chars = [...str];
  const bad = chars.filter(c => !alphabet.includes(c));
  if (bad.length > 0) {
    const unique = [...new Set(bad)];
    return `Symbol(s) not in alphabet Σ: ${unique.map(c => `'${c}'`).join(', ')}`;
  }
  return null;
}

// ── Ready Check ────────────────────────────────────────────────
function checkReady() {
  const hint = document.getElementById('sim-hint');
  const missing = [];
  if (!startState)          missing.push('start state');
  if (!acceptStates.length) missing.push('accepting state');
  if (!alphabet.length)     missing.push('alphabet symbols');
  if (missing.length) {
    hint.textContent = 'Still needed: ' + missing.join(', ') + '.';
    hint.className = 'hint';
    hint.style.display = '';
  } else {
    hint.style.display = 'none';
  }
  resetSim();
}

// ── Graph Layout ───────────────────────────────────────────────
function layoutGraph() {
  const svg = document.getElementById('graph-svg');
  const wrap = document.getElementById('graph-wrap');
  const n = states.length;

  // FIX 4 & 5: Dynamic height based on state count
  const minH = 260;
  const svgH = Math.max(minH, Math.min(500, 80 + n * 60));
  svg.setAttribute('height', svgH);

  const W = wrap.clientWidth  || 500;
  const H = svgH;

  if (n === 0) { nodePositions = {}; return; }
  if (n === 1) { nodePositions[states[0]] = { x: W/2, y: H/2 }; return; }

  // FIX 5: Better spacing — use more of the available area
  const padding = 60;
  const r = Math.min((W - padding*2)/2, (H - padding*2)/2) * 0.85;
  const cx = W / 2;
  const cy = H / 2;

  states.forEach((s, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    nodePositions[s] = {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    };
  });
}

// ── Graph Drawing ──────────────────────────────────────────────
function drawGraph(activeStates, prevStates, deadStates, edgeHighlights, finalResult) {
  const svg   = document.getElementById('graph-svg');
  const W     = svg.clientWidth  || 500;
  const H     = parseInt(svg.getAttribute('height')) || 300;
  const edgeG = document.getElementById('graph-edges');
  const nodeG = document.getElementById('graph-nodes');
  const emptyTxt = document.getElementById('graph-empty');

  edgeG.innerHTML = '';
  nodeG.innerHTML = '';

  if (states.length === 0) {
    emptyTxt.style.display = '';
    updateGraphTransform();
    return;
  }
  emptyTxt.style.display = 'none';

  // FIX 6: Build edge map (group same from→to into one edge with combined labels)
  const edgeMap = {};
  states.forEach(from => {
    alphabet.forEach(sym => {
      const raw   = transitions[from] && transitions[from][sym];
      const dests = faType === 'DFA'
        ? (raw && raw !== '' && states.includes(raw) ? [raw] : [])
        : (Array.isArray(raw) ? raw.filter(d => states.includes(d)) : []);
      dests.forEach(to => {
        const key = `${from}→${to}`;
        if (!edgeMap[key]) edgeMap[key] = { from, to, labels: [] };
        // FIX 7: Truncate label if too many symbols
        edgeMap[key].labels.push(sym);
      });
    });
  });

  // Draw edges
  Object.values(edgeMap).forEach(({ from, to, labels }) => {
    const labelStr = labels.length > 4
      ? labels.slice(0, 3).join(',') + '…'
      : labels.join(',');
    const edgeKey  = `${from}→${to}`;
    const isActive = edgeHighlights && edgeHighlights.active && edgeHighlights.active.has(edgeKey);
    const isDead   = edgeHighlights && edgeHighlights.dead   && edgeHighlights.dead.has(edgeKey);
    const isDone   = visitedEdges.has(edgeKey) && !isActive && !isDead;
    const isFinal  = edgeHighlights && edgeHighlights.final  && edgeHighlights.final.has(edgeKey);

    const hasBoth = !!edgeMap[`${to}→${from}`];
    drawEdge(edgeG, from, to, labelStr, isActive, isDead, isDone, isFinal, hasBoth);
  });

  // Start arrow
  if (startState && nodePositions[startState]) {
    const pos = nodePositions[startState];
    const line = makeSVG('line', {
      x1: pos.x - NODE_R - 30, y1: pos.y,
      x2: pos.x - NODE_R - 2,  y2: pos.y,
      class: 'start-arrow'
    });
    edgeG.appendChild(line);
  }

  // Draw nodes
  states.forEach(s => {
    const pos = nodePositions[s];
    if (!pos) return;
    let stateCls = '';
    if (finalResult) {
      if (activeStates && activeStates.has(s)) {
        stateCls = finalResult === 'accepted' ? 'state-accepted' : 'state-rejected';
      }
    } else if (activeStates && activeStates.has(s)) {
      stateCls = 'state-current';
    } else if (deadStates && deadStates.has(s)) {
      stateCls = 'state-dead';
    } else if (visitedStateSet.has(s)) {
      stateCls = 'state-visited';
    }
    drawNode(nodeG, s, pos, stateCls);
  });

  updateGraphTransform();
}

function drawEdge(parent, from, to, label, isActive, isDead, isDone, isFinal, hasBoth) {
  const pf = nodePositions[from];
  const pt = nodePositions[to];
  if (!pf || !pt) return;

  let edgeCls = 'g-edge';
  if (isActive)     edgeCls += ' edge-active';
  else if (isDead)  edgeCls += ' edge-dead';
  else if (isFinal) edgeCls += ' edge-accepted';
  else if (isDone)  edgeCls += ' edge-done';

  const markerUrl = isActive ? 'url(#arr-active)' : isDead ? 'url(#arr-dead)' : isFinal ? 'url(#arr-accent)' : isDone ? 'url(#arr-done)' : 'url(#arr-normal)';

  const g = makeSVG('g', { class: edgeCls });
  let midX, midY;

  if (from === to) {
    // Self loop
    const lx = pf.x;
    const ly = pf.y - NODE_R;
    const loopR = 20;
    const d = `M ${lx - loopR} ${ly} C ${lx - loopR*2.5} ${ly - loopR*3.5} ${lx + loopR*2.5} ${ly - loopR*3.5} ${lx + loopR} ${ly}`;
    const path = makeSVG('path', { d, 'marker-end': markerUrl });
    midX = lx; midY = ly - loopR * 3.2;
    g.appendChild(path);
  } else if (hasBoth) {
    // Curved bidirectional
    const dx  = pt.x - pf.x;
    const dy  = pt.y - pf.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const ox  = -dy / len * 35;
    const oy  =  dx / len * 35;
    const cpx = (pf.x + pt.x) / 2 + ox;
    const cpy = (pf.y + pt.y) / 2 + oy;

    const ux  = (cpx - pf.x);
    const uy  = (cpy - pf.y);
    const ul  = Math.sqrt(ux*ux + uy*uy);
    const sx  = pf.x + ux/ul * NODE_R;
    const sy  = pf.y + uy/ul * NODE_R;

    const vx  = (cpx - pt.x);
    const vy  = (cpy - pt.y);
    const vl  = Math.sqrt(vx*vx + vy*vy);
    const ex  = pt.x + vx/vl * (NODE_R + 6);
    const ey  = pt.y + vy/vl * (NODE_R + 6);

    const path = makeSVG('path', { d: `M ${sx} ${sy} Q ${cpx} ${cpy} ${ex} ${ey}`, 'marker-end': markerUrl });
    midX = cpx; midY = cpy;
    g.appendChild(path);
  } else {
    // Straight
    const dx  = pt.x - pf.x;
    const dy  = pt.y - pf.y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const ux  = dx/len; const uy = dy/len;
    const sx  = pf.x + ux * NODE_R;
    const sy  = pf.y + uy * NODE_R;
    const ex  = pt.x - ux * (NODE_R + 7);
    const ey  = pt.y - uy * (NODE_R + 7);

    const path = makeSVG('path', { d: `M ${sx} ${sy} L ${ex} ${ey}`, 'marker-end': markerUrl });
    midX = (sx + ex) / 2;
    midY = (sy + ey) / 2;
    g.appendChild(path);
  }

  // FIX 7: Label background for readability
  const labelW = Math.max(24, label.length * 7 + 10);
  const bg = makeSVG('rect', {
    class: 'lbg',
    x: midX - labelW/2, y: midY - 9,
    width: labelW, height: 16, rx: 3
  });
  const txt = makeSVG('text', { x: midX, y: midY, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
  txt.textContent = label;

  g.appendChild(bg);
  g.appendChild(txt);
  parent.appendChild(g);
}

function drawNode(parent, s, pos, stateCls) {
  let cls = 'g-node';
  if (s === startState)         cls += ' start-node';
  if (acceptStates.includes(s)) cls += ' accept-node';
  if (stateCls)                 cls += ' ' + stateCls;

  const g = makeSVG('g', { class: cls });

  const outer = makeSVG('circle', { cx: pos.x, cy: pos.y, r: NODE_R, class: 'outer' });
  g.appendChild(outer);

  if (acceptStates.includes(s)) {
    const inner = makeSVG('circle', { cx: pos.x, cy: pos.y, r: NODE_R - 4, class: 'inner' });
    g.appendChild(inner);
  }

  const txt = makeSVG('text', { x: pos.x, y: pos.y });
  txt.textContent = s;
  g.appendChild(txt);

  parent.appendChild(g);
}

// ── Pan & Zoom ─────────────────────────────────────────────────
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
    updateGraphTransform();
  });
  window.addEventListener('mouseup', () => {
    isPanning = false;
    document.getElementById('graph-wrap').style.cursor = 'grab';
  });

  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    graphScale = Math.max(0.3, Math.min(3, graphScale * delta));
    updateGraphTransform();
  }, { passive: false });
}

function updateGraphTransform() {
  const root = document.getElementById('graph-root');
  if (root) root.setAttribute('transform', `translate(${graphOffX},${graphOffY}) scale(${graphScale})`);
}

function zoomIn()    { graphScale = Math.min(3, graphScale * 1.2); updateGraphTransform(); }
function zoomOut()   { graphScale = Math.max(0.3, graphScale * 0.8); updateGraphTransform(); }
function resetZoom() { graphScale = 1; graphOffX = 0; graphOffY = 0; updateGraphTransform(); }

// ── SVG Helper ─────────────────────────────────────────────────
function makeSVG(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

// ── DFA Logic ─────────────────────────────────────────────────
function dfaStep(state, sym) {
  const dest = transitions[state] && transitions[state][sym];
  return (dest && dest !== '' && states.includes(dest)) ? dest : null;
}

// ── NFA Logic ─────────────────────────────────────────────────
function epsilonClosure(stateSet) {
  const closure = new Set(stateSet);
  const stack = [...stateSet];
  while (stack.length) {
    const s = stack.pop();
    ((transitions[s] && transitions[s]['ε']) || []).forEach(d => {
      if (states.includes(d) && !closure.has(d)) { closure.add(d); stack.push(d); }
    });
  }
  return [...closure];
}

function nfaMove(stateSet, sym) {
  const next = new Set();
  stateSet.forEach(s => ((transitions[s] && transitions[s][sym]) || [])
    .filter(d => states.includes(d)).forEach(d => next.add(d)));
  return epsilonClosure([...next]);
}

// ── Build Steps ────────────────────────────────────────────────
function buildDFASteps() {
  let cur = startState;
  simSteps.push({
    pos: -1, currentStates: [cur], deadStates: [],
    prevStates: [], from: null, to: cur,
    activeEdges: new Set(), deadEdges: new Set(),
    symbol: null, info: `Initial state: ${cur}`, done: false
  });

  if (simChars.length === 0) {
    const acc = acceptStates.includes(cur);
    simSteps.push({
      pos: -1, currentStates: [cur], deadStates: [],
      prevStates: [cur], from: null, to: cur,
      activeEdges: new Set(), deadEdges: new Set(),
      symbol: null, info: `Empty string. ${cur} is ${acc?'':'not '}an accepting state.`,
      done: true, accepted: acc
    });
    return;
  }

  for (let i = 0; i < simChars.length; i++) {
    const sym  = simChars[i];
    const next = dfaStep(cur, sym);
    const done = i === simChars.length - 1;

    if (next === null) {
      simSteps.push({
        pos: i, currentStates: [], deadStates: [cur],
        prevStates: [cur], from: cur, to: null,
        activeEdges: new Set(), deadEdges: new Set(),
        symbol: sym, info: `Read '${sym}': no transition from ${cur} — dead state.`,
        done: true, accepted: false
      });
      break;
    }

    const activeEdges = new Set([`${cur}→${next}`]);
    const prev = cur;
    cur = next;
    simSteps.push({
      pos: i, currentStates: [cur], deadStates: [],
      prevStates: [prev], from: prev, to: cur,
      activeEdges, deadEdges: new Set(),
      symbol: sym, info: `Read '${sym}': ${prev} → ${cur}`,
      done, accepted: done ? acceptStates.includes(cur) : undefined
    });
  }
}

function buildNFASteps() {
  let curSet = epsilonClosure([startState]);
  simSteps.push({
    pos: -1, currentStates: curSet, deadStates: [],
    prevStates: [], from: null, to: null,
    activeEdges: new Set(), deadEdges: new Set(),
    symbol: null, info: `ε-closure({${startState}}) = {${curSet.join(', ')}}`, done: false
  });

  if (simChars.length === 0) {
    const acc = curSet.some(s => acceptStates.includes(s));
    simSteps.push({
      pos: -1, currentStates: curSet, deadStates: [],
      prevStates: curSet, from: null, to: null,
      activeEdges: new Set(), deadEdges: new Set(),
      symbol: null, info: `Empty string. Active: {${curSet.join(', ')}}`,
      done: true, accepted: acc
    });
    return;
  }

  for (let i = 0; i < simChars.length; i++) {
    const sym    = simChars[i];
    const prev   = [...curSet];
    const next   = nfaMove(curSet, sym);
    const done   = i === simChars.length - 1;
    const accepted = done ? next.some(s => acceptStates.includes(s)) : undefined;

    // FIX 10: Find which states died (were in prev but contributed nothing to next)
    const deadStates = prev.filter(s => {
      const dests = ((transitions[s] && transitions[s][sym]) || []).filter(d => states.includes(d));
      return dests.length === 0;
    });

    // Active edges: all transitions taken
    const activeEdges = new Set();
    const deadEdges   = new Set();
    prev.forEach(s => {
      const dests = ((transitions[s] && transitions[s][sym]) || []).filter(d => states.includes(d));
      if (dests.length > 0) {
        dests.forEach(d => activeEdges.add(`${s}→${d}`));
      } else {
        // This state had no transition — mark as dead branch
        deadEdges.add(`${s}→dead`);
      }
    });

    simSteps.push({
      pos: i, currentStates: next, deadStates,
      prevStates: prev, from: null, to: null,
      activeEdges, deadEdges,
      symbol: sym,
      info: `Read '${sym}': {${prev.join(',')}} → {${next.length ? next.join(', ') : '∅'}}${deadStates.length ? ` (${deadStates.join(',')} died)` : ''}`,
      done, accepted
    });

    curSet = next;
    if (next.length === 0) {
      simSteps[simSteps.length-1].info += ' — rejected (all branches dead).';
      break;
    }
  }
}

// ── Simulation Control ─────────────────────────────────────────
function startSimulation() {
  const inputVal = document.getElementById('input-string').value;
  const hint     = document.getElementById('sim-hint');

  // FIX 9: Validate input string
  const err = validateInputString(inputVal);
  if (err) {
    hint.textContent = err;
    hint.className = 'hint error-msg';
    hint.style.display = '';
    return;
  }

  // Check automaton is ready
  if (!startState || !acceptStates.length || !alphabet.length) {
    checkReady();
    return;
  }

  simChars     = (inputVal === '' || inputVal === 'ε') ? [] : [...inputVal];
  simSteps     = [];
  simPos       = 0;
  visitedEdges = new Set();
  visitedStateSet = new Set();
  visitedStateSet.add(startState);

  hint.style.display = 'none';

  faType === 'DFA' ? buildDFASteps() : buildNFASteps();

  document.getElementById('placeholder').style.display  = 'none';
  document.getElementById('tape-card').style.display     = '';
  document.getElementById('states-card').style.display   = '';
  document.getElementById('controls-card').style.display = '';
  document.getElementById('history-card').style.display  = '';
  document.getElementById('history').innerHTML           = '';
  document.getElementById('result').textContent          = '';
  document.getElementById('result').className            = 'result';
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
    el.className = 'sym-cell' + (i === step.pos ? ' active' : i < step.pos ? ' done' : '');
  });

  // Track visited
  step.currentStates.forEach(s => visitedStateSet.add(s));
  step.activeEdges.forEach(e => visitedEdges.add(e));

  // Graph update
  const activeSet = new Set(step.currentStates);
  const deadSet   = new Set(step.deadStates);

  const edgeHighlights = {
    active: step.activeEdges,
    dead:   step.deadEdges,
    final:  step.done && step.accepted ? step.activeEdges : new Set()
  };

  drawGraph(
    activeSet, new Set(step.prevStates), deadSet,
    edgeHighlights,
    step.done ? (step.accepted ? 'accepted' : 'rejected') : null
  );

  // State badges
  const disp = document.getElementById('cur-states');
  let badgeHTML = '';

  if (step.currentStates.length === 0 && step.deadStates.length === 0) {
    badgeHTML = '<span class="state-badge dead">∅ (dead)</span>';
  } else {
    // Active states
    step.currentStates.forEach(s => {
      const isAcc = acceptStates.includes(s);
      let cls = 'active';
      if (step.done) cls = step.accepted ? 'accepted' : 'rejected';
      badgeHTML += `<span class="state-badge ${cls}">${isAcc ? '★ ' : ''}${s}</span>`;
    });
    // FIX 10: Dead branch states shown with strikethrough
    if (faType === 'NFA') {
      step.deadStates.forEach(s => {
        badgeHTML += `<span class="state-badge dead-branch">${s} ✗</span>`;
      });
    }
  }

  disp.innerHTML = badgeHTML;
  document.getElementById('step-info').textContent = step.info;
  document.getElementById('step-count').textContent = `Step ${idx} / ${simSteps.length - 1}`;
  document.getElementById('btn-back').disabled = idx === 0;
  document.getElementById('btn-fwd').disabled  = idx >= simSteps.length - 1;

  // History
  if (idx > 0) {
    const hist = document.getElementById('history');
    if (!hist.querySelector(`[data-idx="${idx}"]`)) {
      const row = document.createElement('div');
      row.className = 'hist-row';
      row.dataset.idx = idx;
      row.innerHTML = `<span class="hist-num">${idx}.</span><span>${step.info}</span>`;
      hist.appendChild(row);
      hist.scrollTop = hist.scrollHeight;
    }
  }

  // Result
  if (step.done) {
    const res = document.getElementById('result');
    res.textContent = step.accepted ? '✓ String ACCEPTED' : '✗ String REJECTED';
    res.className   = 'result ' + (step.accepted ? 'accepted' : 'rejected');
    document.getElementById('btn-fwd').disabled = true;
  }

  simPos = idx;
}

function renderTape() {
  const tape = document.getElementById('tape');
  if (simChars.length === 0) {
    tape.innerHTML = '<div class="sym-cell" style="opacity:0.5;font-size:0.85rem">ε</div>';
    return;
  }
  tape.innerHTML = simChars.map((c, i) => `<div class="sym-cell" id="sym-${i}">${c}</div>`).join('');
}

function stepFwd() { if (simPos < simSteps.length - 1) renderStep(simPos + 1); }

function stepBack() {
  if (simPos > 0) {
    // Rebuild visited sets up to simPos-1
    visitedEdges    = new Set();
    visitedStateSet = new Set();
    visitedStateSet.add(startState);
    for (let i = 0; i < simPos; i++) {
      const s = simSteps[i];
      s.currentStates.forEach(st => visitedStateSet.add(st));
      s.activeEdges.forEach(e => visitedEdges.add(e));
    }
    renderStep(simPos - 1);
  }
}

function runAll() {
  for (let i = simPos + 1; i < simSteps.length; i++) renderStep(i);
}

function resetSim() {
  simSteps        = [];
  simPos          = 0;
  simChars        = [];
  visitedEdges    = new Set();
  visitedStateSet = new Set();
  document.getElementById('tape-card').style.display     = 'none';
  document.getElementById('states-card').style.display   = 'none';
  document.getElementById('controls-card').style.display = 'none';
  document.getElementById('history-card').style.display  = 'none';
  document.getElementById('placeholder').style.display   = '';
  document.getElementById('result').textContent          = '';
  document.getElementById('result').className            = 'result';
  drawGraph();
}

// ── Escape helper ──────────────────────────────────────────────
function esc(s) { return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/-/g,'\\-'); }
