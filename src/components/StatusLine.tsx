import { motion } from 'framer-motion';
import type { CheckResult } from '../engine';

const spring = { type: 'spring', stiffness: 300, damping: 30 } as const;

interface StatusLineProps {
  result: CheckResult | null;
  onClick: () => void;
}

export function StatusLine({ result, onClick }: StatusLineProps) {
  const isContradiction = result?.state === 'contradiction';
  const label = !result
    ? 'idle'
    : isContradiction
      ? `contradiction · ${result.contradiction.commitmentId} · ${result.contradiction.fromTurn} -> ${result.contradiction.toTurn}`
      : `consistent · ${result.latencyMs}ms`;

  return (
    <button
      type="button"
      disabled={!result}
      onClick={onClick}
      className="mt-2 flex h-4 w-full items-center gap-1 overflow-hidden text-left font-mono text-13 text-muted disabled:cursor-default"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
        <motion.circle
          cx="8"
          cy="8"
          r="5.8"
          stroke={isContradiction ? '#E5484D' : '#C9A961'}
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          pathLength="1"
          initial={false}
          animate={{
            pathLength: result ? (isContradiction ? 0.74 : 1) : 0,
            rotate: isContradiction ? 22 : 0,
          }}
          transition={{ ...spring, duration: 0.4 }}
        />
      </svg>
      <motion.span
        layout
        data-status-line
        transition={spring}
        className={['block truncate whitespace-nowrap', isContradiction ? 'text-red' : ''].join(
          ' ',
        )}
      >
        {label}
      </motion.span>
    </button>
  );
}
