/** אותיות ללא תווים דו־משמעיים (0/O, 1/I) כדי שקוד חדר יהיה קל להכתבה בטלפון */
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRoomCode(len = 6): string {
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  return out;
}

export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => ROOM_ALPHABET.includes(c))
    .join('')
    .slice(0, 6);
}

export function formatClock(ms: number): string {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (safe < 20000) {
    const tenths = Math.floor((safe % 1000) / 100);
    return `${m}:${String(s).padStart(2, '0')}.${tenths}`;
  }
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const FIGURINES: Record<string, string> = {
  K: '♚',
  Q: '♛',
  R: '♜',
  B: '♝',
  N: '♞',
};

/** ממיר SAN לסימון פיגורין (♞f3) — ניטרלי לשפה ונעים לעין */
export function toFigurine(san: string): string {
  if (!san) return san;
  const first = san[0];
  if (FIGURINES[first]) return FIGURINES[first] + san.slice(1);
  return san;
}

/** ממיר SAN לתיאור מילולי בעברית — משמש לקוראי מסך ולטולטיפים */
const HEB_PIECE: Record<string, string> = {
  k: 'מלך',
  q: 'מלכה',
  r: 'צריח',
  b: 'רץ',
  n: 'פרש',
  p: 'רגלי',
};

export function describeMoveHe(move: {
  piece: string;
  from: string;
  to: string;
  captured?: string;
  san: string;
}): string {
  if (move.san === 'O-O') return 'הצרחה קטנה';
  if (move.san === 'O-O-O') return 'הצרחה גדולה';
  const base = `${HEB_PIECE[move.piece] ?? ''} מ־${move.from} ל־${move.to}`;
  return move.captured ? `${base} (הכאה)` : base;
}

export const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export type TimeControl = {
  id: string;
  label: string;
  sub: string;
  initialMs: number;
  incrementMs: number;
  icon: string;
};

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'bullet1', label: 'בזק', sub: '1 + 0', initialMs: 60_000, incrementMs: 0, icon: '⚡' },
  { id: 'blitz3', label: 'בליץ', sub: '3 + 2', initialMs: 180_000, incrementMs: 2_000, icon: '🔥' },
  { id: 'blitz5', label: 'בליץ', sub: '5 + 0', initialMs: 300_000, incrementMs: 0, icon: '🔥' },
  { id: 'rapid10', label: 'רפיד', sub: '10 + 0', initialMs: 600_000, incrementMs: 0, icon: '⏱' },
  { id: 'rapid15', label: 'רפיד', sub: '15 + 10', initialMs: 900_000, incrementMs: 10_000, icon: '⏱' },
  { id: 'classic30', label: 'קלאסי', sub: '30 + 0', initialMs: 1_800_000, incrementMs: 0, icon: '♟' },
  { id: 'unlimited', label: 'ללא הגבלה', sub: 'בלי שעון', initialMs: 0, incrementMs: 0, icon: '∞' },
];

export function getTimeControl(id: string): TimeControl {
  return TIME_CONTROLS.find((t) => t.id === id) ?? TIME_CONTROLS[3];
}

export const DIFFICULTIES = [
  { id: 1, label: 'מתחיל', elo: '~800', skill: 0, movetime: 150, depth: 1 },
  { id: 2, label: 'חובב', elo: '~1100', skill: 3, movetime: 250, depth: 3 },
  { id: 3, label: 'מתקדם', elo: '~1400', skill: 7, movetime: 400, depth: 6 },
  { id: 4, label: 'מנוסה', elo: '~1700', skill: 11, movetime: 700, depth: 9 },
  { id: 5, label: 'חזק', elo: '~2000', skill: 15, movetime: 1000, depth: 12 },
  { id: 6, label: 'אמן', elo: '~2300', skill: 18, movetime: 1500, depth: 15 },
  { id: 7, label: 'רב־אמן', elo: '2600+', skill: 20, movetime: 2500, depth: 18 },
];

export function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

const NAMES = [
  'קסבלנקה',
  'טאל',
  'קרפוב',
  'פישר',
  'לסקר',
  'אליוחין',
  'פולגר',
  'ספאסקי',
  'בוטבינק',
  'מורפי',
];

export function randomGuestName(): string {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

export function loadName(): string {
  try {
    const v = localStorage.getItem('shm:name');
    if (v) return v;
  } catch {
    /* ignore */
  }
  return '';
}

export function saveName(name: string) {
  try {
    localStorage.setItem('shm:name', name);
  } catch {
    /* ignore */
  }
}
