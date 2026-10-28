import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 5178;
const BASE_URL = `http://localhost:${PORT}/badminton.html`;

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
  console.log('--- Starting Vite Dev Server for Milestone 6 QA ---');
  const viteProcess = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
    cwd: 'd:\\AGYWorkspace\\WebG',
    stdio: 'pipe',
  });

  viteProcess.stdout.on('data', (d) => console.log(`[vite] ${d.toString().trim()}`));
  viteProcess.stderr.on('data', (d) => console.warn(`[vite err] ${d.toString().trim()}`));

  try {
    await waitForServer(BASE_URL, 15000);
    console.log(`Vite server is UP at ${BASE_URL}`);

    const qaBaseDir = 'd:\\AGYWorkspace\\WebG\\tests\\output\\milestone6';
    fs.mkdirSync(qaBaseDir, { recursive: true });

    console.log('--- Launching Playwright Chromium ---');
    const browser = await chromium.launch({
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader'],
    });

    const consoleErrors = [];
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    // Helper to setup page in shared context so BroadcastChannel works across tabs
    async function createTestPage() {
      const page = await context.newPage();
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
      return page;
    }

    const hostPage = await createTestPage();
    const guestPage = await createTestPage();

    const qaSummary = {
      timestamp: new Date().toISOString(),
      tests: [],
      consoleErrors,
    };

    // Test 1: P2P Lobby, Dual-Transport Connection & Dual-Tab Sync
    {
      const testId = 'm6_p2p_lobby_and_dual_tab_sync';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      const roomCode = 'M6-TEST-ROOM';

      // Host enters lobby and creates room
      const hostRoom = await hostPage.evaluate((code) => {
        return window.createP2PRoom(code);
      }, roomCode);
      await hostPage.evaluate(() => window.advanceTime(16.67));
      await hostPage.screenshot({ path: path.join(testDir, 'p2p-lobby-hosting.png') });

      // Guest enters lobby and joins room
      const guestJoined = await guestPage.evaluate((code) => {
        return window.joinP2PRoom(code);
      }, roomCode);

      // Advance both pages to allow handshake exchange
      for (let i = 0; i < 6; i++) {
        await hostPage.evaluate(() => window.advanceTime(33.33));
        await guestPage.evaluate(() => window.advanceTime(33.33));
        await new Promise((r) => setTimeout(r, 40));
      }

      const hostStateJson = await hostPage.evaluate(() => window.render_game_to_text());
      const guestStateJson = await guestPage.evaluate(() => window.render_game_to_text());
      const hostState = JSON.parse(hostStateJson);
      const guestState = JSON.parse(guestStateJson);

      fs.writeFileSync(path.join(testDir, 'host-state-connected.json'), hostStateJson);
      fs.writeFileSync(path.join(testDir, 'guest-state-connected.json'), guestStateJson);

      await captureCanvas(hostPage, path.join(testDir, 'host-connected.png'));
      await captureCanvas(guestPage, path.join(testDir, 'guest-connected.png'));

      console.log(`[Host Status] status: ${hostState.network.status}, role: ${hostState.network.role}, peerConnected: ${hostState.network.peerConnected}, transport: ${hostState.network.transport}`);
      console.log(`[Guest Status] status: ${guestState.network.status}, role: ${guestState.network.role}, peerConnected: ${guestState.network.peerConnected}, transport: ${guestState.network.transport}`);

      const hostPassed = hostState.network.status === 'connected' && hostState.network.peerConnected === true && hostState.network.role === 'host';
      const guestPassed = guestState.network.status === 'connected' && guestState.network.peerConnected === true && guestState.network.role === 'guest';
      const passed = hostPassed && guestPassed;

      qaSummary.tests.push({
        id: testId,
        roomCode,
        hostRoom,
        guestJoined,
        hostNetwork: hostState.network,
        guestNetwork: guestState.network,
        passed,
      });
    }

    // Test 2: 180° Net-Mirror Coordinate Transformation & Deterministic Strike Sync
    {
      const testId = 'm6_deterministic_strike_sync';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Host strikes a heavy smash toward Guest side:
      // Host local pos: [0.85, 2.65, 3.80], vel: [-2.2, -7.5, -34.5]
      const strikePacket = {
        type: 'STRIKE_SYNC',
        seq: 101,
        shotType: 'SMASH',
        pos: [0.85, 2.65, 3.80],
        vel: [-2.2, -7.5, -34.5],
        speed: 35.5,
        isJumpSmash: true,
        timestamp: Date.now(),
      };

      // Inject / receive packet on Guest side
      await guestPage.evaluate((packet) => {
        window.injectRemotePacket(packet);
      }, strikePacket);

      // Advance both pages by 10 fixed frames (166.7ms)
      for (let i = 0; i < 10; i++) {
        await hostPage.evaluate(() => window.advanceTime(16.67));
        await guestPage.evaluate(() => window.advanceTime(16.67));
      }

      const guestFlightJson = await guestPage.evaluate(() => window.render_game_to_text());
      const guestFlightState = JSON.parse(guestFlightJson);
      fs.writeFileSync(path.join(testDir, 'guest-flight-state.json'), guestFlightJson);
      await captureCanvas(guestPage, path.join(testDir, 'guest-smash-inflight.png'));

      const shuttle = guestFlightState.shuttle;
      console.log(`[Guest In-Flight] shotType: ${shuttle.shotType}, originSide: ${shuttle.originSide}, pos: [${shuttle.pos.join(', ')}], vel: [${shuttle.vel.join(', ')}]`);

      // Mirrored launch coordinate should start at [-0.85, 2.65, -3.80] with vel [+2.2, -7.5, +34.5]
      // After 10 frames (~0.166s), shuttle crosses net toward Guest near court (pos.z > 0)
      const isMirroredCorrectly = shuttle.originSide === 'opponent' && shuttle.shotType === 'SMASH' && shuttle.vel[2] > 0;
      const passed = isMirroredCorrectly && shuttle.inFlight === true;

      qaSummary.tests.push({
        id: testId,
        shuttlePos: shuttle.pos,
        shuttleVel: shuttle.vel,
        originSide: shuttle.originSide,
        shotType: shuttle.shotType,
        passed,
      });
    }

    // Test 3: Remote Opponent State Sync, Lerp Interpolation & 3D Smash Telegraph
    {
      const testId = 'm6_remote_opponent_interpolation';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Simulate remote Host player running to right backcourt and preparing a smash
      const remoteStatePacket = {
        type: 'STATE_SYNC',
        pos: [1.35, 0.65, 4.25],
        vel: [3.2, 0, 1.8],
        chargingSmash: true,
        intendedShot: 'SMASH',
        timestamp: Date.now(),
      };

      // Pause Host background broadcast so Guest interpolates the exact deterministic injected packet
      await hostPage.evaluate(() => {
        window.state.network.status = 'paused_sync';
      });

      await guestPage.evaluate((packet) => {
        window.injectRemotePacket(packet);
      }, remoteStatePacket);

      // Advance 18 frames (300ms) for lerp to interpolate remoteTargetPos
      for (let i = 0; i < 18; i++) {
        await guestPage.evaluate(() => window.advanceTime(16.67));
      }

      await hostPage.evaluate(() => {
        window.state.network.status = 'connected';
      });

      const guestInterpJson = await guestPage.evaluate(() => window.render_game_to_text());
      const guestInterpState = JSON.parse(guestInterpJson);
      fs.writeFileSync(path.join(testDir, 'guest-interp-state.json'), guestInterpJson);
      await captureCanvas(guestPage, path.join(testDir, 'guest-remote-smash-telegraph.png'));

      const opp = guestInterpState.opponent;
      console.log(`[Remote Opponent Interp] Pos: [${opp.pos.join(', ')}], chargingSmash: ${opp.chargingSmash}, intendedShot: ${opp.intendedShot}`);

      // Remote player at [1.35, 0.65, 4.25] mirrors to [-1.35, 0.65, -4.25]
      const posLerpedClose = Math.abs(opp.pos[0] - (-1.35)) < 0.25 && Math.abs(opp.pos[2] - (-4.25)) < 0.35 && opp.pos[1] > 0.40;
      const telegraphActive = opp.chargingSmash === true && opp.intendedShot === 'SMASH';
      const passed = posLerpedClose && telegraphActive;

      qaSummary.tests.push({
        id: testId,
        opponentPos: opp.pos,
        chargingSmash: opp.chargingSmash,
        intendedShot: opp.intendedShot,
        posLerpedClose,
        telegraphActive,
        passed,
      });
    }

    // Test 4: Official BWF 21-Point Scoring, Odd/Even Service Courts, Deuce, & Match Settlement
    {
      const testId = 'm6_bwf_21pt_deuce_and_service_courts';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Step 4A: Even Service Court (0:0) -> Right Court (X > 0)
      const evenScoreState = await hostPage.evaluate(() => {
        window.setMatchScore(0, 0, 'player');
        return JSON.parse(window.render_game_to_text());
      });
      console.log(`[BWF Even 0:0] Court: ${evenScoreState.score.serviceCourt}, Server Box: [${evenScoreState.score.serverBoxCoords.join(', ')}]`);
      const evenPassed = evenScoreState.score.serviceCourt === 'right_even' && evenScoreState.score.serverBoxCoords[0] > 0;

      // Step 4B: Odd Service Court (1:0) -> Left Court (X < 0)
      const oddScoreState = await hostPage.evaluate(() => {
        window.setMatchScore(1, 0, 'player');
        return JSON.parse(window.render_game_to_text());
      });
      console.log(`[BWF Odd 1:0] Court: ${oddScoreState.score.serviceCourt}, Server Box: [${oddScoreState.score.serverBoxCoords.join(', ')}]`);
      const oddPassed = oddScoreState.score.serviceCourt === 'left_odd' && oddScoreState.score.serverBoxCoords[0] < 0;

      // Step 4C: Deuce (20:20) -> isDeuce: true, match continues
      const deuceScoreState = await hostPage.evaluate(() => {
        window.setMatchScore(20, 20, 'player');
        return JSON.parse(window.render_game_to_text());
      });
      await captureCanvas(hostPage, path.join(testDir, 'deuce-20-20.png'));
      console.log(`[BWF Deuce 20:20] isDeuce: ${deuceScoreState.score.isDeuce}, mode: ${deuceScoreState.mode}, matchWinner: ${deuceScoreState.score.matchWinner}`);
      const deucePassed = deuceScoreState.score.isDeuce === true && deuceScoreState.mode === 'playing' && deuceScoreState.score.matchWinner === 'none';

      // Step 4D: Game Point at 21:20 -> isGamePoint: true, player leads
      const gpScoreState = await hostPage.evaluate(() => {
        window.setMatchScore(21, 20, 'player');
        return JSON.parse(window.render_game_to_text());
      });
      console.log(`[BWF Game Point 21:20] isGamePoint: ${gpScoreState.score.isGamePoint}, holder: ${gpScoreState.score.gamePointHolder}`);
      const gpPassed = gpScoreState.score.isGamePoint === true && gpScoreState.score.gamePointHolder === 'player';

      // Step 4E: Winning Point at 22:20 (Win by 2) -> matchWinner: 'player', mode: 'match_over'
      const winScoreState = await hostPage.evaluate(() => {
        window.setMatchScore(22, 20, 'player');
        return JSON.parse(window.render_game_to_text());
      });
      fs.writeFileSync(path.join(testDir, 'match-over-state.json'), JSON.stringify(winScoreState, null, 2));
      await captureCanvas(hostPage, path.join(testDir, 'match-over-victory.png'));
      console.log(`[BWF Match Win 22:20] Winner: ${winScoreState.score.matchWinner}, mode: ${winScoreState.mode}`);
      const winPassed = winScoreState.score.matchWinner === 'player' && winScoreState.mode === 'match_over';

      // Step 4F: Rematch Reset -> scores 0:0, mode: 'playing', court: 'right_even'
      const resetScoreState = await hostPage.evaluate(() => {
        window.resetMatch();
        return JSON.parse(window.render_game_to_text());
      });
      console.log(`[BWF Rematch Reset] Score: ${resetScoreState.score.player}:${resetScoreState.score.opponent}, mode: ${resetScoreState.mode}, court: ${resetScoreState.score.serviceCourt}`);
      const resetPassed = resetScoreState.score.player === 0 && resetScoreState.score.opponent === 0 && resetScoreState.mode === 'playing' && resetScoreState.score.serviceCourt === 'right_even';

      const passed = evenPassed && oddPassed && deucePassed && gpPassed && winPassed && resetPassed;

      qaSummary.tests.push({
        id: testId,
        evenPassed,
        oddPassed,
        deucePassed,
        gpPassed,
        winPassed,
        resetPassed,
        passed,
      });
    }

    // Test 5: Real-time GPU & Draw Calls Performance Verification
    {
      const testId = 'm6_performance_and_regression';
      console.log(`\n=== Testing: ${testId} ===`);
      const testDir = path.join(qaBaseDir, testId);
      fs.mkdirSync(testDir, { recursive: true });

      // Advance 10 frames to ensure all geometries and shaders are cached
      for (let i = 0; i < 10; i++) {
        await hostPage.evaluate(() => window.advanceTime(16.67));
      }

      const perfJson = await hostPage.evaluate(() => window.render_game_to_text());
      const perfState = JSON.parse(perfJson);
      fs.writeFileSync(path.join(testDir, 'performance-state.json'), perfJson);

      const perf = perfState.performance;
      console.log(`[Performance Telemetry] drawCalls: ${perf?.drawCalls}, triangles: ${perf?.triangles}, geometries: ${perf?.geometries}, textures: ${perf?.textures}`);

      const drawCallsHealthy = perf && perf.drawCalls > 0 && perf.drawCalls < 120;
      const noConsoleErrors = consoleErrors.length === 0;
      const passed = Boolean(drawCallsHealthy && noConsoleErrors);

      qaSummary.tests.push({
        id: testId,
        performance: perf,
        drawCallsHealthy,
        consoleErrorsCount: consoleErrors.length,
        passed,
      });
    }

    fs.writeFileSync(path.join(qaBaseDir, 'summary.json'), JSON.stringify(qaSummary, null, 2));

    const allPassed = qaSummary.tests.every((t) => t.passed);
    console.log(`\n========================================`);
    console.log(`Milestone 6 QA Automation Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
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
