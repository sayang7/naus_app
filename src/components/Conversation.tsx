import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Claim, ClaimStatus, Turn, Commitment } from '../types';
import { ClaimUnderline } from './ClaimUnderline';
import type { DemoScenario } from '../demo';

const spring = { type: 'spring', stiffness: 280, damping: 28 } as const;

// ─── Typewriter — reveals text progressively, then shows ClaimUnderline ───────

function useTypewriter(text: string, enabled: boolean, charsPerTick = 4, tickMs = 18) {
  const [pos, setPos] = useState(enabled ? 0 : text.length);
  const done = pos >= text.length;

  useEffect(() => {
    if (!enabled) { setPos(text.length); return; }
    setPos(0);
    const iv = setInterval(() => {
      setPos((p) => {
        const next = p + charsPerTick;
        if (next >= text.length) { clearInterval(iv); return text.length; }
        return next;
      });
    }, tickMs);
    return () => clearInterval(iv);
  }, [text, enabled, charsPerTick, tickMs]);

  return { displayed: text.slice(0, pos), done };
}

// ─── Thinking dots ────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{ width: 4, height: 4, borderRadius: '50%', background: '#3A3A40', display: 'block' }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── Status label colours ─────────────────────────────────────────────────────

const STATUS_COLOR: Record<ClaimStatus, string> = {
  grounded:      '#6B7280',
  ambiguous:     '#C9A961',
  assumption:    '#8A8A85',
  unverifiable:  '#A78BFA',
  contradiction: '#E5484D',
};

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

  const counts = claims.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ marginTop: 14 }}>
      {/* Summary */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 10 }}>
        {(Object.entries(counts) as [ClaimStatus, number][]).map(([s, n]) => (
          <span key={s} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: STATUS_COLOR[s] }}>
            {n} {s}
          </span>
        ))}
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#2A2A2E' }}>
          · {claims.length} total
        </span>
      </div>

      {/* Rows */}
      <div style={{ border: '1px solid #1C1C1F', borderRadius: 10, overflow: 'hidden' }}>
        {claims.map((claim, i) => (
          <ClaimRow
            key={claim.id}
            claim={claim}
            isActive={activeClaim === claim.id}
            ledger={ledger}
            onClick={() => onClaimClick(claim.id)}
            onSuggest={onSuggest}
            delay={i * 0.025}
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
      style={{ borderTop: '1px solid #1C1C1F', background: isActive ? 'rgba(255,255,255,0.02)' : 'transparent' }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
          display: 'grid', gridTemplateColumns: '42px 96px 1fr 18px',
          gap: '0 8px', padding: '9px 14px', alignItems: 'start',
        }}
      >
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#C9A961', lineHeight: '20px' }}>
          {claim.id}
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: STATUS_COLOR[claim.status], lineHeight: '20px' }}>
          {claim.status}
        </span>
        <span style={{ fontSize: 13, color: '#8A8A85', lineHeight: '20px' }}>
          {claim.text}
        </span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#3A3A40', lineHeight: '20px', textAlign: 'right' }}>
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
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#E5484D', marginBottom: 4 }}>
                      this turn
                    </div>
                    <div style={{ fontSize: 13, color: '#F5F4F0', lineHeight: '20px' }}>{claim.text}</div>
                  </div>
                  <div style={{ background: 'rgba(229,72,77,0.25)' }} />
                  <div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#C9A961', marginBottom: 4 }}>
                      {prior.id} · turn {prior.turnNumber}
                    </div>
                    <div style={{ fontSize: 13, color: '#F5F4F0', lineHeight: '20px' }}>{prior.text}</div>
                  </div>
                </div>
              )}
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: '20px', margin: 0 }}>{claim.note}</p>
              {claim.needsSource && (
                <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#3A3A40', marginTop: 6, marginBottom: 0 }}>
                  source would change reliability
                </p>
              )}
              {/* Assumption challenge — suggest a follow-up that tests the claim */}
              {(claim.status === 'assumption' || claim.status === 'unverifiable') && (
                <button
                  type="button"
                  onClick={() => onSuggest(`What is the evidence for the claim that ${claim.text.toLowerCase().replace(/\.$/, '')}?`)}
                  style={{
                    marginTop: 10, background: 'none', border: '1px solid #1C1C1F',
                    borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                    color: '#3A3A40', transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = STATUS_COLOR[claim.status]; b.style.borderColor = '#2A2A2E'; }}
                  onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = '#3A3A40'; b.style.borderColor = '#1C1C1F'; }}
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
      width: 26, height: 26, borderRadius: '50%', border: '1px solid #2A2A2E',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#C9A961',
      flexShrink: 0,
    }}>
      n
    </div>
  );
}

// ─── Turn block ───────────────────────────────────────────────────────────────

