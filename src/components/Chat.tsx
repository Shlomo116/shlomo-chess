import { useEffect, useRef, useState } from 'react';
import { IconSend } from './Icons';
import { classNames } from '../lib/utils';

export type ChatMessage = {
  id: string;
  from: 'me' | 'them' | 'sys';
  text: string;
  ts: number;
};

type Props = {
  messages: ChatMessage[];
  canSend: boolean;
  placeholder?: string;
  onSend: (text: string) => void;
};

const QUICK = ['שלום! 👋', 'משחק טוב!', 'אופס…', 'כל הכבוד!', 'עוד סיבוב?'];

export function Chat({ messages, canSend, placeholder, onSend }: Props) {
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = (text: string) => {
    const t = text.trim().slice(0, 300);
    if (!t || !canSend) return;
    onSend(t);
    setDraft('');
  };

  return (
    <div className="chat">
      <div className="chat-log" ref={logRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">
            {canSend ? 'אמרו שלום ליריב שלכם ✦' : placeholder ?? 'הצ׳אט יהיה זמין כשהיריב יתחבר.'}
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={classNames('bubble', m.from)}>
              {m.text}
              {m.from !== 'sys' && (
                <span className="time">
                  {new Date(m.ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {canSend && messages.length < 2 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {QUICK.map((q) => (
            <button key={q} className="btn sm" style={{ padding: '5px 11px', fontSize: 12.5 }} onClick={() => submit(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <input
          className="field"
          value={draft}
          maxLength={300}
          disabled={!canSend}
          placeholder={canSend ? 'כתבו הודעה…' : 'ממתין ליריב…'}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="chat-send" type="submit" disabled={!canSend || !draft.trim()} aria-label="שליחה">
          <IconSend />
        </button>
      </form>
    </div>
  );
}
