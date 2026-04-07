// App state and DOM wiring for the 2D Camera Selector.

const state = {
  cameras: [],
  cameraId: null,
  distanceMm: 1000,
  fovWidthMm: 500,
  lensMm: null,
  fNumber: null
};

const $ = (id) => document.getElementById(id);

// ── Slider fill helper ───────────────────────────────────────
function setFill(slider) {
  const min = parseFloat(slider.min) || 0;
  const max = parseFloat(slider.max) || 100;
  const val = parseFloat(slider.value);
  const pct = Math.max(0, Math.min(100, (val - min) / (max - min) * 100)).toFixed(1);
  slider.style.background =
    `linear-gradient(to right, #7c5cbf ${pct}%, #dde1ea ${pct}%)`;
}

// ── Init ─────────────────────────────────────────────────────
function init() {
  if (typeof CAMERAS_DATA === 'undefined') {
    alert('Could not load camera data. Make sure data/cameras.js is present.');
    return;
  }
  state.cameras = CAMERAS_DATA.cameras || [];

  buildSidebar();
  if (state.cameras.length) selectCamera(state.cameras[0].id, false);

  // Wire sliders + number boxes
  wireSlider('distance-slider', 'distance-num', v => { state.distanceMm = v; recompute(); });
  wireSlider('fov-slider',      'fov-num',      v => { state.fovWidthMm  = v; recompute(); });

  $('lens-select').addEventListener('change', e => {
    state.lensMm = parseFloat(e.target.value);
    recompute();
  });
  $('aperture-select').addEventListener('change', e => {
    state.fNumber = parseFloat(e.target.value);
    recompute();
  });
}

function wireSlider(sliderId, numId, callback) {
  const slider = $(sliderId), num = $(numId);
  setFill(slider);
  slider.addEventListener('input', () => {
    num.value = slider.value;
    setFill(slider);
    callback(parseFloat(slider.value));
  });
  num.addEventListener('change', () => {
    let v = parseFloat(num.value) || parseFloat(slider.min);
    v = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), v));
    num.value = v;
    slider.value = v;
    setFill(slider);
    callback(v);
  });
}

// ── Camera viability ─────────────────────────────────────────
function isViable(camera, distanceMm, fovWidthMm) {
  const minLens = Math.min(...camera.availableLensesMm);
  const maxFov  = distanceMm * camera.sensor.ccdWidthMm / minLens;
  return maxFov >= fovWidthMm;
}

// ── Sidebar ──────────────────────────────────────────────────
function buildSidebar() {
  const sidebar = $('camera-sidebar');
  sidebar.innerHTML = '';
  for (const c of state.cameras) {
    const btn = document.createElement('button');
    btn.className = 'cam-btn';
    btn.id = 'btn-' + c.id;
    btn.innerHTML =
      `<span class="cam-name">${c.name}</span>` +
      `<span class="status-badge badge-nok" id="badge-${c.id}">✕</span>`;
    btn.addEventListener('click', () => selectCamera(c.id, true));
    sidebar.appendChild(btn);
  }
}

function refreshSidebar() {
  for (const c of state.cameras) {
    const btn   = $('btn-'   + c.id);
    const badge = $('badge-' + c.id);
    if (!btn) continue;
    const viable = isViable(c, state.distanceMm, state.fovWidthMm);
    btn.classList.toggle('viable',   viable);
    btn.classList.toggle('selected', c.id === state.cameraId);
    badge.className = 'status-badge ' + (viable ? 'badge-ok' : 'badge-nok');
    badge.textContent = viable ? '✓' : '✕';
  }
}

// ── Camera selection ─────────────────────────────────────────
function currentCamera() { return state.cameras.find(c => c.id === state.cameraId); }

function selectCamera(id, userClick) {
  state.cameraId = id;
  const c = currentCamera();
  if (!c) return;

  // Lens dropdown
  const lensSel = $('lens-select');
  lensSel.innerHTML = '';
  for (const f of c.availableLensesMm) {
    const o = document.createElement('option');
    o.value = f; o.textContent = f + ' mm';
    lensSel.appendChild(o);
  }

  // Aperture dropdown
  const apSel = $('aperture-select');
  apSel.innerHTML = '';
  for (const N of c.availableAperturesF) {
    const o = document.createElement('option');
    o.value = N; o.textContent = 'f/' + N;
    apSel.appendChild(o);
  }

  // Auto-select best lens (closest to ideal)
  const ideal = idealFocalLength(state.distanceMm, c.sensor.ccdWidthMm, state.fovWidthMm);
  state.lensMm = pickClosestLens(ideal, c.availableLensesMm);
  lensSel.value = state.lensMm;

  // Default aperture = middle of list
  state.fNumber = c.availableAperturesF[Math.floor(c.availableAperturesF.length / 2)];
  apSel.value = state.fNumber;

  // Sensor info table
  const s = c.sensor;
  $('st-sensor').textContent = s.sizeName;
  $('st-pxh').textContent    = s.pixelH;
  $('st-pxv').textContent    = s.pixelV;
  $('st-pxsz').textContent   = s.pixelSizeUm;
  $('st-ccdw').textContent   = s.ccdWidthMm;
  $('st-ccdh').textContent   = s.ccdHeightMm;
  $('st-ratio').textContent  = (s.ccdWidthMm / s.ccdHeightMm).toFixed(2);

  // Camera info panel (right)
  const ov = $('overview-list');
  ov.innerHTML = '';
  for (const line of c.overview) {
    const li = document.createElement('li');
    li.textContent = line;
    ov.appendChild(li);
  }
  const tbl = $('specs-table');
  tbl.innerHTML = '';
  for (const k in c.specs) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${k}</td><td>${c.specs[k]}</td>`;
    tbl.appendChild(tr);
  }
  const link = $('datasheet-link');
  link.href = c.datasheetUrl || '#';

  refreshSidebar();
  recompute();
}

// ── Compute + render ─────────────────────────────────────────
function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  if (!isFinite(n)) return '∞';
  return Number(n).toFixed(d);
}

function recompute() {
  const c = currentCamera();
  if (!c) return;

  refreshSidebar();

  const r = computeAll({
    distanceMm:  state.distanceMm,
    fovWidthMm:  state.fovWidthMm,
    camera:      c,
    lensMm:      state.lensMm,
    fNumber:     state.fNumber
  });

  $('out-ideal').textContent    = fmt(r.ideal, 1) + ' mm';
  $('out-ideal-acc').textContent = fmt(r.idealAccuracy, 4) + ' mm/px';
  $('out-fov').textContent      = `${fmt(r.fov.w, 1)} × ${fmt(r.fov.h, 1)} mm`;
  $('out-acc').textContent      = fmt(r.newAccuracy, 4) + ' mm/px';
  $('out-dofn').textContent     = fmt(r.dof.near, 1) + ' mm';
  $('out-doff').textContent     = fmt(r.dof.far, 1) + ' mm';
  $('out-hyperfocal').textContent = fmt(r.dof.hyperfocal, 0) + ' mm';

  renderFov($('fov-svg'), {
    distanceMm:  state.distanceMm,
    fovWidthMm:  r.fov.w,
    fovHeightMm: r.fov.h,
    dofNear:     r.dof.near,
    dofFar:      r.dof.far
  });
}

window.addEventListener('DOMContentLoaded', init);
