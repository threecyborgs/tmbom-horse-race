/**
 * Shared horse race track component.
 * Used by both the player view and the presenter view during racing.
 */

export interface HorseTrackHorse {
  id: string;
  name: string;
  position: number;
}

interface HorseTrackProps {
  horses: HorseTrackHorse[];
  /** Horse IDs in finish order (winner first). Used to lock position once race ends. */
  finishOrder?: string[];
  /** Horse ID to highlight in purple (e.g. the player's bet). Others render blue. */
  highlightedHorseId?: string | null;
}

export function HorseTrack({ horses, finishOrder = [], highlightedHorseId }: HorseTrackProps) {
  const sorted = [...horses].sort((a, b) => {
    const aFinished = finishOrder.includes(a.id);
    const bFinished = finishOrder.includes(b.id);
    if (aFinished && bFinished) return finishOrder.indexOf(a.id) - finishOrder.indexOf(b.id);
    if (aFinished) return -1;
    if (bFinished) return 1;
    return b.position - a.position;
  });

  return (
    <div style={{ width: '100%' }}>
      {sorted.map((horse, idx) => {
        const position = typeof horse.position === 'number' ? horse.position : 0;
        const isHighlighted = highlightedHorseId === horse.id;
        const barColor = isHighlighted ? '#9333ea' : '#3b82f6';

        return (
          <div
            key={horse.id}
            style={{
              marginBottom: '12px',
              padding: '12px',
              backgroundColor: isHighlighted ? 'rgba(147, 51, 234, 0.2)' : 'rgba(55, 65, 81, 0.4)',
              borderRadius: '8px',
              border: isHighlighted ? '2px solid #9333ea' : '1px solid #374151',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'white', fontWeight: '500' }}>
                {idx === 0 && '🥇 '}
                {idx === 1 && '🥈 '}
                {idx === 2 && '🥉 '}
                {horse.name}
              </span>
              <span style={{ color: '#9ca3af' }}>{Math.round(position)}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: '20px',
                backgroundColor: '#111827',
                borderRadius: '10px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${position}%`,
                  height: '20px',
                  backgroundColor: barColor,
                  borderRadius: '10px',
                  transition: 'width 0.1s',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
