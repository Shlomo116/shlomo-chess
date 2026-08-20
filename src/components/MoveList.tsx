import { useEffect, useRef } from 'react';
import type { Move } from 'chess.js';
import { classNames, describeMoveHe, toFigurine } from '../lib/utils';
import { IconChevronEnd, IconChevronStart, IconNext, IconPrev } from './Icons';

type Props = {
  history: Move[];
  viewPly: number | null;
  onSelectPly: (ply: number | null) => void;
};

export function MoveList({ history, viewPly, onSelectPly }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const total = history.length;
  const current = viewPly ?? total;

  useEffect(() => {
    const el = scrollRef.current?.querySelector('.move-cell.current');
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current, total]);

  const rows: { no: number; white?: Move; black?: Move }[] = [];
  for (let i = 0; i < total; i += 2) {
    rows.push({ no: i / 2 + 1, white: history[i], black: history[i + 1] });
  }

  const go = (ply: number) => onSelectPly(ply >= total ? null : Math.max(0, ply));

  return (
    <>
      <div className="moves" ref={scrollRef}>
        {total === 0 ? (
          <div className="moves-empty">עוד לא שוחקו מהלכים.
            <br />
            הלבן פותח.
          </div>
        ) : (
          rows.map((r, ri) => (
            <div className="move-row" key={r.no}>
              <span className="no">{r.no}.</span>
              {[r.white, r.black].map((m, ci) => {
                if (!m) return <span key={ci} />;
                const ply = ri * 2 + ci + 1;
                return (
                  <button
                    key={ci}
                    className={classNames('move-cell', current === ply && 'current')}
                    onClick={() => go(ply)}
                    title={describeMoveHe(m)}
                  >
                    {toFigurine(m.san)}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="move-nav">
        <button onClick={() => go(0)} disabled={current === 0} title="לתחילת המשחק" aria-label="לתחילת המשחק">
          <IconChevronStart />
        </button>
        <button onClick={() => go(current - 1)} disabled={current === 0} title="מהלך אחורה" aria-label="מהלך אחורה">
          <IconPrev />
        </button>
        <button
          onClick={() => go(current + 1)}
          disabled={current >= total}
          title="מהלך קדימה"
          aria-label="מהלך קדימה"
        >
          <IconNext />
        </button>
        <button
          onClick={() => onSelectPly(null)}
          disabled={current >= total}
          title="לעמדה הנוכחית"
          aria-label="לעמדה הנוכחית"
        >
          <IconChevronEnd />
        </button>
      </div>
    </>
  );
}
