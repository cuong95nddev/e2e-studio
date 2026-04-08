import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Db } from './db';

let tmpDir: string;
let db: Db;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-studio-test-'));
  db = new Db(tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Db', () => {
  it('createSession returns session with sequential name', () => {
    const s1 = db.createSession('id-1');
    const s2 = db.createSession('id-2');
    expect(s1.name).toBe('Session #1');
    expect(s2.name).toBe('Session #2');
    expect(s1.id).toBe('id-1');
    expect(s1.step_count).toBe(0);
  });

  it('getSessions returns all sessions newest first', () => {
    db.createSession('id-1');
    db.createSession('id-2');
    const sessions = db.getSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe('id-2');
  });

  it('insertStep increments session step_count', () => {
    db.createSession('sess-1');
    db.insertStep({
      sessionId: 'sess-1',
      stepNumber: 1,
      actionType: 'click',
      description: 'Click on "Login"',
      xpath: '//button[1]',
      screenshotBase64: null,
      timestamp: Date.now(),
    });
    const sessions = db.getSessions();
    expect(sessions[0].step_count).toBe(1);
  });

  it('insertStep saves screenshot file when base64 provided', () => {
    db.createSession('sess-1');
    // 1x1 transparent PNG base64
    const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const step = db.insertStep({
      sessionId: 'sess-1',
      stepNumber: 1,
      actionType: 'click',
      description: 'Click',
      xpath: null,
      screenshotBase64: png1x1,
      timestamp: Date.now(),
    });
    expect(step.screenshot_path).toMatch(/sess-1/);
    expect(fs.existsSync(path.join(tmpDir, 'screenshots', 'sess-1', '1.png'))).toBe(true);
  });

  it('getSteps returns steps in order for a session', () => {
    db.createSession('sess-1');
    db.insertStep({ sessionId: 'sess-1', stepNumber: 1, actionType: 'click', description: 'Step 1', xpath: null, screenshotBase64: null, timestamp: 1 });
    db.insertStep({ sessionId: 'sess-1', stepNumber: 2, actionType: 'input', description: 'Step 2', xpath: null, screenshotBase64: null, timestamp: 2 });
    const steps = db.getSteps('sess-1');
    expect(steps).toHaveLength(2);
    expect(steps[0].step_number).toBe(1);
    expect(steps[1].action_type).toBe('input');
  });
});
