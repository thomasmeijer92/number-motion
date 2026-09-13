import { getGlyph } from './glyphs.js';
import { FULL_COMPOSITION_FRAMES } from './full-composition-frames.js';

// The 0.45-second motion contains fifteen 30 ms exposures. Its final exposure
// is a hold: keep frame 14 from 0.42 seconds onward instead of extrapolating.
export function sampleFullComposition(effect, progress) {
  const composition = FULL_COMPOSITION_FRAMES[effect];
  if (!composition) throw new RangeError(`Unknown full composition: ${effect}`);
  const frame = Math.max(0, Math.min(composition.rows.length - 1,
    (Number.isFinite(progress) ? progress : 0) * 15));
  const nearest = Math.round(frame);
  const at = Math.abs(frame - nearest) < 1e-9 ? nearest : frame;
  const index = Math.floor(at);
  const amount = at - index;
  const current = composition.rows[index];
  const next = composition.rows[Math.min(index + 1, composition.rows.length - 1)];
  return current.map((pose, i) => {
    const [x, y, height, rotation, width] = pose.map((value, j) => value + (next[i][j] - value) * amount);
    return { id: composition.ids[i], x, y, height, rotation, width };
  });
}

// One selected grapheme is repeated at every measured pose. Preview and export
// supply the same progress; no browser clock or frame-dependent state is used.
export function renderFullComposition(ctx, scene, progress, width, height, effect = scene.effect) {
  const poses = sampleFullComposition(effect, progress);
  const mask = getGlyph(scene.digit, scene.fg);
  if (!mask) throw new Error('The character has not loaded yet. Try again.');
  // Patterns cover the output crop in every aspect ratio. Fitting them by the
  // short edge would expose empty bands above/below the four-row zoom pattern
  // in portrait. The quartet remains a centered, independently sized group.
  const unit = effect === 'quad' ? Math.min(width, height) / 788 : Math.max(width / 1400, height / 788);
  const characterUnit = unit * mask.characterScale;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (const pose of poses) {
    // Side members have fixed +/-90-degree orientations. Swap their local
    // dimensions so rotation happens before the measured painted-box fit.
    const glyphHeight = (pose.width || pose.height) * characterUnit;
    const glyphWidth = pose.width ? pose.height * characterUnit : glyphHeight * mask.width / mask.height;
    ctx.save();
    ctx.translate(width / 2 + (pose.x - 700) * unit, height / 2 + (pose.y - 394) * unit);
    ctx.rotate(pose.rotation);
    ctx.drawImage(mask, -glyphWidth / 2, -glyphHeight / 2, glyphWidth, glyphHeight);
    ctx.restore();
  }
}
