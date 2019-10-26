const http = require('http');
const WebSocket = require('ws');

const httpServer = http.createServer();
const wsServer = new WebSocket.Server({ server: httpServer });

httpServer.listen('8080', () => console.log('Server is listening on port 8080'));


const connections = [];

wsServer.on('connection', (ws) => {
    connections.push(ws);
    
    console.log(`Connected (${connections.length})`);
    
    ws.on('message', (data) => {
        console.log(`\n=============\nMessage\n${data}`);
        broadcast(ws, data);
    });

    ws.on('close', () => {
        connections.forEach((c, index) => {
            if (c.readyState === WebSocket.CLOSING || c.readyState === WebSocket.CLOSED) {
                connections.splice(index, 1);
            }
        });
        console.log(`Disconnected (${connections.length})`);
    });
});

wsServer.on('error', () => {
    connections.forEach((c, index) => {
        if (c.readyState === WebSocket.CLOSING || c.readyState === WebSocket.CLOSED) {
            connections.splice(index, 1);
        }
    });
    console.log(`Disconnected (${connections.length})`);
});


function broadcast(sender, message) {
    let counter = 0;
    connections.forEach(c => {
        if (sender !== c) {
            c.send(message);
            counter++;
        }
    })
    console.log(`Broadcasted to ${counter} clients`);
}