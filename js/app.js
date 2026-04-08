// App state and DOM wiring for the 2D Camera Selector.

const state = {
  cameras: [],
  cameraId: null,
  distanceMm: 1000,
  objectWidthMm: 300,
  objectLengthMm: 200,
  objectThicknessMm: 50,
  lensMm: null,
  fNumber: null
};

const $ = (id) => document.getElementById(id);

function setTooltipIfExists(id, text) {
  const el = $(id);
  if (!el) return;
  el.setAttribute('data-tooltip', text);
  el.removeAttribute('title');
}

function setupHoverTooltipSystem() {
  if (document.getElementById('app-tooltip')) return;

  const tooltip = document.createElement('div');
  tooltip.id = 'app-tooltip';
  tooltip.className = 'app-tooltip';
  document.body.appendChild(tooltip);

  let activeTarget = null;

  function hideTooltip() {
    tooltip.classList.remove('visible');
    activeTarget = null;
  }

  function positionTooltip(clientX, clientY) {
    const pad = 12;
    const { innerWidth, innerHeight } = window;
    const box = tooltip.getBoundingClientRect();

    let x = clientX + 14;
    let y = clientY + 14;

    if (x + box.width > innerWidth - pad) {
      x = clientX - box.width - 14;
    }
    if (y + box.height > innerHeight - pad) {
      y = clientY - box.height - 14;
    }

    x = Math.max(pad, Math.min(x, innerWidth - box.width - pad));
    y = Math.max(pad, Math.min(y, innerHeight - box.height - pad));

    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function showTooltipFor(target, clientX, clientY) {
    const text = target.getAttribute('data-tooltip');
    if (!text) {
      hideTooltip();
      return;
    }
    activeTarget = target;
    tooltip.textContent = text;
    tooltip.classList.add('visible');
    positionTooltip(clientX, clientY);
  }

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) {
      hideTooltip();
      return;
    }
    showTooltipFor(target, e.clientX, e.clientY);
  });

  document.addEventListener('mousemove', (e) => {
    if (!activeTarget) return;
    positionTooltip(e.clientX, e.clientY);
  });

  document.addEventListener('mouseout', (e) => {
    if (!activeTarget) return;
    const related = e.relatedTarget;
    if (related && activeTarget.contains(related)) return;
    if (related && related.closest && related.closest('[data-tooltip]') === activeTarget) return;
    hideTooltip();
  });

  document.addEventListener('focusin', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    showTooltipFor(target, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  document.addEventListener('focusout', () => {
    hideTooltip();
  });
}

function setupStaticHoverInfo() {
  setTooltipIfExists('preset-small', 'Good starting values for small objects at short distance.');
  setTooltipIfExists('preset-medium', 'Balanced starting values for common assembly tasks.');
  setTooltipIfExists('preset-large', 'Good starting values for large objects and longer distance.');

  // Keep tooltips only where they add explanation beyond visible labels.
  setTooltipIfExists('aperture-select', 'Choose between brighter image and larger focus range.');
  setTooltipIfExists('out-hyperfocal', 'Advanced focus metric; can usually be ignored for quick selection.');
}

function formatApertureOptionLabel(apertureValue, apertureList) {
  const sorted = [...apertureList].sort((a, b) => a - b);
  const idx = sorted.indexOf(apertureValue);
  const ratio = sorted.length > 1 ? idx / (sorted.length - 1) : 0.5;

  if (ratio <= 0.33) return `Brighter image (f/${apertureValue})`;
  if (ratio >= 0.67) return `More in focus (f/${apertureValue})`;
  return `Balanced (f/${apertureValue})`;
}

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
  setupHoverTooltipSystem();
  setupStaticHoverInfo();

  buildSidebar();
  if (state.cameras.length) selectCamera(state.cameras[0].id, false);

  // Wire sliders + number boxes
  wireSlider('distance-slider', 'distance-num', v => { state.distanceMm = v; recompute(); });
  wireSlider('objw-slider',     'objw-num',     v => { state.objectWidthMm = v; recompute(); });
  wireSlider('objl-slider',     'objl-num',     v => { state.objectLengthMm = v; recompute(); });
  wireSlider('objt-slider',     'objt-num',     v => { state.objectThicknessMm = v; recompute(); });

  $('lens-select').addEventListener('change', e => {
    state.lensMm = parseFloat(e.target.value);
    recompute();
  });
  $('aperture-select').addEventListener('change', e => {
    state.fNumber = parseFloat(e.target.value);
    recompute();
  });

  $('preset-small').addEventListener('click', () => applyPreset(300, 60, 45));
  $('preset-medium').addEventListener('click', () => applyPreset(1000, 280, 180));
  $('preset-large').addEventListener('click', () => applyPreset(1800, 900, 620));
}