function TurnBlock({
  turn, ledger, hoveredCommitmentId, isLatest, onSuggest,
}: {
  turn: Turn;
  ledger: Commitment[];
  hoveredCommitmentId: string | null;
  isLatest: boolean;
  onSuggest: (q: string) => void;
}) {
  const [activeClaim, setActiveClaim] = useState<string | null>(null);
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const toggle = (id: string) => setActiveClaim((p) => (p === id ? null : id));

  const { displayed, done } = useTypewriter(turn.answer, isLatest);
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <div style={{
          maxWidth: '72%', background: '#18181C', border: '1px solid #252528',
          borderRadius: 14, padding: '10px 14px',
        }}>
          <p style={{ fontSize: 14, color: '#F5F4F0', lineHeight: '22px', margin: 0 }}>
            {turn.question}
          </p>
        </div>
      </div>

      {/* AI response */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ paddingTop: 2 }}><NausAvatar /></div>
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Answer — typewriter during reveal, underlines after */}
          {done ? (
            <ClaimUnderline
              answer={turn.answer}
              claims={turn.claims}
              activeClaim={activeClaim}
              hoveredCommitmentId={hoveredCommitmentId}
              onClaimClick={toggle}
            />
          ) : (
            <div style={{ fontSize: 16, lineHeight: '28px', color: '#F5F4F0' }}>
              {displayed}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                style={{ borderRight: '2px solid #C9A961', marginLeft: 1 }}
              />
            </div>
          )}

          {/* Breakdown toggle */}
          {done && turn.claims.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <button
                type="button"
                onClick={() => setBreakdownOpen((o) => !o)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  marginTop: 14, display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                  color: contradictions > 0 ? '#E5484D' : '#3A3A40',
                  transition: 'color 0.15s',
                }}
              >
                {contradictions > 0 && (
                  <span style={{ color: '#E5484D' }}>⚠ {contradictions} contradiction{contradictions > 1 ? 's' : ''}</span>
                )}
                {contradictions > 0 && <span style={{ color: '#2A2A2E' }}>·</span>}
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

// ─── Demo scenario cards ──────────────────────────────────────────────────────

function ScenarioCard({ scenario, onPick }: { scenario: DemoScenario; onPick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      type="button"
      onClick={onPick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.12 }}
      style={{
        textAlign: 'left', width: '100%', background: hovered ? '#13131A' : '#0F0F12',
        border: `1px solid ${hovered ? '#2A2A35' : '#1C1C22'}`,
        borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#C9A961', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {scenario.title}
      </div>
      <div style={{ fontSize: 13, color: '#6B7280', lineHeight: '20px' }}>
        {scenario.subtitle}
      </div>
    </motion.button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ scenarios, onPick }: { scenarios: DemoScenario[]; onPick: (s: DemoScenario) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      style={{ paddingTop: 40, paddingBottom: 60 }}
    >
      {/* Hero text */}
      <div style={{ marginBottom: 48 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em',
          color: '#F5F4F0', margin: '0 0 10px', lineHeight: '32px',
        }}>
          Ask, and see the reasoning
        </h1>
        <p style={{ fontSize: 14, color: '#5A5A62', lineHeight: '22px', maxWidth: 460, margin: 0 }}>
          Every answer is decomposed into verifiable claims. Each one is graded —
          grounded, ambiguous, assumption, unverifiable, or contradiction — and
          checked against every prior claim in the session. Contradictions surface
          automatically.
        </p>
      </div>

      {/* Why it can't be a prompt */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 48 }}>
        {[
          { label: 'Not a system prompt', body: 'A system prompt instructs the model to be careful. Naus runs a second forced-tool-use call that decomposes the answer structurally — the model cannot skip it or soften it.' },
          { label: 'Not a guardrail', body: 'Guardrails block outputs. Naus registers every claim and checks it against prior claims. It catches contradictions the model itself didn\'t flag.' },
          { label: 'Not RAG', body: 'RAG checks claims against a knowledge base. Naus checks claims against what the same model said three turns ago — no external corpus required.' },
          { label: 'Session-scoped memory', body: 'Claim #001 from turn 1 is live context when claim #008 is analyzed in turn 4. The ledger is a running epistemic state, not a per-response annotation.' },
        ].map((item) => (
          <div
            key={item.label}
            style={{ padding: '14px 16px', border: '1px solid #1C1C22', borderRadius: 10, background: '#0D0D10' }}
          >
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#C9A961', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {item.label}
            </div>
            <p style={{ fontSize: 12, color: '#4A4A52', lineHeight: '19px', margin: 0 }}>
              {item.body}
            </p>
          </div>
        ))}
      </div>

      {/* Demo scenarios */}
      <div>
        <p style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#3A3A40',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
        }}>
          Live demos — real API calls
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        marginBottom: 28, padding: '8px 12px', borderRadius: 8,
        background: '#0F0F12', border: '1px solid #1C1C22',
      }}
    >
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#C9A961' }}>
        demo
      </div>
      <div style={{ flex: 1, fontSize: 12, color: '#4A4A52', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            width: 20, height: 2, borderRadius: 1,
            background: i <= step ? '#C9A961' : '#1C1C22',
            transition: 'background 0.4s',
          }} />
        ))}
      </div>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#3A3A40' }}>
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

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface ConversationProps {
  turns: Turn[];
  isThinking: boolean;
  question: string;
  error: string | null;
  ledger: Commitment[];
  hoveredCommitmentId: string | null;
  demoStep: number;
  demoLength: number;
  demoTitle: string;
  scenarios: DemoScenario[];
  onChange: (value: string) => void;
  onAsk: () => void;
  onRunDemo: (scenario: DemoScenario) => void;
}

