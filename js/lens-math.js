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
  if (!(focalMm > 0) || !(fNumber > 0) || !(cocMm > 0)) return NaN;
  return (focalMm * focalMm) / (fNumber * cocMm) + focalMm;
}

// Depth of field near/far given subject distance D, focal f, f-number N, CoC c.
// Returns { near, far } in mm; far = Infinity when D >= H.
function depthOfField(distanceMm, focalMm, fNumber, cocMm) {
  const H = hyperfocal(focalMm, fNumber, cocMm);
  const D = distanceMm;
  if (!isFinite(H) || !(D > 0)) {
    return { near: NaN, far: NaN, hyperfocal: H };
  }

  // Standard thin-lens DoF equations using distances from the lens plane.
  const nearDen = H + (D - focalMm);
  const near = (H * D) / nearDen;

  let far;
  if (D >= H) {
    far = Infinity;
  } else {
    const farDen = H - (D - focalMm);
    far = (H * D) / farDen;
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

  const pixelBasedCocMm = (s.pixelSizeUm > 0) ? (s.pixelSizeUm * 0.001) : NaN;
  const configuredCocMm = camera.circleOfConfusionMm;
  let effectiveCocMm = configuredCocMm;

  // Keep DoF conservative for machine-vision use by not exceeding a 1-pixel CoC.
  if (isFinite(pixelBasedCocMm) && pixelBasedCocMm > 0) {
    if (isFinite(configuredCocMm) && configuredCocMm > 0) {
      effectiveCocMm = Math.min(configuredCocMm, pixelBasedCocMm);
    } else {
      effectiveCocMm = pixelBasedCocMm;
    }
  }

  const dof = depthOfField(distanceMm, lensMm, fNumber, effectiveCocMm);
  return { ideal, idealAccuracy, fov, newAccuracy, dof, effectiveCocMm };
}

if (typeof module !== 'undefined') {
  module.exports = {
    idealFocalLength, accuracyMmPerPx, pickClosestLens,
    fovForLens, hyperfocal, depthOfField, computeAll
  };
}
