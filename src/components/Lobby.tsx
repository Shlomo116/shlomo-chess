import { useEffect, useState } from 'react';
import {
  classNames,
  DIFFICULTIES,
  loadName,
  normalizeRoomCode,
  randomGuestName,
  saveName,
  TIME_CONTROLS,
} from '../lib/utils';
import { IconArrow, IconBoard, IconClose, IconCpu, IconUsers } from './Icons';

export type OnlineConfig = { name: string; color: 'w' | 'b' | 'random'; timeControlId: string };
export type JoinConfig = { name: string; code: string };
export type ComputerConfig = { difficulty: number; color: 'w' | 'b' | 'random'; timeControlId: string };
export type LocalConfig = { timeControlId: string };

type Props = {
  initialJoinCode?: string | null;
  busy?: boolean;
  onCreateRoom: (c: OnlineConfig) => void;
  onJoinRoom: (c: JoinConfig) => void;
  onStartComputer: (c: ComputerConfig) => void;
  onStartLocal: (c: LocalConfig) => void;
};

type Dialog = null | 'online' | 'computer' | 'local';

export function Lobby({ initialJoinCode, busy, onCreateRoom, onJoinRoom, onStartComputer, onStartLocal }: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [onlineTab, setOnlineTab] = useState<'create' | 'join'>('create');

  const [name, setName] = useState(() => loadName() || randomGuestName());
  const [color, setColor] = useState<'w' | 'b' | 'random'>('random');
  const [tcId, setTcId] = useState('rapid10');
  const [code, setCode] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [engineColor, setEngineColor] = useState<'w' | 'b' | 'random'>('w');
  const [engineTc, setEngineTc] = useState('unlimited');
  const [localTc, setLocalTc] = useState('rapid10');

  useEffect(() => {
    if (initialJoinCode) {
      setCode(normalizeRoomCode(initialJoinCode));
      setOnlineTab('join');
      setDialog('online');
    }
  }, [initialJoinCode]);

  const commitName = (v: string) => {
    const clean = v.slice(0, 18);
    setName(clean);
    saveName(clean);
  };

  return (
    <div className="lobby">
      <div className="hero">
        <div className="eyebrow">שחמט · חיבור ישיר בין מכשירים</div>
        <h1>
          לוח אחד.
          <br />
          <span className="gold-text">שני עולמות.</span>
        </h1>
        <p>
          הזמינו חבר בקוד בן שש ספרות — ושחקו יחד מכל מקום בעולם. החיבור עובר ישירות בין הדפדפנים, בלי שרת באמצע,
          בלי הרשמה, בלי המתנה.
        </p>
      </div>

      <div className="mode-grid">
        <button className="glass mode-card" onClick={() => setDialog('online')}>
          <div className="ico" style={{ color: 'var(--gold-2)' }}>
            <IconUsers />
          </div>
          <h3>שחקו מול חבר</h3>
          <p>צרו חדר פרטי וקבלו קוד הזמנה. החבר מצטרף מכל מכשיר, בכל רשת — והמשחק מתחיל.</p>
          <span className="arrow">
            פתחו חדר <IconArrow />
          </span>
        </button>

        <button className="glass mode-card" onClick={() => setDialog('computer')}>
          <div className="ico" style={{ color: 'var(--azure)' }}>
            <IconCpu />
          </div>
          <h3>מול המחשב</h3>
          <p>מנוע Stockfish רץ בתוך הדפדפן שלכם. שבע רמות קושי, ממתחיל ועד רב־אמן.</p>
          <span className="arrow">
            בחרו רמה <IconArrow />
          </span>
        </button>

        <button className="glass mode-card" onClick={() => setDialog('local')}>
          <div className="ico" style={{ color: 'var(--emerald)' }}>
            <IconBoard />
          </div>
          <h3>על אותו מסך</h3>
          <p>שני שחקנים, מכשיר אחד. הלוח מסתובב אוטומטית — בדיוק כמו לוח אמיתי על השולחן.</p>
          <span className="arrow">
            התחילו משחק <IconArrow />
          </span>
        </button>
      </div>

      <div className="features">
        {[
          ['♦', 'שעונים מקצועיים עם תוספת זמן'],
          ['✦', 'צ׳אט חי בין השחקנים'],
          ['◈', 'רשימת מהלכים וייצוא PGN'],
          ['✧', 'עובד מצוין גם בנייד'],
        ].map(([i, t]) => (
          <span className="feature-pill" key={t}>
            <span className="i">{i}</span>
            {t}
          </span>
        ))}
      </div>

      {/* ------------------------------------------------- דיאלוג משחק מקוון */}
      {dialog === 'online' && (
        <Modal title="משחק מול חבר" sub="חדר פרטי, קוד אחד, שני מכשירים." onClose={() => setDialog(null)}>
          <div className="side-tabs" style={{ marginBottom: 20 }}>
            <button className={classNames(onlineTab === 'create' && 'active')} onClick={() => setOnlineTab('create')}>
              יצירת חדר
            </button>
            <button className={classNames(onlineTab === 'join' && 'active')} onClick={() => setOnlineTab('join')}>
              הצטרפות לחדר
            </button>
          </div>

          <div className="section-label">השם שלכם</div>
          <input className="field" value={name} onChange={(e) => commitName(e.target.value)} placeholder="איך לקרוא לכם?" />

          {onlineTab === 'create' ? (
            <>
              <div className="section-label">בקרת זמן</div>
              <TimeControlPicker value={tcId} onChange={setTcId} />

              <div className="section-label">הצבע שלכם</div>
              <ColorPicker value={color} onChange={setColor} />

              <button
                className="btn primary block"
                style={{ marginTop: 26 }}
                disabled={busy || !name.trim()}
                onClick={() => onCreateRoom({ name: name.trim(), color, timeControlId: tcId })}
              >
                {busy ? 'פותח חדר…' : 'צרו חדר וקבלו קוד'}
              </button>
            </>
          ) : (
            <>
              <div className="section-label">קוד החדר</div>
              <input
                className="field code-input"
                value={code}
                onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
                placeholder="ABC123"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                בקשו מהחבר את הקוד שהופיע אצלו על המסך — או פשוט פתחו את הקישור ששלח.
              </p>
              <button
                className="btn primary block"
                style={{ marginTop: 22 }}
                disabled={busy || code.length < 6 || !name.trim()}
                onClick={() => onJoinRoom({ name: name.trim(), code })}
              >
                {busy ? 'מתחבר…' : 'הצטרפו למשחק'}
              </button>
            </>
          )}
        </Modal>
      )}

      {/* ------------------------------------------------------ דיאלוג מחשב */}
      {dialog === 'computer' && (
        <Modal title="משחק מול המחשב" sub="Stockfish רץ מקומית בדפדפן — בלי חיבור לאינטרנט." onClose={() => setDialog(null)}>
          <div className="section-label">רמת קושי</div>
          <div className="opt-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))' }}>
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                className={classNames('opt', difficulty === d.id && 'active')}
                onClick={() => setDifficulty(d.id)}
              >
                <span className="t">{d.label}</span>
                <span className="s">{d.elo}</span>
              </button>
            ))}
          </div>

          <div className="section-label">הצבע שלכם</div>
          <ColorPicker value={engineColor} onChange={setEngineColor} />

          <div className="section-label">בקרת זמן</div>
          <TimeControlPicker value={engineTc} onChange={setEngineTc} />

          <button
            className="btn primary block"
            style={{ marginTop: 26 }}
            onClick={() => onStartComputer({ difficulty, color: engineColor, timeControlId: engineTc })}
          >
            התחילו לשחק
          </button>
        </Modal>
      )}

      {/* ------------------------------------------------------ דיאלוג מקומי */}
      {dialog === 'local' && (
        <Modal title="שני שחקנים, מסך אחד" sub="הלוח יסתובב אוטומטית בין התורות." onClose={() => setDialog(null)}>
          <div className="section-label">בקרת זמן</div>
          <TimeControlPicker value={localTc} onChange={setLocalTc} />
          <button className="btn primary block" style={{ marginTop: 26 }} onClick={() => onStartLocal({ timeControlId: localTc })}>
            התחילו לשחק
          </button>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- עזרים */

export function Modal({
  title,
  sub,
  children,
  onClose,
  closable = true,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  onClose?: () => void;
  closable?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, closable]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => closable && e.target === e.currentTarget && onClose?.()}>
      <div className="glass modal" role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2>{title}</h2>
            {sub && <p className="sub">{sub}</p>}
          </div>
          {closable && (
            <button className="icon-btn" onClick={onClose} aria-label="סגירה">
              <IconClose />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function TimeControlPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="opt-grid">
      {TIME_CONTROLS.map((t) => (
        <button key={t.id} className={classNames('opt', value === t.id && 'active')} onClick={() => onChange(t.id)}>
          <span className="t">{t.label}</span>
          <span className="s">{t.sub}</span>
        </button>
      ))}
    </div>
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: 'w' | 'b' | 'random';
  onChange: (v: 'w' | 'b' | 'random') => void;
}) {
  const opts: { id: 'w' | 'b' | 'random'; label: string; cls: string }[] = [
    { id: 'w', label: 'לבן', cls: 'w' },
    { id: 'random', label: 'אקראי', cls: 'r' },
    { id: 'b', label: 'שחור', cls: 'b' },
  ];
  return (
    <div className="opt-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
      {opts.map((o) => (
        <button
          key={o.id}
          className={classNames('opt color-opt', value === o.id && 'active')}
          onClick={() => onChange(o.id)}
        >
          <span className={`swatch ${o.cls}`} />
          <span className="t">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
