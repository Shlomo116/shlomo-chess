import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import { sfx } from './sound';
import { getTimeControl, PIECE_VALUE } from './utils';

export type Color = 'w' | 'b';

export type GameResult = {
  winner: Color | null;
  reason:
    | 'checkmate'
    | 'stalemate'
    | 'timeout'
    | 'resign'
    | 'agreement'
    | 'insufficient'
    | 'repetition'
    | 'fifty'
    | 'abandoned';
  titleHe: string;
  subtitleHe: string;
};

export type Snapshot = {
  fen: string;
  turn: Color;
  history: Move[];
  fens: string[];
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
};

const START_FEN = new Chess().fen();

function emptySnapshot(): Snapshot {
  return { fen: START_FEN, turn: 'w', history: [], fens: [START_FEN], lastMove: null, checkSquare: null };
}

function findKingSquare(game: Chess, color: Color): string | null {
  const board = game.board();
  for (const row of board) {
    for (const sq of row) {
      if (sq && sq.type === 'k' && sq.color === color) return sq.square;
    }
  }
  return null;
}

function buildSnapshot(game: Chess, fens: string[]): Snapshot {
  const history = game.history({ verbose: true }) as Move[];
  const last = history[history.length - 1] ?? null;
  const turn = game.turn() as Color;
  return {
    fen: game.fen(),
    turn,
    history,
    fens,
    lastMove: last ? { from: last.from, to: last.to } : null,
    checkSquare: game.isCheck() ? findKingSquare(game, turn) : null,
  };
}

export type UseChessGameOptions = {
  timeControlId: string;
  onResult?: (result: GameResult) => void;
};

