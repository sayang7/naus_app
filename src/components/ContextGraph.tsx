import { useState } from 'react';
import type { Turn, Commitment, ClaimStatus, ReasoningRole } from '../types';
import { STATUS_COLOR } from '../tokens';

// ── Layout constants ──────────────────────────────────────────────────────────

const PAD_X  = 90;   // left padding (for tier labels)
const PAD_Y  = 36;
const COL_W  = 140;  // horizontal space per turn
const TIER_H = 90;   // vertical space per tier row
const NODE_SPACING = 22; // between stacked nodes in same cell
const R = 7;

const TIER_INDEX: Record<ReasoningRole, number> = { premise: 0, inference: 1, conclusion: 2 };
const TIER_LABEL: Record<number, string> = { 0: 'PREMISES', 1: 'INFERENCES', 2: 'CONCLUSIONS' };

// ── Node / edge data ──────────────────────────────────────────────────────────

interface NodeData {
  id: string;
  x: number;
  y: number;
  status: ClaimStatus;
  role: ReasoningRole;
  text: string;
  note: string;
  citationTarget?: string;
  turnNumber: number;
  dependents: number; // how many other nodes depend on this
}

interface EdgeData {
  x1: number; y1: number;
  x2: number; y2: number;
  kind: 'dependency' | 'contradiction';
}

interface ContextGraphProps {
  turns: Turn[];
  ledger: Commitment[];
}

