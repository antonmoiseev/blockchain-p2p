// Roles:
// 1. When a client connects sends the list of other clients in the network
// 2. Routes WebRTC signaling messages (ICE candidates, offers, answers, etc.)
//
// Requirements:
// 1. Each client needs to be assigned with a unique ID (sequential number for demo purpose?)
// 2. Messages:
//      - P2P_ACTIVE_CLIENTS
//      - RTC_ADD_ICE_CANDIDATE
//      - RTC_OFFER
//      - RTC_ANSWER

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

  // private handleRTCAddIceCandidate(sender: WebSocket, message: RTCAddICECandidateMessage): void {
  //   message.data.sender = ws;
  //   this.sendById(message.data.target, message);
  // }

  // private handleRTCOffer(message: RTCOfferMessage): void {
  //   this.sendById(message.data.target, message);
  // }

  // private handleRTCAnswer(message: RTCAnswerMessage): void {
  //   this.sendById(message.data.target, message);
  // }
}
