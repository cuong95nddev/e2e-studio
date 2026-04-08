import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export interface Session {
  id: string;
  name: string;
  created_at: number;
  step_count: number;
}

export interface Step {
  id: number;
  session_id: string;
  step_number: number;
  action_type: string;
  description: string;
  xpath: string | null;
  screenshot_path: string | null;
  timestamp: number;
}

export class Db {
  private db: Database.Database;
  private screenshotsDir: string;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.screenshotsDir = path.join(dataDir, 'screenshots');
    fs.mkdirSync(this.screenshotsDir, { recursive: true });
    this.db = new Database(path.join(dataDir, 'e2e-studio.db'));
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        step_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS steps (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id      TEXT NOT NULL REFERENCES sessions(id),
        step_number     INTEGER NOT NULL,
        action_type     TEXT NOT NULL,
        description     TEXT NOT NULL,
        xpath           TEXT,
        screenshot_path TEXT,
        timestamp       INTEGER NOT NULL
      );
    `);
  }

  createSession(id: string): Session {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number };
    const name = `Session #${row.n + 1}`;
    const created_at = Date.now();
    this.db.prepare(
      'INSERT INTO sessions (id, name, created_at, step_count) VALUES (?, ?, ?, 0)'
    ).run(id, name, created_at);
    return { id, name, created_at, step_count: 0 };
  }

  insertStep(params: {
    sessionId: string;
    stepNumber: number;
    actionType: string;
    description: string;
    xpath: string | null;
    screenshotBase64: string | null;
    timestamp: number;
  }): Step {
    let screenshot_path: string | null = null;

    if (params.screenshotBase64) {
      try {
        const dir = path.join(this.screenshotsDir, params.sessionId);
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `${params.stepNumber}.png`);
        const base64 = params.screenshotBase64.replace(/^data:image\/png;base64,/, '');
        const buf = Buffer.from(base64, 'base64');
        if (buf.length === 0) throw new Error('empty buffer');
        fs.writeFileSync(filePath, buf);
        screenshot_path = `screenshots/${params.sessionId}/${params.stepNumber}.png`;
      } catch {
        // leave screenshot_path as null
      }
    }

    const result = this.db.prepare(`
      INSERT INTO steps (session_id, step_number, action_type, description, xpath, screenshot_path, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.sessionId, params.stepNumber, params.actionType,
      params.description, params.xpath, screenshot_path, params.timestamp
    );

    this.db.prepare('UPDATE sessions SET step_count = step_count + 1 WHERE id = ?')
      .run(params.sessionId);

    return {
      id: result.lastInsertRowid as number,
      session_id: params.sessionId,
      step_number: params.stepNumber,
      action_type: params.actionType,
      description: params.description,
      xpath: params.xpath,
      screenshot_path,
      timestamp: params.timestamp,
    };
  }

  finalizeSession(_id: string): void {
    // step_count maintained live by insertStep; nothing extra needed
  }

  getSessions(): Session[] {
    return this.db.prepare(
      'SELECT * FROM sessions ORDER BY created_at DESC, rowid DESC'
    ).all() as Session[];
  }

  getSteps(sessionId: string): Step[] {
    return this.db.prepare(
      'SELECT * FROM steps WHERE session_id = ? ORDER BY step_number ASC'
    ).all(sessionId) as Step[];
  }

  close(): void {
    this.db.close();
  }
}
