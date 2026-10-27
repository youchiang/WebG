import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 5176;
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
  console.log('--- Starting Vite Dev Server for Milestone 4 QA ---');
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

    const qaBaseDir = 'd:\\AGYWorkspace\\WebG\\tests\\output\\milestone4';
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

    // Click start button to enter active match play
    await page.click('#start-btn');
    await page.waitForTimeout(200);

    const qaSummary = {
      timestamp: new Date().toISOString(),
      tests: [],
      consoleErrors,
    };

    // Test 1: Hit-Stop 40ms Micro-Freeze on Heavy Smash
    {
      const testId = 'm4_smash_hit_stop';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Perform Heavy Smash
      const strikeResult = await page.evaluate(() => {
        return window.performRacketSwipe({
          quadrant: 'Q1',
          dx: -20,
          dy: -240,
          speed: 1950,
          shotType: 'SMASH',
          forceHit: true,
        });
      });

      // Frame 0 State (immediately after contact)
      const state0Json = await page.evaluate(() => window.render_game_to_text());
      const state0 = JSON.parse(state0Json);
      fs.writeFileSync(path.join(testDir, 'state-frame0.json'), state0Json);
      await captureCanvas(page, path.join(testDir, 'frame0-impact.png'));

      const hitStop0 = state0.effects.hitStopRemainingMs;
      const pos0 = [...state0.shuttle.pos];

      // Advance 1 frame (16.67ms) - Still inside 40ms Hit-Stop window
      await page.evaluate(async () => {
        await window.advanceTime(16.67);
      });

      const state1Json = await page.evaluate(() => window.render_game_to_text());
      const state1 = JSON.parse(state1Json);
      fs.writeFileSync(path.join(testDir, 'state-frame1.json'), state1Json);
      await captureCanvas(page, path.join(testDir, 'frame1-hitstop.png'));

      const hitStop1 = state1.effects.hitStopRemainingMs;
      const pos1 = [...state1.shuttle.pos];

      // Verify shuttle physics did NOT step between frame 0 and frame 1
      const shuttleFrozen = (
        Math.abs(pos0[0] - pos1[0]) < 1e-5 &&
        Math.abs(pos0[1] - pos1[1]) < 1e-5 &&
        Math.abs(pos0[2] - pos1[2]) < 1e-5
      );

      // Advance 3 more frames (50ms) to exit Hit-Stop
      await page.evaluate(async () => {
        await window.advanceTime(50);
      });

      const statePostJson = await page.evaluate(() => window.render_game_to_text());
      const statePost = JSON.parse(statePostJson);
      fs.writeFileSync(path.join(testDir, 'state-post-hitstop.json'), statePostJson);
      await captureCanvas(page, path.join(testDir, 'post-hitstop.png'));

      const posPost = [...statePost.shuttle.pos];
      const shuttleResumed = posPost[2] < pos1[2]; // Moving forward across net towards Z < 0

      console.log(`[Hit-Stop] Frame 0 Hit-Stop: ${hitStop0}ms, Frame 1 Hit-Stop: ${hitStop1}ms`);
      console.log(`[Hit-Stop] Shuttle Frozen at contact: ${shuttleFrozen} (pos0: ${pos0[2].toFixed(3)}, pos1: ${pos1[2].toFixed(3)})`);
      console.log(`[Hit-Stop] Shuttle Resumed flight: ${shuttleResumed} (posPost Z: ${posPost[2].toFixed(3)})`);

      qaSummary.tests.push({
        id: testId,
        hitStop0,
        hitStop1,
        shuttleFrozen,
        shuttleResumed,
        passed: hitStop0 >= 38 && hitStop1 > 0 && shuttleFrozen && shuttleResumed,
      });
    }

    // Test 2: Camera Dynamic FOV Punch (80° -> 74°) and Exponential Recovery
    {
      const testId = 'm4_fov_punch_and_recovery';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Trigger Smash
      await page.evaluate(() => {
        return window.performRacketSwipe({
          quadrant: 'Q1',
          dy: -240,
          speed: 1950,
          shotType: 'SMASH',
          forceHit: true,
        });
      });

      const impactStateJson = await page.evaluate(() => window.render_game_to_text());
      const impactState = JSON.parse(impactStateJson);
      const impactFov = impactState.effects.fov;

      // Advance 120ms
      await page.evaluate(async () => {
        await window.advanceTime(120);
      });

      const midStateJson = await page.evaluate(() => window.render_game_to_text());
      const midState = JSON.parse(midStateJson);
      const midFov = midState.effects.fov;

      // Advance another 300ms
      await page.evaluate(async () => {
        await window.advanceTime(300);
      });

      const recoveredStateJson = await page.evaluate(() => window.render_game_to_text());
      const recoveredState = JSON.parse(recoveredStateJson);
      const recoveredFov = recoveredState.effects.fov;

      console.log(`[FOV Punch] Impact FOV: ${impactFov.toFixed(2)}°, Mid FOV: ${midFov.toFixed(2)}°, Recovered FOV: ${recoveredFov.toFixed(2)}°`);

      const fovPunched = impactFov <= 74.5;
      const fovRecovering = midFov > impactFov && recoveredFov >= 79.5;

      qaSummary.tests.push({
        id: testId,
        impactFov,
        midFov,
        recoveredFov,
        fovPunched,
        fovRecovering,
        passed: fovPunched && fovRecovering,
      });
    }

    // Test 3: Trauma-based Camera Shake (Shake = Trauma^2)
    {
      const testId = 'm4_trauma_camera_shake';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Trigger Smash
      await page.evaluate(() => {
        return window.performRacketSwipe({
          quadrant: 'Q1',
          dy: -240,
          speed: 1950,
          shotType: 'SMASH',
          forceHit: true,
        });
      });

      // Advance 1 step
      await page.evaluate(async () => {
        await window.advanceTime(16.67);
      });

      const shakeStateJson = await page.evaluate(() => window.render_game_to_text());
      const shakeState = JSON.parse(shakeStateJson);

      const trauma = shakeState.effects.trauma;
      const cameraShake = shakeState.effects.cameraShake;
      const shakeOffset = shakeState.effects.shakeOffset;
      const shakeRoll = shakeState.effects.shakeRoll;

      console.log(`[Camera Shake] Trauma: ${trauma.toFixed(3)}, Shake: ${cameraShake.toFixed(3)}, Offset: [${shakeOffset.map((n) => n.toFixed(4)).join(', ')}], Roll: ${shakeRoll.toFixed(4)} rad`);

      // Advance 450ms
      await page.evaluate(async () => {
        await window.advanceTime(450);
      });

      const decayedStateJson = await page.evaluate(() => window.render_game_to_text());
      const decayedState = JSON.parse(decayedStateJson);

      const decayedShake = decayedState.effects.cameraShake;
      console.log(`[Camera Shake Decayed] Shake after 450ms: ${decayedShake.toFixed(3)}`);

      const shakeActive = trauma >= 0.85 && cameraShake >= 0.75;
      const shakeDisplaced = (Math.abs(shakeOffset[0]) > 0 || Math.abs(shakeOffset[1]) > 0 || Math.abs(shakeRoll) > 0);
      const shakeDecayed = decayedShake < 0.15;

      qaSummary.tests.push({
        id: testId,
        trauma,
        cameraShake,
        shakeOffset,
        shakeRoll,
        decayedShake,
        passed: shakeActive && shakeDisplaced && shakeDecayed,
      });
    }

    // Test 4: 3D Impact Shockwave Rings & Speed-Lines
    {
      const testId = 'm4_shockwave_vfx';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Trigger Smash
      await page.evaluate(() => {
        return window.performRacketSwipe({
          quadrant: 'Q1',
          dy: -240,
          speed: 1950,
          shotType: 'SMASH',
          forceHit: true,
        });
      });

      const initialVfxStateJson = await page.evaluate(() => window.render_game_to_text());
      const initialVfx = JSON.parse(initialVfxStateJson);

      await captureCanvas(page, path.join(testDir, 'shockwave-initial.png'));

      // Advance 60ms
      await page.evaluate(async () => {
        await window.advanceTime(60);
      });

      const midVfxStateJson = await page.evaluate(() => window.render_game_to_text());
      const midVfx = JSON.parse(midVfxStateJson);

      await captureCanvas(page, path.join(testDir, 'shockwave-expanded.png'));

      // Advance 350ms
      await page.evaluate(async () => {
        await window.advanceTime(350);
      });

      const endedVfxStateJson = await page.evaluate(() => window.render_game_to_text());
      const endedVfx = JSON.parse(endedVfxStateJson);

      console.log(`[Shockwave] Initial active: ${initialVfx.effects.shockwaveActive}, color: ${initialVfx.effects.shockwaveColor}`);
      console.log(`[Shockwave] Mid scale: ${midVfx.effects.shockwaveScale}, alpha: ${midVfx.effects.shockwaveAlpha}`);
      console.log(`[Shockwave] Ended active: ${endedVfx.effects.shockwaveActive}`);

      const vfxTriggered = initialVfx.effects.shockwaveActive && initialVfx.effects.shockwaveColor === '#FF3D00';
      const vfxExpanded = midVfx.effects.shockwaveScale > initialVfx.effects.shockwaveScale;
      const vfxEnded = endedVfx.effects.shockwaveActive === false;

      qaSummary.tests.push({
        id: testId,
        initialActive: initialVfx.effects.shockwaveActive,
        shockwaveColor: initialVfx.effects.shockwaveColor,
        midScale: midVfx.effects.shockwaveScale,
        midAlpha: midVfx.effects.shockwaveAlpha,
        endedActive: endedVfx.effects.shockwaveActive,
        passed: vfxTriggered && vfxExpanded && vfxEnded,
      });
    }

    // Test 5: Procedural Audio Engine Telemetry & Collision Events
    {
      const testId = 'm4_audio_telemetry';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Trigger Smash
      await page.evaluate(() => {
        return window.performRacketSwipe({
          quadrant: 'Q1',
          dy: -240,
          speed: 1950,
          shotType: 'SMASH',
          forceHit: true,
        });
      });

      const smashAudioJson = await page.evaluate(() => window.render_game_to_text());
      const smashAudio = JSON.parse(smashAudioJson).effects.lastAudioEvent;

      console.log(`[Audio Event - Smash]`, smashAudio);

      // Advance until shuttle hits floor
      await page.evaluate(async () => {
        for (let i = 0; i < 35; i++) {
          await window.advanceTime(33.33);
        }
      });

      const floorAudioJson = await page.evaluate(() => window.render_game_to_text());
      const floorAudio = JSON.parse(floorAudioJson).effects.lastAudioEvent;

      console.log(`[Audio Event - Floor]`, floorAudio);

      const smashValid = smashAudio && smashAudio.type === 'strike' && smashAudio.shotType === 'SMASH' && smashAudio.peakFreq === 2800;
      const floorValid = floorAudio && floorAudio.type === 'floor' && smashAudio.timestamp <= floorAudio.timestamp;

      qaSummary.tests.push({
        id: testId,
        smashAudio,
        floorAudio,
        passed: Boolean(smashValid && floorValid),
      });
    }

    fs.writeFileSync(path.join(qaBaseDir, 'summary.json'), JSON.stringify(qaSummary, null, 2));

    const allPassed = qaSummary.tests.every((t) => t.passed);
    console.log(`\n========================================`);
    console.log(`Milestone 4 QA Automation Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    console.log(`========================================\n`);

    await browser.close();
  } finally {
    console.log('Terminating Vite Dev Server...');
    try {
      execSync(`taskkill /pid ${viteProcess.pid} /T /F`, { stdio: 'ignore' });
    } catch (_) {
      viteProcess.kill();
    }
  }
}

main().catch((err) => {
  console.error('Fatal QA Runner Error:', err);
  process.exit(1);
});
