import { useMemo } from 'react';
import { Chessboard, defaultPieces, defaultArrowOptions } from 'react-chessboard';
import type { PieceRenderObject } from 'react-chessboard';

const WHITE_FILL = '#FAF7F0';
const BLACK_FILL = '#1B1D25';

/** עוטף את סט הכלים כדי לשלוט בצבע, בקווי המתאר ובצל */
function buildPieces(): PieceRenderObject {
  const out: PieceRenderObject = {};
  for (const [key, render] of Object.entries(defaultPieces)) {
    const isDark = key.startsWith('b');
    out[key] = (props) => (
      <span className={`piece-wrap ${isDark ? 'dark' : 'light'}`}>
        {render({
          ...props,
          fill: isDark ? BLACK_FILL : WHITE_FILL,
          svgStyle: { width: '100%', height: '100%', display: 'block' },
        })}
      </span>
    );
  }
  return out;
}

export type BoardProps = {
  fen: string;
  orientation: 'white' | 'black';
  selected: string | null;
  targets: { to: string; captured?: string }[];
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
  allowDragging: boolean;
  canDragPiece: (square: string, pieceType: string) => boolean;
  onSquareClick: (square: string) => void;
  onDrop: (from: string, to: string) => boolean;
  animationMs?: number;
};

export function Board({
  fen,
  orientation,
  selected,
  targets,
  lastMove,
  checkSquare,
  allowDragging,
  canDragPiece,
  onSquareClick,
  onDrop,
  animationMs = 220,
}: BoardProps) {
  const pieces = useMemo(buildPieces, []);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    const add = (sq: string, s: React.CSSProperties) => {
      styles[sq] = { ...(styles[sq] ?? {}), ...s };
    };

    if (lastMove) {
      add(lastMove.from, { boxShadow: 'inset 0 0 0 100px rgba(229,185,92,0.22)' });
      add(lastMove.to, { boxShadow: 'inset 0 0 0 100px rgba(229,185,92,0.28)' });
    }
    if (checkSquare) {
      add(checkSquare, {
        backgroundImage:
          'radial-gradient(circle, rgba(240,87,91,0.95) 6%, rgba(240,87,91,0.5) 42%, rgba(240,87,91,0) 72%)',
      });
    }
    if (selected) {
      add(selected, {
        boxShadow: 'inset 0 0 0 3px rgba(229,185,92,0.9), inset 0 0 30px rgba(229,185,92,0.28)',
      });
    }
    for (const t of targets) {
      if (t.captured) {
        add(t.to, {
          backgroundImage:
            'radial-gradient(circle, rgba(240,87,91,0) 52%, rgba(240,87,91,0.55) 53%, rgba(240,87,91,0.55) 64%, rgba(240,87,91,0) 65%)',
        });
      } else {
        add(t.to, {
          backgroundImage:
            'radial-gradient(circle, rgba(18,20,26,0.34) 15%, rgba(18,20,26,0) 16%)',
        });
      }
    }
    return styles;
  }, [lastMove, checkSquare, selected, targets]);

  return (
    <Chessboard
      options={{
        id: 'main-board',
        position: fen,
        boardOrientation: orientation,
        pieces,
        allowDragging,
        allowDrawingArrows: true,
        showAnimations: true,
        animationDurationInMs: animationMs,
        canDragPiece: ({ piece, square }) =>
          allowDragging && !!square && canDragPiece(square, piece.pieceType),
        onSquareClick: ({ square }) => onSquareClick(square),
        onPieceDrop: ({ sourceSquare, targetSquare }) =>
          targetSquare ? onDrop(sourceSquare, targetSquare) : false,
        squareStyles,
        boardStyle: { borderRadius: '12px', overflow: 'hidden' },
        lightSquareStyle: {
          backgroundColor: '#e2dacd',
          backgroundImage: 'linear-gradient(155deg, rgba(255,255,255,0.22), rgba(0,0,0,0.035))',
        },
        darkSquareStyle: {
          backgroundColor: '#4e4d5a',
          backgroundImage: 'linear-gradient(155deg, rgba(255,255,255,0.05), rgba(0,0,0,0.07))',
        },
        dropSquareStyle: { boxShadow: 'inset 0 0 0 4px rgba(248,227,174,0.85)' },
        darkSquareNotationStyle: { color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600 },
        lightSquareNotationStyle: { color: 'rgba(40,42,50,0.55)', fontSize: '11px', fontWeight: 600 },
        arrowOptions: {
          ...defaultArrowOptions,
          colors: {
            ...defaultArrowOptions.colors,
            default: 'rgba(229,185,92,0.8)',
            shift: 'rgba(106,169,255,0.75)',
            ctrl: 'rgba(70,223,160,0.75)',
          },
        },
      }}
    />
  );
}
