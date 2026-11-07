export type NetStatus = 'connecting' | 'open' | 'closed';

export type NetMessage = { type: string; [key: string]: any };

export class Net {
  private ws: WebSocket | null = null;
  private queue: NetMessage[] = [];
  private retry = 0;
  private closedByUser = false;
  status: NetStatus = 'connecting';
  onMessage: (msg: NetMessage) => void = () => {};
  onStatus: (status: NetStatus) => void = () => {};

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.closedByUser = false;
    this.setStatus('connecting');
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/ws`);
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      this.setStatus('open');
      const pending = this.queue.splice(0);
      for (const msg of pending) this.rawSend(msg);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && typeof data.type === 'string') this.onMessage(data);
      } catch {
        /* ignore malformed */
      }
    };

    ws.onclose = () => {
      this.setStatus('closed');
      this.ws = null;
      if (!this.closedByUser) {
        this.retry += 1;
        const delay = Math.min(8000, 500 * 2 ** Math.min(4, this.retry));
        window.setTimeout(() => {
          if (!this.closedByUser) this.connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      /* close handler will retry */
    };
  }

  private rawSend(msg: NetMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.queue.push(msg);
    }
  }

  send(msg: NetMessage) {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    }
    this.rawSend(msg);
  }

  private setStatus(status: NetStatus) {
    this.status = status;
    this.onStatus(status);
  }

  close() {
    this.closedByUser = true;
    this.ws?.close();
    this.ws = null;
  }
}

export const net = new Net();