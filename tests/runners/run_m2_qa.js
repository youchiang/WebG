import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.end();
    }
    function retry() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for ${url} after ${timeoutMs}ms`));
      } else {
        setTimeout(tryConnect, 300);
      }
    }
    tryConnect();
  });
}

async function captureCanvas(page, outPath) {
  const base64 = await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return null;
    return canvas.toDataURL('image/png').split(',')[1];
  });
  if (base64) {
    fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
  } else {
    const canvas = await page.$('#game-canvas');
    if (canvas) {
      await canvas.screenshot({ path: outPath });
    }
  }
}

async function main() {
  console.log('--- Starting Vite Dev Server for Milestone 2 QA ---');
  const viteProcess = spawn('npx.cmd', ['vite', '--port', String(PORT)], {
    cwd: 'd:\\AGYWorkspace\\WebG',
    stdio: 'pipe',
    shell: true,
  });

  viteProcess.stdout.on('data', (d) => console.log(`[vite] ${d.toString().trim()}`));
  viteProcess.stderr.on('data', (d) => console.warn(`[vite err] ${d.toString().trim()}`));

  try {
    await waitForServer(BASE_URL, 15000);
    console.log(`Vite server is UP at ${BASE_URL}`);

    const qaBaseDir = 'd:\\AGYWorkspace\\WebG\\tests\\output\\milestone2';
    fs.mkdirSync(qaBaseDir, { recursive: true });

    console.log('--- Launching Playwright Chromium ---');
    const browser = await chromium.launch({
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader'],
    });

    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`[Browser Console Error] ${msg.text()}`);
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      console.error(`[Browser Page Error] ${err}`);
      consoleErrors.push(String(err));
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    // Click start button to enter match
    await page.click('#start-btn');
    await page.waitForTimeout(200);

    const testScenarios = [
      {
        id: 'clear',
        name: 'CLEAR Shot (High Arc, Parachute Drop, Normal Navy Outline)',
        shotType: 'CLEAR',
        customOpts: { originSide: 'opponent' },
        midFlightFrames: 12, // Shuttle climbing across net with coral/navy outline
        landingFrames: 95,   // Shuttle drops steeply inside player back baseline
      },
      {
        id: 'smash',
        name: 'SMASH Shot (68 m/s, Fiery Orange-Gold Smash Flame Outline, Rapid Decay)',
        shotType: 'SMASH',
        customOpts: { originSide: 'opponent' },
        midFlightFrames: 4,  // High speed flight with fiery trail & mid-court landing ring
        landingFrames: 25,
      },
      {
        id: 'drop',
        name: 'DROP Shot (13.8 m/s, Soft Cyan Outline, Front Court Drop)',
        shotType: 'DROP',
        customOpts: { originSide: 'opponent' },
        midFlightFrames: 18, // Skimming over net toward front court cyan ring
        landingFrames: 55,
      },
      {
        id: 'drive',
        name: 'DRIVE Shot (22 m/s, Flat Skimming Low Over Net)',
        shotType: 'DRIVE',
        customOpts: { originSide: 'opponent' },
        midFlightFrames: 14, // Enters sweet spot zone with emerald green outline
        landingFrames: 45,
      },
      {
        id: 'net_shot',
        name: 'NET_SHOT (5.2 m/s, Delicate Hairpin Tumbling Across Net Tape)',
        shotType: 'NET_SHOT',
        customOpts: { originSide: 'opponent' },
        midFlightFrames: 16, // Tumbling over net tape toward front-court cyan ring
        landingFrames: 45,
      },
      {
        id: 'sweet_spot',
        name: 'SWEET SPOT Indicator Transition (Dynamic Emerald Green Outline in Hit Zone)',
        shotType: 'DRIVE',
        customOpts: { originSide: 'opponent', pos: [0.0, 1.72, -2.5], speed: 21.0, elevationDeg: 4.5 },
        midFlightFrames: 15, // Arrives right in sweet spot [z=2.1 to 3.6, y=0.7 to 2.6]
        landingFrames: 45,
      },
      {
        id: 'net_collision',
        name: 'CCD Net Collision (Tape Deflection & Mesh Bounce Detection)',
        shotType: 'DRIVE',
        customOpts: { originSide: 'opponent', pos: [0.0, 1.54, -2.5], speed: 30.0, elevationDeg: -0.5 },
        midFlightFrames: 10, // Reaches z=0 net cord
        landingFrames: 35,
      },
    ];

    const qaSummary = {
      timestamp: new Date().toISOString(),
      tests: [],
      consoleErrors,
    };

    for (const sc of testScenarios) {
      console.log(`\n=== Testing: ${sc.name} ===`);
      const testDir = path.join(qaBaseDir, sc.id);
      fs.mkdirSync(testDir, { recursive: true });

      // 1. Launch the specific shot
      await page.evaluate(
        ({ type, opts }) => {
          window.launchTestShot(type, opts);
        },
        { type: sc.shotType, opts: sc.customOpts }
      );

      // 2. Advance to mid-flight to verify aerodynamic flight, outline shader, trail, & predictor rings
      await page.evaluate(async (frames) => {
        for (let i = 0; i < frames; i++) {
          await window.advanceTime(1000 / 60);
        }
      }, sc.midFlightFrames);

      // Capture mid-flight screenshot
      const midShotPath = path.join(testDir, 'shot-0.png');
      await captureCanvas(page, midShotPath);

      // Capture mid-flight state
      const midStateJson = await page.evaluate(() => window.render_game_to_text());
      const midState = JSON.parse(midStateJson);
      fs.writeFileSync(path.join(testDir, 'state-0.json'), midStateJson);

      console.log(`[Mid-Flight] pos: ${JSON.stringify(midState.shuttle.pos)}, speed: ${midState.shuttle.speed} m/s, outline: ${midState.shuttle.outlineState}, target: ${JSON.stringify(midState.shuttle.landingTarget)}`);

      // 3. Advance to landing
      await page.evaluate(async (frames) => {
        for (let i = 0; i < frames; i++) {
          await window.advanceTime(1000 / 60);
        }
      }, sc.landingFrames);

      const landShotPath = path.join(testDir, 'shot-land.png');
      await captureCanvas(page, landShotPath);

      const landStateJson = await page.evaluate(() => window.render_game_to_text());
      const landState = JSON.parse(landStateJson);
      fs.writeFileSync(path.join(testDir, 'state-land.json'), landStateJson);

      console.log(`[Landing] pos: ${JSON.stringify(landState.shuttle.pos)}, inFlight: ${landState.shuttle.inFlight}, inBounds: ${landState.shuttle.inBounds}, hitNet: ${landState.shuttle.hitNet}`);

      qaSummary.tests.push({
        id: sc.id,
        name: sc.name,
        midFlight: {
          pos: midState.shuttle.pos,
          speed: midState.shuttle.speed,
          outlineState: midState.shuttle.outlineState,
          landingTarget: midState.shuttle.landingTarget,
          timeToLand: midState.shuttle.timeToLand,
          inFlight: midState.shuttle.inFlight,
        },
        landing: {
          pos: landState.shuttle.pos,
          inFlight: landState.shuttle.inFlight,
          inBounds: landState.shuttle.inBounds,
          hitNet: landState.shuttle.hitNet,
        },
      });
    }

    fs.writeFileSync(
      path.join(qaBaseDir, 'm2_qa_summary.json'),
      JSON.stringify(qaSummary, null, 2)
    );

    await browser.close();
    console.log('\n>>> All Milestone 2 QA Tests Completed Successfully! <<<');
  } finally {
    console.log('--- Shutting down Vite Dev Server ---');
    try {
      execSync(`taskkill /pid ${viteProcess.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      viteProcess.kill('SIGTERM');
    }
  }
}

main().catch((err) => {
  console.error('QA Test execution failed:', err);
  process.exit(1);
});
