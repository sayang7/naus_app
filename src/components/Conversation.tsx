import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Claim, ClaimStatus, Turn, Commitment } from '../types';
import type { ImageAttachment } from '../api';
import { ClaimUnderline } from './ClaimUnderline';
import { STATUS_COLOR, CLAIM_STATUSES } from '../tokens';
import type { DemoScenario } from '../demo';

const spring = { type: 'spring', stiffness: 280, damping: 28 } as const;
const SANS = 'Inter, system-ui, sans-serif';

// ─── Cycling typewriter ────────────────────────────────────────────────────────

const HERO_PHRASES = [
  'Ask, and see the reasoning.',
  'Every claim, grounded or not.',
  'Contradictions surface automatically.',
  'Session memory that doesn\'t forget.',
  'Epistemic accountability, live.',
];

function useCyclingTypewriter(phrases: string[], typeMs = 42, deleteMs = 22, pauseMs = 2400) {
  const [display, setDisplay] = useState('');
  const phraseIdx = useRef(0);
  const charIdx = useRef(0);
  const phase = useRef<'type' | 'pause' | 'delete'>('type');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function tick() {
      const phrase = phrases[phraseIdx.current];

      if (phase.current === 'type') {
        if (charIdx.current < phrase.length) {
          charIdx.current++;
          setDisplay(phrase.slice(0, charIdx.current));
          timer.current = setTimeout(tick, typeMs + Math.random() * 18);
        } else {
          phase.current = 'pause';
          timer.current = setTimeout(tick, pauseMs);
        }
      } else if (phase.current === 'pause') {
        phase.current = 'delete';
        timer.current = setTimeout(tick, 0);
      } else {
        if (charIdx.current > 0) {
          charIdx.current--;
          setDisplay(phrase.slice(0, charIdx.current));
          timer.current = setTimeout(tick, deleteMs);
        } else {
          phraseIdx.current = (phraseIdx.current + 1) % phrases.length;
          phase.current = 'type';
          timer.current = setTimeout(tick, 350);
        }
      }
    }

    timer.current = setTimeout(tick, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return display;
}

// ─── Thinking dots ────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-ghost)', display: 'block' }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── Stacked bar summary ──────────────────────────────────────────────────────

function ClaimDistributionBar({ claims }: { claims: Claim[] }) {
  const counts = claims.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const total = claims.length;
  return (
    <div style={{ display: 'flex', height: 3, borderRadius: 2, overflow: 'hidden', gap: 1, marginBottom: 8 }}>
      {CLAIM_STATUSES.filter((s) => counts[s]).map((s) => (
        <div key={s} title={`${counts[s]} ${s}`} style={{ flex: counts[s] / total, background: STATUS_COLOR[s], minWidth: 3 }} />
      ))}
    </div>
  );
}

// ─── Breakdown panel ──────────────────────────────────────────────────────────

function BreakdownPanel({
  claims, activeClaim, ledger, onClaimClick, onSuggest,
}: {
  claims: Claim[];
  activeClaim: string | null;
  ledger: Commitment[];
  onClaimClick: (id: string) => void;
  onSuggest: (q: string) => void;
}) {
  if (!claims.length) return null;
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | 'all'>('all');

  const counts = claims.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  const sorted = [...claims].sort((a, b) => {
    const p: Record<ClaimStatus, number> = { contradiction: 0, unverifiable: 1, assumption: 2, ambiguous: 3, grounded: 4 };
    return p[a.status] - p[b.status];
  });
  const filtered = statusFilter === 'all' ? sorted : sorted.filter((c) => c.status === statusFilter);

  return (
    <div style={{ marginTop: 12 }}>
      <ClaimDistributionBar claims={claims} />

      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px', marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontFamily: SANS, fontSize: 12,
            color: statusFilter === 'all' ? 'var(--color-text)' : 'var(--color-ghost)',
            transition: 'color 0.15s',
          }}
        >
          all {claims.length}
        </button>
        {CLAIM_STATUSES.map((s) =>
          counts[s] ? (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontFamily: SANS, fontSize: 12,
                color: statusFilter === s ? STATUS_COLOR[s] : 'var(--color-ghost)',
                transition: 'color 0.15s',
              }}
            >
              {s} {counts[s]}
            </button>
          ) : null,
        )}
      </div>

      <div style={{ border: '1px solid var(--color-border-3)', borderRadius: 10, overflow: 'hidden' }}>
        {filtered.map((claim, i) => (
          <ClaimRow
            key={claim.id}
            claim={claim}
            isActive={activeClaim === claim.id}
            ledger={ledger}
            onClick={() => onClaimClick(claim.id)}
            onSuggest={onSuggest}
            delay={i * 0.02}
          />
        ))}
      </div>
    </div>
  );
}

