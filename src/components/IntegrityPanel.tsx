import { useState } from 'react';
import type { ClaimStatus, Commitment, Turn } from '../types';
import { Ledger } from './Ledger';
import { ContextGraph } from './ContextGraph';
import { STATUS_COLOR, EPISTEMIC_WEIGHTS, CLAIM_STATUSES } from '../tokens';

// ── Epistemic health score ────────────────────────────────────────────────────

function computeScore(ledger: Commitment[]): number | null {
  if (!ledger.length) return null;
  const total = ledger.reduce((s, c) => s + EPISTEMIC_WEIGHTS[c.status], 0);
  return Math.round((total / ledger.length) * 100);
}

// ── Circular gauge ────────────────────────────────────────────────────────────

function EpistemicGauge({ score, color }: { score: number; color: string }) {
  const radius = 30;
  const stroke = 5;
  const size = (radius + stroke) * 2 + 4;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--color-border-2)" strokeWidth={stroke} />
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color, lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 9, color: 'var(--color-ghost)', marginTop: 1 }}>
          /100
        </span>
      </div>
    </div>
  );
}

// ── Distribution bar ──────────────────────────────────────────────────────────

function DistributionBar({ ledger }: { ledger: Commitment[] }) {
  const counts = ledger.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const total = ledger.length;

  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', gap: 1, marginBottom: 10 }}>
      {CLAIM_STATUSES.filter((s) => counts[s]).map((s) => (
        <div
          key={s}
          title={`${counts[s]} ${s}`}
          style={{ flex: counts[s] / total, background: STATUS_COLOR[s], minWidth: 3, transition: 'flex 0.4s' }}
        />
      ))}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

function exportSession(turns: Turn[], ledger: Commitment[], title: string): void {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const score = computeScore(ledger);

  const lines: string[] = [
    `# naus session report`,
    `**${title || 'Untitled session'}** · ${date}`,
    score !== null ? `Epistemic integrity score: ${score}/100` : '',
    '',
    `## Epistemic ledger (${ledger.length} commitments)`,
    '',
    ...ledger.map((c) => [
      `### ${c.id} · ${c.status} · turn ${c.turnNumber}`,
      c.text,
      c.note ? `> ${c.note}` : '',
      '',
    ].filter(Boolean).join('\n')),
    '## Turns',
    '',
    ...turns.flatMap((t) => [
      `### Turn ${t.turnNumber}`,
      `**Q:** ${t.question}`,
      '',
      t.answer,
      '',
      t.claims.length ? `**Claims:** ${t.claims.map((c) => `${c.id} [${c.status}]`).join(', ')}` : '',
      '',
    ]),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `naus-${(title || 'session').replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

type Filter = ClaimStatus | 'all';
type PanelTab = 'integrity' | 'graph';

interface IntegrityPanelProps {
  ledger: Commitment[];
  turns: Turn[];
  title: string;
  onHover: (id: string | null) => void;
  isAnalyzing?: boolean;
}

export function IntegrityPanel({ ledger, turns, title, onHover, isAnalyzing }: IntegrityPanelProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [tab, setTab] = useState<PanelTab>('integrity');

  const counts = ledger.reduce(
    (acc, c) => { acc[c.status] = (acc[c.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  const score = computeScore(ledger);
  const scoreColor = score === null ? 'var(--color-ghost)' : score >= 80 ? STATUS_COLOR.grounded : score >= 60 ? STATUS_COLOR.ambiguous : STATUS_COLOR.contradiction;
  const filtered = filter === 'all' ? ledger : ledger.filter((c) => c.status === filter);

  // Sort contradictions to top
  const sorted = [...filtered].sort((a, b) => {
    const priority: Record<ClaimStatus, number> = { contradiction: 0, unverifiable: 1, assumption: 2, ambiguous: 3, grounded: 4 };
    return priority[a.status] - priority[b.status];
  });

  return (
    <section style={{ height: '100%', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--color-border-2)', padding: '12px 16px 10px' }}>
        {/* Tabs + export */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {(['integrity', 'graph'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
                  marginRight: 14,
                  fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10,
                  color: tab === t ? 'var(--color-text)' : 'var(--color-ghost)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  borderBottom: tab === t ? '1px solid var(--color-gold)' : '1px solid transparent',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {ledger.length > 0 && (
            <button
              type="button"
              onClick={() => exportSession(turns, ledger, title)}
              title="Export session as Markdown"
              style={{
                background: 'none', border: '1px solid var(--color-border-2)', borderRadius: 6,
                padding: '2px 8px', cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10, color: 'var(--color-ghost)',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { const b = e.currentTarget; b.style.color = 'var(--color-muted)'; b.style.borderColor = 'var(--color-whisper)'; }}
              onMouseLeave={(e) => { const b = e.currentTarget; b.style.color = 'var(--color-ghost)'; b.style.borderColor = 'var(--color-border-2)'; }}
            >
              export ↓
            </button>
          )}
        </div>

        {/* Score row */}
        {score !== null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <EpistemicGauge score={score} color={scoreColor} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10, color: 'var(--color-ghost)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                reasoning integrity
              </div>
              <DistributionBar ledger={ledger} />
              {/* Filter chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px' }}>
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10,
                    color: filter === 'all' ? 'var(--color-text)' : 'var(--color-ghost)',
                    transition: 'color 0.15s',
                  }}
                >
                  all {ledger.length}
                </button>
                {CLAIM_STATUSES.map((s) =>
                  counts[s] ? (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFilter(filter === s ? 'all' : s)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10,
                        color: filter === s ? STATUS_COLOR[s] : 'var(--color-ghost)',
                        transition: 'color 0.15s',
                      }}
                    >
                      {s} {counts[s]}
                    </button>
                  ) : null,
                )}
              </div>
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, color: 'var(--color-whisper)', marginBottom: 4 }}>
            {isAnalyzing ? 'analyzing claims…' : 'waiting for first answer'}
          </p>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '6px 6px 4px', position: 'relative' }}>
        {tab === 'integrity' ? (
          <Ledger ledger={sorted} onHover={onHover} loading={isAnalyzing && ledger.length === 0} />
        ) : (
          <ContextGraph turns={turns} ledger={ledger} />
        )}
      </div>

      {/* Footer */}
      {ledger.length > 0 && tab === 'integrity' && (
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border-2)', padding: '8px 16px' }}>
          <p style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 10, color: 'var(--color-whisper)', margin: 0, lineHeight: '16px' }}>
            click to expand · hover to highlight · export to share
          </p>
        </div>
      )}
    </section>
  );
}
