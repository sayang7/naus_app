import { AnimatePresence, motion } from 'framer-motion';
import type { CheckResult, Commitment } from '../engine';

const spring = { type: 'spring', stiffness: 300, damping: 30 } as const;

interface TracePanelProps {
  result: CheckResult | null;
  ledger: Commitment[];
}

export function TracePanel({ result, ledger }: TracePanelProps) {
  return (
    <AnimatePresence initial={false}>
      {result ? (
        <motion.div
          layout
          data-trace-panel
          key={result.state}
          initial={{ opacity: 0, y: 16, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: 8, height: 0 }}
          transition={spring}
          className="overflow-hidden border-t border-border pb-2 pt-3"
        >
          {result.state === 'consistent' ? (
            <ConsistentTrace result={result} />
          ) : (
            <ContradictionTrace result={result} ledger={ledger} />
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ConsistentTrace({ result }: { result: Extract<CheckResult, { state: 'consistent' }> }) {
  const checked = result.checked.length ? result.checked.join(', ') : 'none';
  const relations = result.relations.slice(0, 6);

  return (
    <div className="space-y-2 text-14">
      <div className="whitespace-nowrap text-muted">
        checked against <CommitmentList ids={result.checked} fallback={checked} /> · no conflicts ·{' '}
        {result.latencyMs}ms · deterministic
      </div>
      <div className="grid grid-cols-[120px_1fr] gap-x-2 gap-y-1 font-mono text-13 text-muted">
        {relations.map((relation, index) => (
          <div className="contents" key={`${relation.to}-${index}`}>
            <div className="text-gold">{relation.to}</div>
            <div className="whitespace-nowrap">{relation.kind}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContradictionTrace({
  result,
}: {
  result: Extract<CheckResult, { state: 'contradiction' }>;
  ledger: Commitment[];
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[300px_1px_1fr] gap-2 text-13">
        <div className="min-w-0 whitespace-nowrap text-text">
          {result.contradiction.leftStatement}
        </div>
        <div className="bg-red" />
        <div className="min-w-0 whitespace-nowrap text-text">
          {result.contradiction.rightStatement}
        </div>
      </div>
      <div className="font-mono text-13 text-muted">
        <div className="whitespace-nowrap text-red">{result.contradiction.formula}</div>
        <div className="whitespace-nowrap">
          same client · same session · no frame update / resolved in {result.latencyMs}ms · 0 model
          calls · deterministic
        </div>
      </div>
    </div>
  );
}

function CommitmentList({ ids, fallback }: { ids: string[]; fallback: string }) {
  if (!ids.length) return <span>{fallback}</span>;
  return (
    <>
      {ids.map((id, index) => (
        <span key={id}>
          <span className="font-mono text-gold">{id}</span>
          {index < ids.length - 1 ? ', ' : ''}
        </span>
      ))}
    </>
  );
}
