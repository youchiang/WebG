import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

/**
 * Derivation of Screen-Right Vector for Chase Camera:
 * 1. Camera is a chase camera looking along the forward travel vector f = (fx, 0, fz), normalized.
 * 2. Camera up vector in world space is u = (0, 1, 0).
 * 3. In Three.js / WebGL camera space:
 *    - Camera looks along -Z_cam (viewDir = -Z_cam <=> Z_cam = -viewDir = -f)
 *    - Camera up is +Y_cam = u = (0, 1, 0)
 *    - Camera right is +X_cam (screen-right)
 * 4. In a right-handed orthonormal coordinate system:
 *    X_cam = Y_cam x Z_cam = u x (-viewDir) = viewDir x u
 * 5. Cross product viewDir x u:
 *    (fx, 0, fz) x (0, 1, 0) = (0*0 - fz*1, fz*0 - fx*0, fx*1 - 0*0) = (-fz, 0, fx)
 * 6. Therefore, the screen-right unit vector in world space is r_screen = (-fz, 0, fx).
 *    Any displacement d = (dx, 0, dz) has lateral component along screen-right:
 *    lateralDisp = d . r_screen = dx * (-fz) + dz * fx.
 *    If lateralDisp > 0, the car moved to screen-right.
 *    If lateralDisp < 0, the car moved to screen-left.
 */