export function useChessGame({ timeControlId, onResult }: UseChessGameOptions) {
  const gameRef = useRef(new Chess());
  const [snap, setSnap] = useState<Snapshot>(emptySnapshot);
  const [result, setResultState] = useState<GameResult | null>(null);
  const [viewPly, setViewPly] = useState<number | null>(null);

  const tc = useMemo(() => getTimeControl(timeControlId), [timeControlId]);
  const hasClock = tc.initialMs > 0;

  const [clocks, setClocks] = useState<{ w: number; b: number }>({ w: tc.initialMs, b: tc.initialMs });
  const [clockActive, setClockActive] = useState(false);
  const lastTickRef = useRef<number>(Date.now());
  const resultRef = useRef<GameResult | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const setResult = useCallback((r: GameResult | null) => {
    resultRef.current = r;
    setResultState(r);
    if (r) onResultRef.current?.(r);
  }, []);

  /* ---------------------------------------------------------------- שעונים */
  useEffect(() => {
    if (!hasClock || !clockActive || result) return;
    lastTickRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      const side = gameRef.current.turn() as Color;
      setClocks((prev) => {
        const next = { ...prev, [side]: Math.max(0, prev[side] - delta) };
        return next;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [hasClock, clockActive, result]);

  /* -------------------------------------------------- זיהוי סיום על זמן */
  const flaggedRef = useRef<Color | null>(null);
  useEffect(() => {
    if (!hasClock || result || !clockActive) return;
    (['w', 'b'] as Color[]).forEach((c) => {
      if (clocks[c] <= 0 && flaggedRef.current !== c) {
        flaggedRef.current = c;
      }
    });
  }, [clocks, hasClock, result, clockActive]);

  const timedOutColor: Color | null =
    hasClock && clockActive && !result ? (clocks.w <= 0 ? 'w' : clocks.b <= 0 ? 'b' : null) : null;

  /* ---------------------------------------------------------- סיום משחק */
  const detectEnd = useCallback((game: Chess): GameResult | null => {
    if (game.isCheckmate()) {
      const loser = game.turn() as Color;
      const winner: Color = loser === 'w' ? 'b' : 'w';
      return {
        winner,
        reason: 'checkmate',
        titleHe: 'מט!',
        subtitleHe: winner === 'w' ? 'הלבן ניצח במט' : 'השחור ניצח במט',
      };
    }
    if (game.isStalemate()) {
      return { winner: null, reason: 'stalemate', titleHe: 'פט', subtitleHe: 'אין מהלך חוקי — תיקו' };
    }
    if (game.isInsufficientMaterial()) {
      return { winner: null, reason: 'insufficient', titleHe: 'תיקו', subtitleHe: 'אין חומר מספיק למט' };
    }
    if (game.isThreefoldRepetition()) {
      return { winner: null, reason: 'repetition', titleHe: 'תיקו', subtitleHe: 'חזרה שלישית על אותה עמדה' };
    }
    if (game.isDraw()) {
      return { winner: null, reason: 'fifty', titleHe: 'תיקו', subtitleHe: 'חוק חמישים המהלכים' };
    }
    return null;
  }, []);

  /* ---------------------------------------------------------- ביצוע מהלך */
  const applyMove = useCallback(
    (
      move: { from: string; to: string; promotion?: string },
      opts?: { silent?: boolean; clocks?: { w: number; b: number } },
    ): Move | null => {
      if (resultRef.current) return null;
      const game = gameRef.current;
      const mover = game.turn() as Color;
      let made: Move | null = null;
      try {
        made = game.move({
          from: move.from,
          to: move.to,
          promotion: (move.promotion as 'q' | 'r' | 'b' | 'n' | undefined) ?? 'q',
        }) as Move;
      } catch {
        return null;
      }
      if (!made) return null;

      setSnap((prev) => buildSnapshot(game, [...prev.fens, game.fen()]));
      setViewPly(null);

      if (opts?.clocks) {
        setClocks(opts.clocks);
        lastTickRef.current = Date.now();
      } else if (hasClock) {
        setClocks((prev) => ({ ...prev, [mover]: prev[mover] + tc.incrementMs }));
        lastTickRef.current = Date.now();
      }
      if (hasClock) setClockActive(true);

      if (!opts?.silent) {
        if (game.isCheckmate()) sfx.check();
        else if (game.isCheck()) sfx.check();
        else if (made.san === 'O-O' || made.san === 'O-O-O') sfx.castle();
        else if (made.captured) sfx.capture();
        else sfx.move();
      }

      const end = detectEnd(game);
      if (end) setResult(end);
      return made;
    },
    [detectEnd, hasClock, setResult, tc.incrementMs],
  );

  /** בונה מחדש את המשחק מרשימת מהלכי UCI — משמש לסנכרון אחרי ניתוק */
  const loadMoves = useCallback((moves: string[], remoteClocks?: { w: number; b: number }) => {
    const g = new Chess();
    const fens = [g.fen()];
    for (const uci of moves) {
      try {
        g.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: (uci[4] as 'q' | 'r' | 'b' | 'n') || 'q',
        });
        fens.push(g.fen());
      } catch {
        break;
      }
    }
    gameRef.current = g;
    setSnap(buildSnapshot(g, fens));
    setViewPly(null);
    if (remoteClocks) {
      setClocks(remoteClocks);
      lastTickRef.current = Date.now();
    }
  }, []);

  /* ------------------------------------------------------------- איפוס */
  const reset = useCallback(() => {
    gameRef.current = new Chess();
    flaggedRef.current = null;
    setSnap(emptySnapshot());
    setResult(null);
    setViewPly(null);
    setClocks({ w: tc.initialMs, b: tc.initialMs });
    setClockActive(false);
    lastTickRef.current = Date.now();
  }, [setResult, tc.initialMs]);

  useEffect(() => {
    setClocks({ w: tc.initialMs, b: tc.initialMs });
  }, [tc.initialMs]);

  /* ------------------------------------------------------- מידע נגזר */
  const legalTargets = useCallback(
    (square: string): Move[] => {
      if (resultRef.current) return [];
      try {
        return gameRef.current.moves({ square: square as Square, verbose: true }) as Move[];
      } catch {
        return [];
      }
    },
    [],
  );

  const displayFen = viewPly === null ? snap.fen : (snap.fens[viewPly] ?? snap.fen);
  const isBrowsing = viewPly !== null && viewPly !== snap.fens.length - 1;

  const displayLastMove = useMemo(() => {
    if (viewPly === null) return snap.lastMove;
    if (viewPly <= 0) return null;
    const m = snap.history[viewPly - 1];
    return m ? { from: m.from, to: m.to } : null;
  }, [viewPly, snap]);

  const material = useMemo(() => {
    const counts: Record<Color, Record<string, number>> = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    };
    for (const m of snap.history) {
      if (m.captured) {
        const victim: Color = m.color === 'w' ? 'b' : 'w';
        counts[victim][m.captured] = (counts[victim][m.captured] ?? 0) + 1;
      }
    }
    const score = (c: Color) =>
      Object.entries(counts[c]).reduce((sum, [p, n]) => sum + (PIECE_VALUE[p] ?? 0) * n, 0);
    // capturedBy[x] = הכלים ש-x לקח (כלומר הכלים שאבדו לצד השני)
    return {
      capturedByWhite: counts.b,
      capturedByBlack: counts.w,
      advantage: score('b') - score('w'), // חיובי = יתרון ללבן
    };
  }, [snap.history]);

  const uciMoves = useMemo(
    () => snap.history.map((m) => `${m.from}${m.to}${m.promotion ?? ''}`),
    [snap.history],
  );

  const pgn = useCallback(() => gameRef.current.pgn({ maxWidth: 80, newline: '\n' }), []);

  return {
    game: gameRef,
    snap,
    displayFen,
    displayLastMove,
    isBrowsing,
    viewPly,
    setViewPly,
    clocks,
    setClocks,
    clockActive,
    setClockActive,
    hasClock,
    timeControl: tc,
    timedOutColor,
    result,
    setResult,
    applyMove,
    loadMoves,
    reset,
    legalTargets,
    material,
    uciMoves,
    pgn,
  };
}

export type ChessGameApi = ReturnType<typeof useChessGame>;
