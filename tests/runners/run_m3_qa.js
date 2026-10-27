import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 5174;
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
  console.log('--- Starting Vite Dev Server for Milestone 3 QA ---');
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

    const qaBaseDir = 'd:\\AGYWorkspace\\WebG\\tests\\output\\milestone3';
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

    const qaSummary = {
      timestamp: new Date().toISOString(),
      tests: [],
      consoleErrors,
    };

    // Test 1: Q1 Heavy Smash
    {
      const testId = 'm3_q1_smash';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      const result = await page.evaluate(() => {
        return window.performRacketSwipe({
          quadrant: 'Q1',
          dx: -20,
          dy: -220,
          speed: 1850,
          forceHit: true,
        });
      });

      // Advance 4 frames of flight so smash is crossing the net with fiery trail & swing arc
      await page.evaluate(async () => {
        for (let i = 0; i < 4; i++) await window.advanceTime(1000 / 60);
      });

      const shot0Path = path.join(testDir, 'shot-0.png');
      await captureCanvas(page, shot0Path);

      const midStateJson = await page.evaluate(() => window.render_game_to_text());
      const midState = JSON.parse(midStateJson);
      fs.writeFileSync(path.join(testDir, 'state-0.json'), midStateJson);

      console.log(`[Q1 Smash] hit: ${result.success}, shotType: ${result.shotType}, speed: ${result.speedKmh} km/h, pos: ${JSON.stringify(midState.shuttle.pos)}`);

      qaSummary.tests.push({
        id: testId,
        hit: result.success,
        shotType: result.shotType,
        speedKmh: result.speedKmh,
        timingQuality: result.timingQuality,
        racketFaceNormal: midState.player.racketFaceNormal,
        shuttleMidFlightPos: midState.shuttle.pos,
      });
    }

    // Test 2: Q2 Backhand Flip (~165 deg rotation & 0.85 grip power factor)
    {
      const testId = 'm3_q2_backhand_flip';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      const result = await page.evaluate(() => {
        return window.performRacketSwipe({
          quadrant: 'Q2',
          dx: -50,
          dy: -60,
          speed: 650,
          forceHit: true,
        });
      });

      await page.evaluate(async () => {
        for (let i = 0; i < 12; i++) await window.advanceTime(1000 / 60);
      });

      const shot0Path = path.join(testDir, 'shot-0.png');
      await captureCanvas(page, shot0Path);

      const midStateJson = await page.evaluate(() => window.render_game_to_text());
      const midState = JSON.parse(midStateJson);
      fs.writeFileSync(path.join(testDir, 'state-0.json'), midStateJson);

      console.log(`[Q2 Backhand] quadrant: ${midState.player.racketQuadrant}, grip: ${midState.player.grip}, shotType: ${result.shotType}, speed: ${result.speedKmh} km/h`);

      qaSummary.tests.push({
        id: testId,
        hit: result.success,
        quadrant: midState.player.racketQuadrant,
        grip: midState.player.grip,
        shotType: result.shotType,
        speedKmh: result.speedKmh,
      });
    }

    // Test 3: Q3 Lift (Upward defensive arc from low contact point)
    {
      const testId = 'm3_q3_lift';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      const result = await page.evaluate(() => {
        return window.performRacketSwipe({
          quadrant: 'Q3',
          dx: 15,
          dy: 170,
          speed: 760,
          forceHit: true,
        });
      });

      await page.evaluate(async () => {
        for (let i = 0; i < 18; i++) await window.advanceTime(1000 / 60);
      });

      const shot0Path = path.join(testDir, 'shot-0.png');
      await captureCanvas(page, shot0Path);

      const midStateJson = await page.evaluate(() => window.render_game_to_text());
      const midState = JSON.parse(midStateJson);
      fs.writeFileSync(path.join(testDir, 'state-0.json'), midStateJson);

      console.log(`[Q3 Lift] quadrant: ${midState.player.racketQuadrant}, grip: ${midState.player.grip}, shotType: ${result.shotType}, speed: ${result.speedKmh} km/h, pos: ${JSON.stringify(midState.shuttle.pos)}`);

      qaSummary.tests.push({
        id: testId,
        hit: result.success,
        quadrant: midState.player.racketQuadrant,
        grip: midState.player.grip,
        shotType: result.shotType,
        speedKmh: result.speedKmh,
      });
    }

    // Test 4: Q4 Drive (Horizontal swipe for flat fast drive skimming net)
    {
      const testId = 'm3_q4_drive';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      const result = await page.evaluate(() => {
        return window.performRacketSwipe({
          quadrant: 'Q4',
          dx: 190,
          dy: -15,
          speed: 840,
          forceHit: true,
        });
      });

      await page.evaluate(async () => {
        for (let i = 0; i < 14; i++) await window.advanceTime(1000 / 60);
      });

      const shot0Path = path.join(testDir, 'shot-0.png');
      await captureCanvas(page, shot0Path);

      const midStateJson = await page.evaluate(() => window.render_game_to_text());
      const midState = JSON.parse(midStateJson);
      fs.writeFileSync(path.join(testDir, 'state-0.json'), midStateJson);

      console.log(`[Q4 Drive] quadrant: ${midState.player.racketQuadrant}, grip: ${midState.player.grip}, shotType: ${result.shotType}, speed: ${result.speedKmh} km/h`);

      qaSummary.tests.push({
        id: testId,
        hit: result.success,
        quadrant: midState.player.racketQuadrant,
        grip: midState.player.grip,
        shotType: result.shotType,
        speedKmh: result.speedKmh,
      });
    }

    // Test 5: All 7 Badminton Shot Ballistics
    {
      const testId = 'm3_all_7_shots';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      const shotTypes = ['CLEAR', 'SMASH', 'ATTACKING_CLEAR', 'DROP', 'DRIVE', 'NET_SHOT', 'LIFT'];
      const results7 = [];

      for (const shotType of shotTypes) {
        const res = await page.evaluate((st) => {
          return window.performRacketSwipe({
            shotType: st,
            forceHit: true,
            speed: 700,
          });
        }, shotType);

        // Advance 10 frames
        await page.evaluate(async () => {
          for (let i = 0; i < 10; i++) await window.advanceTime(1000 / 60);
        });

        const shotImgPath = path.join(testDir, `shot-${shotType.toLowerCase()}.png`);
        await captureCanvas(page, shotImgPath);

        const stateJson = await page.evaluate(() => window.render_game_to_text());
        const s = JSON.parse(stateJson);

        console.log(`  -> Shot: ${shotType} => hit: ${res.success}, lastShotType: ${s.player.lastShotType}, speedKmh: ${s.player.lastShotSpeedKmh}, pos: ${JSON.stringify(s.shuttle.pos)}`);
        results7.push({
          shotType,
          hit: res.success,
          recordedShotType: s.player.lastShotType,
          recordedSpeedKmh: s.player.lastShotSpeedKmh,
          shuttlePos: s.shuttle.pos,
          shuttleSpeed: s.shuttle.speed,
        });
      }

      fs.writeFileSync(path.join(testDir, 'shots-7-results.json'), JSON.stringify(results7, null, 2));
      qaSummary.tests.push({
        id: testId,
        shots: results7,
      });
    }

    // Test 6: Pure Mouse Swipe Strike (Zero Click Required!)
    {
      const testId = 'm3_pure_mouse_swipe_no_click';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Launch an incoming CLEAR shot from opponent side
      await page.evaluate(() => {
        window.launchTestShot('CLEAR', { originSide: 'opponent' });
      });

      // Advance frames until incoming CLEAR descends into reachable strike window (y <= 3.2m, z >= 2.0m)
      await page.evaluate(async () => {
        for (let i = 0; i < 90; i++) {
          const s = JSON.parse(window.render_game_to_text());
          if (s.shuttle.inFlight && s.shuttle.vel[2] > 0 && s.shuttle.pos[1] <= 3.2 && s.shuttle.pos[2] >= 2.0) {
            break;
          }
          await window.advanceTime(1000 / 60);
        }
      });

      // Verify shuttle is incoming in player's hitting zone
      const beforeStateJson = await page.evaluate(() => window.render_game_to_text());
      const beforeState = JSON.parse(beforeStateJson);
      console.log(`[Before Pure Swipe] shuttle.pos: ${JSON.stringify(beforeState.shuttle.pos)}, vel.z: ${beforeState.shuttle.vel[2]}`);

      // Perform fast mouse movements WITHOUT ANY MOUSE CLICKS across steps
      await page.mouse.move(640, 360);
      await page.mouse.move(680, 420, { steps: 5 });
      await page.mouse.move(730, 520, { steps: 5 });
      await page.mouse.move(770, 600, { steps: 5 });

      // Advance 2 frames for physics update
      await page.evaluate(async () => {
        await window.advanceTime(1000 / 60);
        await window.advanceTime(1000 / 60);
      });

      const afterStateJson = await page.evaluate(() => window.render_game_to_text());
      const afterState = JSON.parse(afterStateJson);
      console.log(`[After Pure Swipe] shuttle.pos: ${JSON.stringify(afterState.shuttle.pos)}, vel.z: ${afterState.shuttle.vel[2]}, lastShotType: ${afterState.player.lastShotType}`);

      const shotImgPath = path.join(testDir, 'shot-0.png');
      await captureCanvas(page, shotImgPath);
      fs.writeFileSync(path.join(testDir, 'state-0.json'), afterStateJson);

      const pureSwipeHit = afterState.shuttle.vel[2] < 0; // successfully hit back toward opponent!
      console.log(`[Pure Mouse Swipe Result] Hit successfully reversed velocity toward opponent: ${pureSwipeHit}`);

      qaSummary.tests.push({
        id: testId,
        pureSwipeHit,
        velZ: afterState.shuttle.vel[2],
        lastShotType: afterState.player.lastShotType,
        lastShotSpeedKmh: afterState.player.lastShotSpeedKmh,
        shuttlePos: afterState.shuttle.pos,
      });
    }

    // Test 7: Outer Edge Mouse Move Performance (Zero Lag / No Speed Explosion)
    {
      const testId = 'm3_outer_edge_performance';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Move mouse to far edge/corner (clientX = 1260, clientY = 700), far outside (±360, ±220)
      await page.mouse.move(1260, 700);
      // Wait 160ms so the 120ms rolling buffer clears the initial cross-screen jump
      await page.waitForTimeout(160);

      // Wiggle mouse slightly at edge
      await page.mouse.move(1262, 701, { steps: 2 });
      await page.waitForTimeout(30);
      await page.mouse.move(1264, 702, { steps: 2 });
      await page.waitForTimeout(30);

      await page.evaluate(async () => {
        await window.advanceTime(1000 / 60);
      });

      const edgeStateJson = await page.evaluate(() => window.render_game_to_text());
      const edgeState = JSON.parse(edgeStateJson);
      console.log(`[Outer Edge Performance] virtualCursor: ${JSON.stringify(edgeState.player.virtualCursor)}, swipeSpeed: ${edgeState.player.swipeSpeed} px/s`);

      const shotImgPath = path.join(testDir, 'shot-0.png');
      await captureCanvas(page, shotImgPath);
      fs.writeFileSync(path.join(testDir, 'state-0.json'), edgeStateJson);

      const speedStaysCalm = edgeState.player.swipeSpeed < 250;
      console.log(`[Outer Edge Performance Result] Speed stayed calm (<250 px/s, no explosion): ${speedStaysCalm}`);

      qaSummary.tests.push({
        id: testId,
        speedStaysCalm,
        swipeSpeed: edgeState.player.swipeSpeed,
        virtualCursor: edgeState.player.virtualCursor,
      });
    }

    fs.writeFileSync(
      path.join(qaBaseDir, 'm3_qa_summary.json'),
      JSON.stringify(qaSummary, null, 2)
    );

    await browser.close();
    console.log('\n>>> All Milestone 3 QA Tests Completed Successfully! <<<');
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
  console.error('Milestone 3 QA Test execution failed:', err);
  process.exit(1);
});
