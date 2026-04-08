import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import WebSocket from 'ws';
import { WsServer } from './wsServer';
import { Db } from './db';

const TEST_PORT = 19901;

let tmpDir: string;
let db: Db;
let server: WsServer;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-ws-test-'));
  db = new Db(tmpDir);
  server = new WsServer(TEST_PORT, db);
  await server.start();
});

afterEach(async () => {
  await server.stop();
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function connect(): Promise<WebSocket> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    ws.on('open', () => resolve(ws));
  });
}

function send(ws: WebSocket, msg: object): void {
  ws.send(JSON.stringify(msg));
}

function waitMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('WsServer', () => {
  it('creates session on session-start message', async () => {
    const ws = await connect();
    send(ws, { type: 'session-start', sessionId: 'abc-123' });
    await waitMs(50);
    const sessions = db.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('abc-123');
    ws.close();
  });

  it('inserts step on step message', async () => {
    const ws = await connect();
    send(ws, { type: 'session-start', sessionId: 'sess-1' });
    await waitMs(30);
    send(ws, {
      type: 'step',
      sessionId: 'sess-1',
      stepNumber: 1,
      actionType: 'click',
      description: 'Click "Login"',
      xpath: '//button[1]',
      screenshotBase64: null,
      timestamp: Date.now(),
    });
    await waitMs(50);
    const steps = db.getSteps('sess-1');
    expect(steps).toHaveLength(1);
    expect(steps[0].description).toBe('Click "Login"');
    ws.close();
  });

  it('fires onSessionChange callback on session-start and session-end', async () => {
    const calls: string[] = [];
    server.onSessionChange = (sessionId) => calls.push(sessionId);
    const ws = await connect();
    send(ws, { type: 'session-start', sessionId: 'sess-cb' });
    await waitMs(30);
    send(ws, { type: 'session-end', sessionId: 'sess-cb' });
    await waitMs(30);
    expect(calls).toEqual(['sess-cb', 'sess-cb']);
    ws.close();
  });

  it('fires onStep callback with step data', async () => {
    const steps: import('./db').Step[] = [];
    server.onStep = (step) => steps.push(step);
    const ws = await connect();
    send(ws, { type: 'session-start', sessionId: 'sess-2' });
    await waitMs(30);
    send(ws, {
      type: 'step',
      sessionId: 'sess-2',
      stepNumber: 1,
      actionType: 'navigate',
      description: 'Navigate to /home',
      xpath: null,
      screenshotBase64: null,
      timestamp: 123,
    });
    await waitMs(50);
    expect(steps).toHaveLength(1);
    expect(steps[0].action_type).toBe('navigate');
    expect(steps[0].description).toBe('Navigate to /home');
    ws.close();
  });
});
