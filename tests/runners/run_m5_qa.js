import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 5177;
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
  console.log('--- Starting Vite Dev Server for Milestone 5 QA ---');
  const viteProcess = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
    cwd: 'd:\\AGYWorkspace\\WebG',
    stdio: 'pipe',
  });

  viteProcess.stdout.on('data', (d) => console.log(`[vite] ${d.toString().trim()}`));
  viteProcess.stderr.on('data', (d) => console.warn(`[vite err] ${d.toString().trim()}`));

  try {
    await waitForServer(BASE_URL, 15000);
    console.log(`Vite server is UP at ${BASE_URL}`);

    const qaBaseDir = 'd:\\AGYWorkspace\\WebG\\tests\\output\\milestone5';
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

    // Test 1: Semi-Automatic Intercept Footwork & WASD Manual Fine-Tuning
    {
      const testId = 'm5_auto_footwork_and_wasd';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Launch an angled shot landing in player's right midcourt (X ~ 1.8m, Z ~ 4.2m)
      await page.evaluate(() => {
        window.setPlayMode('ai_match');
        window.launchTestShot('CLEAR', {
          pos: [0, 1.8, -4.0],
          azimuthDeg: 14.5,
          speed: 34.0,
        });
      });

      // Advance 450ms for arrive steering to guide player toward right corner
      await page.evaluate(async () => {
        for (let i = 0; i < 27; i++) {
          await window.advanceTime(16.67);
        }
      });

      const autoStateJson = await page.evaluate(() => window.render_game_to_text());
      const autoState = JSON.parse(autoStateJson);
      fs.writeFileSync(path.join(testDir, 'state-auto-footwork.json'), autoStateJson);

      const playerPosX = autoState.player.pos[0];
      const autoFootworkState = autoState.player.footworkState;
      console.log(`[Auto Footwork] Player X: ${playerPosX.toFixed(3)}m, State: ${autoFootworkState}`);

      // Now apply manual WASD movement (moving Left and Forward toward net)
      await page.evaluate(() => {
        window.setPlayerMoveKeys({ left: true, forward: true });
      });

      // Advance 300ms
      await page.evaluate(async () => {
        for (let i = 0; i < 18; i++) {
          await window.advanceTime(16.67);
        }
      });

      const manualStateJson = await page.evaluate(() => window.render_game_to_text());
      const manualState = JSON.parse(manualStateJson);
      fs.writeFileSync(path.join(testDir, 'state-manual-wasd.json'), manualStateJson);
      await captureCanvas(page, path.join(testDir, 'footwork-wasd.png'));

      const manualFootworkState = manualState.player.footworkState;
      console.log(`[Manual WASD] Player Pos: [${manualState.player.pos.join(', ')}], State: ${manualFootworkState}`);

      // Reset move keys and verify boundary clamping
      await page.evaluate(() => {
        window.setPlayerMoveKeys({ left: false, forward: false });
      });

      const inBounds =
        manualState.player.pos[0] >= -2.95 &&
        manualState.player.pos[0] <= 2.95 &&
        manualState.player.pos[2] >= 0.65 &&
        manualState.player.pos[2] <= 6.65;

      const passed = playerPosX > 0.35 && manualFootworkState === 'manual' && inBounds;
      qaSummary.tests.push({
        id: testId,
        autoPosX: playerPosX,
        autoFootworkState,
        manualPos: manualState.player.pos,
        manualFootworkState,
        inBounds,
        passed,
      });
    }

    // Test 2: Space Key Jump & Aerial Jump Smash (+8% Exit Speed, -25.5° Elevation)
    {
      const testId = 'm5_jump_smash_combo';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Trigger player jump
      const jumpTriggered = await page.evaluate(() => window.triggerPlayerJump());

      // Advance 200ms to reach airborne apex
      await page.evaluate(async () => {
        for (let i = 0; i < 12; i++) {
          await window.advanceTime(16.67);
        }
      });

      const airStateJson = await page.evaluate(() => window.render_game_to_text());
      const airState = JSON.parse(airStateJson);
      const jumpHeight = airState.player.pos[1];
      const isJumping = airState.player.isJumping;

      console.log(`[Jump Smash] Jump triggered: ${jumpTriggered}, Height: ${jumpHeight.toFixed(3)}m, isJumping: ${isJumping}`);

      // Execute Smash while airborne
      const smashResult = await page.evaluate(() => {
        return window.performRacketSwipe({
          quadrant: 'Q1',
          dy: -240,
          speed: 1950,
          shotType: 'SMASH',
          forceHit: true,
        });
      });

      const postSmashJson = await page.evaluate(() => window.render_game_to_text());
      const postSmashState = JSON.parse(postSmashJson);
      fs.writeFileSync(path.join(testDir, 'state-jump-smash.json'), postSmashJson);
      await captureCanvas(page, path.join(testDir, 'jump-smash-airborne.png'));

      const lastJumpSmash = postSmashState.player.lastJumpSmash;
      const smashSpeedKmh = postSmashState.player.lastShotSpeedKmh;
      const fov = postSmashState.effects.fov;

      console.log(`[Jump Smash] lastJumpSmash: ${lastJumpSmash}, Speed: ${smashSpeedKmh} km/h, FOV: ${fov}°`);

      const passed = jumpHeight > 0.45 && lastJumpSmash === true && smashSpeedKmh >= 240 && fov <= 74.5;
      qaSummary.tests.push({
        id: testId,
        jumpTriggered,
        jumpHeight,
        isJumping,
        lastJumpSmash,
        smashSpeedKmh,
        fov,
        passed,
      });
    }

    // Test 3: AI Opponent Rally & BWF Official Scoring System
    {
      const testId = 'm5_ai_opponent_rally_and_scoring';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      await page.evaluate(() => {
        window.setPlayMode('ai_match');
      });

      // Hit a clear from player court into opponent mid-backcourt
      await page.evaluate(() => {
        window.launchTestShot('CLEAR', {
          originSide: 'player',
          pos: [0, 2.0, 3.5],
          speed: 28.0,
          elevationDeg: 24.0,
        });
      });

      // Advance time for AI to intercept and return
      let aiSwungOrReturned = false;
      for (let step = 0; step < 35; step++) {
        await page.evaluate(async () => {
          await window.advanceTime(33.33);
        });

        const checkJson = await page.evaluate(() => window.render_game_to_text());
        const checkState = JSON.parse(checkJson);
        if (checkState.opponent.state === 'swinging' || checkState.opponent.rallyCount >= 1 || checkState.shuttle.originSide === 'opponent') {
          aiSwungOrReturned = true;
          break;
        }
      }

      await captureCanvas(page, path.join(testDir, 'ai-opponent-return.png'));

      const rallyStateJson = await page.evaluate(() => window.render_game_to_text());
      const rallyState = JSON.parse(rallyStateJson);
      fs.writeFileSync(path.join(testDir, 'state-ai-return.json'), rallyStateJson);

      console.log(`[AI Rally] AI Intercepted & Returned: ${aiSwungOrReturned}, Rally Count: ${rallyState.opponent.rallyCount}, Return Type: ${rallyState.opponent.lastReturnType}`);

      // Now player scores a point with a sharp smash that lands in opponent court
      await page.evaluate(() => {
        window.performRacketSwipe({
          quadrant: 'Q1',
          dy: -240,
          speed: 1950,
          shotType: 'SMASH',
          forceHit: true,
        });
      });

      // Advance time until shuttle settles on opponent ground
      for (let step = 0; step < 30; step++) {
        await page.evaluate(async () => {
          await window.advanceTime(33.33);
        });
      }

      const scoreStateJson = await page.evaluate(() => window.render_game_to_text());
      const scoreState = JSON.parse(scoreStateJson);
      fs.writeFileSync(path.join(testDir, 'state-scored.json'), scoreStateJson);

      const playerScore = scoreState.score.player;
      const lastWinner = scoreState.score.lastPointWinner;
      console.log(`[Scoring] Player Score: ${playerScore}, Opponent Score: ${scoreState.score.opponent}, Last Winner: ${lastWinner}`);

      const passed = aiSwungOrReturned && playerScore >= 1 && lastWinner === 'player';
      qaSummary.tests.push({
        id: testId,
        aiSwungOrReturned,
        rallyCount: rallyState.opponent.rallyCount,
        lastReturnType: rallyState.opponent.lastReturnType,
        playerScore,
        lastWinner,
        passed,
      });
    }

    // Test 4: Multi-Shot Feeder Training Mode & Opponent Smash Warning Telegraph
    {
      const testId = 'm5_feeder_training_mode';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Switch to feeder mode
      const setMode = await page.evaluate(() => window.setPlayMode('feeder'));

      const feederStateJson = await page.evaluate(() => window.render_game_to_text());
      const feederState = JSON.parse(feederStateJson);
      fs.writeFileSync(path.join(testDir, 'state-feeder-mode.json'), feederStateJson);
      await captureCanvas(page, path.join(testDir, 'feeder-mode.png'));

      console.log(`[Feeder Mode] playMode: ${feederState.playMode}, Opponent State: ${feederState.opponent.state}`);

      // Verify Pre-Strike Smash Warning Telegraph (0.75s warning window)
      const telegraphData = await page.evaluate(async () => {
        // Fast forward 0.85s so feeder launches shot 0 (CLEAR) and increments feederIndex to 1 (SMASH)
        for (let i = 0; i < 28; i++) await window.advanceTime(33.33);
        // End shot 0 flight so feeder enters countdown for shot 1 (SMASH)
        window.state.shuttle.inFlight = false;
        // Set timer into telegraph window (0.72s) and step 8 frames (~266ms) so opponent leaps to ~0.60m
        window.state.rallyResetTimer = 0.72;
        for (let i = 0; i < 8; i++) await window.advanceTime(33.33);

        const s = JSON.parse(window.render_game_to_text());
        return {
          chargingSmash: s.opponent.chargingSmash,
          intendedShot: s.opponent.intendedShot,
          opponentHeight: s.opponent.pos[1],
          lastAudioEvent: s.effects?.lastAudioEvent,
        };
      });

      console.log(`[Smash Warning Telegraph] chargingSmash: ${telegraphData.chargingSmash}, intendedShot: ${telegraphData.intendedShot}, Height: ${telegraphData.opponentHeight}m, Audio: ${telegraphData.lastAudioEvent?.type}`);
      await captureCanvas(page, path.join(testDir, 'smash-warning-telegraph.png'));

      // Advance through launch to verify moderated flight speed (36.0 m/s ~ 130 km/h)
      let smashLaunched = null;
      for (let step = 0; step < 25; step++) {
        await page.evaluate(async () => {
          await window.advanceTime(33.33);
        });
        const check = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
        if (check.shuttle.inFlight && check.shuttle.originSide === 'opponent' && check.shuttle.shotType === 'SMASH') {
          smashLaunched = {
            shotType: check.shuttle.shotType,
            speed: check.shuttle.speed,
            speedKmh: Math.round(check.shuttle.speed * 3.6),
            chargingSmashAfterLaunch: check.opponent.chargingSmash,
          };
          break;
        }
      }

      console.log(`[Moderated Opponent Smash] Speed: ${smashLaunched?.speed} m/s (${smashLaunched?.speedKmh} km/h), chargingSmash reset: ${smashLaunched?.chargingSmashAfterLaunch === false}`);
      await captureCanvas(page, path.join(testDir, 'opponent-smash-inflight.png'));

      const telegraphPassed =
        telegraphData.chargingSmash === true &&
        telegraphData.intendedShot === 'SMASH' &&
        telegraphData.lastAudioEvent?.type === 'smash_warning';

      const speedModeratedPassed =
        Boolean(smashLaunched) &&
        smashLaunched.speed <= 40.0 &&
        smashLaunched.speed >= 32.0 &&
        smashLaunched.chargingSmashAfterLaunch === false;

      const passed =
        feederState.playMode === 'feeder' &&
        feederState.opponent.state === 'feeder' &&
        telegraphPassed &&
        speedModeratedPassed;

      qaSummary.tests.push({
        id: testId,
        setMode,
        playMode: feederState.playMode,
        opponentState: feederState.opponent.state,
        telegraphData,
        smashLaunched,
        passed,
      });
    }

    // Test 5: Off-Screen Shuttlecock Directional Indicator
    {
      const testId = 'm5_offscreen_indicator';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Launch an overhead sky lob shot above the camera frustum (Y = 6.2m)
      await page.evaluate(() => {
        window.launchTestShot('CLEAR', {
          pos: [0, 6.2, 3.8],
          speed: 10.0,
          elevationDeg: 75.0,
        });
      });

      // Advance 1 frame
      await page.evaluate(async () => {
        await window.advanceTime(16.67);
      });

      const indStateJson = await page.evaluate(() => window.render_game_to_text());
      const indState = JSON.parse(indStateJson);
      fs.writeFileSync(path.join(testDir, 'state-offscreen.json'), indStateJson);
      await captureCanvas(page, path.join(testDir, 'offscreen-indicator.png'));

      const indicator = indState.effects.offScreenIndicator;
      console.log(`[Off-Screen Indicator] Active: ${indicator?.active}, Height: ${indicator?.heightM}m, Angle: ${indicator?.angleRad} rad`);

      const passed = Boolean(indicator && indicator.active && indicator.heightM >= 5.5);
      qaSummary.tests.push({
        id: testId,
        indicator,
        passed,
      });
    }

    fs.writeFileSync(path.join(qaBaseDir, 'summary.json'), JSON.stringify(qaSummary, null, 2));

    const allPassed = qaSummary.tests.every((t) => t.passed);
    console.log(`\n========================================`);
    console.log(`Milestone 5 QA Automation Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
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
