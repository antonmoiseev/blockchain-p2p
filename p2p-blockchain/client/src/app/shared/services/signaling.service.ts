import { Inject, Injectable } from '@angular/core';
import {
  Messages,
  MessageType,
  RTCAddICECandidateMessage,
  RTCAnswerMessage,
  RTCOfferMessage
} from '@common/message';

import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { SIGNALING_SERVER_URL } from '../../app.tokens';
import { Message as BlockhainMessage } from '../messages';
import { Subject, merge, forkJoin } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SignalingService {
  private ws: WebSocketSubject<Messages>;
  private peers: Peer[] = [];

  private readonly _ready = new Subject<boolean>();
  private readonly _messageReceived = new Subject<BlockhainMessage>();

  get ready() {
    return this._ready.asObservable();
  }

  get messageReceived() {
    return this._messageReceived.asObservable();
  }

  get peerIDs(): number[] {
    return this.peers.map(p => p.remoteId);
  }

  constructor(@Inject(SIGNALING_SERVER_URL) private readonly signalingServerUrl: string) {}

  connect() {
    this.ws = webSocket(this.signalingServerUrl);
    this.ws.subscribe(message => {
      switch (message.type) {
        case MessageType.Peers: {
          console.log('[WS] Peers: ' + (message.data.peers.join(', ') || 'none'));
          this.peers = message.data.peers.map(id => Peer.connect(id, message.data.ownId, this.ws));

          if (this.peers.length > 0) {
            merge(...this.peers.map(p => p.messageReceived)).subscribe(msg =>
              this._messageReceived.next(msg)
            );

            forkJoin(...this.peers.map(p => p.ready)).subscribe(
              () => this._ready.next(),
              error => this._ready.error(error),
              () => this._ready.complete()
            );
          } else {
            this._ready.next();
            this._ready.complete();
          }

          break;
        }
        case MessageType.RTCOffer: {
          const { sender: id, target: localId, candidate: offer } = message.data;
          const peer = Peer.acceptOffer(id, localId, offer, this.ws);
          this.peers.push(peer);
          peer.messageReceived.subscribe(msg => this._messageReceived.next(msg));
          break;
        }
      }
    });
  }

  broadcast(message: any) {
    console.log('[P2P] Broadcasting:', message);
    this.peers.forEach(p => p.send(message));
  }

  replyTo(peerId: number, message: BlockhainMessage) {
    const p = this.peers.find(p => p.remoteId === peerId);
    console.log(`[P2P] To ${p.remoteId}:`, message);
    p.send(message);
  }
}

export class Peer {
  private readonly connection: RTCPeerConnection;
  private channel: RTCDataChannel;

  private readonly _ready = new Subject<boolean>();
  private readonly _messageReceived = new Subject<BlockhainMessage>();

  get ready() {
    return this._ready.asObservable();
  }

  get messageReceived() {
    return this._messageReceived.asObservable();
  }

  static connect(id: number, localId: number, ws: WebSocketSubject<Messages>): Peer {
    const peer = new Peer(id, localId, ws);
    const label = `CH_${peer.localId}_${peer.remoteId}`;
    peer.setupDataChannel(peer.connection.createDataChannel(label));

    console.log('Creating an offer...');
    peer.connection
      .createOffer()
      .then(offer => {
        console.log('Setting local session description...');
        peer.connection.setLocalDescription(offer);
      })
      .then(() => {
        console.log('[WS] Sending the offer...');
        peer.ws.next(
          new RTCOfferMessage({
            candidate: peer.connection.localDescription,
            sender: peer.localId,
            target: peer.remoteId
          })
        );
      });

    return peer;
  }

  static acceptOffer(
    id: number,
    localId: number,
    offer: RTCSessionDescription,
    ws: WebSocketSubject<Messages>
  ): Peer {
    const peer = new Peer(id, localId, ws);
    peer.connection.ondatachannel = (event: RTCDataChannelEvent) => {
      peer.setupDataChannel(event.channel);
    };

    console.log('Received an offer.');
    console.log('Setting remote session description.');
    peer.connection
      .setRemoteDescription(offer)
      .then(() => {
        console.log('Creating an answer...');
        return peer.connection.createAnswer();
      })
      .then(answer => {
        console.log('Setting local description...');
        peer.connection.setLocalDescription(answer);
      })
      .then(() => {
        console.log('[WS] Sending the answer...');
        peer.ws.next(
          new RTCAnswerMessage({
            candidate: peer.connection.localDescription,
            sender: peer.localId,
            target: peer.remoteId
          })
        );
      });

    return peer;
  }

  private constructor(
    readonly remoteId: number,
    readonly localId: number,
    private readonly ws: WebSocketSubject<Messages>
  ) {
    this.connection = new RTCPeerConnection();
    this.connection.onicecandidate = this.onICECandidate;
    this.ws.subscribe(this.handleMessages);
  }

  send(message: any) {
    if (this.channel.readyState === 'open') {
      this.channel.send(JSON.stringify({ ...message, sender: this.localId }));
    }
  }

  private setupDataChannel(dataChannel: RTCDataChannel) {
    this.channel = dataChannel;
    this.channel.onopen = this.onOpen;
    this.channel.onmessage = this.onMessage;
  }

  private readonly handleMessages = (message: Messages) => {
    switch (message.type) {
      case MessageType.RTCAnswer: {
        if (message.data.sender === this.remoteId) {
          console.log(`[WS] Received an answer from ${message.data.sender}.`);
          console.log('Setting remote session description...');
          this.connection.setRemoteDescription(message.data.candidate);
        }
        break;
      }
      case MessageType.RTCAddICECandidate: {
        if (message.data.sender === this.remoteId) {
          console.log('[WS] Received an ICE candidate.');
          this.connection
            .addIceCandidate(message.data.candidate)
            .catch(() => console.error('Cannot add ICE candidate: ', message.data.candidate));
        }
        break;
      }
    }
  };

  private readonly onICECandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      console.log('[WS] Sending an ICE candidate...');
      this.ws.next(
        new RTCAddICECandidateMessage({
          sender: this.localId,
          target: this.remoteId,
          candidate: event.candidate
        })
      );
    }
  };

  private readonly onOpen = () => {
    console.log('[P2P] Data channel opened: ' + this.channel.label);
    this._ready.next();
    this._ready.complete();
  };

  private readonly onMessage = (event: MessageEvent) => {
    const message: BlockhainMessage = JSON.parse(event.data);
    console.log(`[P2P] From ${this.remoteId}:`, message);
    this._messageReceived.next(message);
  };
}