function ClaimRow({
  claim, isActive, ledger, onClick, onSuggest, delay,
}: {
  claim: Claim;
  isActive: boolean;
  ledger: Commitment[];
  onClick: () => void;
  onSuggest: (q: string) => void;
  delay: number;
}) {
  const prior = claim.status === 'contradiction' && claim.conflictsWithId
    ? ledger.find((c) => c.id === claim.conflictsWithId)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay, duration: 0.2 }}
      style={{ borderTop: '1px solid var(--color-border-3)', background: isActive ? 'rgba(255,255,255,0.02)' : 'transparent' }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
          display: 'grid', gridTemplateColumns: '42px 110px 1fr 18px',
          gap: '0 8px', padding: '9px 14px', alignItems: 'start',
        }}
      >
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--color-gold)', lineHeight: '20px' }}>
          {claim.id}
        </span>
        <span style={{ fontFamily: SANS, fontSize: 12, color: STATUS_COLOR[claim.status], lineHeight: '20px' }}>
          {claim.status}
        </span>
        <span style={{ fontFamily: SANS, fontSize: 13, color: 'var(--color-text)', lineHeight: '20px' }}>
          {claim.text}
        </span>
        <span style={{ fontFamily: SANS, fontSize: 12, color: 'var(--color-ghost)', lineHeight: '20px', textAlign: 'right' }}>
          {isActive ? '−' : '+'}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 14px 14px 50px' }}>
              {prior && (
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1px 1fr', gap: 12, marginBottom: 12,
                  padding: '10px 12px', borderRadius: 8,
                  background: 'rgba(229,72,77,0.05)', border: '1px solid rgba(229,72,77,0.12)',
                }}>
                  <div>
                    <div style={{ fontFamily: SANS, fontSize: 11, color: STATUS_COLOR.contradiction, marginBottom: 4 }}>this turn</div>
                    <div style={{ fontFamily: SANS, fontSize: 13, color: 'var(--color-text)', lineHeight: '20px' }}>{claim.text}</div>
                  </div>
                  <div style={{ background: 'rgba(229,72,77,0.25)' }} />
                  <div>
                    <div style={{ fontFamily: SANS, fontSize: 11, color: 'var(--color-gold)', marginBottom: 4 }}>
                      {prior.id} · turn {prior.turnNumber}
                    </div>
                    <div style={{ fontFamily: SANS, fontSize: 13, color: 'var(--color-text)', lineHeight: '20px' }}>{prior.text}</div>
                  </div>
                </div>
              )}
              <p style={{ fontFamily: SANS, fontSize: 13, color: 'var(--color-muted)', lineHeight: '20px', margin: 0 }}>{claim.note}</p>
              {claim.needsSource && (
                <p style={{ fontFamily: SANS, fontSize: 11, color: 'var(--color-ghost)', marginTop: 6, marginBottom: 0 }}>
                  source would change reliability
                </p>
              )}
              {(claim.status === 'assumption' || claim.status === 'unverifiable') && (
                <button
                  type="button"
                  onClick={() => onSuggest(`What is the evidence for the claim that ${claim.text.toLowerCase().replace(/\.$/, '')}?`)}
                  style={{
                    marginTop: 10, background: 'none', border: '1px solid var(--color-border-3)',
                    borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                    fontFamily: SANS, fontSize: 11,
                    color: 'var(--color-ghost)', transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = STATUS_COLOR[claim.status]; b.style.borderColor = 'var(--color-whisper)'; }}
                  onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'var(--color-ghost)'; b.style.borderColor = 'var(--color-border-3)'; }}
                >
                  challenge this {claim.status} →
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── AI avatar ────────────────────────────────────────────────────────────────

