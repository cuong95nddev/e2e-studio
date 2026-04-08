import { useEffect, useState } from 'react';

const vscode = acquireVsCodeApi();

interface Session {
  id: string;
  name: string;
  created_at: number;
  step_count: number;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SidebarApp() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'load-sessions') {
        setSessions(msg.sessions);
        setActiveSessionId(msg.activeSessionId ?? null);
      } else if (msg.type === 'session-added') {
        setSessions((prev) => [msg.session, ...prev]);
        setActiveSessionId(msg.session.id);
      } else if (msg.type === 'session-updated') {
        setSessions((prev) =>
          prev.map((s) => (s.id === msg.session.id ? msg.session : s))
        );
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ command: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  function openSession(id: string) {
    vscode.postMessage({ command: 'openSession', sessionId: id });
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 px-4">
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          No recordings yet. Start recording in the Chrome extension.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => openSession(session.id)}
          className={[
            'flex items-start gap-3 px-3 py-2.5 text-left w-full',
            'hover:bg-accent transition-colors',
            activeSessionId === session.id ? 'bg-accent' : '',
          ].join(' ')}
        >
          <div className="w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
            📋
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium truncate">{session.name}</span>
              {activeSessionId === session.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0 animate-pulse" />
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatDate(session.created_at)} · {session.step_count} steps
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
