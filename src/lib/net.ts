import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

/**
 * שכבת הרשת: חיבור עמית־לעמית (WebRTC) בין שני דפדפנים.
 * שרת ה־signaling הציבורי של PeerJS משמש רק ל"לחיצת היד" הראשונית;
 * מרגע שהחיבור נוצר כל המהלכים עוברים ישירות בין המכשירים.
 */

export const PEER_PREFIX = 'shm7x-';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  // שרתי TURN ציבוריים חינמיים — מאפשרים חיבור גם מאחורי NAT נוקשה / רשת סלולרית
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turns:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: [
      'turn:staticauth.openrelay.metered.ca:80',
      'turn:staticauth.openrelay.metered.ca:443',
      'turns:staticauth.openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export type TimeState = { w: number; b: number };

export type NetMessage =
  | {
      t: 'hello';
      name: string;
      /** הצבע שהאורח יקבל */
      guestColor: 'w' | 'b';
      timeControlId: string;
      fen: string;
      clocks: TimeState;
    }
  | { t: 'ready'; name: string }
  | { t: 'move'; from: string; to: string; promotion?: string; clocks: TimeState; ply: number }
  | { t: 'chat'; text: string; ts: number }
  | { t: 'resign' }
  | { t: 'draw-offer' }
  | { t: 'draw-accept' }
  | { t: 'draw-decline' }
  | { t: 'rematch-offer' }
  | { t: 'rematch-accept'; guestColor: 'w' | 'b'; clocks: TimeState }
  | { t: 'flag'; loser: 'w' | 'b' }
  | { t: 'sync-request' }
  | { t: 'sync'; fen: string; moves: string[]; clocks: TimeState; guestColor: 'w' | 'b'; timeControlId: string }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number };

export type NetStatus =
  | 'idle'
  | 'creating'
  | 'waiting'
  | 'joining'
  | 'connected'
  | 'reconnecting'
  | 'closed'
  | 'error';

export type NetHandlers = {
  onStatus: (status: NetStatus, detail?: string) => void;
  onMessage: (msg: NetMessage) => void;
  onLatency: (ms: number) => void;
};

export class NetSession {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private handlers: NetHandlers;
  private pingTimer: number | null = null;
  private destroyed = false;
  private reconnects = 0;

  role: 'host' | 'guest' = 'host';
  roomCode = '';

  constructor(handlers: NetHandlers) {
    this.handlers = handlers;
  }

  private makePeer(id?: string): Peer {
    return new Peer(id as string, {
      debug: 0,
      config: { iceServers: ICE_SERVERS, iceCandidatePoolSize: 4 },
    });
  }

  /** מארח חדר חדש. מחזיר הבטחה שנפתרת כשה־peer מוכן וממתין לאורח. */
  host(roomCode: string): Promise<void> {
    this.role = 'host';
    this.roomCode = roomCode;
    this.handlers.onStatus('creating');
    return new Promise((resolve, reject) => {
      const peer = this.makePeer(PEER_PREFIX + roomCode);
      this.peer = peer;

      const timeout = window.setTimeout(() => {
        reject(new Error('timeout'));
      }, 20000);

      peer.on('open', () => {
        window.clearTimeout(timeout);
        this.handlers.onStatus('waiting');
        resolve();
      });

      peer.on('connection', (conn) => {
        // חדר תופס שחקן אחד בלבד; חיבור נוסף נדחה בעדינות
        if (this.conn && this.conn.open) {
          conn.on('open', () => {
            conn.close();
          });
          return;
        }
        this.attach(conn);
      });

      peer.on('error', (err: Error & { type?: string }) => {
        window.clearTimeout(timeout);
        if (err.type === 'unavailable-id') {
          reject(new Error('room-taken'));
        } else if (err.type === 'peer-unavailable') {
          // לא רלוונטי למארח
        } else {
          this.handlers.onStatus('error', err.message);
          reject(err);
        }
      });

      peer.on('disconnected', () => {
        if (this.destroyed || this.reconnects >= 6) return;
        this.reconnects++;
        window.setTimeout(() => {
          if (!this.destroyed) {
            try {
              peer.reconnect();
            } catch {
              /* ignore */
            }
          }
        }, 800 * this.reconnects);
      });
    });
  }

  /** מתחבר לחדר קיים. */
  join(roomCode: string): Promise<void> {
    this.role = 'guest';
    this.roomCode = roomCode;
    this.handlers.onStatus('joining');
    return new Promise((resolve, reject) => {
      const peer = this.makePeer();
      this.peer = peer;

      const timeout = window.setTimeout(() => reject(new Error('timeout')), 25000);

      peer.on('open', () => {
        const conn = peer.connect(PEER_PREFIX + roomCode, {
          reliable: true,
          serialization: 'json',
          metadata: { room: roomCode },
        });
        conn.on('open', () => {
          window.clearTimeout(timeout);
          resolve();
        });
        this.attach(conn);
      });

      peer.on('error', (err: Error & { type?: string }) => {
        window.clearTimeout(timeout);
        if (err.type === 'peer-unavailable') reject(new Error('no-room'));
        else reject(err);
      });

      peer.on('disconnected', () => {
        if (this.destroyed || this.reconnects >= 6) return;
        this.reconnects++;
        window.setTimeout(() => {
          if (!this.destroyed) {
            try {
              peer.reconnect();
            } catch {
              /* ignore */
            }
          }
        }, 800 * this.reconnects);
      });
    });
  }

  private attach(conn: DataConnection) {
    this.conn = conn;

    conn.on('open', () => {
      this.handlers.onStatus('connected');
      this.startPing();
    });

    conn.on('data', (raw) => {
      const msg = raw as NetMessage;
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'ping') {
        this.send({ t: 'pong', ts: msg.ts });
        return;
      }
      if (msg.t === 'pong') {
        this.handlers.onLatency(Date.now() - msg.ts);
        return;
      }
      this.handlers.onMessage(msg);
    });

    conn.on('close', () => {
      this.stopPing();
      if (!this.destroyed) {
        this.conn = null;
        this.handlers.onStatus(this.role === 'host' ? 'waiting' : 'closed');
      }
    });

    conn.on('error', () => {
      this.handlers.onStatus('reconnecting');
    });
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      this.send({ t: 'ping', ts: Date.now() });
    }, 5000);
  }

  private stopPing() {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /** ניסיון חיבור מחדש של האורח למארח על אותו peer קיים */
  retryJoin(): boolean {
    const peer = this.peer;
    if (!peer || this.destroyed || this.role !== 'guest') return false;
    if (this.conn?.open) return true;
    if (peer.disconnected) {
      try {
        peer.reconnect();
      } catch {
        /* ignore */
      }
      return false;
    }
    try {
      const conn = peer.connect(PEER_PREFIX + this.roomCode, {
        reliable: true,
        serialization: 'json',
        metadata: { room: this.roomCode, rejoin: true },
      });
      this.attach(conn);
      return true;
    } catch {
      return false;
    }
  }

  send(msg: NetMessage): boolean {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(msg);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  get isConnected() {
    return !!this.conn?.open;
  }

  destroy() {
    this.destroyed = true;
    this.stopPing();
    try {
      this.conn?.close();
    } catch {
      /* ignore */
    }
    try {
      this.peer?.destroy();
    } catch {
      /* ignore */
    }
    this.conn = null;
    this.peer = null;
  }
}