function NausAvatar() {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '50%', border: '1px solid var(--color-whisper)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--color-gold)',
      flexShrink: 0,
    }}>
      n
    </div>
  );
}

// ─── Turn block ───────────────────────────────────────────────────────────────

function TurnBlock({
  turn, ledger, hoveredCommitmentId, onSuggest,
}: {
  turn: Turn;
  ledger: Commitment[];
  hoveredCommitmentId: string | null;
  onSuggest: (q: string) => void;
}) {
  const [activeClaim, setActiveClaim] = useState<string | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const toggle = (id: string) => setActiveClaim((p) => (p === id ? null : id));
  const contradictions = turn.claims.filter((c) => c.status === 'contradiction').length;

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      style={{ marginBottom: 36 }}
    >
      {/* User message */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18, alignItems: 'flex-end', gap: 8 }}>
        {turn.image && (
          <img
            src={turn.image}
            alt="Attached"
            style={{ maxWidth: 200, maxHeight: 160, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--color-border)' }}
          />
        )}
        <div style={{
          maxWidth: '72%', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
          borderRadius: 14, padding: '10px 14px',
        }}>
          <p style={{ fontFamily: SANS, fontSize: 14, color: 'var(--color-text)', lineHeight: '22px', margin: 0 }}>
            {turn.question}
          </p>
        </div>
      </div>

      {/* AI response */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ paddingTop: 2 }}><NausAvatar /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ClaimUnderline
            answer={turn.answer}
            claims={turn.claims}
            activeClaim={activeClaim}
            hoveredCommitmentId={hoveredCommitmentId}
            onClaimClick={toggle}
          />

          {turn.claims.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <button
                type="button"
                onClick={() => setBreakdownOpen((o) => !o)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  marginTop: 14, display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: SANS, fontSize: 12,
                  color: contradictions > 0 ? STATUS_COLOR.contradiction : 'var(--color-ghost)',
                  transition: 'color 0.15s',
                }}
              >
                {contradictions > 0 && (
                  <span style={{ color: STATUS_COLOR.contradiction }}>⚠ {contradictions} contradiction{contradictions > 1 ? 's' : ''}</span>
                )}
                {contradictions > 0 && <span style={{ color: 'var(--color-ghost)' }}>·</span>}
                <span>{turn.claims.length} claims {breakdownOpen ? '↑' : '↓'}</span>
              </button>

              <AnimatePresence initial={false}>
                {breakdownOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={spring}
                    style={{ overflow: 'hidden' }}
                  >
                    <BreakdownPanel
                      claims={turn.claims}
                      activeClaim={activeClaim}
                      ledger={ledger}
                      onClaimClick={toggle}
                      onSuggest={onSuggest}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Streaming turn ───────────────────────────────────────────────────────────

function StreamingTurn({
  question, text, isAnalyzing, imageUrl,
}: {
  question: string;
  text: string;
  isAnalyzing: boolean;
  imageUrl?: string;
}) {
  return (
    <motion.div
      key="streaming-block"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={spring}
      style={{ marginBottom: 28 }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18, alignItems: 'flex-end', gap: 8 }}>
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Attached"
            style={{ maxWidth: 200, maxHeight: 160, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--color-border)' }}
          />
        )}
        <div style={{
          maxWidth: '72%', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
          borderRadius: 14, padding: '10px 14px',
        }}>
          <p style={{ fontFamily: SANS, fontSize: 14, color: 'var(--color-text)', lineHeight: '22px', margin: 0 }}>{question}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ paddingTop: 2 }}><NausAvatar /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {text ? (
            <div style={{ fontFamily: SANS, fontSize: 16, lineHeight: '30px', color: 'var(--color-text)' }}>
              {text}
              {!isAnalyzing && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  style={{ borderRight: '2px solid var(--color-gold)', marginLeft: 1 }}
                />
              )}
            </div>
          ) : (
            <ThinkingDots />
          )}
          {isAnalyzing && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ fontFamily: SANS, fontSize: 12, color: 'var(--color-ghost)', marginTop: 8, marginBottom: 0 }}
            >
              analyzing claims…
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Demo scenario cards ──────────────────────────────────────────────────────

