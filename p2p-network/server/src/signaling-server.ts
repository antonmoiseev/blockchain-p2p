import * as WebSocket from 'ws';
import { UnreachableCaseError } from './errors';
import { Messages, MessageType, PeersMessage } from './message';
import { MessageServer } from './message-server';

export class SignalingServer extends MessageServer<Messages> {
  protected onConnection(ws: WebSocket): void {
    const peers = Array.from(this.clients)
      .map(c => c['id'])
      .filter(c => c !== ws['id']);
    this.sendTo(ws, new PeersMessage({ ownId: ws['id'], peers }));
  }

  protected handleMessage(sender: WebSocket, message: Messages): void {
    switch (message.type) {
      case MessageType.RTCAddICECandidate: {
        message.data.sender = sender['id'];
        this.sendById(message.data.target, message);
        break;
      }
      case MessageType.RTCOffer: {
        message.data.sender = sender['id'];
        this.sendById(message.data.target, message);
        break;
      }
      case MessageType.RTCAnswer: {
        message.data.sender = sender['id'];
        this.sendById(message.data.target, message);
        break;
      }
      case MessageType.Peers: {
        // Do nothing. Sent by server to the clients.
        break;
      }
      default: {
        throw new UnreachableCaseError(message);
      }
    }
  }
}
