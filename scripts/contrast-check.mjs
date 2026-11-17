// Gate 1 contrast verification: every text/background token pair is
// COMPUTED with the WCAG relative-luminance formula, in both themes.
// Writes the table to redesign/contrast-table.md and exits nonzero on
// any failure. Run: npm run contrast
import { writeFileSync } from 'node:fs';

function lum(hex) {
  const c = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const DARK = {
  canvas: '#17142B', s1: '#1F1B38', s2: '#272145', s3: '#322A55', overlay: '#3A3163',
  borderI: '#8B7FD4', t1: '#F2F0FA', t2: '#C9C2E2', t3: '#9D94C4',
  action: '#A78BFA', actionHover: '#BBA3FC', actionText: '#1D1440',
  link: '#C4B0FF', focus: '#D6C9FF', success: '#3ECF8E',
  warnText: '#FFB224', warnFill: '#FFB224', warnInk: '#241A02', warnTint: '#38300F',
  danger: '#FF7A6B', dangerText: '#FF9D8F', dangerTint: '#3D1E24', successTint: '#12352A',
  meterTrack: '#322A55', gold: '#F5C04E',
};
const LIGHT = {
  canvas: '#F5F3FC', s1: '#FFFFFF', s2: '#EEEAF9', s3: '#E2DAF3', overlay: '#FFFFFF',
  borderI: '#7A68B8', t1: '#1D1836', t2: '#463E6E', t3: '#6B5FA0',
  action: '#6D3FD4', actionHover: '#5E34B8', actionText: '#FFFFFF',
  link: '#5E34C4', focus: '#5E34B8', success: '#0E7A4C',
  warnText: '#8A5A00', warnFill: '#F5C15C', warnInk: '#3A2A05', warnTint: '#FBF0CE',
  danger: '#C23418', dangerText: '#C23418', dangerTint: '#FDECE7', successTint: '#E2F2E9',
  meterTrack: '#E2DAF3', gold: '#9A6B00',
};

// [label, fg, bg, minimum]  4.5 = body text, 3.0 = large text / UI boundary / focus
function pairs(T) {
  return [
    ['text.1 on canvas', T.t1, T.canvas, 4.5], ['text.1 on surface.1', T.t1, T.s1, 4.5],
    ['text.1 on surface.2', T.t1, T.s2, 4.5], ['text.1 on surface.3', T.t1, T.s3, 4.5],
    ['text.1 on overlay', T.t1, T.overlay, 4.5],
    ['text.2 on canvas', T.t2, T.canvas, 4.5], ['text.2 on surface.1', T.t2, T.s1, 4.5],
    ['text.2 on surface.2', T.t2, T.s2, 4.5], ['text.2 on surface.3', T.t2, T.s3, 4.5],
    ['text.3 on canvas (large only)', T.t3, T.canvas, 3.0], ['text.3 on surface.1 (large only)', T.t3, T.s1, 3.0],
    ['action text on action', T.actionText, T.action, 4.5], ['action text on action hover', T.actionText, T.actionHover, 4.5],
    ['link on canvas', T.link, T.canvas, 4.5], ['link on surface.1', T.link, T.s1, 4.5], ['link on surface.2', T.link, T.s2, 4.5],
    ['success on canvas', T.success, T.canvas, 4.5], ['text.1 on success tint', T.t1, T.successTint, 4.5],
    ['warning text on canvas', T.warnText, T.canvas, 4.5], ['warning text on warning tint', T.warnText, T.warnTint, 4.5],
    ['warning ink on warning fill', T.warnInk, T.warnFill, 4.5],
    ['danger text on canvas', T.dangerText, T.canvas, 4.5], ['danger text on danger tint', T.dangerText, T.dangerTint, 4.5],
    ['text.1 on danger tint', T.t1, T.dangerTint, 4.5], ['text.1 on warning tint', T.t1, T.warnTint, 4.5],
    ['border.interactive on canvas', T.borderI, T.canvas, 3.0], ['border.interactive on surface.1', T.borderI, T.s1, 3.0],
    ['border.interactive on surface.2', T.borderI, T.s2, 3.0],
    ['focus on canvas', T.focus, T.canvas, 3.0], ['focus on surface.1', T.focus, T.s1, 3.0], ['focus on surface.3', T.focus, T.s3, 3.0],
    ['action fill on meter track', T.action, T.meterTrack, 3.0],
    ['gold on canvas (large)', T.gold, T.canvas, 3.0], ['gold on surface.1 (large)', T.gold, T.s1, 3.0],
    ['gold on surface.2 (large)', T.gold, T.s2, 3.0],
  ];
}

let failures = 0;
const lines = ['# Gate 1 contrast table (computed, WCAG relative luminance)', ''];
for (const [name, T] of [['dark (default)', DARK], ['light', LIGHT]]) {
  lines.push(`## ${name}`, '', '| pair | ratio | min | result |', '| --- | --- | --- | --- |');
  for (const [label, fg, bg, min] of pairs(T)) {
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failures++;
    lines.push(`| ${label} | ${r.toFixed(2)}:1 | ${min}:1 | ${ok ? 'PASS' : 'FAIL'} |`);
    console.log(`${name} ${label}: ${r.toFixed(2)}:1 (min ${min}) ${ok ? 'PASS' : 'FAIL'}`);
  }
  lines.push('');
}
writeFileSync(new URL('../redesign/contrast-table.md', import.meta.url), lines.join('\n'));
console.log(failures ? `${failures} FAILURES` : 'ALL PAIRS PASS');
process.exit(failures ? 1 : 0);
