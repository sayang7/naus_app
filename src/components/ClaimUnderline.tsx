import type { Claim, ClaimStatus } from '../types';

interface Segment {
  type: 'text' | 'claim';
  content: string;
  claim?: Claim;
}

function buildSegments(answer: string, claims: Claim[]): Segment[] {
  const indexed = claims
    .filter(
      (c) => c.startIndex !== undefined && c.endIndex !== undefined && c.endIndex > c.startIndex,
    )
    .sort((a, b) => a.startIndex! - b.startIndex!);

  const nonOverlapping: typeof indexed = [];
  let maxEnd = 0;
  for (const claim of indexed) {
    if (claim.startIndex! >= maxEnd) {
      nonOverlapping.push(claim);
      maxEnd = claim.endIndex!;
    }
  }

  const segments: Segment[] = [];
  let pos = 0;

  for (const claim of nonOverlapping) {
    if (claim.startIndex! > pos) {
      segments.push({ type: 'text', content: answer.slice(pos, claim.startIndex) });
    }
    segments.push({
      type: 'claim',
      content: answer.slice(claim.startIndex!, claim.endIndex!),
      claim,
    });
    pos = claim.endIndex!;
  }

  if (pos < answer.length) {
    segments.push({ type: 'text', content: answer.slice(pos) });
  }

  return segments;
}

function underlineStyle(status: ClaimStatus, active: boolean): React.CSSProperties {
  const color: Record<ClaimStatus, string> = {
    grounded: '#3A3A40',       // visible on dark panel, not gold
    ambiguous: '#C9A961',      // gold
    assumption: '#8A8A85',     // muted dashed
    unverifiable: '#5A5A60',   // slightly muted
    contradiction: '#E5484D',  // red
  };
  return {
    textDecorationLine: 'underline',
    textDecorationColor: color[status],
    textDecorationStyle: status === 'assumption' ? 'dashed' : 'solid',
    textDecorationThickness: '1px',
    textUnderlineOffset: '3px',
    cursor: 'pointer',
    borderRadius: '2px',
    padding: '1px 1px',
    backgroundColor: active ? 'rgba(201,169,97,0.09)' : undefined,
    transition: 'background-color 120ms ease',
  };
}

interface ClaimUnderlineProps {
  answer: string;
  claims: Claim[];
  activeClaim: string | null;
  hoveredCommitmentId: string | null;
  onClaimClick: (id: string) => void;
}

export function ClaimUnderline({
  answer,
  claims,
  activeClaim,
  hoveredCommitmentId,
  onClaimClick,
}: ClaimUnderlineProps) {
  const segments = buildSegments(answer, claims);

  return (
    <div className="text-16 font-normal text-text" style={{ lineHeight: '30px' }}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i}>{seg.content}</span>;
        }

        const claim = seg.claim!;
        const active = activeClaim === claim.id || hoveredCommitmentId === claim.id;

        return (
          <span
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => onClaimClick(claim.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onClaimClick(claim.id);
            }}
            style={underlineStyle(claim.status, active)}
          >
            {seg.content}
          </span>
        );
      })}
    </div>
  );
}