async function runDriftQA() {
  console.log('🏎️ Starting Drift Downhill 3D 《垃圾清運行動》 QA Runner...');

  const artifactsDir = path.resolve('tests/artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (err) => {
    const msg = err && err.message ? err.message : String(err);
    console.error('❌ Browser Page Exception:', msg);
    pageErrors.push(msg);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      console.error('❌ Browser Console Error:', text);
      consoleErrors.push(text);
    }
  });

  const testResults = [];
  let capturedStartScreen = false;

  async function freshStart() {
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(400);

    if (!capturedStartScreen) {
      await page.screenshot({ path: path.join(artifactsDir, '01_start_screen.png') });
      console.log('📸 Captured 01_start_screen.png');
      capturedStartScreen = true;
    }

    await page.click('#start-race-btn');
    await page.waitForTimeout(200);

    const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
    if (state.mode !== 'RACING') {
      throw new Error(`Expected mode RACING on fresh start, got: ${state.mode}`);
    }
    return state;
  }

  try {
    // =========================================================================
    // Check 0: 遊戲標題包含《垃圾清運行動》
    // =========================================================================
    console.log('\n--- [Check 0] 遊戲名稱 document.title 檢驗 ---');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const pageTitle = await page.title();
    console.log(`Document Title: "${pageTitle}"`);
    const titleMatch = pageTitle.includes('垃圾清運行動');
    const check0Pass = titleMatch;
    const check0Detail = check0Pass
      ? `PASS: title 包含「垃圾清運行動」("${pageTitle}")`
      : `FAIL: title 未包含「垃圾清運行動」("${pageTitle}")`;

    if (check0Pass) console.log('✅ ' + check0Detail);
    else console.error('❌ ' + check0Detail);

    testResults.push({
      id: 0,
      name: '遊戲標題檢查 (Title)',
      threshold: 'document.title 包含「垃圾清運行動」',
      detail: check0Detail,
      pass: check0Pass,
    });

    // =========================================================================
    // Check 1: Nose-up Pitch Check during Straight Downhill Driving (Steer 0)
    // =========================================================================
    console.log('\n--- [Check 1] Nose-up Pitch Angle Check ---');
    await freshStart();

    const pitchData = await page.evaluate(() => {
      window.simulateJoystick(0, 0); // Straight downhill
      const samples = [];
      for (let i = 0; i < 30; i++) { // ~3 seconds (30 x 100ms)
        window.advanceTime(100, true);
        const s = JSON.parse(window.render_game_to_text());
        samples.push({
          step: i,
          speed: s.speed,
          pitchDeg: s.pitchDeg,
          progress: s.progress,
        });
      }
      return samples;
    });

    const definedPitches = pitchData.filter(s => typeof s.pitchDeg === 'number');
    let check1Pass = false;
    let check1Detail = '';

    if (definedPitches.length === 0) {
      check1Pass = false;
      check1Detail = 'FAIL: pitchDeg telemetry undefined';
      console.warn('⚠️ ' + check1Detail);
    } else {
      const maxPitch = Math.max(...definedPitches.map(s => s.pitchDeg));
      const minPitch = Math.min(...definedPitches.map(s => s.pitchDeg));
      const violating = definedPitches.filter(s => s.pitchDeg > 2.0);

      if (violating.length > 0) {
        check1Pass = false;
        check1Detail = `FAIL: pitchDeg exceeded +2° (max: ${maxPitch.toFixed(2)}°, samples > 2°: ${violating.length}/${definedPitches.length})`;
        console.error('❌ ' + check1Detail);
      } else {
        check1Pass = true;
        check1Detail = `PASS: max pitchDeg = ${maxPitch.toFixed(2)}° <= +2.0° (range: [${minPitch.toFixed(2)}°, ${maxPitch.toFixed(2)}°])`;
        console.log('✅ ' + check1Detail);
      }
    }
    testResults.push({
      id: 1,
      name: 'Nose-up Pitch Check',
      threshold: 'pitchDeg <= +2.0° on steer 0 downhill',
      detail: check1Detail,
      pass: check1Pass,
    });

    // =========================================================================
    // Check 2: Steering Direction Verification (+0.6 right vs -0.6 left)
    // =========================================================================
    console.log('\n--- [Check 2] Steering Direction Verification ---');

    // Run A: Steer +0.6
    await freshStart();
    const steerRightResult = await page.evaluate(() => {
      window.simulateJoystick(0, 0);
      window.advanceTime(300, true);
      const s0 = JSON.parse(window.render_game_to_text());

      window.advanceTime(100, true);
      const s1 = JSON.parse(window.render_game_to_text());

      const headingX = s1.carPos.x - s0.carPos.x;
      const headingZ = s1.carPos.z - s0.carPos.z;
      const headingLen = Math.hypot(headingX, headingZ);
      const fx = headingLen > 0.001 ? headingX / headingLen : 0;
      const fz = headingLen > 0.001 ? headingZ / headingLen : 1;

      const rightX = -fz;
      const rightZ = fx;

      const posBefore = { ...s1.carPos };

      window.simulateJoystick(0.6, 0);
      for (let i = 0; i < 6; i++) {
        window.advanceTime(100, true);
      }
      const posAfter = JSON.parse(window.render_game_to_text()).carPos;

      const deltaX = posAfter.x - posBefore.x;
      const deltaZ = posAfter.z - posBefore.z;
      const lateralDisp = deltaX * rightX + deltaZ * rightZ;

      return { fx, fz, rightX, rightZ, posBefore, posAfter, deltaX, deltaZ, lateralDisp };
    });

    // Run B: Steer -0.6
    await freshStart();
    const steerLeftResult = await page.evaluate(() => {
      window.simulateJoystick(0, 0);
      window.advanceTime(300, true);
      const s0 = JSON.parse(window.render_game_to_text());

      window.advanceTime(100, true);
      const s1 = JSON.parse(window.render_game_to_text());

      const headingX = s1.carPos.x - s0.carPos.x;
      const headingZ = s1.carPos.z - s0.carPos.z;
      const headingLen = Math.hypot(headingX, headingZ);
      const fx = headingLen > 0.001 ? headingX / headingLen : 0;
      const fz = headingLen > 0.001 ? headingZ / headingLen : 1;

      const rightX = -fz;
      const rightZ = fx;

      const posBefore = { ...s1.carPos };

      window.simulateJoystick(-0.6, 0);
      for (let i = 0; i < 6; i++) {
        window.advanceTime(100, true);
      }
      const posAfter = JSON.parse(window.render_game_to_text()).carPos;

      const deltaX = posAfter.x - posBefore.x;
      const deltaZ = posAfter.z - posBefore.z;
      const lateralDisp = deltaX * rightX + deltaZ * rightZ;

      return { fx, fz, rightX, rightZ, posBefore, posAfter, deltaX, deltaZ, lateralDisp };
    });

    console.log(`Steer +0.6 lateral displacement: ${steerRightResult.lateralDisp.toFixed(3)}m (screen-right)`);
    console.log(`Steer -0.6 lateral displacement: ${steerLeftResult.lateralDisp.toFixed(3)}m (screen-left)`);

    const check2Pass = (steerRightResult.lateralDisp > 0) && (steerLeftResult.lateralDisp < 0);
    const check2Detail = check2Pass
      ? `PASS: steer +0.6 gave +${steerRightResult.lateralDisp.toFixed(3)}m (screen-right), -0.6 gave ${steerLeftResult.lateralDisp.toFixed(3)}m (screen-left)`
      : `FAIL: steer sign mismatch (+0.6 -> ${steerRightResult.lateralDisp.toFixed(3)}m, -0.6 -> ${steerLeftResult.lateralDisp.toFixed(3)}m)`;

    if (check2Pass) console.log('✅ ' + check2Detail);
    else console.error('❌ ' + check2Detail);

    testResults.push({
      id: 2,
      name: 'Steering Direction Check',
      threshold: '+0.6 -> screen-right (>0), -0.6 -> screen-left (<0)',
      detail: check2Detail,
      pass: check2Pass,
    });

    // =========================================================================
    // Check 5: Drift Sideways Slip Angle + Screenshots 02 & 05
    // =========================================================================
    console.log('\n--- [Check 5] Drift Sideways Slip Angle & Drift Screenshots ---');
    await freshStart();

    const driftRun = await page.evaluate(() => {
      window.simulateJoystick(0, 0.4);
      for (let i = 0; i < 20; i++) {
        window.advanceTime(50, true);
        const s = JSON.parse(window.render_game_to_text());
        if (s.speed > 10) break;
      }

      window.simulateJoystick(0.9, 0.2);
      const samples = [];
      for (let i = 0; i < 15; i++) {
        window.advanceTime(100, true);
        const s = JSON.parse(window.render_game_to_text());
        samples.push({
          step: i,
          speed: s.speed,
          isDrifting: s.isDrifting,
          slipDeg: s.slipDeg,
          maxSlipDeg: s.maxSlipDeg,
          trashBagsRemaining: s.trashBagsRemaining,
          trashBagsLost: s.trashBagsLost,
        });
      }
      return samples;
    });

    await page.screenshot({ path: path.join(artifactsDir, '02_mid_drift.png') });
    console.log('📸 Captured 02_mid_drift.png');

    await page.evaluate(() => {
      if (window.driftGameApp && window.driftGameApp.cameraController) {
        window.driftGameApp.cameraController.followDistance = 6.0;
        window.driftGameApp.cameraController.followHeight = 2.8;
      }
      window.advanceTime(16, true);
    });
    await page.screenshot({ path: path.join(artifactsDir, '05_drift_closeup.png') });
    console.log('📸 Captured 05_drift_closeup.png');

    await page.evaluate(() => {
      if (window.driftGameApp && window.driftGameApp.cameraController) {
        window.driftGameApp.cameraController.followDistance = 7.5;
        window.driftGameApp.cameraController.followHeight = 3.6;
      }
    });

    let check5Pass = false;
    let check5Detail = '';
    const slipValues = driftRun
      .map(s => {
        if (typeof s.maxSlipDeg === 'number') return s.maxSlipDeg;
        if (typeof s.slipDeg === 'number') return Math.abs(s.slipDeg);
        return undefined;
      })
      .filter(v => typeof v === 'number');

    if (slipValues.length === 0) {
      check5Pass = false;
      check5Detail = 'FAIL: slipDeg/maxSlipDeg telemetry undefined';
      console.warn('⚠️ ' + check5Detail);
    } else {
      const peakSlip = Math.max(...slipValues);
      if (peakSlip < 15) {
        check5Pass = false;
        check5Detail = `FAIL: maxSlipDeg (${peakSlip.toFixed(1)}°) < 15° (car not angling enough)`;
      } else if (peakSlip > 50) {
        check5Pass = false;
        check5Detail = `FAIL: maxSlipDeg (${peakSlip.toFixed(1)}°) > 50° (spin-out / over-drift)`;
      } else {
        check5Pass = true;
        check5Detail = `PASS: maxSlipDeg = ${peakSlip.toFixed(1)}° (within [15°, 50°])`;
      }
      if (check5Pass) console.log('✅ ' + check5Detail);
      else console.error('❌ ' + check5Detail);
    }

    testResults.push({
      id: 5,
      name: 'Drift Sideways Slip Angle',
      threshold: '15° <= maxSlipDeg <= 50° at steer 0.9',
      detail: check5Detail,
      pass: check5Pass,
    });

    // =========================================================================
    // Check 6: 垃圾袋載貨與甩飛機制 (Trash Bags Cargo Ejection)
    // =========================================================================
    console.log('\n--- [Check 6] 垃圾袋載貨與甩飛機制檢驗 ---');
    const startTrashState = await freshStart();
    const initialBags = typeof startTrashState.trashBagsRemaining === 'number'
      ? startTrashState.trashBagsRemaining
      : (await page.evaluate(() => window.driftGameApp?.vehiclePhysics?.trashBagsRemaining ?? 30));
    const initialLost = typeof startTrashState.trashBagsLost === 'number'
      ? startTrashState.trashBagsLost
      : (await page.evaluate(() => window.driftGameApp?.vehiclePhysics?.trashBagsLost ?? 0));

    console.log(`起跑時垃圾袋狀態: 剩餘 ${initialBags} 袋, 已甩飛 ${initialLost} 袋`);

    // 進行激烈過彎甩尾 2~3 秒以觸發離心力甩飛
    const afterDriftTrash = await page.evaluate(() => {
      // 加速進入彎道
      window.simulateJoystick(0, 0.5);
      for (let i = 0; i < 20; i++) {
        window.advanceTime(50, false);
      }
      // 大幅轉向甩尾 2 秒
      window.simulateJoystick(0.9, 0.2);
      for (let i = 0; i < 20; i++) {
        window.advanceTime(100, false);
      }
      const s = JSON.parse(window.render_game_to_text());
      const vpRemaining = window.driftGameApp?.vehiclePhysics?.trashBagsRemaining;
      const vpLost = window.driftGameApp?.vehiclePhysics?.trashBagsLost;
      return {
        stateRemaining: s.trashBagsRemaining,
        stateLost: s.trashBagsLost,
        vpRemaining,
        vpLost,
      };
    });

    const currentRemaining = typeof afterDriftTrash.stateRemaining === 'number'
      ? afterDriftTrash.stateRemaining
      : afterDriftTrash.vpRemaining;
    const currentLost = typeof afterDriftTrash.stateLost === 'number'
      ? afterDriftTrash.stateLost
      : afterDriftTrash.vpLost;

    console.log(`甩尾後垃圾袋狀態: 剩餘 ${currentRemaining} 袋, 已甩飛 ${currentLost} 袋`);

    const initialBagsValid = initialBags > 0;
    const bagsLostValid = currentLost > 0;
    const bagsReducedValid = currentRemaining < initialBags;
    const checkTrashPass = initialBagsValid && bagsLostValid && bagsReducedValid;
    const checkTrashDetail = checkTrashPass
      ? `PASS: 起跑初始 ${initialBags} 袋，甩尾後甩飛 ${currentLost} 袋，剩餘 ${currentRemaining} 袋`
      : `FAIL: 垃圾袋未正確甩飛 (初始: ${initialBags}, 甩飛: ${currentLost}, 剩餘: ${currentRemaining})`;

    if (checkTrashPass) console.log('✅ ' + checkTrashDetail);
    else console.error('❌ ' + checkTrashDetail);

    testResults.push({
      id: 6,
      name: '垃圾袋甩飛機制 (Trash Bags)',
      threshold: '初始 > 0，激烈甩尾後 lost > 0 且 remaining 減少',
      detail: checkTrashDetail,
      pass: checkTrashPass,
    });

    // =========================================================================
    // Check 3: Wall Robustness ("Lazy Player" Runs)
    // =========================================================================
    console.log('\n--- [Check 3] Wall Robustness Lazy Player Runs ---');

    console.log('Running Lazy Run (a): steer +1.0 for 3s then 0...');
    await freshStart();
    const lazyA = await page.evaluate(() => {
      window.simulateJoystick(1.0, 0);
      for (let i = 0; i < 30; i++) {
        window.advanceTime(100, false);
      }
      window.simulateJoystick(0, 0);
      let steps = 0;
      for (let i = 0; i < 3000; i++) {
        window.advanceTime(100, false);
        steps++;
        const s = JSON.parse(window.render_game_to_text());
        if (s.mode === 'FINISHED') break;
      }
      const finalState = JSON.parse(window.render_game_to_text());
      return { finalState, steps };
    });

    const wallHits3a = typeof lazyA.finalState.wallHits === 'number' ? lazyA.finalState.wallHits : undefined;
    console.log(`Lazy Run (a) finished in ${lazyA.steps} steps. wallHits: ${wallHits3a !== undefined ? wallHits3a : 'undefined'}`);

    console.log('Running Lazy Run (b): zig-zag sin steer 0.8...');
    await freshStart();

    await page.evaluate(() => {
      for (let i = 0; i < 80; i++) {
        const steer = Math.sin(i * 0.15) * 0.8;
        window.simulateJoystick(steer, 0);
        window.advanceTime(100, false);
      }
      window.advanceTime(16, true);
    });

    await page.screenshot({ path: path.join(artifactsDir, '03_yeet_gameplay.png') });
    console.log('📸 Captured 03_yeet_gameplay.png (mid-descent active gameplay)');

    const lazyB = await page.evaluate(() => {
      let steps = 80;
      for (let i = 80; i < 3000; i++) {
        const steer = Math.sin(i * 0.15) * 0.8;
        window.simulateJoystick(steer, 0);
        window.advanceTime(100, false);
        steps++;
        const s = JSON.parse(window.render_game_to_text());
        if (s.mode === 'FINISHED') break;
      }
      const finalState = JSON.parse(window.render_game_to_text());
      return { finalState, steps };
    });

    const wallHits3b = typeof lazyB.finalState.wallHits === 'number' ? lazyB.finalState.wallHits : undefined;
    console.log(`Lazy Run (b) finished in ${lazyB.steps} steps. wallHits: ${wallHits3b !== undefined ? wallHits3b : 'undefined'}`);

    let check3Pass = true;
    let check3Detail = '';
    const hitsInfoA = wallHits3a !== undefined ? `${wallHits3a}` : 'N/A';
    const hitsInfoB = wallHits3b !== undefined ? `${wallHits3b}` : 'N/A';

    // 隨車速調快放寬警告門檻至 50
    if (wallHits3a > 50 || wallHits3b > 50) {
      check3Detail = `WARN: wallHits elevated on fast runs (3a: ${hitsInfoA}, 3b: ${hitsInfoB} > 50)`;
      console.warn('⚠️ ' + check3Detail);
    } else {
      check3Detail = `REPORT: Lazy runs completed (3a: ${hitsInfoA} wall hits, 3b: ${hitsInfoB} wall hits)`;
      console.log('ℹ️ ' + check3Detail);
    }
    testResults.push({
      id: 3,
      name: 'Wall Robustness (Lazy Runs)',
      threshold: 'Report numbers (WARN if > 50)',
      detail: check3Detail,
      pass: check3Pass,
    });

    // =========================================================================
    // Check 4: Smart Auto-Driver (Steer 0 Full Run) + Finish Screenshot 04
    // =========================================================================
    console.log('\n--- [Check 4] Smart Auto-Driver (Steer 0) Full Run ---');
    await freshStart();

    const autoRun = await page.evaluate(() => {
      window.simulateJoystick(0, 0);
      let steps = 0;
      for (let i = 0; i < 3000; i++) {
        window.advanceTime(100, false);
        steps++;
        const s = JSON.parse(window.render_game_to_text());
        if (s.mode === 'FINISHED') break;
      }
      window.advanceTime(16, true);
      const finalState = JSON.parse(window.render_game_to_text());
      return { finalState, steps };
    });

    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(artifactsDir, '04_finish_summary.png') });
    console.log('📸 Captured 04_finish_summary.png');

    let check4Pass = false;
    let check4Detail = '';
    const autoWallHits = autoRun.finalState.wallHits;

    if (typeof autoWallHits !== 'number') {
      check4Pass = false;
      check4Detail = 'FAIL: wallHits telemetry undefined';
      console.warn('⚠️ ' + check4Detail);
    } else if (autoWallHits > 15) {
      check4Pass = false;
      check4Detail = `FAIL: steer-0 wallHits (${autoWallHits}) > 15`;
      console.error('❌ ' + check4Detail);
    } else {
      check4Pass = true;
      check4Detail = `PASS: steer-0 wallHits = ${autoWallHits} <= 15 (steps: ${autoRun.steps}, progress: ${autoRun.finalState.progress})`;
      console.log('✅ ' + check4Detail);
    }

    testResults.push({
      id: 4,
      name: 'Smart Auto-Driver / Steer 0 Run',
      threshold: 'wallHits <= 15 on steer-0 full run',
      detail: check4Detail,
      pass: check4Pass,
    });

    // =========================================================================
    // Check 7: Course Completion & Error-Free Console / Page
    // =========================================================================
    console.log('\n--- [Check 7] Finish State & Error Verification ---');
    const finishedMode = autoRun.finalState.mode === 'FINISHED';
    const noErrors = pageErrors.length === 0 && consoleErrors.length === 0;
    const check7Pass = finishedMode && noErrors;
    const check7Detail = check7Pass
      ? `PASS: Mode is FINISHED, 0 page errors, 0 console errors`
      : `FAIL: Finished=${finishedMode}, pageErrors=${pageErrors.length}, consoleErrors=${consoleErrors.length}`;

    if (check7Pass) console.log('✅ ' + check7Detail);
    else console.error('❌ ' + check7Detail);

    testResults.push({
      id: 7,
      name: 'Finish & Clean Console Check',
      threshold: 'mode === FINISHED and 0 errors',
      detail: check7Detail,
      pass: check7Pass,
    });

    // =========================================================================
    // Check 8: Screenshot Artifact Verification
    // =========================================================================
    console.log('\n--- [Check 8] Screenshot Artifact Verification ---');
    const expectedScreenshots = [
      '01_start_screen.png',
      '02_mid_drift.png',
      '03_yeet_gameplay.png',
      '04_finish_summary.png',
      '05_drift_closeup.png',
    ];

    const missingScreenshots = [];
    for (const file of expectedScreenshots) {
      const fullPath = path.join(artifactsDir, file);
      if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
        missingScreenshots.push(file);
      }
    }

    const check8Pass = missingScreenshots.length === 0;
    const check8Detail = check8Pass
      ? `PASS: All 5 screenshots generated in ${artifactsDir}`
      : `FAIL: Missing or empty screenshots: ${missingScreenshots.join(', ')}`;

    if (check8Pass) console.log('✅ ' + check8Detail);
    else console.error('❌ ' + check8Detail);

    testResults.push({
      id: 8,
      name: 'Screenshot Artifacts Check',
      threshold: 'All 5 screenshots exist and non-empty',
      detail: check8Detail,
      pass: check8Pass,
    });

  } catch (err) {
    console.error('❌ Fatal runner exception:', err);
    testResults.push({
      id: 99,
      name: 'Runner Execution',
      threshold: 'Execution without uncaught crash',
      detail: `CRASH: ${err.message}`,
      pass: false,
    });
  } finally {
    await browser.close();
  }

  // ===========================================================================
  // Summary Table Output
  // ===========================================================================
  console.log('\n========================================================================================');
  console.log('📊 《垃圾清運行動》 AUTOMATED QA SUMMARY REPORT');
  console.log('========================================================================================');
  console.log('| ID | Check Name | Target / Threshold | Result | Details |');
  console.log('|---|---|---|---|---|');
  let hasFailure = false;
  for (const r of testResults) {
    const status = r.pass ? 'PASS' : 'FAIL';
    if (!r.pass) hasFailure = true;
    console.log(`| ${r.id} | ${r.name} | ${r.threshold} | ${status} | ${r.detail} |`);
  }
  console.log('========================================================================================');

  if (hasFailure) {
    console.log('❌ QA completed with FAILURES (exit code 1).');
    process.exitCode = 1;
  } else {
    console.log('✅ QA completed: ALL CHECKS PASSED.');
    process.exitCode = 0;
  }
}

runDriftQA();
