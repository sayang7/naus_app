import { motion } from 'framer-motion';
import type { SavedSession } from '../types';

const spring = { type: 'spring', stiffness: 300, damping: 30 } as const;

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface SessionHistoryProps {
  sessions: SavedSession[];
  activeId: string | null;
  onSelect: (session: SavedSession) => void;
  onNew: () => void;
}

export function SessionHistory({ sessions, activeId, onSelect, onNew }: SessionHistoryProps) {
  return (
    <aside className="h-full bg-bg flex flex-col overflow-hidden border-r border-border">
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 flex items-center justify-between border-b border-border"
        style={{ height: 56 }}
      >
        <span className="font-mono text-13 text-muted uppercase tracking-wider">sessions</span>
        <button
          type="button"
          onClick={onNew}
          className="font-mono text-13 text-muted hover:text-text transition-colors"
          title="New session"
        >
          + new
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-2">
        {sessions.length === 0 ? (
          <p className="px-4 py-3 text-13 text-muted leading-[20px]">
            Conversations appear here after your first question.
          </p>
        ) : (
          sessions.map((s) => {
            const isActive = s.id === activeId;
            return (
              <motion.button
                key={s.id}
                type="button"
                onClick={() => onSelect(s)}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={spring}
                className="w-full text-left px-4 py-3 border-b border-border transition-colors"
                style={{
                  backgroundColor: isActive ? 'rgba(201,169,97,0.06)' : undefined,
                  borderLeft: isActive ? '2px solid #C9A961' : '2px solid transparent',
                }}
              >
                <div className="text-13 text-text leading-[20px] truncate">{s.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-13 text-muted">{relativeTime(s.timestamp)}</span>
                  {s.ledger.length > 0 && (
                    <span className="font-mono text-13 text-muted">
                      · {s.ledger.length} claims
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </aside>
  );
}
