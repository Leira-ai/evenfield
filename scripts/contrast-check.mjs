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
  canvas: '#0D130F', s1: '#141D17', s2: '#1B2820', s3: '#24352A', overlay: '#2C4234',
  borderI: '#597D65', t1: '#EDF4EE', t2: '#AEC2B2', t3: '#7E937F',
  action: '#2FD68A', actionHover: '#4BE39E', actionText: '#052418',
  link: '#6FE3AC', focus: '#8CF0BC', success: '#3ECF7B',
  warnText: '#F0B24A', warnFill: '#F0B24A', warnInk: '#1C1710', warnTint: '#33270F',
  danger: '#FF7A5C', dangerText: '#FF9D85', dangerTint: '#3A1D16', successTint: '#14301F',
  meterTrack: '#24352A',
};
const LIGHT = {
  canvas: '#F6F4EC', s1: '#FFFFFF', s2: '#FBFAF5', s3: '#F0EEE3', overlay: '#FFFFFF',
  borderI: '#7A755C', t1: '#16211A', t2: '#4E5D52', t3: '#68796B',
  action: '#0B7A55', actionHover: '#09684A', actionText: '#FFFFFF',
  link: '#0B6B4A', focus: '#0B7A55', success: '#177A46',
  warnText: '#8A5A00', warnFill: '#F5C15C', warnInk: '#3A2A05', warnTint: '#FDF3D3',
  danger: '#C23418', dangerText: '#C23418', dangerTint: '#FDECE7', successTint: '#E5F3EA',
  meterTrack: '#E7E4D3',
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
