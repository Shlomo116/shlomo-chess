import { useCallback, useRef, useState } from 'react';
import { classNames } from '../lib/utils';

export type ToastAction = { label: string; primary?: boolean; onClick: () => void };

export type Toast = {
  id: number;
  text: string;
  tone?: 'good' | 'bad' | 'gold';
  actions?: ToastAction[];
  /** 0 = נשאר עד שלוחצים */
  timeout?: number;
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = idRef.current++;
      setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
      const ms = t.timeout ?? 4200;
      if (ms > 0) window.setTimeout(() => dismiss(id), ms);
      return id;
    },
    [dismiss],
  );

  return { toasts, push, dismiss };
}

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={classNames('toast', t.tone)} role="status">
          <span>{t.text}</span>
          {t.actions && t.actions.length > 0 && (
            <span className="t-actions">
              {t.actions.map((a) => (
                <button
                  key={a.label}
                  className={a.primary ? 'ok' : undefined}
                  onClick={() => {
                    a.onClick();
                    dismiss(t.id);
                  }}
                >
                  {a.label}
                </button>
              ))}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
