export enum MessageType {
  Peers = 'PEERS',
  RTCAddICECandidate = 'RTC_ADD_ICE_CANDIDATE',
  RTCOffer = 'RTC_OFFER',
  RTCAnswer = 'RTC_ANSWER'
}

export interface Message<T> {
  type: MessageType;
  data: T;
}

export type Messages =
  | PeersMessage
  | RTCAddICECandidateMessage
  | RTCOfferMessage
  | RTCAnswerMessage;

/**
 * Session Description Protocol
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols#SDP
 */
export type SDP = string; // SDP - Session

export type Peer = number;

export interface ICEMessageData {
  sender: Peer;
  target: Peer;
  candidate: SDP;
}

/**
 * Represents all the peers available online.
 * Sent when a new node is connected.
 */
export class PeersMessage implements Message<{ ownId: Peer; peers: Peer[] }> {
  readonly type = MessageType.Peers;
  constructor(readonly data: { ownId: Peer; peers: Peer[] }) {}
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling#Exchanging_ICE_candidates
 */
export class RTCAddICECandidateMessage implements Message<ICEMessageData> {
  readonly type = MessageType.RTCAddICECandidate;
  constructor(readonly data: ICEMessageData) {}
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling#Designing_the_signaling_protocol
 */
export class RTCOfferMessage implements Message<ICEMessageData> {
  readonly type = MessageType.RTCOffer;
  constructor(readonly data: ICEMessageData) {}
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling#Designing_the_signaling_protocol
 */
export class RTCAnswerMessage implements Message<ICEMessageData> {
  readonly type = MessageType.RTCAnswer;
  constructor(readonly data: ICEMessageData) {}
}
