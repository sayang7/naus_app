import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Commitment, ClaimStatus } from '../types';

const spring = { type: 'spring', stiffness: 300, damping: 30 } as const;

const STATUS_META: Record<ClaimStatus, { label: string; color: string; bg: string }> = {
  grounded:      { label: 'grounded',      color: '#6B7280', bg: 'rgba(107,114,128,0.10)' },
  ambiguous:     { label: 'ambiguous',     color: '#C9A961', bg: 'rgba(201,169,97,0.10)'  },
  assumption:    { label: 'assumption',    color: '#8A8A85', bg: 'rgba(138,138,133,0.10)' },
  unverifiable:  { label: 'unverifiable', color: '#A78BFA', bg: 'rgba(167,139,250,0.10)' },
  contradiction: { label: 'contradiction', color: '#E5484D', bg: 'rgba(229,72,77,0.10)'  },
};

interface LedgerProps {
  ledger: Commitment[];
  onHover: (id: string | null) => void;
}

export function Ledger({ ledger, onHover }: LedgerProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (ledger.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center px-5" style={{ paddingBottom: 48 }}>
        <p className="font-mono text-13 text-muted mb-4 uppercase tracking-wider">
          waiting for first answer
        </p>
        <p className="text-13 leading-[20px]" style={{ color: '#4A4A4F' }}>
          Every claim the AI makes — grounded facts, ambiguous statements,
          unverifiable assertions, hidden assumptions — is registered here with
          the reasoning for its classification. Contradictions are caught live
          and flagged in red.
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
                  borderColor: isOpen ? '#2A2A2E' : '#1F1F22',
                  borderRadius: 8,
                  padding: '10px 12px',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                {/* Row: id + status badge + turn */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-13" style={{ color: '#C9A961' }}>
                      {c.id}
                    </span>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 11,
                        lineHeight: '16px',
                        color: meta.color,
                        background: meta.bg,
                        borderRadius: 4,
                        padding: '1px 6px',
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <span className="font-mono text-13" style={{ color: '#3A3A40' }}>
                    t{c.turnNumber}
                  </span>
                </div>

                {/* Claim text */}
                <p
                  className="text-13 text-text"
                  style={{
                    lineHeight: '18px',
                    display: '-webkit-box',
                    WebkitLineClamp: isOpen ? undefined : 2,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: isOpen ? 'visible' : 'hidden',
                  }}
                >
                  {c.text}
                </p>

                {/* Note — expanded only */}
                <AnimatePresence initial={false}>
                  {isOpen && c.note && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={spring}
                      className="text-13 overflow-hidden"
                      style={{ color: meta.color, lineHeight: '18px', marginTop: 8 }}
                    >
                      {c.note}
                    </motion.p>
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
