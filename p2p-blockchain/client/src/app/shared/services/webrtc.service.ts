import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Message, MessageTypes, UUID } from '../messages';
import { Block, Transaction } from './blockchain-node.service';
import { CryptoService } from './crypto.service';
import { WebsocketService } from './websocket.service';
import { SignalingService } from './signaling.service';

@Injectable({
  providedIn: 'root'
})
export class WebRTCService {
  // private websocket: Promise<WebSocket>;

  private readonly canSend: Promise<true>;
  private readonly _messageReceived = new Subject<Message>();
  private readonly receivedMessagesAwaitingResponse = new Map<UUID, number>(); // number represents peer ID
  // private readonly sentMessagesAwaitingReply = new Map<UUID, Replies>(); // Used as accumulator for replies from clients.
  private readonly messagesAwaitingReply = new Map<UUID, DeferredMessageContext>();

  get messageReceived(): Observable<Message> {
    return this._messageReceived.asObservable();
  }

  constructor(private readonly crypto: CryptoService, private readonly signalingService: SignalingService) {
    this.signalingService.connect();
    this.signalingService.messageReceived.subscribe(this.onMessageReceived);
    this.canSend = new Promise((resolve, reject) => {
      this.signalingService.ready.subscribe(() => resolve(true), error => reject(error));
    });
  }

  // private get url(): string {
  //   const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  //   const hostname = environment.wsHostname;
  //   return `${protocol}://${hostname}`;
  // }
  // private connect(): Promise<WebSocket> {
  //   return new Promise((resolve, reject) => {
  //     const ws = new WebSocket(this.url);
  //     ws.addEventListener('open', () => resolve(ws));
  //     ws.addEventListener('error', err => reject(err));
  //     ws.addEventListener('message', this.onMessageReceived);
  //   });
  // }

  private readonly onMessageReceived = (message: Message) => {
    // const message = JSON.parse(event.data) as Message;
    // console.log;
    if (message.type === MessageTypes.GetLongestChainRequest) {
      this.receivedMessagesAwaitingResponse.set(message.correlationId, message.sender);
    }

    if (this.messagesAwaitingReply.has(message.correlationId)) {
      this.messagesAwaitingReply.get(message.correlationId).replies.set(message.sender, message);

      if (this.everyoneReplied(message)) {
        this.messagesAwaitingReply.get(message.correlationId).executor.resolve(message);
        this.messagesAwaitingReply.delete(message.correlationId);
      }
    } else {
      this._messageReceived.next(message);
    }
  };

  async send(message: Partial<Message>, awaitForReply: boolean = false) {
    return new Promise<Message>(async (resolve, reject) => {
      if (awaitForReply) {
        this.messagesAwaitingReply.set(message.correlationId, {
          executor: { resolve, reject },
          replies: new Map()
        });
      }

      if (this.receivedMessagesAwaitingResponse.has(message.correlationId)) {
        this.canSend.then(() =>
          this.signalingService.replyTo(
            this.receivedMessagesAwaitingResponse.get(message.correlationId),
            message as Message
          )
        );
        () => this.receivedMessagesAwaitingResponse.delete(message.correlationId);
      } else {
        this.canSend.then(() => this.signalingService.broadcast(message));
      }
      // this.websocket.then(
      //   ws => ws.send(JSON.stringify(message)),
      //   () => this.messagesAwaitingReply.delete(message.correlationId)
      // );
    });
  }

  async requestLongestChain(): Promise<Block[]> {
    if (this.signalingService.peerIDs.length > 0) {
      const reply = await this.send(
        {
          type: MessageTypes.GetLongestChainRequest,
          correlationId: this.crypto.uuid()
        },
        true
      );
      return reply.payload;
    } else {
      return await Promise.resolve([]);
    }
  }

  requestNewBlock(transactions: Transaction[]): void {
    this.send({
      type: MessageTypes.NewBlockRequest,
      correlationId: this.crypto.uuid(),
      payload: transactions
    });
  }

  announceNewBlock(block: Block): void {
    this.send({
      type: MessageTypes.NewBlockAnnouncement,
      correlationId: this.crypto.uuid(),
      payload: block
    });
  }

  // NOTE: naive implementation that assumes no clients added or removed after the server requested the longest chain.
  // Otherwise the server may await a reply from a client that has never received the request.
  private everyoneReplied(message: Message): boolean {
    const replies = this.messagesAwaitingReply.get(message.correlationId).replies;
    const awaitingForPeers = Array.from(this.signalingService.peerIDs).filter(c => !replies.has(c));
    return awaitingForPeers.length === 0;
  }
}

interface PromiseExecutor<T> {
  resolve: (value?: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

// type Replies = Map<number, Message>; // key represents peer ID

interface DeferredMessageContext {
  readonly executor: PromiseExecutor<Message>;
  readonly replies: Map<number, Message>; // key represents peer ID
}