function ScenarioCard({ scenario, onPick }: { scenario: DemoScenario; onPick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      type="button"
      onClick={onPick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: 1.005 }}
      transition={{ duration: 0.1 }}
      style={{
        textAlign: 'left', width: '100%',
        background: hovered ? 'var(--color-surface-2)' : 'var(--color-panel-2)',
        border: `1px solid ${hovered ? 'var(--color-whisper)' : 'var(--color-border-3)'}`,
        borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--color-gold)', marginBottom: 4 }}>
        {scenario.title}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 13, color: 'var(--color-muted)', lineHeight: '20px' }}>
        {scenario.subtitle}
      </div>
    </motion.button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ scenarios, onPick }: { scenarios: DemoScenario[]; onPick: (s: DemoScenario) => void }) {
  const heroText = useCyclingTypewriter(HERO_PHRASES);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      style={{ paddingTop: 40, paddingBottom: 60 }}
    >
      {/* Hero — cycling typewriter */}
      <div style={{ marginBottom: 44 }}>
        <h1 style={{
          fontFamily: SANS,
          fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em',
          color: 'var(--color-text)', margin: '0 0 12px', lineHeight: '34px',
          minHeight: 34,
        }}>
          {heroText}
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.55, repeat: Infinity }}
            style={{ borderRight: '2.5px solid var(--color-gold)', marginLeft: 2, display: 'inline-block', height: '1em', verticalAlign: 'text-bottom' }}
          />
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 14, color: 'var(--color-text)', lineHeight: '22px', maxWidth: 460, margin: 0, opacity: 0.7 }}>
          Every answer is decomposed into verifiable claims. Each one is graded —
          grounded, ambiguous, assumption, unverifiable, or contradiction — and
          checked against every prior claim in the session.
        </p>
      </div>

      {/* Feature cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 44 }}>
        {[
          { label: 'Not a system prompt', body: 'A system prompt asks the model to be careful. Naus runs a second forced-tool-use call that decomposes the answer structurally — the model cannot skip or soften it.' },
          { label: 'Not a guardrail', body: 'Guardrails block outputs. Naus registers every claim and checks it against prior claims. It catches contradictions the model itself didn\'t flag.' },
          { label: 'Not RAG', body: 'RAG checks claims against a knowledge base. Naus checks claims against what the same model said three turns ago — no external corpus required.' },
          { label: 'Session memory', body: 'Claim #001 from turn 1 is live context when claim #008 is analyzed in turn 4. The ledger is a running epistemic state, not a per-response annotation.' },
        ].map((item) => (
          <div
            key={item.label}
            style={{ padding: '12px 14px', border: '1px solid var(--color-border-3)', borderRadius: 10, background: 'var(--color-panel-2)' }}
          >
            <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: 'var(--color-gold)', marginBottom: 5 }}>
              {item.label}
            </div>
            <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--color-muted)', lineHeight: '19px', margin: 0 }}>
              {item.body}
            </p>
          </div>
        ))}
      </div>

      {/* Demo scenarios */}
      <div>
        <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--color-ghost)', marginBottom: 12 }}>
          Live demos — real API calls
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scenarios.map((s) => (
            <ScenarioCard key={s.id} scenario={s} onPick={() => onPick(s)} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Demo progress ────────────────────────────────────────────────────────────

function DemoBar({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 28, padding: '7px 12px', borderRadius: 8,
        background: 'var(--color-panel-2)', border: '1px solid var(--color-border-3)',
      }}
    >
      <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: 'var(--color-gold)' }}>demo</div>
      <div style={{ flex: 1, fontFamily: SANS, fontSize: 13, color: 'var(--color-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            width: 18, height: 2, borderRadius: 1,
            background: i <= step ? 'var(--color-gold)' : 'var(--color-border-3)',
            transition: 'background 0.4s',
          }} />
        ))}
      </div>
      <span style={{ fontFamily: SANS, fontSize: 12, color: 'var(--color-ghost)' }}>
        {step + 1}/{total}
      </span>
    </motion.div>
  );
}

