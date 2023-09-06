const { createPublicClient, webSocket } = require('viem');
const { mainnet } = require('viem/chains');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const { analyzeBlock, analyzeWatchedPairs } = require('./src/common');
const CONFIG = require('./config.json');

const transport = webSocket(CONFIG.wsRemote);
const client = createPublicClient({
  chain: mainnet,
  transport
});

client.watchBlockNumber({
  onBlockNumber: block => parseBlockNumber(block)
});

async function parseBlockNumber(blockNumber) {
  // @PITFALL - block is unfinalized at this point, uncertain if a delay is needed for accurate results

  // console.log(`parseBlockNumber: ${blockNumber}`);
  // console.log(`https://etherscan.io/block/${blockNumber}`);

  // does not seem like db needs to reopened for each block
  const db = await open({
    filename: 'monitor-node.db',
    driver: sqlite3.Database
  });

  await analyzeBlock({ client, db, blockNumber, outputToFile: false });
  const watchedPairs = await analyzeWatchedPairs({ client, db });
  await broadcastToClients('watchedPairs', watchedPairs);
  await db.close();
};

async function broadcastToClients(type, data) {
  clients.forEach((client) => {
    client.send(JSON.stringify({ type, data }));
  });
}

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = [];
const PORT = 5002;
app.use(cors());

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.push(ws);

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.splice(clients.indexOf(ws), 1);
  });
});

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
