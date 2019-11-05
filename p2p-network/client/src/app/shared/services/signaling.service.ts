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

@Injectable({ providedIn: 'root' })
export class SignalingService {
  private ws: WebSocketSubject<Messages>;
  private peers: Peer[] = [];

  constructor(@Inject(SIGNALING_SERVER_URL) private readonly signalingServerUrl: string) {}

  connect() {
    this.ws = webSocket(this.signalingServerUrl);
    this.ws.subscribe(message => {
      switch (message.type) {
        case MessageType.Peers: {
          console.log('[WS] Peers: ' + (message.data.peers.join(', ') || 'none'));
          this.peers = message.data.peers.map(id => Peer.connect(id, message.data.ownId, this.ws));
          break;
        }
        case MessageType.RTCOffer: {
          const { sender: id, target: localId, candidate: offer } = message.data;
          this.peers.push(Peer.acceptOffer(id, localId, offer, this.ws));
          break;
        }
      }
    });
  }

  broadcast() {
    this.peers.forEach(p => p.send(`I'm peer #${p.localId} (${new Date().toTimeString()})`));
  }
}

export class Peer {
  private readonly connection: RTCPeerConnection;
  private channel: RTCDataChannel;

  static connect(id: number, localId: number, ws: WebSocketSubject<Messages>): Peer {
    const peer = new Peer(id, localId, ws);
    const label = `CH_${peer.localId}_${peer.remoteId}`;
    peer.setupDataChannel(peer.connection.createDataChannel(label));

    console.log('[WebRTC] Creating an offer...');
    peer.connection
      .createOffer()
      .then(offer => {
        console.log('[WebRTC] Setting local session description...');
        peer.connection.setLocalDescription(offer);
      })
      .then(() => {
        console.log('[WebRTC] Sending the offer...');
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

    console.log('[WebRTC] Received an offer.');
    console.log('[WebRTC] Setting remote session description.');
    peer.connection
      .setRemoteDescription(offer)
      .then(() => {
        console.log('[WebRTC] Creating an answer...');
        return peer.connection.createAnswer();
      })
      .then(answer => {
        console.log('[WebRTC] Setting local description...');
        peer.connection.setLocalDescription(answer);
      })
      .then(() => {
        console.log('[WebRTC] Sending the answer...');
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
    console.log('Creating peer for ' + remoteId);
    this.connection = new RTCPeerConnection();
    this.connection.onicecandidate = this.onICECandidate;
    this.ws.subscribe(this.handleMessages);
  }

  send(message: any) {
    if (this.channel.readyState === 'open') {
      this.channel.send(message);
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
          console.log(`[WebRTC] Received an answer from ${message.data.sender}.`);
          console.log('[WebRTC] Setting remote session description...');
          this.connection.setRemoteDescription(message.data.candidate);
        }
        break;
      }
      case MessageType.RTCAddICECandidate: {
        if (message.data.sender === this.remoteId) {
          console.log('[WebRTC] Received an ICE candidate.');
          this.connection
            .addIceCandidate(message.data.candidate)
            .catch(() => console.error('[WebRTC] Cannot add ICE candidate: ', message.data.candidate));
        }
        break;
      }
    }
  };

  private readonly onICECandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      console.log('[WebRTC] Sending an ICE candidate...');
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
    console.log('[WebRTC] Data channel opened: ' + this.channel.label);
  };

  private readonly onMessage = (event: MessageEvent) => {
    console.log(`[WebRTC] ${this.remoteId}: ${event.data}`);
  };
}
