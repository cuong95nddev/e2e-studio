import { WebSocketServer, WebSocket } from 'ws';
import { Db, Step } from './db';

interface SessionStartMsg {
  type: 'session-start';
  sessionId: string;
}

interface StepMsg {
  type: 'step';
  sessionId: string;
  stepNumber: number;
  actionType: string;
  description: string;
  xpath: string | null;
  screenshotBase64: string | null;
  timestamp: number;
}

interface SessionEndMsg {
  type: 'session-end';
  sessionId: string;
}

type IncomingMsg = SessionStartMsg | StepMsg | SessionEndMsg;

export class WsServer {
  private wss: WebSocketServer | null = null;
  onSessionChange: ((sessionId: string) => void) | null = null;
  onStep: ((step: Step) => void) | null = null;

  constructor(private port: number, private db: Db) {}

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port });
      this.wss.on('connection', (ws: WebSocket) => {
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString()) as IncomingMsg;
            this.handle(msg);
          } catch {
            // ignore malformed messages
          }
        });
      });
      this.wss.on('listening', resolve);
    });
  }

  private handle(msg: IncomingMsg): void {
    if (msg.type === 'session-start') {
      this.db.createSession(msg.sessionId);
      this.onSessionChange?.(msg.sessionId);
    } else if (msg.type === 'step') {
      const step = this.db.insertStep({
        sessionId: msg.sessionId,
        stepNumber: msg.stepNumber,
        actionType: msg.actionType,
        description: msg.description,
        xpath: msg.xpath,
        screenshotBase64: msg.screenshotBase64,
        timestamp: msg.timestamp,
      });
      this.onStep?.(step);
    } else if (msg.type === 'session-end') {
      this.db.finalizeSession(msg.sessionId);
      this.onSessionChange?.(msg.sessionId);
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.wss) { resolve(); return; }
      this.wss.close(() => resolve());
    });
  }
}
