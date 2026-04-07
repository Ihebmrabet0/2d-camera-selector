// App state and DOM wiring for the 2D Camera Selector.

const state = {
  cameras: [],
  cameraId: null,
  distanceMm: 1000,
  objectWidthMm: 300,
  objectLengthMm: 200,
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
  wireSlider('objw-slider',     'objw-num',     v => { state.objectWidthMm = v; recompute(); });
  wireSlider('objl-slider',     'objl-num',     v => { state.objectLengthMm = v; recompute(); });

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
      `<span class="fit-tag" id="fit-${c.id}">Not fit</span>` +
      `<span class="status-badge badge-nok" id="badge-${c.id}">✕</span>`;
    btn.addEventListener('click', () => selectCamera(c.id, true));
    sidebar.appendChild(btn);
  }
}

function cameraFit(camera, distanceMm, desiredWidthMm) {
  const viable = isViable(camera, distanceMm, desiredWidthMm);
  const ideal = idealFocalLength(distanceMm, camera.sensor.ccdWidthMm, desiredWidthMm);
  const bestLens = pickClosestLens(ideal, camera.availableLensesMm);
  const actual = fovForLens(
    distanceMm,
    camera.sensor.ccdWidthMm,
    camera.sensor.ccdHeightMm,
    bestLens
  );

  const requiredHeightMm = desiredWidthMm * camera.sensor.ccdHeightMm / Math.max(camera.sensor.ccdWidthMm, 0.001);
  const widthError = Math.abs(actual.w - desiredWidthMm) / Math.max(desiredWidthMm, 1);
  const heightError = Math.abs(actual.h - requiredHeightMm) / Math.max(requiredHeightMm, 1);
  const coverageError = (widthError + heightError) / 2;
  const megaPixels = (camera.sensor.pixelH * camera.sensor.pixelV) / 1000000;
  const resolutionBonus = Math.min(20, megaPixels * 1.4);

  let score = 100 - coverageError * 60 + resolutionBonus;
  if (!viable) score -= 40;
  score = Math.max(0, Math.min(130, score));

  if (!viable) return { viable, score, label: 'Not fit', badgeClass: 'badge-nok', badgeText: '✕' };
  if (score >= 110) return { viable, score, label: 'Best', badgeClass: 'badge-best', badgeText: '1' };
  if (score >= 95) return { viable, score, label: 'Good', badgeClass: 'badge-good', badgeText: '2' };
  return { viable, score, label: 'Possible', badgeClass: 'badge-possible', badgeText: '3' };
}

function refreshSidebar() {
  const sidebar = $('camera-sidebar');
  const ranked = state.cameras
    .map(c => {
      const desiredWidthMm = targetWidthForCamera(c);
      return { camera: c, fit: cameraFit(c, state.distanceMm, desiredWidthMm) };
    })
    .sort((a, b) => b.fit.score - a.fit.score);

  for (const entry of ranked) {
    const c = entry.camera;
    const fit = entry.fit;
    const btn   = $('btn-'   + c.id);
    const badge = $('badge-' + c.id);
    const fitLabel = $('fit-' + c.id);
    if (!btn) continue;
    btn.classList.toggle('viable',   fit.viable);
    btn.classList.toggle('selected', c.id === state.cameraId);
    badge.className = 'status-badge ' + fit.badgeClass;
    badge.textContent = fit.badgeText;
    fitLabel.textContent = fit.label;
    sidebar.appendChild(btn);
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
  const desiredWidthMm = targetWidthForCamera(c);
  const ideal = idealFocalLength(state.distanceMm, c.sensor.ccdWidthMm, desiredWidthMm);
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
    dofNear:     r.dof.near,
    dofFar:      r.dof.far
  });
}

window.addEventListener('DOMContentLoaded', init);
