import type { Color } from '../lib/useChessGame';
import { classNames, formatClock } from '../lib/utils';

const GLYPH: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
const ORDER = ['q', 'r', 'b', 'n', 'p'];

type Props = {
  color: Color;
  name: string;
  subtitle?: string;
  online?: boolean | null;
  isTurn: boolean;
  clockMs: number | null;
  captured: Record<string, number>;
  advantage: number;
};

export function PlayerBar({ color, name, subtitle, online, isTurn, clockMs, captured, advantage }: Props) {
  const low = clockMs !== null && clockMs <= 20000;
  const shownAdvantage = color === 'w' ? advantage : -advantage;

  return (
    <div className={classNames('player-bar', isTurn && 'turn')}>
      <div className={classNames('avatar', color)}>{color === 'w' ? '♔' : '♚'}</div>

      <div className="player-meta">
        <div className="nm">{name}</div>
        <div className="st">
          {online !== undefined && online !== null && (
            <span className={classNames('chip', online ? 'live' : 'bad')} style={{ padding: '2px 8px', fontSize: 11 }}>
              <span className="dot" />
              {online ? 'מחובר' : 'מנותק'}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      </div>

      <div className="captured" aria-label="כלים שנלקחו">
        {ORDER.flatMap((p) =>
          Array.from({ length: captured[p] ?? 0 }, (_, i) => (
            <span key={`${p}${i}`}>{GLYPH[p]}</span>
          )),
        )}
        {shownAdvantage > 0 && <span className="adv">+{shownAdvantage}</span>}
      </div>

      {clockMs !== null && (
        <div className={classNames('clock', isTurn && 'active', low && 'low')}>{formatClock(clockMs)}</div>
      )}
    </div>
  );
}
