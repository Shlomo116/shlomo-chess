/**
 * עטיפה למנוע Stockfish (WebAssembly, חד־תהליכי) שרץ ב-Web Worker.
 * מדבר UCI: פקודות טקסט פנימה, שורות טקסט החוצה.
 */

type BestMoveHandler = (move: { from: string; to: string; promotion?: string }) => void;

export class ChessEngine {
  private worker: Worker | null = null;
  private ready = false;
  private readyWaiters: (() => void)[] = [];
  private bestMoveHandler: BestMoveHandler | null = null;
  private thinking = false;

  async init(): Promise<void> {
    if (this.worker) return this.whenReady();
    this.worker = new Worker(`${import.meta.env.BASE_URL}engine/stockfish.js`);
    this.worker.onmessage = (e: MessageEvent) => this.handleLine(String(e.data ?? ''));
    this.worker.onerror = () => {
      this.ready = false;
    };
    this.post('uci');
    this.post('setoption name Ponder value false');
    this.post('setoption name Hash value 32');
    this.post('isready');
    return this.whenReady();
  }

  private whenReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve) => {
      this.readyWaiters.push(resolve);
      window.setTimeout(resolve, 12000); // לא נתקע לנצח אם המנוע לא נטען
    });
  }

  private handleLine(line: string) {
    if (line.startsWith('readyok') || line.startsWith('uciok')) {
      this.ready = true;
      const waiters = this.readyWaiters;
      this.readyWaiters = [];
      waiters.forEach((w) => w());
      return;
    }
    if (line.startsWith('bestmove')) {
      this.thinking = false;
      const parts = line.split(/\s+/);
      const uci = parts[1];
      const handler = this.bestMoveHandler;
      this.bestMoveHandler = null;
      if (!handler || !uci || uci === '(none)') return;
      handler({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
    }
  }

  private post(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  setDifficulty(skill: number) {
    this.post(`setoption name Skill Level value ${skill}`);
  }

  newGame() {
    this.post('ucinewgame');
    this.post('isready');
  }

  /** מבקש מהלך על סמך רשימת מהלכי UCI מתחילת המשחק */
  think(
    moves: string[],
    opts: { movetime: number; depth: number; skill: number },
    handler: BestMoveHandler,
  ) {
    if (!this.worker) return;
    this.stop();
    this.bestMoveHandler = handler;
    this.thinking = true;
    this.setDifficulty(opts.skill);
    this.post(`position startpos${moves.length ? ' moves ' + moves.join(' ') : ''}`);
    this.post(`go depth ${opts.depth} movetime ${opts.movetime}`);
  }

  stop() {
    if (this.thinking) {
      this.post('stop');
      this.thinking = false;
    }
    this.bestMoveHandler = null;
  }

  destroy() {
    try {
      this.post('quit');
      this.worker?.terminate();
    } catch {
      /* ignore */
    }
    this.worker = null;
    this.ready = false;
  }
}
