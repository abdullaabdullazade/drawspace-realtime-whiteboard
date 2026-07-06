import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const FRONT = 'http://localhost:3001';
const OUT = 'demo-out';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const VW = 1280, VH = 820;

// A polished "design asset" image (gradient card with a title) — looks real, not a flat block
execSync(
  `ffmpeg -y -f lavfi -i "gradients=s=680x420:c0=0x16A34A:c1=0x2E8FDB:x0=0:y0=0:x1=680:y1=420" ` +
  `-vf "drawbox=x=0:y=0:w=iw:h=ih:color=black@0.12:t=fill,` +
  `drawtext=text='Design Sprint':x=40:y=150:fontsize=64:fontcolor=white,` +
  `drawtext=text='Q3 · 2026':x=42:y=230:fontsize=34:fontcolor=white@0.85" ` +
  `-frames:v 1 ${OUT}/asset.png -loglevel error`
);

async function stroke(page, pts, hold = 45) {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts) { await page.mouse.move(x, y, { steps: 14 }); await page.waitForTimeout(hold); }
  await page.mouse.up();
  await page.waitForTimeout(250);
}
const star = (cx, cy, r = 70) => {
  const p = []; for (let i = 0; i <= 10; i++) { const rad = (i % 2 ? r * 0.42 : r); const a = -Math.PI / 2 + i * Math.PI / 5; p.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } return p;
};
const wave = (cx, cy) => [[cx - 100, cy], [cx - 50, cy - 50], [cx, cy], [cx + 50, cy + 50], [cx + 100, cy]];
const circle = (cx, cy, r = 60) => { const p = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };

const browser = await chromium.launch();
const tA = Date.now();
const ctxA = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, recordVideo: { dir: OUT, size: { width: VW, height: VH } } });
const A = await ctxA.newPage();

// Register
const uname = 'demo' + Date.now().toString().slice(-6);
await A.goto(FRONT + '/register');
await A.waitForTimeout(700);
await A.fill('input[type=text]', uname);
await A.fill('input[type=email]', uname + '@demo.com');
await A.fill('input[type=password]', 'demo1234');
await A.waitForTimeout(400);
await A.click('button[type=submit]');
await A.waitForURL('**/dashboard', { timeout: 15000 });
await A.waitForTimeout(1300);

// Create a public board
await A.getByText('New Board').first().click();
await A.waitForTimeout(500);
await A.fill('input[placeholder*="Q3"]', 'Team Sync Board');
await A.locator('button', { hasText: 'Anyone with the link' }).click();
await A.waitForTimeout(300);
await A.getByRole('button', { name: /Create board/i }).click();
await A.waitForTimeout(1500);
await A.getByText('Team Sync Board').first().click();
await A.waitForURL('**/board/**', { timeout: 15000 });
const boardURL = A.url();
await A.waitForTimeout(1600);

// User draws + adds the design asset
await stroke(A, wave(440, 300));
await stroke(A, star(470, 500));
await A.setInputFiles('input[type=file]', OUT + '/asset.png');
await A.waitForTimeout(1000);
const doneBtn = A.getByRole('button', { name: /Done/i });
if (await doneBtn.count()) await doneBtn.first().click();
await A.waitForTimeout(900);

// Reload the user so it re-fits to the FULL content — the guest will fit to the
// same content with the same viewport → identical zoom on both sides.
await A.reload();
await A.waitForTimeout(2200);

// Guest opens the shared public link (no login)
const tB = Date.now();
const offset = ((tB - tA) / 1000).toFixed(2);
const ctxB = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, recordVideo: { dir: OUT, size: { width: VW, height: VH } } });
const B = await ctxB.newPage();
await B.goto(boardURL);
await B.waitForTimeout(2400);

// Live collaboration — both draw within the shared view, each sees the other instantly
await stroke(B, circle(760, 360));
await A.waitForTimeout(700);
await stroke(A, star(300, 360, 55));
await B.waitForTimeout(700);
await stroke(B, wave(760, 620));
await A.waitForTimeout(1600);

const vA = A.video(), vB = B.video();
await ctxA.close();
await ctxB.close();
const pathA = await vA.path();
const pathB = await vB.path();
await browser.close();

// Side-by-side, aligned in real time, crisp, with clean labels
execSync(
  `ffmpeg -y -i "${pathA}" -i "${pathB}" -filter_complex ` +
  `"[0:v]drawbox=x=0:y=0:w=iw:h=46:color=0x16A34A:t=fill,drawtext=text='User — logged in':x=24:y=10:fontsize=24:fontcolor=white[a];` +
  `[1:v]tpad=start_duration=${offset}:start_mode=add:color=0xF4FAF6,` +
  `drawbox=x=0:y=0:w=iw:h=46:color=0x0EA5E9:t=fill,drawtext=text='Guest — shared link, no login':x=24:y=10:fontsize=24:fontcolor=white[b];` +
  `[a][b]hstack=inputs=2,scale=2200:-2" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart ${OUT}/demo.mp4 -loglevel error`
);
// High-quality gif (palette) for the README
execSync(`ffmpeg -y -i ${OUT}/demo.mp4 -vf "fps=15,scale=1200:-1:flags=lanczos,palettegen=stats_mode=diff" ${OUT}/pal.png -loglevel error`);
execSync(`ffmpeg -y -i ${OUT}/demo.mp4 -i ${OUT}/pal.png -lavfi "fps=15,scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" ${OUT}/demo.gif -loglevel error`);

console.log('DONE');
console.log('offset(s):', offset);
console.log('mp4:', OUT + '/demo.mp4');
console.log('gif:', OUT + '/demo.gif');
console.log('board:', boardURL);