export function Conversation({
  turns, isThinking, question, error, ledger, hoveredCommitmentId,
  demoStep, demoLength, demoTitle, scenarios, onChange, onAsk, onRunDemo,
}: ConversationProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const demoRunning = demoStep >= 0;
  const isEmpty = turns.length === 0 && !isThinking;

  const { supported: voiceOk, listening, start: startVoice, stop: stopVoice } = useSpeech(
    (t) => onChange(question ? question + ' ' + t : t),
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, isThinking]);

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

  return (
    <section style={{ height: '100%', background: '#111113', display: 'flex', flexDirection: 'column' }}>
      {/* Scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#1C1C22 transparent' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px 24px' }}>

          {isEmpty && <EmptyState scenarios={scenarios} onPick={onRunDemo} />}

          <AnimatePresence>
            {demoRunning && (
              <DemoBar step={demoStep} total={demoLength} title={demoTitle} />
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {turns.map((turn, i) => (
              <TurnBlock
                key={turn.id}
                turn={turn}
                ledger={ledger}
                hoveredCommitmentId={hoveredCommitmentId}
                isLatest={i === turns.length - 1}
                onSuggest={(q) => { onChange(q); setTimeout(() => textareaRef.current?.focus(), 50); }}
              />
            ))}
          </AnimatePresence>

          {/* Thinking state — show user question bubble then dots */}
          <AnimatePresence>
            {isThinking && (
              <motion.div
                key="thinking-block"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
                style={{ marginBottom: 28 }}
              >
                {/* Show question bubble while thinking */}
                {question === '' && turns.length > 0 && null /* question was already dispatched */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ paddingTop: 2 }}><NausAvatar /></div>
                  <ThinkingDots />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={endRef} />
        </div>
      </div>

      {/* Input bar */}
      <div style={{ flexShrink: 0, padding: '10px 24px 18px', borderTop: '1px solid #171719', background: '#111113' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <AnimatePresence>
            {error && (
              <motion.p
                key="err"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring}
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#E5484D', marginBottom: 8, overflow: 'hidden' }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            background: '#16161A', border: '1px solid #252528',
            borderRadius: 14, padding: '10px 12px 10px 16px',
          }}>
            <textarea
              ref={textareaRef}
              value={question}
              onChange={handleChange}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder={demoRunning ? 'demo running…' : 'Ask anything.'}
              disabled={isThinking || demoRunning}
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                resize: 'none', fontSize: 14, lineHeight: '22px', color: '#F5F4F0',
                fontFamily: 'Inter, system-ui, sans-serif', maxHeight: 180,
                overflowY: 'auto', padding: 0,
                opacity: (isThinking || demoRunning) ? 0.4 : 1,
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingBottom: 1 }}>
              {voiceOk && !demoRunning && (
                <button
                  type="button"
                  onClick={listening ? stopVoice : startVoice}
                  disabled={isThinking}
                  title={listening ? 'Stop' : 'Voice input'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: listening ? '#E5484D' : '#3A3A40', fontSize: 15,
                    lineHeight: 1, padding: '4px', transition: 'color 0.15s',
                  }}
                >
                  {listening ? '◉' : '○'}
                </button>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={!question.trim() || isThinking || demoRunning}
                style={{
                  width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: question.trim() && !isThinking && !demoRunning ? '#C9A961' : '#1C1C22',
                  color: question.trim() && !isThinking && !demoRunning ? '#0A0A0B' : '#3A3A40',
                  fontSize: 15, transition: 'background 0.15s, color 0.15s',
                }}
              >
                {isThinking ? '…' : '↑'}
              </button>
            </div>
          </div>

          <p style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#1C1C22',
            textAlign: 'center', marginTop: 8,
          }}>
            naus · epistemic accountability layer · every claim, every turn
          </p>
        </div>
      </div>
    </section>
  );
}
