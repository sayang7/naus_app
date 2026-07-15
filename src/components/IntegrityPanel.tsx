import { useState } from 'react';
import type { ClaimStatus, Commitment, Turn } from '../types';
import { Ledger } from './Ledger';

// ── Epistemic health score ────────────────────────────────────────────────────
// Weighted: grounded=1.0, ambiguous=0.6, assumption=0.4, unverifiable=0.2, contradiction=0

const WEIGHTS: Record<ClaimStatus, number> = {
  grounded: 1.0, ambiguous: 0.6, assumption: 0.4, unverifiable: 0.2, contradiction: 0,
};

const STATUS_COLOR: Record<ClaimStatus, string> = {
  grounded:      '#6B7280',
  ambiguous:     '#C9A961',
  assumption:    '#8A8A85',
  unverifiable:  '#A78BFA',
  contradiction: '#E5484D',
};

type Filter = ClaimStatus | 'all';

function computeScore(ledger: Commitment[]): number | null {
  if (!ledger.length) return null;
  const total = ledger.reduce((s, c) => s + WEIGHTS[c.status], 0);
  return Math.round((total / ledger.length) * 100);
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
      t.claims.length
        ? `**Claims:** ${t.claims.map((c) => `${c.id} [${c.status}]`).join(', ')}`
        : '',
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

interface IntegrityPanelProps {
  ledger: Commitment[];
  turns: Turn[];
  title: string;
  onHover: (id: string | null) => void;
}

export function IntegrityPanel({ ledger, turns, title, onHover }: IntegrityPanelProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = ledger.reduce(
    (acc, c) => { acc[c.status] = (acc[c.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  const score = computeScore(ledger);
  const scoreColor = score === null ? '#3A3A40' : score >= 80 ? '#6B7280' : score >= 60 ? '#C9A961' : '#E5484D';

  const statuses: ClaimStatus[] = ['grounded', 'ambiguous', 'assumption', 'unverifiable', 'contradiction'];
  const filtered = filter === 'all' ? ledger : ledger.filter((c) => c.status === filter);

  return (
    <section style={{ height: '100%', background: '#0A0A0B', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #1A1A1E', padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#3A3A40', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            epistemic ledger
          </span>
          {ledger.length > 0 && (
            <button
              type="button"
              onClick={() => exportSession(turns, ledger, title)}
              title="Export session as Markdown"
              style={{
                background: 'none', border: '1px solid #1A1A1E', borderRadius: 6,
                padding: '2px 8px', cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#3A3A40',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#8A8A85'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#2A2A2E'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#3A3A40'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#1A1A1E'; }}
            >
              export ↓
            </button>
          )}
        </div>

        {/* Health score */}
        {score !== null ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', color: scoreColor, lineHeight: 1 }}>
                {score}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#3A3A40' }}>
                / 100 integrity
              </span>
            </div>
            {/* Score bar */}
            <div style={{ height: 2, background: '#1A1A1E', borderRadius: 1 }}>
              <div style={{ height: '100%', width: `${score}%`, background: scoreColor, borderRadius: 1, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#2A2A2E', marginBottom: 0 }}>
            waiting for first answer
          </p>
        )}

        {/* Status breakdown + filter */}
        {ledger.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px' }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                color: filter === 'all' ? '#F5F4F0' : '#3A3A40',
                transition: 'color 0.15s',
              }}
            >
              all {ledger.length}
            </button>
            {statuses.map((s) =>
              counts[s] ? (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(filter === s ? 'all' : s)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                    color: filter === s ? STATUS_COLOR[s] : '#3A3A40',
                    transition: 'color 0.15s',
                  }}
                >
                  {s} {counts[s]}
                </button>
              ) : null,
            )}
          </div>
        )}
      </div>

      {/* Ledger list */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '6px 6px 4px' }}>
        <Ledger ledger={filtered} onHover={onHover} />
      </div>

      {/* Footer */}
      {ledger.length > 0 && (
        <div style={{ flexShrink: 0, borderTop: '1px solid #1A1A1E', padding: '8px 16px' }}>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#2A2A2E', margin: 0, lineHeight: '16px' }}>
            click to expand · hover to highlight in answer · export to share
          </p>
        </div>
      )}
    </section>
  );
}
