import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;
const PLAYWRIGHT_CLIENT =
  'C:\\Users\\john.hu\\.agents\\skills\\openai-develop-web-game\\scripts\\web_game_playwright_client.js';

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

async function main() {
  console.log('--- Starting Vite dev server ---');
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

    const payloadsDir = 'd:\\AGYWorkspace\\WebG\\tests\\payloads\\milestone1';
    const qaBaseDir = 'd:\\AGYWorkspace\\WebG\\tests\\output\\milestone1';
    fs.mkdirSync(qaBaseDir, { recursive: true });

    const tests = [
      {
        name: 'Initial Menu Screen',
        actionsFile: path.join(payloadsDir, 'qa_actions_menu.json'),
        outDir: path.join(qaBaseDir, 'menu'),
        selector: null,
      },
      {
        name: 'Multi-Quadrant Flow (Q1 -> Q2 -> Q3 -> Q4)',
        actionsFile: path.join(payloadsDir, 'qa_actions_all_quadrants.json'),
        outDir: qaBaseDir,
        selector: '#start-btn',
      },
      {
        name: 'Quadrant 1 Forehand High',
        actionsFile: path.join(payloadsDir, 'qa_actions_q1.json'),
        outDir: path.join(qaBaseDir, 'q1'),
        selector: '#start-btn',
      },
      {
        name: 'Quadrant 2 Backhand High',
        actionsFile: path.join(payloadsDir, 'qa_actions_q2.json'),
        outDir: path.join(qaBaseDir, 'q2'),
        selector: '#start-btn',
      },
      {
        name: 'Quadrant 3 Backhand Low',
        actionsFile: path.join(payloadsDir, 'qa_actions_q3.json'),
        outDir: path.join(qaBaseDir, 'q3'),
        selector: '#start-btn',
      },
      {
        name: 'Quadrant 4 Forehand Low',
        actionsFile: path.join(payloadsDir, 'qa_actions_q4.json'),
        outDir: path.join(qaBaseDir, 'q4'),
        selector: '#start-btn',
      },
      {
        name: 'Hysteresis Deadzone Check (-8px from Q1)',
        actionsFile: path.join(payloadsDir, 'qa_actions_hysteresis.json'),
        outDir: path.join(qaBaseDir, 'hysteresis'),
        selector: '#start-btn',
      },
    ];

    for (const t of tests) {
      console.log(`\n=== Running Test: ${t.name} ===`);
      fs.mkdirSync(t.outDir, { recursive: true });

      const cmdArgs = [
        `"${PLAYWRIGHT_CLIENT}"`,
        `--url "${BASE_URL}"`,
        `--screenshot-dir "${t.outDir}"`,
        `--actions-file "${t.actionsFile}"`,
        `--iterations 1`,
      ];
      if (t.selector) {
        cmdArgs.push(`--click-selector "${t.selector}"`);
      }

      const fullCmd = `node ${cmdArgs.join(' ')}`;
      console.log(`Command: ${fullCmd}`);
      execSync(fullCmd, { cwd: 'd:\\AGYWorkspace\\WebG', stdio: 'inherit' });
      console.log(`Test passed: ${t.name}`);
    }

    console.log('\n>>> All QA Playwright tests completed successfully! <<<');
  } finally {
    console.log('--- Shutting down Vite dev server ---');
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
