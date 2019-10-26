const ws = new WebSocket('ws://localhost:8080');
let rtcConnection = null;
let dataChannel = null;

document.getElementById('send').addEventListener('click', () => {
    dataChannel.send('Yeeeeeessss!!!! IT WORKS!');
});

document.getElementById('connect').addEventListener('click', () => {
    console.log('Generating an offer, setting the local description');

    dataChannel = rtcConnection.createDataChannel('sendChannel');

    rtcConnection.createOffer()
        .then(offer => rtcConnection.setLocalDescription(offer))
        .then(() => ws.send(JSON.stringify({
            type: 'offer',
            data: rtcConnection.localDescription
        }, null, 2)));
    
    dataChannel.onopen = () => {
        console.log('onopen');
    };

    dataChannel.onclose = (e) => {
        console.log('onclose', e);
    };

    dataChannel.onmessage = (m) => {
        console.log('onmessage', m);
    };
});

ws.addEventListener('open', () => {
    console.log('connection opened');
    
    rtcConnection = new RTCPeerConnection();

    // let negotiating = false;
    // rtcConnection.onnegotiationneeded = async e => {
    //     try {
    //         if (negotiating || rtcConnection.signalingState != "stable") return;
    //         negotiating = true;
    //         /* Your async/await-using code goes here */
    //     } finally {
    //         negotiating = false;
    //     }
    // }

    rtcConnection.ondatachannel = (e) => {
        console.log('ondatachannel', e);
        if (!dataChannel) dataChannel = e.channel;
    };

    rtcConnection.onicecandidate = (e) => {
        console.log('onicecandidate');
        if (e.candidate) {
            ws.send(JSON.stringify({
                type: 'add-ice-candidate',
                data: e.candidate
            }, null, 2));
        }
    };

    // if (new Date().getSeconds() < 30) {
        
        // }
})

ws.addEventListener('closed', () => {
    console.log('connection opened');
})

ws.addEventListener('message', (e) => {
    // console.log('Message:', e.data);
    const message = JSON.parse(e.data);
    
    if (message.type === 'add-ice-candidate') {
        rtcConnection.addIceCandidate(message.data)
            .catch(() => console.log('Cannot add ICE candidate:', message.data));
    } else if (message.type === 'offer') {
        console.log('Received an offer, setting the remote description');
        if (!rtcConnection.remoteDescription) {
        rtcConnection.setRemoteDescription(message.data)
            .then(() => rtcConnection.createAnswer())
            .then(answer => {
                if (!rtcConnection.localDescription) {
                    console.log('Setting local description from answer');
                    rtcConnection.setLocalDescription(answer)
                } else {
                    console.log('Already have a description, ignoring answer');
                }
                return answer;
            })
            .then(answer => ws.send(JSON.stringify({
                type: 'answer',
                data: answer
            }, null, 2)));
        }
    } else if (message.type === 'answer') {
        console.log('Received an answer, setting the remote description');
        if (!rtcConnection.remoteDescription) {
            console.log('Setting remote description from answer');
            rtcConnection.setRemoteDescription(message.data);
        } else {
            console.log('Already have a description, ignoring answer');
        }
    } else {
        console.log('Unknown message type');
    }
})