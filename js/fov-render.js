// Renders an SVG FOV diagram matching Mech-Mind visual style.
// renderFov(svgEl, { distanceMm, fovWidthMm, fovHeightMm, dofNear, dofFar })

function renderFov(svg, { distanceMm, fovWidthMm, fovHeightMm, dofNear, dofFar }) {
  const W = 660, H = 420;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';

  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => {
    const e = document.createElementNS(ns, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    svg.appendChild(e);
    return e;
  };

  // Layout constants
  const cx    = 300;   // horizontal center (left of right-side labels)
  const camY  = 22;
  const objY  = 360;
  const camW  = 92, camH = 24;
  const coneTop = camY + camH;
  const coneH   = objY - coneTop;

  // Scale FOV width visually — capped so it fits the canvas
  const maxDraw = 440;
  const halfFov = Math.max(40, Math.min(maxDraw / 2, fovWidthMm * 0.22));

  // Helper: x-width at a given y inside the cone
  const halfAt = (y) => halfFov * (y - coneTop) / coneH;

  // --- DoF polygon (yellow band) ---
  const dofNearY = (dofNear && isFinite(dofNear))
    ? Math.max(coneTop + 2, coneTop + coneH * (dofNear / distanceMm)) : null;
  const dofFarRaw = (dofFar && isFinite(dofFar))
    ? coneTop + coneH * (dofFar / distanceMm) : objY + 20;
  const dofFarY = Math.min(objY + 20, dofFarRaw);

  if (dofNearY != null) {
    const nw = halfAt(dofNearY), fw = halfAt(dofFarY);
    el('polygon', {
      points: `${cx-nw},${dofNearY} ${cx+nw},${dofNearY} ${cx+fw},${dofFarY} ${cx-fw},${dofFarY}`,
      fill: '#fef3c7', stroke: '#f59e0b', 'stroke-width': 1, opacity: 0.9
    });
  }

  // --- Main FOV cone (trapezoid) ---
  el('polygon', {
    points: `${cx},${coneTop} ${cx-halfFov},${objY} ${cx+halfFov},${objY}`,
    fill: '#dbeafe', stroke: '#3b82f6', 'stroke-width': 1.5
  });

  // --- Object bar at bottom ---
  el('rect', {
    x: cx - halfFov * 0.55, y: objY - 8,
    width: halfFov * 1.1, height: 14,
    fill: '#f87171', rx: 2
  });

  // --- Center dashed axis ---
  el('line', {
    x1: cx, y1: coneTop, x2: cx, y2: objY + 15,
    stroke: '#94a3b8', 'stroke-dasharray': '5 4', 'stroke-width': 1
  });

  // --- Camera body ---
  el('rect', {
    x: cx - camW / 2, y: camY,
    width: camW, height: camH,
    fill: '#1e293b', rx: 4
  });
  // Lens circle on camera
  el('circle', {
    cx: cx - camW / 2 + 16, cy: camY + camH / 2,
    r: 7, fill: '#334155', stroke: '#64748b', 'stroke-width': 1.2
  });
  el('circle', {
    cx: cx - camW / 2 + 16, cy: camY + camH / 2,
    r: 3, fill: '#0f172a'
  });

  // --- FOV width dimension line at object plane ---
  const dimY = objY + 32;
  // line + ticks
  el('line', { x1: cx - halfFov, y1: dimY, x2: cx + halfFov, y2: dimY, stroke: '#374151', 'stroke-width': 1.4 });
  el('line', { x1: cx - halfFov, y1: dimY - 5, x2: cx - halfFov, y2: dimY + 5, stroke: '#374151', 'stroke-width': 1.4 });
  el('line', { x1: cx + halfFov, y1: dimY - 5, x2: cx + halfFov, y2: dimY + 5, stroke: '#374151', 'stroke-width': 1.4 });
  el('text', {
    x: cx, y: dimY + 16,
    'text-anchor': 'middle', fill: '#374151',
    'font-size': 13, 'font-weight': '700', 'font-family': 'Segoe UI, Arial, sans-serif'
  }, `${Math.round(fovWidthMm)} mm`);

  // --- D dimension arrow (right side) ---
  const dArrowX = cx + halfFov + 46;
  el('line', { x1: dArrowX, y1: coneTop, x2: dArrowX, y2: objY, stroke: '#374151', 'stroke-width': 1.4 });
  el('line', { x1: dArrowX - 5, y1: coneTop, x2: dArrowX + 5, y2: coneTop, stroke: '#374151', 'stroke-width': 1.4 });
  el('line', { x1: dArrowX - 5, y1: objY,   x2: dArrowX + 5, y2: objY,   stroke: '#374151', 'stroke-width': 1.4 });
  el('text', {
    x: dArrowX + 10, y: (coneTop + objY) / 2 + 5,
    'text-anchor': 'start', fill: '#374151',
    'font-size': 12, 'font-weight': '600', 'font-family': 'Segoe UI, Arial, sans-serif'
  }, `D = ${Math.round(distanceMm)} mm`);

  // --- DoF labels (left side) ---
  if (dofNearY != null) {
    const lblX = cx - halfAt(dofNearY) - 8;
    el('line', { x1: lblX, y1: dofNearY, x2: lblX - 18, y2: dofNearY, stroke: '#d97706', 'stroke-dasharray': '3 2', 'stroke-width': 1 });
    el('text', {
      x: lblX - 22, y: dofNearY + 4,
      'text-anchor': 'end', fill: '#92400e',
      'font-size': 11, 'font-family': 'Segoe UI, Arial, sans-serif'
    }, `DoFn ${isFinite(dofNear) ? Math.round(dofNear) : '∞'} mm`);

    const fLblY = Math.min(objY + 16, dofFarY);
    const fLblX = cx - halfAt(fLblY) - 8;
    el('line', { x1: fLblX, y1: fLblY, x2: fLblX - 18, y2: fLblY, stroke: '#d97706', 'stroke-dasharray': '3 2', 'stroke-width': 1 });
    el('text', {
      x: fLblX - 22, y: fLblY + 4,
      'text-anchor': 'end', fill: '#92400e',
      'font-size': 11, 'font-family': 'Segoe UI, Arial, sans-serif'
    }, `DoFf ${isFinite(dofFar) ? Math.round(dofFar) : '∞'} mm`);
  }

  // Optional: FOV height annotation inside cone
  if (fovHeightMm) {
    el('text', {
      x: cx - 5, y: (coneTop + objY) / 2,
      'text-anchor': 'middle', fill: '#1e40af',
      'font-size': 10, 'font-family': 'Segoe UI, Arial, sans-serif',
      opacity: 0.7
    }, 'FOV');
  }
}