// ─── Voice hook ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = any;

function useSpeech(onResult: (t: string) => void) {
  const ref = useRef<AnyRec>(null);
  const [listening, setListening] = useState(false);
  const win = typeof window !== 'undefined' ? (window as AnyRec) : null;
  const supported = !!win && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const start = useCallback(() => {
    if (!supported || listening || !win) return;
    const SR = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false; rec.interimResults = false; rec.lang = 'en-US';
    rec.onresult = (e: AnyRec) => { const t = e.results[0]?.[0]?.transcript ?? ''; if (t) onResult(t); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    ref.current = rec; rec.start(); setListening(true);
  }, [supported, listening, onResult, win]);
  const stop = useCallback(() => { ref.current?.stop(); setListening(false); }, []);
  return { supported, listening, start, stop };
}

// ─── Image resize ─────────────────────────────────────────────────────────────

function resizeImage(file: File, maxEdge = 1568): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(url);
      resolve({ mediaType: 'image/jpeg', data: dataUrl.split(',')[1], dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface ConversationProps {
  turns: Turn[];
  isThinking: boolean;
  isAnalyzing: boolean;
  streamingText: string;
  streamingQuestion: string;
  question: string;
  error: string | null;
  ledger: Commitment[];
  hoveredCommitmentId: string | null;
  demoStep: number;
  demoLength: number;
  demoTitle: string;
  scenarios: DemoScenario[];
  imageAttachment: ImageAttachment | null;
  onChange: (value: string) => void;
  onAsk: () => void;
  onStop: () => void;
  onRunDemo: (scenario: DemoScenario) => void;
  onImageChange: (image: ImageAttachment | null) => void;
}

export function Conversation({
  turns, isThinking, isAnalyzing, streamingText, streamingQuestion,
  question, error, ledger, hoveredCommitmentId,
  demoStep, demoLength, demoTitle, scenarios,
  imageAttachment, onChange, onAsk, onStop, onRunDemo, onImageChange,
}: ConversationProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const demoRunning = demoStep >= 0;
  const isEmpty = turns.length === 0 && !isThinking;

  const { supported: voiceOk, listening, start: startVoice, stop: stopVoice } = useSpeech(
    (t) => onChange(question ? question + ' ' + t : t),
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, isThinking, streamingText]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
  };

  const submit = () => {
    if (question.trim() && !isThinking && !demoRunning) {
      onAsk();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { onImageChange(await resizeImage(file)); } catch { /* ignore */ }
    e.target.value = '';
  };

  return (
    <section style={{ height: '100%', background: 'var(--color-panel)', display: 'flex', flexDirection: 'column' }}>
      {/* Scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'var(--color-border) transparent' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px 24px' }}>

          {isEmpty && <EmptyState scenarios={scenarios} onPick={onRunDemo} />}

          <AnimatePresence>
            {demoRunning && <DemoBar step={demoStep} total={demoLength} title={demoTitle} />}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {turns.map((turn) => (
              <TurnBlock
                key={turn.id}
                turn={turn}
                ledger={ledger}
                hoveredCommitmentId={hoveredCommitmentId}
                onSuggest={(q) => { onChange(q); setTimeout(() => textareaRef.current?.focus(), 50); }}
              />
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {isThinking && (
              <StreamingTurn
                question={streamingQuestion}
                text={streamingText}
                isAnalyzing={isAnalyzing}
                imageUrl={imageAttachment?.dataUrl}
              />
            )}
          </AnimatePresence>

          <div ref={endRef} />
        </div>
      </div>

      {/* Input bar */}
      <div style={{ flexShrink: 0, padding: '10px 24px 18px', borderTop: '1px solid var(--color-border)', background: 'var(--color-panel)' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <AnimatePresence>
            {error && (
              <motion.p
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring}
                style={{ fontFamily: SANS, fontSize: 13, color: 'var(--color-red)', marginBottom: 8, overflow: 'hidden' }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Image preview */}
          {imageAttachment && (
            <div style={{ marginBottom: 8, position: 'relative', display: 'inline-block' }}>
              <img
                src={imageAttachment.dataUrl}
                alt="Attachment preview"
                style={{ maxHeight: 80, borderRadius: 8, border: '1px solid var(--color-border)', display: 'block' }}
              />
              <button
                type="button"
                onClick={() => onImageChange(null)}
                style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--color-ghost)', border: 'none',
                  color: 'var(--color-bg)', fontSize: 11, lineHeight: 1,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 14, padding: '10px 12px 10px 16px',
          }}>
            <textarea
              ref={textareaRef}
              value={question}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || !e.shiftKey)) { e.preventDefault(); submit(); }
              }}
              placeholder={demoRunning ? 'demo running…' : isThinking ? '' : 'Ask anything.'}
              disabled={isThinking || demoRunning}
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                resize: 'none', fontSize: 14, lineHeight: '22px', color: 'var(--color-text)',
                fontFamily: SANS, maxHeight: 180,
                overflowY: 'auto', padding: 0,
                opacity: (isThinking || demoRunning) ? 0.5 : 1,
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingBottom: 1 }}>
              {!demoRunning && !isThinking && (
                <>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach image"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: imageAttachment ? 'var(--color-gold)' : 'var(--color-ghost)',
                      fontSize: 15, lineHeight: 1, padding: '4px', transition: 'color 0.15s',
                    }}
                  >
                    ⊕
                  </button>
                </>
              )}

              {voiceOk && !demoRunning && !isThinking && (
                <button
                  type="button"
                  onClick={listening ? stopVoice : startVoice}
                  title={listening ? 'Stop voice' : 'Voice input'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: listening ? 'var(--color-red)' : 'var(--color-ghost)',
                    fontSize: 14, lineHeight: 1, padding: '4px', transition: 'color 0.15s',
                  }}
                >
                  {listening ? '◉' : '○'}
                </button>
              )}

              {isThinking ? (
                <button
                  type="button"
                  onClick={onStop}
                  title="Stop generation (Esc)"
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    border: '1px solid var(--color-ghost)',
                    background: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-muted)', fontSize: 10,
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--color-red)'; b.style.color = 'var(--color-red)'; }}
                  onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = 'var(--color-ghost)'; b.style.color = 'var(--color-muted)'; }}
                >
                  ■
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!question.trim() || demoRunning}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: question.trim() && !demoRunning ? 'var(--color-gold)' : 'var(--color-border)',
                    color: question.trim() && !demoRunning ? 'var(--color-bg)' : 'var(--color-ghost)',
                    fontSize: 15, transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  ↑
                </button>
              )}
            </div>
          </div>

          <p style={{ fontFamily: SANS, fontSize: 11, color: 'var(--color-whisper)', textAlign: 'center', marginTop: 8 }}>
            naus · epistemic accountability · every claim, every turn
          </p>
        </div>
      </div>
    </section>
  );
}
