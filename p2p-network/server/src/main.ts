import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import { SignalingServer } from './signaling-server';

const PORT = 3000;
const app = express();
// app.use('/', express.static(path.join(__dirname, '../../client')));
// app.use('/node_modules', express.static(path.join(__dirname, '../../node_modules')));

const httpServer: http.Server = app.listen(PORT, () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Listening on http://localhost:${PORT}`);
  }
});

const wsServer = new WebSocket.Server({ server: httpServer });
new SignalingServer(wsServer);
