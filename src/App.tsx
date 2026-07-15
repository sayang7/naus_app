import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Turn, Commitment, SavedSession } from './types';
import { createSession, askQuestion } from './api';
import { DEMO_SCENARIOS } from './demo';
import type { DemoScenario } from './demo';
import { Conversation } from './components/Conversation';
import { IntegrityPanel } from './components/IntegrityPanel';
import { SessionHistory } from './components/SessionHistory';
import { Ouroboros } from './components/Ouroboros';
import { AnimatePresence, motion } from 'framer-motion';

// ── localStorage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'naus-sessions-v1';

function loadSavedSessions(): SavedSession[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function persistSession(session: SavedSession, all: SavedSession[]): SavedSession[] {
  const without = all.filter((s) => s.id !== session.id);
  const next = [session, ...without].slice(0, 30);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function generateTitle(question: string): string {
  return question.length > 60 ? question.slice(0, 57) + '…' : question;
}

// ── State ─────────────────────────────────────────────────────────────────────

interface ActiveSession {
  id: string;
  serverSessionId: string | null;
  turns: Turn[];
  ledger: Commitment[];
  title: string;
  turnCount: number;
}

// Stable ref for session values — lets the demo loop avoid stale closures
interface SessionRef {
  serverSessionId: string | null;
  isThinking: boolean;
  turnCount: number;
}

interface AppState {
  active: ActiveSession;
  savedSessions: SavedSession[];
  isThinking: boolean;
  error: string | null;
  question: string;
  hoveredCommitmentId: string | null;
  demoStep: number;
  demoTitle: string;
}

type Action =
  | { type: 'session-server-ready'; serverSessionId: string }
  | { type: 'set-question'; value: string }
  | { type: 'thinking-start' }
  | { type: 'turn-complete'; turn: Turn; ledger: Commitment[] }
  | { type: 'error'; message: string }
  | { type: 'hover-commitment'; id: string | null }
  | { type: 'load-session'; session: SavedSession }
  | { type: 'new-session' }
  | { type: 'save-sessions'; sessions: SavedSession[] }
  | { type: 'demo-step'; step: number; title?: string };

function makeBlankActive(): ActiveSession {
  return { id: crypto.randomUUID(), serverSessionId: null, turns: [], ledger: [], title: '', turnCount: 0 };
}

const initial: AppState = {
  active: makeBlankActive(),
  savedSessions: loadSavedSessions(),
  isThinking: false,
  error: null,
  question: '',
  hoveredCommitmentId: null,
  demoStep: -1,
  demoTitle: '',
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'session-server-ready':
      return { ...state, active: { ...state.active, serverSessionId: action.serverSessionId }, error: null };
    case 'set-question':
      return { ...state, question: action.value, error: null };
    case 'thinking-start':
      return { ...state, isThinking: true, error: null };
    case 'turn-complete': {
      const turnCount = state.active.turnCount + 1;
      const title = state.active.title || generateTitle(action.turn.question);
      const turns = [...state.active.turns, action.turn];
      return {
        ...state,
        active: { ...state.active, turns, ledger: action.ledger, title, turnCount },
        isThinking: false, question: '', error: null,
      };
    }
    case 'error':
      return { ...state, isThinking: false, error: action.message };
    case 'hover-commitment':
      return { ...state, hoveredCommitmentId: action.id };
    case 'load-session':
      return {
        ...state,
        active: {
          id: action.session.id,
          serverSessionId: action.session.serverSessionId,
          turns: action.session.turns,
          ledger: action.session.ledger,
          title: action.session.title,
          turnCount: action.session.turns.length,
        },
        question: '', error: null, hoveredCommitmentId: null,
      };
    case 'new-session':
      return { ...state, active: makeBlankActive(), question: '', error: null, hoveredCommitmentId: null, demoStep: -1 };
    case 'save-sessions':
      return { ...state, savedSessions: action.sessions };
    case 'demo-step':
      return { ...state, demoStep: action.step, demoTitle: action.title ?? state.demoTitle };
    default:
      return state;
  }
}

const spring = { type: 'spring', stiffness: 300, damping: 30 } as const;

// ── Mobile drawer ─────────────────────────────────────────────────────────────

function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-40" style={{ background: 'rgba(10,10,11,0.8)' }}
          />
          <motion.div
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={spring}
            className="fixed left-0 top-0 bottom-0 z-50 flex flex-col" style={{ width: 260 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [state, dispatch] = useReducer(reducer, initial);
  const turnIdRef = useRef(0);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [mobileLedgerOpen, setMobileLedgerOpen] = useState(false);

  const startServerSession = useCallback(() => {
    createSession()
      .then((id) => dispatch({ type: 'session-server-ready', serverSessionId: id }))
      .catch(() => dispatch({ type: 'error', message: 'Could not reach the server. Is it running on port 3001?' }));
  }, []);

  useEffect(() => { startServerSession(); }, [startServerSession]);

  // Persist to localStorage
  useEffect(() => {
    const { active, savedSessions } = state;
    if (active.turns.length === 0 || !active.serverSessionId) return;
    const saved: SavedSession = {
      id: active.id,
      serverSessionId: active.serverSessionId,
      title: active.title,
      preview: active.turns[0]?.answer.slice(0, 120) ?? '',
      timestamp: Date.now(),
      turns: active.turns,
      ledger: active.ledger,
    };
    const updated = persistSession(saved, savedSessions);
    dispatch({ type: 'save-sessions', sessions: updated });
  }, [state.active.turns.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable ref so the demo loop reads live values, not stale closures
  const sessionRef = useRef<SessionRef>({ serverSessionId: null, isThinking: false, turnCount: 0 });
  useEffect(() => {
    sessionRef.current = {
      serverSessionId: state.active.serverSessionId,
      isThinking: state.isThinking,
      turnCount: state.active.turnCount,
    };
  });

  // Stable ref for ledger so demo loop always sends latest commitments
  const ledgerRef = useRef<Commitment[]>([]);
  useEffect(() => { ledgerRef.current = state.active.ledger; });

  // Core submit — reads from sessionRef for latest values, safe in async loops
  const submitTurnRef = useRef(async (question: string, predefinedAnswer?: string) => {
    const { serverSessionId, isThinking, turnCount } = sessionRef.current;
    if (!question.trim() || !serverSessionId || isThinking) return;
    dispatch({ type: 'thinking-start' });
    try {
      const result = await askQuestion(serverSessionId, question, ledgerRef.current, predefinedAnswer);
      turnIdRef.current++;
      const turn: Turn = {
        id: `turn-${turnIdRef.current}`,
        question,
        answer: result.answer,
        claims: result.claims,
        turnNumber: turnCount + 1,
      };
      dispatch({ type: 'turn-complete', turn, ledger: result.ledger });
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Unknown error';
      const message = raw.includes('not configured')
        ? 'Naus needs an API key on the server.'
        : "Couldn't complete the analysis — try again.";
      dispatch({ type: 'error', message });
    }
  });

  const handleAsk = useCallback(() => {
    submitTurnRef.current(state.question);
  }, [state.question]);

  // Demo runner — uses ref-based submit to avoid stale closures across turns
  const activeDemoLength = useRef(3);
  const demoRunning = useRef(false);
  const runDemo = useCallback(async (scenario: DemoScenario) => {
    if (demoRunning.current || sessionRef.current.isThinking) return;
    activeDemoLength.current = scenario.turns.length;
    demoRunning.current = true;
    dispatch({ type: 'demo-step', step: 0, title: scenario.title });
    for (let i = 0; i < scenario.turns.length; i++) {
      dispatch({ type: 'demo-step', step: i, title: scenario.title });
      const { question, answer } = scenario.turns[i];
      await submitTurnRef.current(question, answer);
      if (i < scenario.turns.length - 1) {
        await new Promise((r) => setTimeout(r, 1600));
      }
    }
    dispatch({ type: 'demo-step', step: -1 });
    demoRunning.current = false;
  }, []);

  const handleNew = useCallback(() => {
    demoRunning.current = false;
    dispatch({ type: 'new-session' });
    setMobileHistoryOpen(false);
    startServerSession();
  }, [startServerSession]);

  const handleLoadSession = useCallback((session: SavedSession) => {
    dispatch({ type: 'load-session', session });
    setMobileHistoryOpen(false);
  }, []);

  const { active, savedSessions, isThinking, error, question, hoveredCommitmentId, demoStep, demoTitle } = state;

  return (
    <div className="h-full bg-bg text-text font-sans flex flex-col" style={{ overflow: 'hidden' }}>

      {/* ── Header ── */}
      <header
        className="flex-shrink-0 border-b border-border flex items-center justify-between"
        style={{ height: 52, padding: '0 16px', background: '#0D0D0F' }}
      >
        <div className="flex items-center gap-3">
          {/* Mobile: history toggle */}
          <button
            type="button"
            onClick={() => setMobileHistoryOpen(true)}
            className="lg:hidden font-mono text-13 text-muted"
            style={{ marginRight: 4 }}
          >
            ≡
          </button>
          <Ouroboros />
          <span className="font-mono text-13" style={{ color: '#C9A961', letterSpacing: '0.02em' }}>
            naus
          </span>
          {active.title && (
            <span className="hidden md:block font-mono text-13 text-muted" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              — {active.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden lg:block font-mono text-13" style={{ color: '#2A2A2E' }}>
            every answer, fully accounted
          </span>
          {/* Mobile: ledger toggle */}
          <button
            type="button"
            onClick={() => setMobileLedgerOpen(true)}
            className="lg:hidden font-mono text-13 text-muted"
          >
            ledger {active.ledger.length > 0 && `(${active.ledger.length})`}
          </button>
          <span className="font-mono text-13 hidden lg:block" style={{ color: '#2A2A2E' }}>
            {active.serverSessionId ? active.serverSessionId.slice(0, 8) : '·'}
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex min-h-0">

        {/* Left: session history — desktop */}
        <div className="hidden lg:flex flex-col shrink-0 border-r border-border overflow-hidden" style={{ width: 220 }}>
          <SessionHistory
            sessions={savedSessions}
            activeId={active.id}
            onSelect={handleLoadSession}
            onNew={handleNew}
          />
        </div>

        {/* Center: conversation */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <Conversation
            turns={active.turns}
            isThinking={isThinking}
            question={question}
            error={error}
            ledger={active.ledger}
            hoveredCommitmentId={hoveredCommitmentId}
            demoStep={demoStep}
            demoLength={activeDemoLength.current}
            demoTitle={demoTitle}
            scenarios={DEMO_SCENARIOS}
            onChange={(v) => dispatch({ type: 'set-question', value: v })}
            onAsk={handleAsk}
            onRunDemo={runDemo}
          />
        </div>

        {/* Right: integrity panel — desktop */}
        <div className="hidden lg:flex flex-col shrink-0 border-l border-border overflow-hidden" style={{ width: 320 }}>
          <IntegrityPanel
            ledger={active.ledger}
            turns={active.turns}
            title={active.title}
            onHover={(id) => dispatch({ type: 'hover-commitment', id })}
          />
        </div>
      </div>

      {/* ── Mobile drawers ── */}
      <Drawer open={mobileHistoryOpen} onClose={() => setMobileHistoryOpen(false)}>
        <SessionHistory
          sessions={savedSessions}
          activeId={active.id}
          onSelect={handleLoadSession}
          onNew={handleNew}
        />
      </Drawer>

      <AnimatePresence>
        {mobileLedgerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileLedgerOpen(false)}
              className="fixed inset-0 z-40" style={{ background: 'rgba(10,10,11,0.8)' }}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={spring}
              className="fixed right-0 top-0 bottom-0 z-50 flex flex-col border-l border-border"
              style={{ width: 300, background: '#0A0A0B' }}
            >
              <div
                className="flex items-center justify-between border-b border-border flex-shrink-0"
                style={{ height: 52, padding: '0 16px' }}
              >
                <span className="font-mono text-13 text-muted uppercase tracking-wider">ledger</span>
                <button
                  type="button"
                  onClick={() => setMobileLedgerOpen(false)}
                  className="font-mono text-13 text-muted"
                >
                  close
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <IntegrityPanel
                  ledger={active.ledger}
                  turns={active.turns}
                  title={active.title}
                  onHover={(id) => dispatch({ type: 'hover-commitment', id })}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
