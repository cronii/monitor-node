const { createPublicClient, webSocket } = require('viem');
const { mainnet } = require('viem/chains');
const Database = require('better-sqlite3');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const { analyzeBlock, getWatchedWalletActivity } = require('./src/wallet-watcher-common');
const CONFIG = require('./config.json');

const transport = webSocket(CONFIG.wsLocal);
const client = createPublicClient({
  chain: mainnet,
  transport
});

client.watchBlockNumber({
  onBlockNumber: block => parseBlockNumber(block)
});

async function parseBlockNumber(blockNumber) {
  const db = new Database('monitor-node.db');
  db.pragma('journal_mode = WAL');

  await analyzeBlock({ client, db, blockNumber });
  const { recentPairs, recentSwaps } = await getWatchedWalletActivity({ client, db });
  await broadcastToClients('watchedWalletScreener', { recentPairs, recentSwaps });
  db.close();
};

async function broadcastToClients(type, data) {
  clients.forEach((client) => {
    client.send(JSON.stringify({ type, ...data }));
  });
}

const clients = [];
const PORT = 5002;
app.use(cors());

app.get('/', (req, res) => {
  res.send('Hello, HTTP!');
});

app.get('/api/wallet/:address', async (req, res) => {
  try {
    const address = req.params.address;
    const db = new Database('monitor-node.db');
    db.pragma('journal_mode = WAL');

    const watchedWalletSwapsQuery = db.prepare(`
      SELECT * 
      FROM watched_wallet_swaps
      WHERE maker = ?
      ORDER BY timestamp DESC, txIndex DESC, logIndex DESC`);
    const watchedWalletSwaps = watchedWalletSwapsQuery.all(address.toLowerCase());
    res.json(watchedWalletSwaps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data from the database' });
  }
});

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