export function ContextGraph({ turns, ledger: _ledger }: ContextGraphProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number;
    title: string; text: string; note: string; citation?: string;
  } | null>(null);

  if (turns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ paddingBottom: 48 }}>
        <p style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, color: 'var(--color-ghost)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          no turns yet
        </p>
      </div>
    );
  }

  // ── Build nodes with tier + column layout ────────────────────────────────────

  // Track how many cells exist per (tier, col) to stack nodes
  const cellCount: Record<string, number> = {};
  const nodes: NodeData[] = [];
  const nodeById = new Map<string, NodeData>();

  // First pass: count all dependsOnIds so we can compute 'dependents'
  const dependentCount: Record<string, number> = {};
  turns.forEach((turn) => {
    turn.claims.forEach((claim) => {
      (claim.dependsOnIds ?? []).forEach((depId) => {
        dependentCount[depId] = (dependentCount[depId] ?? 0) + 1;
      });
    });
  });

  turns.forEach((turn, ti) => {
    turn.claims.forEach((claim) => {
      const role: ReasoningRole = claim.reasoningRole ?? 'inference';
      const tierIdx = TIER_INDEX[role];
      const cellKey = `${tierIdx}-${ti}`;
      const stackIdx = cellCount[cellKey] ?? 0;
      cellCount[cellKey] = stackIdx + 1;

      const x = PAD_X + ti * COL_W;
      const y = PAD_Y + tierIdx * TIER_H + stackIdx * NODE_SPACING;

      const node: NodeData = {
        id: claim.id,
        x, y,
        status: claim.status,
        role,
        text: claim.text,
        note: claim.note,
        citationTarget: claim.citationTarget,
        turnNumber: turn.turnNumber,
        dependents: dependentCount[claim.id] ?? 0,
      };
      nodes.push(node);
      nodeById.set(claim.id, node);
    });
  });

  // ── Build edges ───────────────────────────────────────────────────────────────

  const edges: EdgeData[] = [];

  turns.forEach((turn) => {
    turn.claims.forEach((claim) => {
      const from = nodeById.get(claim.id);
      if (!from) return;

      // Dependency edges (from prior commitments)
      (claim.dependsOnIds ?? []).forEach((depId) => {
        const to = nodeById.get(depId);
        if (to) {
          edges.push({ x1: to.x, y1: to.y, x2: from.x, y2: from.y, kind: 'dependency' });
        }
      });

      // Contradiction edges
      if (claim.status === 'contradiction' && claim.conflictsWithId) {
        const to = nodeById.get(claim.conflictsWithId);
        if (to) {
          edges.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, kind: 'contradiction' });
        }
      }
    });
  });

  // ── SVG sizing ────────────────────────────────────────────────────────────────

  const maxStackInAnyCell = Math.max(...Object.values(cellCount), 1);
  const svgWidth  = PAD_X + turns.length * COL_W + PAD_X;
  const svgHeight = PAD_Y + 3 * TIER_H + maxStackInAnyCell * NODE_SPACING + PAD_Y;

  // ── Edge path helper (cubic bezier) ──────────────────────────────────────────

  function edgePath(e: EdgeData): string {
    const dx = e.x2 - e.x1;
    const dy = e.y2 - e.y1;
    if (e.kind === 'contradiction') {
      // Arc bowing upward above both nodes
      const mx = (e.x1 + e.x2) / 2;
      const my = Math.min(e.y1, e.y2) - 44 - Math.abs(dx) * 0.15;
      return `M ${e.x1},${e.y1} C ${mx},${my} ${mx},${my} ${e.x2},${e.y2}`;
    }
    // Dependency: s-curve from left node to right node
    const cx1 = e.x1 + dx * 0.45;
    const cy1 = e.y1;
    const cx2 = e.x2 - dx * 0.45;
    const cy2 = e.y2;
    return `M ${e.x1},${e.y1} C ${cx1},${cy1} ${cx2},${cy2} ${e.x2},${e.y2}`;
  }

  const SANS = 'Inter, system-ui, sans-serif';

  return (
    <div className="flex-1 overflow-auto min-h-0 px-1 py-1" style={{ position: 'relative' }}>
      <svg width={svgWidth} height={svgHeight} style={{ display: 'block', minWidth: svgWidth }}>

        {/* Tier background bands */}
        {[0, 1, 2].map((ti) => (
          <rect
            key={`band-${ti}`}
            x={0} y={PAD_Y + ti * TIER_H - 10}
            width={svgWidth} height={TIER_H}
            fill={ti % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'}
          />
        ))}

        {/* Tier labels */}
        {[0, 1, 2].map((ti) => (
          <text
            key={`tier-label-${ti}`}
            x={PAD_X - 14}
            y={PAD_Y + ti * TIER_H + 4}
            textAnchor="end"
            fill="var(--color-whisper)"
            fontSize={8}
            fontFamily={SANS}
            letterSpacing="0.1em"
          >
            {TIER_LABEL[ti]}
          </text>
        ))}

        {/* Tier separator lines */}
        {[1, 2].map((ti) => (
          <line
            key={`sep-${ti}`}
            x1={PAD_X - 60} y1={PAD_Y + ti * TIER_H - 10}
            x2={svgWidth - 10} y2={PAD_Y + ti * TIER_H - 10}
            stroke="var(--color-border)"
            strokeWidth={1}
            strokeDasharray="3 6"
            opacity={0.4}
          />
        ))}

        {/* Turn labels + column guides */}
        {turns.map((turn, i) => (
          <g key={turn.id}>
            <text
              x={PAD_X + i * COL_W}
              y={16}
              textAnchor="middle"
              fill="var(--color-ghost)"
              fontSize={10}
              fontFamily={SANS}
              letterSpacing="0.04em"
            >
              T{turn.turnNumber}
            </text>
            <line
              x1={PAD_X + i * COL_W} y1={24}
              x2={PAD_X + i * COL_W} y2={svgHeight - 12}
              stroke="var(--color-border)"
              strokeWidth={1}
              strokeDasharray="2 5"
              opacity={0.35}
            />
          </g>
        ))}

        {/* Dependency edges */}
        {edges.filter((e) => e.kind === 'dependency').map((e, i) => (
          <path
            key={`dep-${i}`}
            d={edgePath(e)}
            fill="none"
            stroke="var(--color-whisper)"
            strokeWidth={1}
            opacity={0.5}
            markerEnd="url(#arrowhead)"
          />
        ))}

        {/* Arrowhead marker */}
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-whisper)" opacity="0.6" />
          </marker>
          <marker id="arrowhead-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={STATUS_COLOR.contradiction} opacity="0.9" />
          </marker>
        </defs>

        {/* Contradiction edges */}
        {edges.filter((e) => e.kind === 'contradiction').map((e, i) => (
          <g key={`contra-${i}`}>
            <path
              d={edgePath(e)}
              fill="none"
              stroke={STATUS_COLOR.contradiction}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.75}
              markerEnd="url(#arrowhead-red)"
            />
            {/* Contradiction marker ✕ at midpoint */}
            <text
              x={(e.x1 + e.x2) / 2}
              y={Math.min(e.y1, e.y2) - 46 - Math.abs(e.x2 - e.x1) * 0.075}
              textAnchor="middle"
              fill={STATUS_COLOR.contradiction}
              fontSize={10}
              fontFamily={SANS}
              opacity={0.9}
            >
              ✕
            </text>
          </g>
        ))}

        {/* Nodes */}
        {nodes.map((node) => {
          const isHovered = hoveredId === node.id;
          const r = isHovered ? R + 2 : R + (node.dependents > 0 ? 1 : 0);

          return (
            <g
              key={node.id}
              onMouseEnter={(e) => {
                setHoveredId(node.id);
                const svg = (e.currentTarget as SVGGElement).closest('svg')!;
                const rect = svg.getBoundingClientRect();
                const scale = rect.width / svgWidth;
                setTooltip({
                  x: node.x * scale,
                  y: node.y * scale - r * scale - 10,
                  title: `${node.id} · ${node.role} · ${node.status}`,
                  text: node.text,
                  note: node.note,
                  citation: node.citationTarget,
                });
              }}
              onMouseLeave={() => { setHoveredId(null); setTooltip(null); }}
              style={{ cursor: 'pointer' }}
            >
              {/* Dependency ripple (node is a premise others rely on) */}
              {node.dependents > 1 && (
                <circle
                  cx={node.x} cy={node.y}
                  r={r + 5}
                  fill="none"
                  stroke={STATUS_COLOR[node.status]}
                  strokeWidth={0.75}
                  opacity={0.2}
                />
              )}

              {/* Contradiction halo */}
              {node.status === 'contradiction' && (
                <circle
                  cx={node.x} cy={node.y}
                  r={r + 4}
                  fill="none"
                  stroke={STATUS_COLOR.contradiction}
                  strokeWidth={1}
                  opacity={0.25}
                />
              )}

              <circle
                cx={node.x} cy={node.y}
                r={r}
                fill={STATUS_COLOR[node.status]}
                opacity={isHovered ? 1 : 0.78}
                style={{ transition: 'r 0.1s, opacity 0.1s' }}
              />

              {/* Citation indicator (small dot) */}
              {node.citationTarget && (
                <circle
                  cx={node.x + r - 1}
                  cy={node.y - r + 1}
                  r={2.5}
                  fill="var(--color-purple)"
                  opacity={0.9}
                />
              )}

              {/* Node ID label (for prominent/hovered nodes) */}
              {(isHovered || node.dependents > 0) && (
                <text
                  x={node.x}
                  y={node.y + r + 11}
                  textAnchor="middle"
                  fill="var(--color-ghost)"
                  fontSize={8}
                  fontFamily="JetBrains Mono, monospace"
                  opacity={isHovered ? 1 : 0.5}
                >
                  {node.id}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateX(-50%) translateY(-100%)',
            background: 'var(--color-panel-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '8px 10px',
            maxWidth: 240,
            pointerEvents: 'none',
            zIndex: 20,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--color-gold)', marginBottom: 4 }}>
            {tooltip.title}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 12, color: 'var(--color-text)', lineHeight: '17px', marginBottom: 4 }}>
            {tooltip.text.length > 100 ? tooltip.text.slice(0, 100) + '…' : tooltip.text}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 11, color: 'var(--color-muted)', lineHeight: '16px' }}>
            {tooltip.note}
          </div>
          {tooltip.citation && (
            <div style={{ marginTop: 5, fontFamily: SANS, fontSize: 10, color: 'var(--color-purple)', lineHeight: '15px' }}>
              🔍 {tooltip.citation}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', padding: '10px 4px 2px' }}>
        {(['grounded', 'ambiguous', 'assumption', 'unverifiable', 'contradiction'] as const).map((s) => {
          if (!nodes.some((n) => n.status === s)) return null;
          return (
            <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[s], display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontFamily: SANS, fontSize: 10, color: 'var(--color-ghost)' }}>{s}</span>
            </span>
          );
        })}
        {nodes.some((n) => n.citationTarget) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-purple)', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontFamily: SANS, fontSize: 10, color: 'var(--color-ghost)' }}>needs citation</span>
          </span>
        )}
        {edges.some((e) => e.kind === 'dependency') && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 1, background: 'var(--color-whisper)', display: 'inline-block' }} />
            <span style={{ fontFamily: SANS, fontSize: 10, color: 'var(--color-ghost)' }}>relies on</span>
          </span>
        )}
        {edges.some((e) => e.kind === 'contradiction') && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 1, background: STATUS_COLOR.contradiction, display: 'inline-block' }} />
            <span style={{ fontFamily: SANS, fontSize: 10, color: 'var(--color-ghost)' }}>contradiction</span>
          </span>
        )}
      </div>
    </div>
  );
}
