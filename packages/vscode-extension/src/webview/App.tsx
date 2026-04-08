import { useEffect, useState } from 'react';

const vscode = acquireVsCodeApi();

interface Step {
  id: number;
  session_id: string;
  step_number: number;
  action_type: string;
  description: string;
  xpath: string | null;
  screenshot_path: string | null;  // original relative path for openScreenshot command
  screenshot_uri: string | null;   // webview URI for <img> src (set by panelManager)
  timestamp: number;
}

interface Session {
  id: string;
  name: string;
  created_at: number;
  step_count: number;
}

const ACTION_LABELS: Record<string, string> = {
  click: 'click',
  'right-click': 'right-click',
  input: 'input',
  navigate: 'navigate',
  scroll: 'scroll',
  drag: 'drag',
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'load-session') {
        setSession(msg.session);
        setSteps(msg.steps);
        setIsRecording(msg.isRecording ?? false);
      } else if (msg.type === 'step-added') {
        setSteps((prev) => [...prev, msg.step]);
        setSession((prev) => prev ? { ...prev, step_count: prev.step_count + 1 } : prev);
      } else if (msg.type === 'recording-stopped') {
        setIsRecording(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <p className="text-sm text-muted-foreground">Select a recording from the sidebar.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted flex-shrink-0">
        <span className="text-sm font-medium">{session.name}</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-border bg-card text-muted-foreground">
          {session.step_count} steps
        </span>
        {isRecording && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-destructive/10 text-destructive border border-destructive/20">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            Recording
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-muted z-10">
            <tr>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium border-b border-border w-10">#</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium border-b border-border">Step</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium border-b border-border w-24">Action</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium border-b border-border">XPath</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium border-b border-border w-20">Screenshot</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                <td className="px-3 py-2 text-muted-foreground">{step.step_number}</td>
                <td className="px-3 py-2">{step.description}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex px-1.5 py-0.5 rounded-full border border-border bg-card text-muted-foreground text-[10px]">
                    {ACTION_LABELS[step.action_type] ?? step.action_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground font-mono truncate max-w-xs">
                  {step.xpath ?? '—'}
                </td>
                <td className="px-3 py-2">
                  {step.screenshot_uri ? (
                    <img
                      src={step.screenshot_uri}
                      alt={`step ${step.step_number}`}
                      className="w-9 h-6 object-cover rounded border border-border cursor-pointer hover:opacity-80"
                      onClick={() => vscode.postMessage({ command: 'openScreenshot', path: step.screenshot_path })}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
