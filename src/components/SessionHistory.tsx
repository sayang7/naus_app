import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  onDelete: (id: string) => void;
}

export function SessionHistory({ sessions, activeId, onSelect, onNew, onDelete }: SessionHistoryProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <aside className="h-full bg-bg flex flex-col overflow-hidden border-r border-border">
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 flex items-center justify-between border-b border-border"
        style={{ height: 52 }}
      >
        <span className="font-sans text-11 text-muted uppercase tracking-wider">sessions</span>
        <button
          type="button"
          onClick={onNew}
          className="font-sans text-11 text-muted transition-colors"
          style={{ transition: 'color 0.15s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-muted)'; }}
          title="New session (Ctrl+N)"
        >
          + new
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1">
        {sessions.length === 0 ? (
          <p className="px-4 py-3 text-13 text-muted leading-[20px]">
            Conversations appear here after your first question.
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {sessions.map((s) => {
              const isActive = s.id === activeId;
              const showDelete = hoveredId === s.id;
              return (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={spring}
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredId(s.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(s)}
                    className="w-full text-left px-4 py-2 border-b border-border transition-colors"
                    style={{
                      background: isActive ? 'rgba(201,169,97,0.06)' : undefined,
                      borderLeft: isActive ? '2px solid var(--color-gold)' : '2px solid transparent',
                      paddingRight: showDelete ? '28px' : '16px',
                      transition: 'background 0.15s, padding 0.12s',
                    }}
                  >
                    <div className="text-13 text-text leading-[20px] truncate">{s.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-sans text-11 text-muted">{relativeTime(s.timestamp)}</span>
                      {s.ledger.length > 0 && (
                        <span className="font-sans text-11 text-muted">
                          · {s.ledger.length} claims
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Delete button */}
                  {showDelete && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                      title="Delete session"
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--color-ghost)', fontSize: 14, lineHeight: 1,
                        padding: '4px',
                        transition: 'color 0.12s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-red)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ghost)'; }}
                    >
                      ×
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </aside>
  );
}