function applyPreset(distanceMm, objectWidthMm, objectLengthMm) {
  state.distanceMm = distanceMm;
  state.objectWidthMm = objectWidthMm;
  state.objectLengthMm = objectLengthMm;
  $('distance-slider').value = distanceMm;
  $('distance-num').value = distanceMm;
  $('objw-slider').value = objectWidthMm;
  $('objw-num').value = objectWidthMm;
  $('objl-slider').value = objectLengthMm;
  $('objl-num').value = objectLengthMm;
  setFill($('distance-slider'));
  setFill($('objw-slider'));
  setFill($('objl-slider'));
  recompute();
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
function targetWidthForCamera(camera) {
  const objW = Math.max(1, state.objectWidthMm);
  const objL = Math.max(1, state.objectLengthMm);
  const aspect = camera.sensor.ccdWidthMm / Math.max(camera.sensor.ccdHeightMm, 0.001);

  // To fit object length in sensor height, the corresponding FOV width must also grow by sensor aspect.
  const widthNeededForLength = objL * aspect;
  return Math.max(objW, widthNeededForLength);
}

function isViable(camera, distanceMm, desiredWidthMm) {
  const minLens = Math.min(...camera.availableLensesMm);
  const maxFov  = distanceMm * camera.sensor.ccdWidthMm / minLens;
  return maxFov >= desiredWidthMm;
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

function cameraFit(camera, distanceMm, desiredWidthMm) {
  const viable = isViable(camera, distanceMm, desiredWidthMm);
  if (viable) return { viable, label: 'Works for current setup', badgeClass: 'badge-ok', badgeText: '✓' };
  return { viable, label: 'Field of view is too small', badgeClass: 'badge-nok', badgeText: '✕' };
}

function refreshSidebar() {
  for (const c of state.cameras) {
    const desiredWidthMm = targetWidthForCamera(c);
    const fit = cameraFit(c, state.distanceMm, desiredWidthMm);
    const minLens = Math.min(...c.availableLensesMm);
    const maxFovW = state.distanceMm * c.sensor.ccdWidthMm / Math.max(minLens, 0.001);
    const btn   = $('btn-'   + c.id);
    const badge = $('badge-' + c.id);
    if (!btn) continue;
    btn.classList.toggle('viable',   fit.viable);
    btn.classList.toggle('selected', c.id === state.cameraId);
    badge.className = 'status-badge ' + fit.badgeClass;
    badge.textContent = fit.badgeText;
    btn.setAttribute('data-tooltip',
      `${c.name}\n` +
      `Status: ${fit.label}\n` +
      `Required FOV width: ${desiredWidthMm.toFixed(1)} mm\n` +
      `Max FOV width (shortest lens): ${maxFovW.toFixed(1)} mm`
    );
    btn.removeAttribute('title');
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
    o.value = N;
    o.textContent = formatApertureOptionLabel(N, c.availableAperturesF);
    apSel.appendChild(o);
  }

  // Auto-select best lens (closest to ideal)
  const desiredWidthMm = targetWidthForCamera(c);
  const ideal = idealFocalLength(state.distanceMm, c.sensor.ccdWidthMm, desiredWidthMm);
  state.lensMm = pickClosestLens(ideal, c.availableLensesMm);
  lensSel.value = state.lensMm;

  // Default aperture = middle of list
  state.fNumber = c.availableAperturesF[Math.floor(c.availableAperturesF.length / 2)];
  apSel.value = state.fNumber;

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
    fovWidthMm:  targetWidthForCamera(c),
    camera:      c,
    lensMm:      state.lensMm,
    fNumber:     state.fNumber
  });

  $('out-ideal').textContent    = fmt(r.ideal, 1) + ' mm';
  $('out-ideal-acc').textContent = fmt(r.idealAccuracy, 4) + ' mm/px';
  $('out-fov').textContent      = `${fmt(r.fov.w, 1)} × ${fmt(r.fov.h, 1)} mm`;
  $('out-acc').textContent      = fmt(r.newAccuracy, 4) + ' mm/px';
  $('out-dofn').textContent     = fmt(r.dof.near, 1) + ' mm';
  $('out-doff').textContent     = isFinite(r.dof.far) ? (fmt(r.dof.far, 1) + ' mm') : 'Extends beyond working range';
  $('out-hyperfocal').textContent = fmt(r.dof.hyperfocal, 0) + ' mm';

  setTooltipIfExists('out-hyperfocal', `Advanced: hyperfocal distance is ${fmt(r.dof.hyperfocal, 0)} mm`);

  const detailMm = r.newAccuracy * 3;
  const fits = state.objectWidthMm <= r.fov.w && state.objectLengthMm <= r.fov.h;
  const fitMessage = fits
    ? `Object (${fmt(state.objectWidthMm, 0)} × ${fmt(state.objectLengthMm, 0)} mm) fits in the visible area.`
    : `Object (${fmt(state.objectWidthMm, 0)} × ${fmt(state.objectLengthMm, 0)} mm) is larger than the visible area.`;
  $('out-summary').textContent =
    `This setup covers ${fmt(r.fov.w, 0)} × ${fmt(r.fov.h, 0)} mm and can typically detect details around ${fmt(detailMm, 2)} mm. ${fitMessage}`;

  renderFov($('fov-svg'), {
    distanceMm:  state.distanceMm,
    distanceMinMm: parseFloat($('distance-slider').min) || 100,
    distanceMaxMm: parseFloat($('distance-slider').max) || 5000,
    fovWidthMm:  r.fov.w,
    fovHeightMm: r.fov.h,
    objectWidthMm: state.objectWidthMm,
    objectLengthMm: state.objectLengthMm,
    objectThicknessMm: state.objectThicknessMm,
    dofNear:     r.dof.near,
    dofFar:      r.dof.far
  });
}

window.addEventListener('DOMContentLoaded', init);
