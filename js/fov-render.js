// Renders an SVG FOV diagram matching Mech-Mind visual style.
// renderFov(svgEl, {
//   distanceMm, distanceMinMm, distanceMaxMm,
//   fovWidthMm, fovHeightMm, objectWidthMm, objectLengthMm,
//   dofNear, dofFar
// })

function renderFov(svg, {
  distanceMm, distanceMinMm, distanceMaxMm,
  fovWidthMm, fovHeightMm,
  objectWidthMm, objectLengthMm,
  dofNear, dofFar
}) {
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

  const outerPad = 28;
  const viewGap = 52;
  const viewWidth = (W - outerPad * 2 - viewGap) / 2;
  const leftCx = outerPad + viewWidth / 2;
  const rightCx = outerPad + viewWidth + viewGap + viewWidth / 2;

  const camY = 44;
  const camW = 84;
  const camH = 24;
  const workTopY = 188;
  const workBottomY = 320;

  const minHalf = 26;
  const maxHalf = viewWidth * 0.38;
  const baseHalfW = Math.max(minHalf, Math.min(maxHalf, fovWidthMm * 0.105));
  const baseHalfH = Math.max(minHalf, Math.min(maxHalf, (fovHeightMm || fovWidthMm) * 0.14));

  const dMin = distanceMinMm ?? 100;
  const dMax = distanceMaxMm ?? 5000;

  function yForDistance(d) {
    const t = Math.max(0, Math.min(1, (d - dMin) / Math.max(1, dMax - dMin)));
    return workTopY + t * (workBottomY - workTopY);
  }

  function halfAt(y, topHalf, bottomHalf) {
    const t = Math.max(0, Math.min(1, (y - workTopY) / Math.max(1, workBottomY - workTopY)));
    return topHalf + t * (bottomHalf - topHalf);
  }

  function drawView(cx, baseHalf, mmLabel, objectMm, fovMm, sideView) {
    const topHalf = baseHalf * 0.62;
    const bottomHalf = baseHalf;
    const objY = yForDistance(distanceMm);

    const dofNearDist = (dofNear && isFinite(dofNear)) ? dofNear : distanceMm;
    const dofFarDist = (dofFar && isFinite(dofFar)) ? dofFar : dMax;
    const trapTopY = Math.max(workTopY, Math.min(workBottomY - 40, yForDistance(dofNearDist)));
    const trapBottomY = Math.min(workBottomY, Math.max(trapTopY + 40, yForDistance(dofFarDist)));

    function halfAtLocal(y) {
      const t = Math.max(0, Math.min(1, (y - trapTopY) / Math.max(1, trapBottomY - trapTopY)));
      return topHalf + t * (bottomHalf - topHalf);
    }

    el('polygon', {
      points: `${cx - topHalf},${trapTopY} ${cx + topHalf},${trapTopY} ${cx + bottomHalf},${trapBottomY} ${cx - bottomHalf},${trapBottomY}`,
      fill: '#dbeafe',
      stroke: '#3b82f6',
      'stroke-width': 1.5
    });

    el('line', {
      x1: cx,
      y1: trapTopY,
      x2: cx,
      y2: trapBottomY + 14,
      stroke: '#94a3b8',
      'stroke-dasharray': '5 4',
      'stroke-width': 1
    });

    if (sideView) {
      el('rect', {
        x: cx - camW * 0.46,
        y: camY + 2,
        width: camW * 0.8,
        height: camH - 4,
        fill: '#1e293b',
        rx: 4
      });
      el('rect', {
        x: cx - camW * 0.40,
        y: camY + 5,
        width: 2,
        height: 14,
        fill: '#22c55e',
        rx: 0.8
      });
      el('rect', {
        x: cx - camW * 0.36,
        y: camY + 5,
        width: 2,
        height: 14,
        fill: '#22c55e',
        rx: 0.8
      });
      el('rect', {
        x: cx - camW * 0.32,
        y: camY + 5,
        width: 2,
        height: 14,
        fill: '#22c55e',
        rx: 0.8
      });
      el('rect', {
        x: cx - 6,
        y: camY + camH - 3,
        width: 12,
        height: 6,
        fill: '#64748b',
        rx: 2
      });
      el('rect', {
        x: cx + camW * 0.34,
        y: camY + 7,
        width: 14,
        height: camH - 14,
        fill: '#334155',
        rx: 2
      });
      el('circle', {
        cx: cx + camW * 0.49,
        cy: camY + camH / 2,
        r: 7,
        fill: '#0f172a',
        stroke: '#64748b',
        'stroke-width': 1
      });
      el('circle', {
        cx: cx + camW * 0.49,
        cy: camY + camH / 2,
        r: 4,
        fill: '#1e293b'
      });
    } else {
      el('rect', {
        x: cx - camW / 2,
        y: camY,
        width: camW,
        height: camH,
        fill: '#1e293b',
        rx: 4
      });
      el('rect', {
        x: cx - 6,
        y: camY + camH - 1,
        width: 12,
        height: 6,
        fill: '#64748b',
        rx: 2
      });
    }

    const objectRatio = Math.max(0, objectMm / Math.max(fovMm, 1));
    const objTopY = objY - 22;
    const objBottomY = objY + 2;
    const objHalfAtTop = halfAtLocal(Math.max(trapTopY, Math.min(trapBottomY, objTopY)));
    const objHalfAtBottom = halfAtLocal(Math.max(trapTopY, Math.min(trapBottomY, objBottomY)));
    const minHalfAcrossObject = Math.min(objHalfAtTop, objHalfAtBottom);
    const objWidth = Math.max(18, minHalfAcrossObject * 2 * objectRatio);
    const objectHalfPx = objWidth / 2;
    const fitsHorizontally = objectHalfPx < (minHalfAcrossObject - 0.5);
    const fitsVertically = objTopY >= trapTopY && objBottomY <= trapBottomY;
    const fitsInView = fitsHorizontally && fitsVertically;
    const objColor = fitsInView ? '#59b38f' : '#ef6b6b';
    el('rect', {
      x: cx - objWidth / 2,
      y: objTopY,
      width: objWidth,
      height: 24,
      fill: objColor,
      opacity: 0.82,
      stroke: fitsInView ? '#2f8a67' : '#d14343',
      'stroke-width': 0.8,
      rx: 2
    });

    function drawHorizontalDimension(xL, xR, y, label, anchorY) {
      el('line', { x1: xL, y1: y, x2: xR, y2: y, stroke: '#374151', 'stroke-width': 1.3 });
      el('line', { x1: xL, y1: y - 5, x2: xL, y2: y + 5, stroke: '#374151', 'stroke-width': 1.3 });
      el('line', { x1: xR, y1: y - 5, x2: xR, y2: y + 5, stroke: '#374151', 'stroke-width': 1.3 });
      el('line', { x1: xL, y1: anchorY, x2: xL, y2: y - 8, stroke: '#a3a3a3', 'stroke-width': 1 });
      el('line', { x1: xR, y1: anchorY, x2: xR, y2: y - 8, stroke: '#a3a3a3', 'stroke-width': 1 });
      el('text', {
        x: (xL + xR) / 2,
        y: y - 8,
        'text-anchor': 'middle',
        fill: '#374151',
        'font-size': 12,
        'font-weight': '700',
        'font-family': 'Segoe UI, Arial, sans-serif'
      }, `${Math.round(label)} mm`);
    }

    const topDimY = trapTopY - 14;
    const topLabelMm = mmLabel * (topHalf / Math.max(bottomHalf, 1));
    drawHorizontalDimension(cx - topHalf, cx + topHalf, topDimY, topLabelMm, trapTopY);

    const dimY = trapBottomY + 30;
    drawHorizontalDimension(cx - bottomHalf, cx + bottomHalf, dimY, mmLabel, trapBottomY + 1);

    if (!sideView) {
      const nearY = trapTopY;
      const farY = trapBottomY;
      const nearLabelX = cx - halfAtLocal(nearY) - 8;
      el('line', {
        x1: nearLabelX,
        y1: nearY,
        x2: nearLabelX - 18,
        y2: nearY,
        stroke: '#d97706',
        'stroke-dasharray': '3 2',
        'stroke-width': 1
      });
      el('text', {
        x: nearLabelX - 22,
        y: nearY + 4,
        'text-anchor': 'end',
        fill: '#92400e',
        'font-size': 11,
        'font-family': 'Segoe UI, Arial, sans-serif'
      }, `DoFn ${Math.round(dofNearDist)} mm`);

      const farLabelX = cx - halfAtLocal(farY) - 8;
      el('line', {
        x1: farLabelX,
        y1: farY,
        x2: farLabelX - 18,
        y2: farY,
        stroke: '#d97706',
        'stroke-dasharray': '3 2',
        'stroke-width': 1
      });
      el('text', {
        x: farLabelX - 22,
        y: farY + 4,
        'text-anchor': 'end',
        fill: '#92400e',
        'font-size': 11,
        'font-family': 'Segoe UI, Arial, sans-serif'
      }, `DoFf ${isFinite(dofFarDist) ? Math.round(dofFarDist) : 'inf'} mm`);
    }
  }

  drawView(leftCx, baseHalfW, fovWidthMm, objectWidthMm || 0, fovWidthMm, false);
  drawView(rightCx, baseHalfH, (fovHeightMm || 0), objectLengthMm || 0, (fovHeightMm || 1), true);

  const rightBottomHalf = baseHalfH;
  const dArrowX = rightCx + rightBottomHalf + 30;
  const objYForDistance = yForDistance(distanceMm);
  const objTopYForDistance = objYForDistance - 22;
  const distStartY = camY + camH + 3;
  const distEndY = objTopYForDistance;
  const distTopY = Math.min(distStartY, distEndY);
  const distBottomY = Math.max(distStartY, distEndY);
  el('line', { x1: dArrowX, y1: distTopY, x2: dArrowX, y2: distBottomY, stroke: '#374151', 'stroke-width': 1.3 });
  el('line', { x1: dArrowX - 5, y1: distTopY, x2: dArrowX + 5, y2: distTopY, stroke: '#374151', 'stroke-width': 1.3 });
  el('line', { x1: dArrowX - 5, y1: distBottomY, x2: dArrowX + 5, y2: distBottomY, stroke: '#374151', 'stroke-width': 1.3 });
  const distLabelX = dArrowX + 9;
  const distLabelY = (distTopY + distBottomY) / 2 + 4;
  el('text', {
    x: distLabelX,
    y: distLabelY,
    'text-anchor': 'start',
    fill: '#374151',
    'font-size': 12,
    'font-weight': '600',
    'font-family': 'Segoe UI, Arial, sans-serif'
  }, `${Math.round(distanceMm)} mm`);
}
