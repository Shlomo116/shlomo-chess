import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board } from './components/Board';
import { Chat } from './components/Chat';
import type { ChatMessage } from './components/Chat';
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconExit,
  IconFlag,
  IconFlip,
  IconHandshake,
  IconLink,
  IconRestart,
  IconSoundOff,
  IconSoundOn,
} from './components/Icons';
import { Lobby, Modal } from './components/Lobby';
import type { ComputerConfig, JoinConfig, LocalConfig, OnlineConfig } from './components/Lobby';
import { MoveList } from './components/MoveList';
import { PlayerBar } from './components/PlayerBar';
import { Toasts, useToasts } from './components/Toasts';
import { ChessEngine } from './lib/engine';
import { NetSession } from './lib/net';
import type { NetMessage, NetStatus } from './lib/net';
import { isSoundEnabled, setSoundEnabled, sfx } from './lib/sound';
import { useChessGame } from './lib/useChessGame';
import type { Color, GameResult } from './lib/useChessGame';
import { classNames, DIFFICULTIES, getTimeControl, makeRoomCode } from './lib/utils';

type Mode = 'online' | 'computer' | 'local';
type Screen = 'lobby' | 'game';

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
const resolveColor = (c: 'w' | 'b' | 'random'): Color =>
  c === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : c;

