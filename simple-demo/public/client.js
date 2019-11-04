document.getElementById('connect').addEventListener('click', sendOffer);
document.getElementById('send').addEventListener('click', () => {
  dataChannel.send('Current time: ' + new Date().toLocaleTimeString());
});

// Signaling server
const ws = new WebSocket('ws://localhost:8080');
ws.addEventListener('message', handleMessageFromSignalingServer);


// Setup WebRTC RTCPeerConnection
let dataChannel = null;
let rtcConnection = new RTCPeerConnection();
rtcConnection.ondatachannel = (e) => {
  log('[WebRTC] Received data channel.');
  dataChannel = e.channel;
  setupDataChannel(dataChannel);
};

rtcConnection.onicecandidate = (e) => {
  log('[WebRTC] Sending an ICE candidate...', '#666');
  if (e.candidate) {
    ws.send(JSON.stringify({ type: 'add-ice-candidate', data: e.candidate }));
  }
};

function sendOffer() {
  log('[WebRTC] Creating a data channel...');
  dataChannel = rtcConnection.createDataChannel('DEMO DATA CHANNEL');
  setupDataChannel(dataChannel);

  log('[WebRTC] Creating an offer...');
  rtcConnection.createOffer()
    .then(offer => {
      log('[WebRTC] Sending the offer...');
      rtcConnection.setLocalDescription(offer);
    })
    .then(() => {
      log('[WebRTC] Setting local session description..');
      ws.send(JSON.stringify({ type: 'offer', data: rtcConnection.localDescription }));
    });
}

function handleMessageFromSignalingServer(messageEvent) {
  const message = JSON.parse(messageEvent.data);
  
  switch (message.type) {
    case 'add-ice-candidate': {
      rtcConnection
        .addIceCandidate(message.data)
        .catch(() => log('[WebRTC] Cannot add ICE candidate: ' + message.data, 'red'));
      break;
    }
  
    case 'offer': {
      log('[WebRTC] Received an offer.');
      if (!rtcConnection.remoteDescription) {
        log('[WebRTC] Setting up remote session description.');
        rtcConnection.setRemoteDescription(message.data)
          .then(() => {
            log('[WebRTC] Creating an answer...');
            return rtcConnection.createAnswer();
          })
          .then(answer => {
            log('[WebRTC] Setting local description...');
            rtcConnection.setLocalDescription(answer);
            return answer;
          })
          .then(answer => {
            log('[WebRTC] Sending the answer...');
            ws.send(JSON.stringify({ type: 'answer', data: answer }));
          });
      }
      break;
    }
  
    case 'answer': {
      log('[WebRTC] Received an answer');
      log('[WebRTC] Setting remote session description...');
      rtcConnection.setRemoteDescription(message.data);
      break;
    }
  
    default: {
      log('[WebRTC] Unknown message type', 'red');
    }
  }
}

function setupDataChannel(dataChannel) {
  dataChannel.onopen = () => log('[WebRTC] Data channel opened.');
  dataChannel.onmessage = (messageEvent) => log(`[WebRTC] ${messageEvent.data}`, 'green');
}

function log(message, color = '#000') {
  console.log(`%c${message}`, `color: ${color}`);
}
