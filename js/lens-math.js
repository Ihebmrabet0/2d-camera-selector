// Pure lens math functions. All distances in mm unless noted.

// Ideal focal length so that FOV width fits exactly on the sensor width.
function idealFocalLength(distanceMm, sensorWidthMm, fovWidthMm) {
  if (fovWidthMm <= 0) return NaN;
  return (distanceMm * sensorWidthMm) / fovWidthMm;
}

// mm-per-pixel accuracy at a given FOV width and horizontal pixel count.
function accuracyMmPerPx(fovWidthMm, pixelH) {
  if (pixelH <= 0) return NaN;
  return fovWidthMm / pixelH;
}

// Pick the closest available lens (mm) from a list to the ideal focal length.
function pickClosestLens(idealMm, availableLensesMm) {
  if (!availableLensesMm || availableLensesMm.length === 0) return null;
  let best = availableLensesMm[0];
  let bestDiff = Math.abs(best - idealMm);
  for (const f of availableLensesMm) {
    const d = Math.abs(f - idealMm);
    if (d < bestDiff) { best = f; bestDiff = d; }
  }
  return best;
}

// Actual FOV when using a given lens focal length at distance D.
function fovForLens(distanceMm, sensorWidthMm, sensorHeightMm, focalMm) {
  if (focalMm <= 0) return { w: NaN, h: NaN };
  return {
    w: (distanceMm * sensorWidthMm) / focalMm,
    h: (distanceMm * sensorHeightMm) / focalMm
  };
}

// Hyperfocal distance H = f^2 / (N * c) + f   (all mm; N is f-number, c is CoC in mm)
function hyperfocal(focalMm, fNumber, cocMm) {
  return (focalMm * focalMm) / (fNumber * cocMm) + focalMm;
}

// Depth of field near/far given subject distance D, focal f, f-number N, CoC c.
// Returns { near, far } in mm; far = Infinity when D >= H.
function depthOfField(distanceMm, focalMm, fNumber, cocMm) {
  const H = hyperfocal(focalMm, fNumber, cocMm);
  const D = distanceMm;
  const near = (D * (H - focalMm)) / (H + D - 2 * focalMm);
  let far;
  if (D >= H) {
    far = Infinity;
  } else {
    far = (D * (H - focalMm)) / (H - D);
  }
  return { near, far, hyperfocal: H };
}

// Convenience: full computation bundle.
function computeAll({ distanceMm, fovWidthMm, camera, lensMm, fNumber }) {
  const s = camera.sensor;
  const ideal = idealFocalLength(distanceMm, s.ccdWidthMm, fovWidthMm);
  const idealAccuracy = accuracyMmPerPx(fovWidthMm, s.pixelH);
  const fov = fovForLens(distanceMm, s.ccdWidthMm, s.ccdHeightMm, lensMm);
  const newAccuracy = accuracyMmPerPx(fov.w, s.pixelH);
  const dof = depthOfField(distanceMm, lensMm, fNumber, camera.circleOfConfusionMm);
  return { ideal, idealAccuracy, fov, newAccuracy, dof };
}

if (typeof module !== 'undefined') {
  module.exports = {
    idealFocalLength, accuracyMmPerPx, pickClosestLens,
    fovForLens, hyperfocal, depthOfField, computeAll
  };
}
