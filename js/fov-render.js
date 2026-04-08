// Renders an SVG FOV diagram matching Mech-Mind visual style.
// renderFov(svgEl, {
//   distanceMm, distanceMinMm, distanceMaxMm,
//   fovWidthMm, fovHeightMm, objectWidthMm, objectLengthMm,
//   dofNear, dofFar
// })

function renderFov(svg, {
  distanceMm, distanceMinMm, distanceMaxMm,
  fovWidthMm, fovHeightMm,
  objectWidthMm, objectLengthMm, objectThicknessMm = 50,
  dofNear, dofFar
}) {
  const W = 660, H = 420;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';

  const ns = 'http://www.w3.org/2000/svg';
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const edgePad = 10;
  const el = (tag, attrs, text) => {
    const e = document.createElementNS(ns, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    svg.appendChild(e);
    return e;
  };

  function drawEdgeSafeText({
    x,
    y,
    text,
    fill,
    fontSize = 11,
    fontWeight = '400',
    fontFamily = 'Segoe UI, Arial, sans-serif',
    preferredAnchor = 'end'
  }) {
    const t = el('text', {
      x,
      y,
      'text-anchor': preferredAnchor,
      fill,
      'font-size': fontSize,
      'font-weight': fontWeight,
      'font-family': fontFamily
    }, text);

    let box = t.getBBox();
    if (box.x < edgePad) {
      t.setAttribute('text-anchor', 'start');
      t.setAttribute('x', String(edgePad));
      box = t.getBBox();
    }
    if (box.x + box.width > (W - edgePad)) {
      t.setAttribute('text-anchor', 'end');
      t.setAttribute('x', String(W - edgePad));
      box = t.getBBox();
    }

    return {
      left: box.x,
      right: box.x + box.width,
      anchor: t.getAttribute('text-anchor') || preferredAnchor,
      x: parseFloat(t.getAttribute('x') || String(x))
    };
  }

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

  const focusDistanceMm = Math.max(dMin, Math.min(dMax, distanceMm));
  const nearDistMm = (dofNear && isFinite(dofNear))
    ? Math.max(dMin, Math.min(dMax, dofNear))
    : focusDistanceMm;
  const farDistForGeometryMm = (dofFar && isFinite(dofFar))
    ? Math.max(nearDistMm + 1, Math.min(dMax, dofFar))
    : Math.max(nearDistMm + 1, Math.min(dMax, focusDistanceMm * 2.6));

  // Use a local distance window so focus and DoF planes remain visually distinct.
  const sceneMinDistMm = Math.max(dMin, nearDistMm * 0.9);
  const sceneMaxDistMm = Math.min(dMax, Math.max(farDistForGeometryMm, focusDistanceMm) * 1.08);
  const sceneSpanMm = Math.max(1, sceneMaxDistMm - sceneMinDistMm);

  function yForDistance(d) {
    const clamped = Math.max(sceneMinDistMm, Math.min(sceneMaxDistMm, d));
    const t = Math.max(0, Math.min(1, (clamped - sceneMinDistMm) / sceneSpanMm));
    return workTopY + t * (workBottomY - workTopY);
  }

  function drawView(cx, baseHalf, mmLabel, objectMm, fovMm, sideView) {
    const localFocusDistMm = Math.max(1, focusDistanceMm);
    const lensY = camY + camH + 2;

    const dofNearDist = nearDistMm;
    const dofFarDist = farDistForGeometryMm;
    const trapTopY = Math.max(workTopY, Math.min(workBottomY - 40, yForDistance(dofNearDist)));
    const trapBottomY = Math.min(workBottomY, Math.max(trapTopY + 40, yForDistance(dofFarDist)));
    const focusY = Math.max(trapTopY + 4, Math.min(trapBottomY - 4, yForDistance(focusDistanceMm)));

    const fovAtDistance = (distanceVal) => {
      return (mmLabel * Math.max(distanceVal, 1)) / localFocusDistMm;
    };

    const nearFovMm = fovAtDistance(dofNearDist);
    const farFovMm = fovAtDistance(dofFarDist);
    const maxFovMmInView = Math.max(nearFovMm, farFovMm, mmLabel, 1);
    const pxPerMm = (maxHalf * 2) / maxFovMmInView;

    const topHalf = Math.max(8, (nearFovMm * pxPerMm) / 2);
    const bottomHalf = Math.max(topHalf + 2, (farFovMm * pxPerMm) / 2);
    const focusHalf = Math.max(topHalf + 1, (mmLabel * pxPerMm) / 2);

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

    // Rays from the camera toward the field ensure trapezoid side direction is camera-consistent.
    el('line', {
      x1: cx,
      y1: lensY,
      x2: cx - bottomHalf,
      y2: trapBottomY,
      stroke: '#3b82f6',
      'stroke-width': 1.1,
      opacity: 0.35
    });
    el('line', {
      x1: cx,
      y1: lensY,
      x2: cx + bottomHalf,
      y2: trapBottomY,
      stroke: '#3b82f6',
      'stroke-width': 1.1,
      opacity: 0.35
    });

    // Focus plane (the configured camera-to-object distance).
    el('line', {
      x1: cx - focusHalf,
      y1: focusY,
      x2: cx + focusHalf,
      y2: focusY,
      stroke: '#1f2937',
      'stroke-width': 1,
      opacity: 0.35,
      'stroke-dasharray': '5 4'
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
    const halfThicknessMm = Math.max(0, objectThicknessMm) / 2;
    const objNearY = yForDistance(focusDistanceMm - halfThicknessMm);
    const objFarY = yForDistance(focusDistanceMm + halfThicknessMm);
    const objTopY = Math.min(objNearY, objFarY);
    const objBottomY = Math.max(objNearY, objFarY);
    const objHalfAtTop = halfAtLocal(Math.max(trapTopY, Math.min(trapBottomY, objTopY)));
    const objHalfAtBottom = halfAtLocal(Math.max(trapTopY, Math.min(trapBottomY, objBottomY)));
    const minHalfAcrossObject = Math.min(objHalfAtTop, objHalfAtBottom);
    const objWidth = Math.max(6, minHalfAcrossObject * 2 * objectRatio);
    const objectHalfPx = objWidth / 2;
    const fitsHorizontally = objectHalfPx < (minHalfAcrossObject - 0.5);
    const fitsVertically = objTopY >= trapTopY && objBottomY <= trapBottomY;
    const fitsInView = fitsHorizontally && fitsVertically;
    const objColor = fitsInView ? '#59b38f' : '#ef6b6b';
    el('rect', {
      x: cx - objWidth / 2,
      y: objTopY,
      width: objWidth,
      height: Math.max(2, objBottomY - objTopY),
      fill: objColor,
      opacity: 0.82,
      stroke: fitsInView ? '#2f8a67' : '#d14343',
      'stroke-width': 0.8,
      rx: 0
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
    drawHorizontalDimension(cx - topHalf, cx + topHalf, topDimY, nearFovMm, trapTopY);

    const dimY = trapBottomY + 30;
    drawHorizontalDimension(cx - bottomHalf, cx + bottomHalf, dimY, farFovMm, trapBottomY + 1);

    // Additional reference: actual FOV width at focus distance (camera-to-object setting).
    const focusDimY = Math.min(trapBottomY - 10, focusY + 22);
    drawHorizontalDimension(cx - focusHalf, cx + focusHalf, focusDimY, mmLabel, focusY);

    if (!sideView) {
      const nearY = trapTopY;
      const farY = trapBottomY;
      const nearLabelX = cx - halfAtLocal(nearY) - 8;
      const leftLabelLaneX = cx - bottomHalf - 34;
      const nearTextY = Math.max(12, nearY - 8);
      const nearText = drawEdgeSafeText({
        x: leftLabelLaneX,
        y: nearTextY,
        text: `Sharp from ${Math.round(dofNearDist)} mm`,
        fill: '#92400e',
        preferredAnchor: 'end'
      });
      const nearLineEndX = nearLabelX > nearText.right
        ? clamp(nearText.right + 4, edgePad, W - edgePad)
        : clamp(nearText.left - 4, edgePad, W - edgePad);
      el('line', {
        x1: nearLabelX,
        y1: nearY,
        x2: nearLineEndX,
        y2: nearY,
        stroke: '#d97706',
        'stroke-dasharray': '3 2',
        'stroke-width': 1
      });

      const farLabelX = cx - halfAtLocal(farY) - 8;
      const farTextY = Math.min(H - 10, farY + 14);
      const farText = drawEdgeSafeText({
        x: leftLabelLaneX,
        y: farTextY,
        text: `Sharp to ${isFinite(dofFarDist) ? Math.round(dofFarDist) : 'inf'} mm`,
        fill: '#92400e',
        preferredAnchor: 'end'
      });
      const farLineEndX = farLabelX > farText.right
        ? clamp(farText.right + 4, edgePad, W - edgePad)
        : clamp(farText.left - 4, edgePad, W - edgePad);
      el('line', {
        x1: farLabelX,
        y1: farY,
        x2: farLineEndX,
        y2: farY,
        stroke: '#d97706',
        'stroke-dasharray': '3 2',
        'stroke-width': 1
      });
    }
  }

  drawView(leftCx, baseHalfW, fovWidthMm, objectWidthMm || 0, fovWidthMm, false);
  drawView(rightCx, baseHalfH, (fovHeightMm || 0), objectLengthMm || 0, (fovHeightMm || 1), true);

  const rightBottomHalf = baseHalfH;
  const dArrowX = clamp(rightCx + rightBottomHalf + 30, edgePad + 4, W - edgePad - 4);
  const focusYForDistance = yForDistance(focusDistanceMm);
  const distStartY = camY + camH + 3;
  const distEndY = focusYForDistance;
  const distTopY = Math.min(distStartY, distEndY);
  const distBottomY = Math.max(distStartY, distEndY);
  el('line', { x1: dArrowX, y1: distTopY, x2: dArrowX, y2: distBottomY, stroke: '#374151', 'stroke-width': 1.3 });
  el('line', { x1: dArrowX - 5, y1: distTopY, x2: dArrowX + 5, y2: distTopY, stroke: '#374151', 'stroke-width': 1.3 });
  el('line', { x1: dArrowX - 5, y1: distBottomY, x2: dArrowX + 5, y2: distBottomY, stroke: '#374151', 'stroke-width': 1.3 });
  const distLabelRawX = dArrowX + 9;
  const distLabelOnRight = distLabelRawX <= (W - edgePad);
  const distLabelX = distLabelOnRight ? distLabelRawX : (dArrowX - 9);
  const distLabelY = (distTopY + distBottomY) / 2 + 4;
  el('text', {
    x: distLabelX,
    y: distLabelY,
    'text-anchor': distLabelOnRight ? 'start' : 'end',
    fill: '#374151',
    'font-size': 12,
    'font-weight': '600',
    'font-family': 'Segoe UI, Arial, sans-serif'
  }, `${Math.round(distanceMm)} mm`);
}
