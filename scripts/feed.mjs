// Evenfield one-way Telegram feed generator (prepared, not live).
// Reads public/snapshot.json (and the previous snapshot kept at
// public/feed-prev.json by CI) and writes:
//   public/feed.json  machine-readable digest of what changed
//   public/feed.txt   a ready-to-post plain-text digest for a Telegram channel
// Posting itself needs a Telegram bot token (secret TELEGRAM_BOT_TOKEN and
// TELEGRAM_CHANNEL_ID). CI sends the digest only when both secrets exist;
// without them the channel stays prepared-not-live, honestly (BUILD.md).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const snapPath = new URL('../public/snapshot.json', import.meta.url);
const prevPath = new URL('../public/feed-prev.json', import.meta.url);
const snap = JSON.parse(readFileSync(snapPath, 'utf8'));
const prev = existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, 'utf8')) : null;

const prevCurves = new Set((prev?.launches ?? []).map((l) => l.curve.toLowerCase()));
const prevStatus = new Map((prev?.launches ?? []).map((l) => [l.curve.toLowerCase(), l.statusName]));
const newLaunches = snap.launches.filter((l) => !prevCurves.has(l.curve.toLowerCase()));
const newGraduations = snap.launches.filter(
  (l) => l.statusName === 'graduated' && prevStatus.get(l.curve.toLowerCase()) !== 'graduated',
);
const weekFrom = snap.headBlock - 650_000;
const weekLaunches = snap.launches.filter((l) => l.block >= weekFrom && !l.testLaunch);
const nearGrad = [...snap.launches]
  .filter((l) => l.statusName === 'trading' && l.progressPct !== null)
  .sort((a, b) => (b.progressPct ?? 0) - (a.progressPct ?? 0))
  .slice(0, 3);

const name = (l) => `${l.name ?? l.symbol ?? l.token} (${l.symbol ?? ''})`.trim();
const feed = {
  generatedAt: new Date().toISOString(),
  headBlock: snap.headBlock,
  newLaunches: newLaunches.map((l) => ({ name: name(l), curve: l.curve, block: l.block })),
  newGraduations: newGraduations.map((l) => ({ name: name(l), curve: l.curve })),
  weekly: {
    newLaunches: weekLaunches.length,
    closestToGraduation: nearGrad.map((l) => ({ name: name(l), progressPct: l.progressPct })),
  },
};
writeFileSync(new URL('../public/feed.json', import.meta.url), JSON.stringify(feed, null, 1));

const lines = ['Evenfield digest', `Data as of block ${snap.headBlock}.`, ''];
if (newLaunches.length) {
  lines.push('New launches:');
  for (const l of newLaunches.slice(0, 10)) lines.push(`- ${name(l)}`);
  lines.push('');
}
if (newGraduations.length) {
  lines.push('New graduations:');
  for (const l of newGraduations) lines.push(`- ${name(l)}`);
  lines.push('');
}
lines.push(`This week: ${weekLaunches.length} new launches.`);
if (nearGrad.length) {
  lines.push('Closest to graduation:');
  for (const l of nearGrad) lines.push(`- ${name(l)}: ${l.progressPct}%`);
}
writeFileSync(new URL('../public/feed.txt', import.meta.url), lines.join('\n') + '\n');
console.log(`feed written: ${newLaunches.length} new launches, ${newGraduations.length} new graduations`);
