import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Commitment, ClaimStatus } from '../types';
import { STATUS_COLOR, STATUS_BG } from '../tokens';

const spring = { type: 'spring', stiffness: 300, damping: 30 } as const;
const SANS = 'Inter, system-ui, sans-serif';
const MONO = 'JetBrains Mono, monospace';

const STATUS_META: Record<ClaimStatus, { label: string; color: string; bg: string }> = {
  grounded:      { label: 'grounded',      color: STATUS_COLOR.grounded,      bg: STATUS_BG.grounded      },
  ambiguous:     { label: 'ambiguous',     color: STATUS_COLOR.ambiguous,     bg: STATUS_BG.ambiguous     },
  assumption:    { label: 'assumption',    color: STATUS_COLOR.assumption,     bg: STATUS_BG.assumption    },
  unverifiable:  { label: 'unverifiable', color: STATUS_COLOR.unverifiable,  bg: STATUS_BG.unverifiable  },
  contradiction: { label: 'contradiction', color: STATUS_COLOR.contradiction, bg: STATUS_BG.contradiction },
};

const ROLE_STYLE: Record<string, { label: string; color: string }> = {
  premise:    { label: 'premise',    color: 'var(--color-ghost)' },
  inference:  { label: 'inference', color: 'var(--color-ghost)' },
  conclusion: { label: 'conclusion', color: 'var(--color-muted)' },
};

interface LedgerProps {
  ledger: Commitment[];
  onHover: (id: string | null) => void;
  loading?: boolean;
}

function SkeletonCard() {
  return (
    <div style={{ marginBottom: 6, padding: '10px 12px', border: '1px solid var(--color-border-2)', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div className="skeleton" style={{ width: 36, height: 14 }} />
        <div className="skeleton" style={{ width: 60, height: 14 }} />
      </div>
      <div className="skeleton" style={{ width: '85%', height: 12, marginBottom: 4 }} />
      <div className="skeleton" style={{ width: '65%', height: 12 }} />
    </div>
  );
}

export function Ledger({ ledger, onHover, loading }: LedgerProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 px-1">
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (ledger.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center px-5" style={{ paddingBottom: 48 }}>
        <p style={{ fontFamily: SANS, fontSize: 13, color: 'var(--color-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          waiting for first answer
        </p>
        <p style={{ fontFamily: SANS, fontSize: 13, lineHeight: '20px', color: 'var(--color-faint)' }}>
          Every claim the AI makes — grounded facts, ambiguous statements,
          unverifiable assertions, hidden assumptions — is registered here.
          Contradictions are caught live and flagged in red. The graph shows
          how each claim fits into the reasoning chain.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 px-1">
      <AnimatePresence initial={false}>
        {ledger.map((c, i) => {
          const meta = STATUS_META[c.status];
          const isOpen = expanded === c.id;
          const role = c.reasoningRole ? ROLE_STYLE[c.reasoningRole] : null;

          return (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ ...spring, delay: i * 0.03 }}
              onMouseEnter={() => onHover(c.id)}
              onMouseLeave={() => onHover(null)}
              style={{ marginBottom: 6 }}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : c.id)}
                className="w-full text-left"
                style={{
                  background: isOpen ? 'rgba(255,255,255,0.03)' : 'transparent',
                  border: '1px solid',
                  borderColor: isOpen ? 'var(--color-whisper)' : 'var(--color-border-2)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--color-gold)' }}>
                      {c.id}
                    </span>
                    <span style={{
                      fontFamily: SANS, fontSize: 11, lineHeight: '16px',
                      color: meta.color, background: meta.bg,
                      borderRadius: 4, padding: '1px 6px',
                    }}>
                      {meta.label}
                    </span>
                    {role && (
                      <span style={{
                        fontFamily: SANS, fontSize: 10, lineHeight: '16px',
                        color: role.color, borderRadius: 4,
                        border: '1px solid var(--color-border-2)',
                        padding: '0px 5px',
                      }}>
                        {role.label}
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: SANS, fontSize: 12, color: 'var(--color-ghost)' }}>
                    t{c.turnNumber}
                  </span>
                </div>

                {/* Claim text */}
                <p style={{
                  fontFamily: SANS, fontSize: 13, color: 'var(--color-text)',
                  lineHeight: '18px',
                  display: '-webkit-box',
                  WebkitLineClamp: isOpen ? undefined : 2,
                  WebkitBoxOrient: 'vertical' as const,
                  overflow: isOpen ? 'visible' : 'hidden',
                  margin: 0,
                }}>
                  {c.text}
                </p>

                {/* Expanded details */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={spring}
                      style={{ overflow: 'hidden' }}
                    >
                      {/* Reasoning note */}
                      {c.note && (
                        <p style={{
                          fontFamily: SANS, fontSize: 12, color: meta.color,
                          lineHeight: '18px', marginTop: 8, marginBottom: 0,
                        }}>
                          {c.note}
                        </p>
                      )}

                      {/* Citation target */}
                      {c.citationTarget && (
                        <div style={{
                          marginTop: 8, padding: '6px 8px',
                          background: 'rgba(167,139,250,0.07)',
                          border: '1px solid rgba(167,139,250,0.18)',
                          borderRadius: 6,
                        }}>
                          <span style={{ fontFamily: SANS, fontSize: 10, color: 'var(--color-purple)', fontWeight: 500 }}>
                            VERIFY →
                          </span>
                          <span style={{ fontFamily: SANS, fontSize: 11, color: 'var(--color-text)', marginLeft: 6, lineHeight: '16px' }}>
                            {c.citationTarget}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