export default function App() {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [mode, setMode] = useState<Mode>('local');
  const [timeControlId, setTimeControlId] = useState('rapid10');
  const [myColor, setMyColor] = useState<Color>('w');
  const [myName, setMyName] = useState('אתם');
  const [opponentName, setOpponentName] = useState('היריב');
  const [difficulty, setDifficulty] = useState(3);
  const [roomCode, setRoomCode] = useState('');
  const [netStatus, setNetStatus] = useState<NetStatus>('idle');
  const [latency, setLatency] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [waitingOpen, setWaitingOpen] = useState(false);
  const [flip, setFlip] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [tab, setTab] = useState<'moves' | 'chat'>('moves');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [engineThinking, setEngineThinking] = useState(false);
  const [initialJoinCode, setInitialJoinCode] = useState<string | null>(null);

  const { toasts, push, dismiss } = useToasts();
  const netRef = useRef<NetSession | null>(null);
  const engineRef = useRef<ChessEngine | null>(null);
  const messageHandlerRef = useRef<(m: NetMessage) => void>(() => {});

  const onResult = useCallback(
    (r: GameResult) => {
      window.setTimeout(() => {
        if (r.winner === null) sfx.draw();
        else if (mode === 'local') sfx.win();
        else if (r.winner === myColor) sfx.win();
        else sfx.lose();
      }, 320);
    },
    [mode, myColor],
  );

  const game = useChessGame({ timeControlId, onResult });
  const {
    snap,
    displayFen,
    displayLastMove,
    isBrowsing,
    viewPly,
    setViewPly,
    clocks,
    hasClock,
    timeControl,
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
  } = game;

  /* ------------------------------------------------ קוד חדר מהכתובת */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) setInitialJoinCode(room);
  }, []);

  /* ------------------------------------------------------- שחרור אודיו */
  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  /* -------------------------------------------------------------- ניקוי */
  useEffect(
    () => () => {
      netRef.current?.destroy();
      engineRef.current?.destroy();
    },
    [],
  );

  const connected = netStatus === 'connected';
  const isOnline = mode === 'online';

  /* --------------------------------------------------- הודעות מערכת בצ׳אט */
  const pushSystem = useCallback((text: string) => {
    setChat((prev) => [...prev, { id: `s${Date.now()}${Math.random()}`, from: 'sys', text, ts: Date.now() }]);
  }, []);

  /* ================================================================ רשת */
  const ensureNet = useCallback(() => {
    if (netRef.current) return netRef.current;
    const session = new NetSession({
      onStatus: (s, detail) => {
        setNetStatus(s);
        if (s === 'connected') sfx.connect();
        if (s === 'waiting' && screenRef.current === 'game') {
          sfx.disconnect();
          push({ text: 'היריב התנתק. הקישור נשמר — הוא יכול לחזור עם אותו קוד.', tone: 'bad', timeout: 6000 });
          pushSystem('היריב התנתק');
        }
        if (s === 'closed' && screenRef.current === 'game') {
          sfx.disconnect();
          push({ text: 'החיבור נסגר. מנסה להתחבר מחדש…', tone: 'bad', timeout: 6000 });
        }
        if (s === 'error' && detail) push({ text: `שגיאת רשת: ${detail}`, tone: 'bad' });
      },
      onMessage: (m) => messageHandlerRef.current(m),
      onLatency: (ms) => setLatency(ms),
    });
    netRef.current = session;
    return session;
  }, [push, pushSystem]);

  const screenRef = useRef(screen);
  screenRef.current = screen;

  const send = useCallback((m: NetMessage) => netRef.current?.send(m) ?? false, []);

  /* ------------------------------------------------- טיפול בהודעות נכנסות */
  useEffect(() => {
    messageHandlerRef.current = (msg: NetMessage) => {
      switch (msg.t) {
        case 'hello': {
          // אורח מקבל את הגדרות המשחק מהמארח
          setTimeControlId(msg.timeControlId);
          setMyColor(msg.guestColor);
          setOpponentName(msg.name || 'היריב');
          setChat([]);
          reset();
          setScreen('game');
          setWaitingOpen(false);
          setBusy(false);
          send({ t: 'ready', name: myNameRef.current });
          push({ text: `מחוברים! משחקים מול ${msg.name || 'היריב'}`, tone: 'good' });
          break;
        }
        case 'ready': {
          setOpponentName(msg.name || 'היריב');
          setWaitingOpen(false);
          setScreen('game');
          push({ text: `${msg.name || 'היריב'} הצטרף למשחק`, tone: 'good' });
          break;
        }
        case 'move': {
          // מקבלים רק מהלך של היריב, בתורו
          if (snapRef.current.turn === myColorRef.current) break;
          applyMove({ from: msg.from, to: msg.to, promotion: msg.promotion }, { clocks: msg.clocks });
          break;
        }
        case 'chat': {
          setChat((prev) => [...prev, { id: `t${msg.ts}${Math.random()}`, from: 'them', text: msg.text, ts: msg.ts }]);
          if (tabRef.current !== 'chat') {
            setUnread((u) => u + 1);
            sfx.notify();
          }
          break;
        }
        case 'resign': {
          setResult({
            winner: myColorRef.current,
            reason: 'resign',
            titleHe: 'ניצחתם',
            subtitleHe: 'היריב פרש מהמשחק',
          });
          break;
        }
        case 'draw-offer': {
          push({
            text: 'היריב מציע תיקו',
            tone: 'gold',
            timeout: 0,
            actions: [
              {
                label: 'מקבלים',
                primary: true,
                onClick: () => {
                  send({ t: 'draw-accept' });
                  setResult({ winner: null, reason: 'agreement', titleHe: 'תיקו', subtitleHe: 'בהסכמת השחקנים' });
                },
              },
              { label: 'לא', onClick: () => send({ t: 'draw-decline' }) },
            ],
          });
          break;
        }
        case 'draw-accept': {
          setResult({ winner: null, reason: 'agreement', titleHe: 'תיקו', subtitleHe: 'בהסכמת השחקנים' });
          break;
        }
        case 'draw-decline': {
          push({ text: 'היריב דחה את הצעת התיקו', timeout: 3200 });
          break;
        }
        case 'flag': {
          const winner = other(msg.loser);
          setResult({
            winner,
            reason: 'timeout',
            titleHe: winner === myColorRef.current ? 'ניצחתם' : 'הפסדתם',
            subtitleHe: 'נגמר הזמן',
          });
          break;
        }
        case 'rematch-offer': {
          push({
            text: 'היריב מציע משחק חוזר',
            tone: 'gold',
            timeout: 0,
            actions: [
              {
                label: 'קדימה',
                primary: true,
                onClick: () => {
                  send({ t: 'rematch-accept', guestColor: 'w', clocks: { w: 0, b: 0 } });
                  doRematch();
                },
              },
              { label: 'לא עכשיו', onClick: () => undefined },
            ],
          });
          break;
        }
        case 'rematch-accept': {
          doRematch();
          break;
        }
        case 'sync-request': {
          send({
            t: 'sync',
            fen: snapRef.current.fen,
            moves: snapRef.current.history.map((m) => `${m.from}${m.to}${m.promotion ?? ''}`),
            clocks: clocksRef.current,
            guestColor: other(myColorRef.current),
            timeControlId: tcIdRef.current,
          });
          break;
        }
        case 'sync': {
          setTimeControlId(msg.timeControlId);
          setMyColor(msg.guestColor);
          loadMoves(msg.moves, msg.clocks);
          push({ text: 'סונכרן מחדש עם היריב', tone: 'good' });
          break;
        }
        default:
          break;
      }
    };
  });

  const myNameRef = useRef(myName);
  myNameRef.current = myName;
  const myColorRef = useRef(myColor);
  myColorRef.current = myColor;
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const clocksRef = useRef(clocks);
  clocksRef.current = clocks;
  const tcIdRef = useRef(timeControlId);
  tcIdRef.current = timeControlId;

  const doRematch = useCallback(() => {
    setMyColor((c) => other(c));
    reset();
    setSelected(null);
    setViewPly(null);
    pushSystem('משחק חדש התחיל — הצבעים התחלפו');
    push({ text: 'משחק חוזר! הצבעים התחלפו', tone: 'good' });
  }, [push, pushSystem, reset, setViewPly]);

  /* ===================================================== התחלת משחקים */
  const startOnlineHost = useCallback(
    async (cfg: OnlineConfig) => {
      setBusy(true);
      setMode('online');
      setMyName(cfg.name);
      setTimeControlId(cfg.timeControlId);
      const hostColor = resolveColor(cfg.color);
      setMyColor(hostColor);
      setChat([]);
      reset();

      const session = ensureNet();
      let code = makeRoomCode();
      let attempts = 0;
      // ניסיון נוסף אם הקוד תפוס
      for (;;) {
        try {
          await session.host(code);
          break;
        } catch (err) {
          const msg = (err as Error).message;
          if (msg === 'room-taken' && attempts < 4) {
            attempts++;
            code = makeRoomCode();
            continue;
          }
          setBusy(false);
          push({ text: 'לא הצלחנו לפתוח חדר. בדקו את החיבור לאינטרנט ונסו שוב.', tone: 'bad', timeout: 6000 });
          return;
        }
      }
      setRoomCode(code);
      setBusy(false);
      setWaitingOpen(true);
      hostGreetedRef.current = false;
      hostCfgRef.current = { name: cfg.name, guestColor: other(hostColor), timeControlId: cfg.timeControlId };
    },
    [ensureNet, push, reset],
  );

  /** המארח שולח את הגדרות המשחק ברגע שאורח מתחבר — וגם אחרי חיבור מחדש */
  const hostGreetedRef = useRef(false);
  const hostCfgRef = useRef<{ name: string; guestColor: Color; timeControlId: string } | null>(null);

  useEffect(() => {
    if (mode !== 'online') return;
    const id = window.setInterval(() => {
      const session = netRef.current;
      if (!session) return;

      if (session.role === 'host') {
        const cfg = hostCfgRef.current;
        if (!cfg) return;
        if (session.isConnected && !hostGreetedRef.current) {
          hostGreetedRef.current = true;
          if (snapRef.current.history.length > 0) {
            // האורח חזר באמצע משחק — שולחים מצב מלא
            session.send({
              t: 'sync',
              fen: snapRef.current.fen,
              moves: snapRef.current.history.map((m) => `${m.from}${m.to}${m.promotion ?? ''}`),
              clocks: clocksRef.current,
              guestColor: other(myColorRef.current),
              timeControlId: tcIdRef.current,
            });
            setWaitingOpen(false);
            setScreen('game');
          } else {
            session.send({
              t: 'hello',
              name: cfg.name,
              guestColor: cfg.guestColor,
              timeControlId: cfg.timeControlId,
              fen: new Chess().fen(),
              clocks: {
                w: getTimeControl(cfg.timeControlId).initialMs,
                b: getTimeControl(cfg.timeControlId).initialMs,
              },
            });
          }
        }
        if (!session.isConnected) hostGreetedRef.current = false;
      } else if (session.role === 'guest' && !session.isConnected && screenRef.current === 'game') {
        session.retryJoin();
      }
    }, 1200);
    return () => window.clearInterval(id);
  }, [mode]);

  const startOnlineJoin = useCallback(
    async (cfg: JoinConfig) => {
      setBusy(true);
      setMode('online');
      setMyName(cfg.name);
      setRoomCode(cfg.code);
      setChat([]);
      const session = ensureNet();
      try {
        await session.join(cfg.code);
        // ההגדרות מגיעות בהודעת hello מהמארח
      } catch (err) {
        setBusy(false);
        const msg = (err as Error).message;
        push({
          text:
            msg === 'no-room'
              ? 'לא נמצא חדר עם הקוד הזה. ודאו שהחבר עדיין ממתין ושהקוד הוקלד נכון.'
              : 'ההתחברות נכשלה. נסו שוב.',
          tone: 'bad',
          timeout: 6500,
        });
        netRef.current?.destroy();
        netRef.current = null;
      }
    },
    [ensureNet, push],
  );

  const startComputer = useCallback(
    async (cfg: ComputerConfig) => {
      setMode('computer');
      setTimeControlId(cfg.timeControlId);
      setDifficulty(cfg.difficulty);
      const c = resolveColor(cfg.color);
      setMyColor(c);
      setMyName('אתם');
      const d = DIFFICULTIES.find((x) => x.id === cfg.difficulty)!;
      setOpponentName(`Stockfish · ${d.label}`);
      setChat([]);
      reset();
      setScreen('game');
      if (!engineRef.current) {
        engineRef.current = new ChessEngine();
        await engineRef.current.init();
      }
      engineRef.current.newGame();
    },
    [reset],
  );

  const startLocal = useCallback(
    (cfg: LocalConfig) => {
      setMode('local');
      setTimeControlId(cfg.timeControlId);
      setMyColor('w');
      setMyName('לבן');
      setOpponentName('שחור');
      setChat([]);
      reset();
      setScreen('game');
    },
    [reset],
  );

  /* ================================================== לוגיקת מהלך מקומי */
  const canInteract =
    !result &&
    !isBrowsing &&
    (mode === 'local' || snap.turn === myColor) &&
    (!isOnline || connected) &&
    !(mode === 'computer' && engineThinking);

  const targets = useMemo(() => {
    if (!selected || !canInteract) return [];
    return legalTargets(selected).map((m) => ({ to: m.to, captured: m.captured }));
  }, [selected, canInteract, legalTargets]);

  const commitMove = useCallback(
    (from: string, to: string, promo?: string): boolean => {
      const made = applyMove({ from, to, promotion: promo });
      if (!made) return false;
      setSelected(null);
      if (isOnline) {
        // השעונים כבר עודכנו בסטייט; שולחים את הערכים העדכניים
        const tc = getTimeControl(tcIdRef.current);
        const mover = made.color as Color;
        const nextClocks = tc.initialMs
          ? { ...clocksRef.current, [mover]: clocksRef.current[mover] + tc.incrementMs }
          : clocksRef.current;
        send({
          t: 'move',
          from,
          to,
          promotion: made.promotion,
          clocks: nextClocks,
          ply: snapRef.current.history.length + 1,
        });
      }
      return true;
    },
    [applyMove, isOnline, send],
  );

  const tryMove = useCallback(
    (from: string, to: string): boolean => {
      if (!canInteract) return false;
      const moves = legalTargets(from).filter((m) => m.to === to);
      if (moves.length === 0) return false;
      if (moves.some((m) => m.promotion)) {
        setPromotion({ from, to });
        setSelected(null);
        return true;
      }
      return commitMove(from, to);
    },
    [canInteract, commitMove, legalTargets],
  );

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!canInteract) return;
      if (selected && selected !== square) {
        if (tryMove(selected, square)) return;
      }
      const piece = game.game.current.get(square as never);
      if (piece && piece.color === (mode === 'local' ? snap.turn : myColor)) {
        setSelected(square === selected ? null : square);
      } else {
        setSelected(null);
      }
    },
    [canInteract, selected, tryMove, game.game, mode, snap.turn, myColor],
  );

  const canDragPiece = useCallback(
    (_square: string, pieceType: string) => {
      const color: Color = pieceType[0] === 'w' ? 'w' : 'b';
      if (mode === 'local') return color === snap.turn;
      return color === myColor && snap.turn === myColor;
    },
    [mode, myColor, snap.turn],
  );

  /* ======================================================= מנוע המחשב */
  useEffect(() => {
    if (mode !== 'computer' || result || screen !== 'game') return;
    if (snap.turn === myColor) return;
    const engine = engineRef.current;
    if (!engine) return;
    const d = DIFFICULTIES.find((x) => x.id === difficulty)!;
    setEngineThinking(true);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      engine.think(uciMoves, { movetime: d.movetime, depth: d.depth, skill: d.skill }, (mv) => {
        if (cancelled) return;
        setEngineThinking(false);
        applyMove(mv);
      });
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(timer);
      setEngineThinking(false);
    };
  }, [mode, result, screen, snap.turn, myColor, difficulty, uciMoves, applyMove]);

  /* ==================================================== סיום על הזמן */
  useEffect(() => {
    if (!timedOutColor || result) return;
    const winner = other(timedOutColor);
    setResult({
      winner,
      reason: 'timeout',
      titleHe: mode === 'local' ? 'נגמר הזמן' : winner === myColor ? 'ניצחתם' : 'הפסדתם',
      subtitleHe: `${timedOutColor === 'w' ? 'ללבן' : 'לשחור'} נגמר הזמן`,
    });
    if (isOnline) send({ t: 'flag', loser: timedOutColor });
  }, [timedOutColor, result, setResult, mode, myColor, isOnline, send]);

  /* ========================================== ניווט במקלדת בין מהלכים */
  useEffect(() => {
    if (screen !== 'game') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const total = snapRef.current.history.length;
      const current = viewPly ?? total;
      // בעברית: חץ ימינה = אחורה
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setViewPly(Math.max(0, current - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const nxt = current + 1;
        setViewPly(nxt >= total ? null : nxt);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setViewPly(0);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setViewPly(null);
      } else if (e.key === 'f' || e.key === 'F') {
        setFlip((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, viewPly, setViewPly]);

  /* ============================================================ פעולות */
  const shareLink = useMemo(
    () => `${window.location.origin}${window.location.pathname}?room=${roomCode}`,
    [roomCode],
  );

  const copy = useCallback(
    async (text: string, what: 'code' | 'link') => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
    },
    [],
  );

  const doResign = useCallback(() => {
    if (result) return;
    if (isOnline) {
      send({ t: 'resign' });
      setResult({ winner: other(myColor), reason: 'resign', titleHe: 'פרשתם', subtitleHe: 'היריב מנצח' });
    } else if (mode === 'computer') {
      setResult({ winner: other(myColor), reason: 'resign', titleHe: 'פרשתם', subtitleHe: 'המחשב מנצח' });
    } else {
      setResult({
        winner: other(snap.turn),
        reason: 'resign',
        titleHe: 'פרישה',
        subtitleHe: `${snap.turn === 'w' ? 'הלבן' : 'השחור'} פרש`,
      });
    }
  }, [result, isOnline, send, setResult, myColor, mode, snap.turn]);

  const offerDraw = useCallback(() => {
    if (isOnline) {
      send({ t: 'draw-offer' });
      push({ text: 'הצעת התיקו נשלחה', timeout: 2800 });
    } else {
      setResult({ winner: null, reason: 'agreement', titleHe: 'תיקו', subtitleHe: 'בהסכמה' });
    }
  }, [isOnline, push, send, setResult]);

  const requestRematch = useCallback(() => {
    if (isOnline) {
      send({ t: 'rematch-offer' });
      push({ text: 'הצעת המשחק החוזר נשלחה', timeout: 2800 });
    } else {
      setMyColor((c) => (mode === 'computer' ? other(c) : c));
      reset();
      setSelected(null);
      if (mode === 'computer') engineRef.current?.newGame();
    }
  }, [isOnline, mode, push, reset, send]);

  const downloadPgn = useCallback(() => {
    const header = [
      '[Event "שח־מט"]',
      `[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, '.')}"]`,
      `[White "${myColor === 'w' ? myName : opponentName}"]`,
      `[Black "${myColor === 'b' ? myName : opponentName}"]`,
      `[Result "${result ? (result.winner === 'w' ? '1-0' : result.winner === 'b' ? '0-1' : '1/2-1/2') : '*'}"]`,
      '',
    ].join('\n');
    const blob = new Blob([header + pgn() + '\n'], { type: 'application/x-chess-pgn;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shachmat-${new Date().toISOString().slice(0, 10)}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }, [myColor, myName, opponentName, pgn, result]);

  const exitToLobby = useCallback(() => {
    netRef.current?.destroy();
    netRef.current = null;
    engineRef.current?.stop();
    setNetStatus('idle');
    setScreen('lobby');
    setWaitingOpen(false);
    setRoomCode('');
    setSelected(null);
    setChat([]);
    reset();
    if (window.location.search) window.history.replaceState({}, '', window.location.pathname);
    setInitialJoinCode(null);
  }, [reset]);

  const sendChat = useCallback(
    (text: string) => {
      const ts = Date.now();
      setChat((prev) => [...prev, { id: `m${ts}`, from: 'me', text, ts }]);
      if (isOnline) send({ t: 'chat', text, ts });
    },
    [isOnline, send],
  );

  /* ========================================================= תצוגה */
  const baseColor: Color = mode === 'local' ? snap.turn : myColor;
  const shownColor: Color = flip ? other(baseColor) : baseColor;
  const orientation = shownColor === 'w' ? 'white' : 'black';

  const topColor = other(shownColor);
  const bottomColor = shownColor;

  const nameFor = (c: Color) => {
    if (mode === 'local') return c === 'w' ? 'לבן' : 'שחור';
    return c === myColor ? myName || 'אתם' : opponentName;
  };
  const onlineFor = (c: Color) => (isOnline && c !== myColor ? connected : null);

  const modeLabel =
    mode === 'online' ? `חדר ${roomCode}` : mode === 'computer' ? opponentName : 'שני שחקנים';

  return (
    <>
      <div className="ambience">
        <div className="orb a" />
        <div className="orb b" />
      </div>

      <div className="app">
        <header className="topbar">
          <button className="brand" onClick={() => (screen === 'lobby' ? undefined : exitToLobby())}>
            <span className="mark">♞</span>
            <span style={{ textAlign: 'start' }}>
              <span className="name gold-text" style={{ display: 'block' }}>
                שח־מט
              </span>
              <span className="tag">CHESS ROYALE</span>
            </span>
          </button>

          <div className="topbar-actions">
            {screen === 'game' && (
              <span className={classNames('chip', isOnline ? (connected ? 'live' : 'warn') : '')}>
                <span className="dot" />
                {modeLabel}
                {isOnline && connected && latency !== null && (
                  <span className="muted" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {latency}ms
                  </span>
                )}
              </span>
            )}
            <button
              className={classNames('icon-btn', soundOn && 'on')}
              onClick={() => {
                const v = !soundOn;
                setSoundOn(v);
                setSoundEnabled(v);
                if (v) sfx.notify();
              }}
              title={soundOn ? 'כיבוי צלילים' : 'הפעלת צלילים'}
              aria-label="צלילים"
            >
              {soundOn ? <IconSoundOn /> : <IconSoundOff />}
            </button>
            {screen === 'game' && (
              <>
                <button
                  className="icon-btn"
                  onClick={() => setFlip((v) => !v)}
                  title="סיבוב הלוח (F)"
                  aria-label="סיבוב הלוח"
                >
                  <IconFlip />
                </button>
                <button className="icon-btn" onClick={exitToLobby} title="יציאה" aria-label="יציאה">
                  <IconExit />
                </button>
              </>
            )}
          </div>
        </header>

        {screen === 'lobby' ? (
          <>
            <Lobby
              initialJoinCode={initialJoinCode}
              busy={busy}
              suppressDialogs={waitingOpen}
              onCreateRoom={startOnlineHost}
              onJoinRoom={startOnlineJoin}
              onStartComputer={startComputer}
              onStartLocal={startLocal}
            />
            <footer className="footer">
              נבנה עם ♥ · החיבור בין השחקנים מתבצע ישירות (WebRTC) · כלי הלוח באדיבות{' '}
              <a href="https://github.com/Clariity/react-chessboard" target="_blank" rel="noreferrer">
                react-chessboard
              </a>{' '}
              · מנוע{' '}
              <a href="https://stockfishchess.org" target="_blank" rel="noreferrer">
                Stockfish
              </a>
            </footer>
          </>
        ) : (
          <main className="game">
            {/* -------------------------------------------------- טור צדדי */}
            <aside className="left-rail">
              <div className="glass panel">
                <h4>פרטי המשחק</h4>
                <div className="info-row">
                  <span className="k">סוג</span>
                  <span className="v">
                    {mode === 'online' ? 'מול חבר · מקוון' : mode === 'computer' ? 'מול המחשב' : 'שני שחקנים'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="k">בקרת זמן</span>
                  <span className="v">
                    {timeControl.label} {hasClock ? `· ${timeControl.sub}` : ''}
                  </span>
                </div>
                {mode === 'computer' && (
                  <div className="info-row">
                    <span className="k">רמה</span>
                    <span className="v">
                      {DIFFICULTIES.find((d) => d.id === difficulty)?.label} ·{' '}
                      {DIFFICULTIES.find((d) => d.id === difficulty)?.elo}
                    </span>
                  </div>
                )}
                <div className="info-row">
                  <span className="k">מהלכים</span>
                  <span className="v">{Math.ceil(snap.history.length / 2)}</span>
                </div>

                {mode === 'online' && (
                  <>
                    <div className="section-label" style={{ marginTop: 18 }}>
                      קוד החדר
                    </div>
                    <div className="code-pill">{roomCode}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="btn sm" style={{ flex: 1 }} onClick={() => copy(roomCode, 'code')}>
                        {copied === 'code' ? <IconCheck /> : <IconCopy />}
                        {copied === 'code' ? 'הועתק' : 'העתקת קוד'}
                      </button>
                      <button className="btn sm" style={{ flex: 1 }} onClick={() => copy(shareLink, 'link')}>
                        {copied === 'link' ? <IconCheck /> : <IconLink />}
                        {copied === 'link' ? 'הועתק' : 'קישור'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="glass panel">
                <h4>פעולות</h4>
                <div style={{ display: 'grid', gap: 8 }}>
                  <button className="btn sm" onClick={offerDraw} disabled={!!result}>
                    <IconHandshake /> הצעת תיקו
                  </button>
                  <button className="btn sm danger" onClick={doResign} disabled={!!result}>
                    <IconFlag /> פרישה
                  </button>
                  <button className="btn sm" onClick={requestRematch}>
                    <IconRestart /> משחק חוזר
                  </button>
                  <button className="btn sm" onClick={downloadPgn} disabled={snap.history.length === 0}>
                    <IconDownload /> הורדת PGN
                  </button>
                </div>
              </div>
            </aside>

            {/* ---------------------------------------------------- הלוח */}
            <section className="board-col">
              <PlayerBar
                color={topColor}
                name={nameFor(topColor)}
                online={onlineFor(topColor)}
                isTurn={snap.turn === topColor && !result}
                clockMs={hasClock ? clocks[topColor] : null}
                captured={topColor === 'w' ? material.capturedByWhite : material.capturedByBlack}
                advantage={material.advantage}
                subtitle={mode === 'computer' && topColor !== myColor && engineThinking ? 'חושב…' : undefined}
              />

              <div className={classNames('board-shell', isBrowsing && 'board-browsing')}>
                <div className="board-frame">
                  <div className="board-inner">
                    <Board
                      fen={displayFen}
                      orientation={orientation}
                      selected={selected}
                      targets={targets}
                      lastMove={displayLastMove}
                      checkSquare={viewPly === null ? snap.checkSquare : null}
                      allowDragging={canInteract}
                      canDragPiece={canDragPiece}
                      onSquareClick={handleSquareClick}
                      onDrop={tryMove}
                    />
                  </div>
                </div>

                {isBrowsing && (
                  <div className="browsing-banner">
                    <span onClick={() => setViewPly(null)}>צופים בעמדה קודמת · לחצו לחזרה</span>
                  </div>
                )}

                {result && (
                  <div className="result-overlay">
                    <div className="result-card">
                      <div className="crest">
                        {result.winner === null
                          ? '🤝'
                          : mode === 'local'
                            ? result.winner === 'w'
                              ? '♔'
                              : '♚'
                            : result.winner === myColor
                              ? '👑'
                              : '🏳️'}
                      </div>
                      <h2 className="gold-text">{result.titleHe}</h2>
                      <p>{result.subtitleHe}</p>
                      <div className="result-actions">
                        <button className="btn primary" onClick={requestRematch}>
                          <IconRestart /> משחק חוזר
                        </button>
                        <button className="btn" onClick={downloadPgn}>
                          <IconDownload /> PGN
                        </button>
                        <button className="btn" onClick={exitToLobby}>
                          חזרה ללובי
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <PlayerBar
                color={bottomColor}
                name={nameFor(bottomColor)}
                online={onlineFor(bottomColor)}
                isTurn={snap.turn === bottomColor && !result}
                clockMs={hasClock ? clocks[bottomColor] : null}
                captured={bottomColor === 'w' ? material.capturedByWhite : material.capturedByBlack}
                advantage={material.advantage}
                subtitle={mode === 'computer' && bottomColor !== myColor && engineThinking ? 'חושב…' : undefined}
              />
            </section>

            {/* --------------------------------------------------- פאנל ימני */}
            <aside className="right-rail">
              <div className="glass panel">
                <div className="side-tabs">
                  <button className={classNames(tab === 'moves' && 'active')} onClick={() => setTab('moves')}>
                    מהלכים
                  </button>
                  <button
                    className={classNames(tab === 'chat' && 'active')}
                    onClick={() => {
                      setTab('chat');
                      setUnread(0);
                    }}
                  >
                    צ׳אט
                    {unread > 0 && <span className="badge" />}
                  </button>
                </div>

                {tab === 'moves' ? (
                  <MoveList history={snap.history} viewPly={viewPly} onSelectPly={setViewPly} />
                ) : (
                  <Chat
                    messages={chat}
                    canSend={isOnline ? connected : false}
                    placeholder={
                      isOnline ? 'ממתינים שהיריב יתחבר…' : 'הצ׳אט זמין רק במשחק מקוון מול חבר.'
                    }
                    onSend={sendChat}
                  />
                )}
              </div>
            </aside>
          </main>
        )}
      </div>

      {/* ------------------------------------------------- דיאלוג המתנה */}
      {waitingOpen && (
        <Modal
          title="החדר מוכן"
          sub="שלחו לחבר את הקוד או את הקישור — ברגע שהוא ייכנס, המשחק מתחיל."
          onClose={() => {
            setWaitingOpen(false);
            exitToLobby();
          }}
        >
          <div className="waiting-orbit">
            <div className="ring" />
            <div className="ring two" />
            <div className="center">♞</div>
          </div>

          <div className="room-code">
            {roomCode.split('').map((c, i) => (
              <span className="ch" key={i}>
                {c}
              </span>
            ))}
          </div>

          <p className="muted" style={{ textAlign: 'center', fontSize: 13.5, margin: '14px 0 20px' }}>
            ממתינים ליריב… הקוד תקף כל עוד החלון פתוח.
          </p>

          <div style={{ display: 'flex', gap: 9 }}>
            <button className="btn" style={{ flex: 1 }} onClick={() => copy(roomCode, 'code')}>
              {copied === 'code' ? <IconCheck /> : <IconCopy />}
              {copied === 'code' ? 'הועתק!' : 'העתקת הקוד'}
            </button>
            <button className="btn primary" style={{ flex: 1 }} onClick={() => copy(shareLink, 'link')}>
              {copied === 'link' ? <IconCheck /> : <IconLink />}
              {copied === 'link' ? 'הועתק!' : 'העתקת קישור'}
            </button>
          </div>

          <div
            style={{
              marginTop: 18,
              padding: '12px 14px',
              borderRadius: 14,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border)',
              fontSize: 13,
              color: 'var(--muted)',
              lineHeight: 1.7,
            }}
          >
            הצבע שלכם: <strong style={{ color: 'var(--text)' }}>{myColor === 'w' ? 'לבן' : 'שחור'}</strong> · בקרת זמן:{' '}
            <strong style={{ color: 'var(--text)' }}>
              {timeControl.label} {timeControl.sub}
            </strong>
          </div>
        </Modal>
      )}

      {/* ---------------------------------------------- דיאלוג הקדמת רגלי */}
      {promotion && (
        <Modal title="הקדמת רגלי" sub="לאיזה כלי להפוך את הרגלי?" closable={false}>
          <div className="promo">
            {(['q', 'r', 'b', 'n'] as const).map((p) => (
              <button
                key={p}
                onClick={() => {
                  const { from, to } = promotion;
                  setPromotion(null);
                  commitMove(from, to, p);
                }}
                aria-label={p}
              >
                <span style={{ fontSize: 42, lineHeight: 1, color: myColor === 'w' ? '#f5f2ec' : '#c9cedb' }}>
                  {{ q: '♛', r: '♜', b: '♝', n: '♞' }[p]}
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      <Toasts toasts={toasts} dismiss={dismiss} />
    </>
  );
}
