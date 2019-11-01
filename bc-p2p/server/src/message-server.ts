import * as WebSocket from 'ws';

export abstract class MessageServer<T> {
  private counter = 0;

  constructor(private readonly wsServer: WebSocket.Server) {
    this.wsServer.on('connection', this.subscribeToMessages);
    this.wsServer.on('error', this.cleanupDeadClients);
  }

  protected abstract handleMessage(sender: WebSocket, message: T): void;
  protected abstract onConnection(ws: WebSocket): void;

  protected readonly subscribeToMessages = (ws: WebSocket): void => {
    // Assign an ID to the client, so we can send messages to specific clients.
    ws['id'] = this.counter++;

    ws.on('message', (data: WebSocket.Data) => {
      if (typeof data === 'string') {
        this.handleMessage(ws, JSON.parse(data));
      } else {
        console.log('Received data of unsupported type.');
      }
    });

    // A lifecycle callback for subclasses.
    this.onConnection(ws);
  };

  private readonly cleanupDeadClients = (): void => {
    this.wsServer.clients.forEach(client => {
      if (this.isDead(client)) {
        this.wsServer.clients.delete(client);
      }
    });
  };

  protected broadcastExcept(currentClient: WebSocket, message: Readonly<T>): void {
    this.wsServer.clients.forEach(client => {
      if (this.isAlive(client) && client !== currentClient) {
        client.send(JSON.stringify(message));
      }
    });
  }

  protected sendTo(client: WebSocket, message: Readonly<T>): void {
    client.send(JSON.stringify(message));
  }

  protected sendById(id: number, message: Readonly<T>): void {
    const client = Array.from(this.clients).find(c => c['id'] === id);
    if (client) {
      client.send(JSON.stringify(message));
    }
  }

  protected get clients(): Set<WebSocket> {
    return this.wsServer.clients;
  }

  private isAlive(client: WebSocket): boolean {
    return !this.isDead(client);
  }

  private isDead(client: WebSocket): boolean {
    return client.readyState === WebSocket.CLOSING || client.readyState === WebSocket.CLOSED;
  }
}
