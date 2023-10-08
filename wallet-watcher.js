const { createPublicClient, webSocket } = require('viem');
const { mainnet } = require('viem/chains');
const Database = require('better-sqlite3');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const { analyzeBlock, getWatchedWalletActivity } = require('./src/wallet-watcher-common');
const CONFIG = require('./config.json');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const db = new Database('monitor-node.db');
db.pragma('journal_mode = WAL');

const transport = webSocket(CONFIG.wsRemote);
const client = createPublicClient({
  chain: mainnet,
  transport
});

client.watchBlockNumber({
  onBlockNumber: block => parseBlockNumber(block)
});

async function parseBlockNumber(blockNumber) {
  await analyzeBlock({ client, db, blockNumber });
  const { recentPairs, recentSwaps } = await getWatchedWalletActivity({ client, db });
  await broadcastToClients('watchedWalletScreener', { recentPairs, recentSwaps });
};

async function broadcastToClients(type, data) {
  clients.forEach((client) => {
    client.send(JSON.stringify({ type, ...data }));
  });
}

const clients = [];
const PORT = 5002;
app.use(cors());
app.use(express.json());

app.get('/api/wallet/:address', async (req, res) => {
  try {
    const address = req.params.address;

    const watchedWalletQuery = db.prepare(`
      SELECT * 
      FROM watched_wallets
      WHERE address = ?`);
    const info = watchedWalletQuery.get(address.toLowerCase());

    const watchedWalletSwapsQuery = db.prepare(`
      SELECT * 
      FROM watched_wallet_view
      WHERE maker = ?
      ORDER BY timestamp DESC, txIndex DESC, logIndex DESC`);
    const swaps = watchedWalletSwapsQuery.all(address.toLowerCase());
    res.json({ info, swaps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data from the database' });
  }
});

app.get('/api/wallets', async (req, res) => {
  try {
    const watchedWalletsQuery = db.prepare(`
      SELECT
      ww.address,
      ww.ensName,
      (
        SELECT MAX(wws.timestamp)
        FROM watched_wallet_swaps AS wws
        WHERE wws.maker = ww.address
      ) AS lastSeen
      FROM watched_wallets AS ww
      ORDER BY lastSeen DESC`);
    const wallets = watchedWalletsQuery.all();
    res.json(wallets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data from the database' });
  }
});

/**
 * Fetches wallets that have been submitted for review
 */
app.get('/api/wallets-for-review', async (req, res) => {
  try {
    const getWalletsForReviewQuery = db.prepare('SELECT * FROM wallets_for_review ORDER BY reviewed ASC, added DESC');
    const wallets = getWalletsForReviewQuery.all();
    res.json(wallets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data from the database' });
  }
});

/**
 * Accepts client reviews of wallets
 */
app.post('/api/wallets-for-review', async (req, res) => {
  try {
    const { address, reviewed, added } = req.body;

    const updateWalletsForReviewQuery = db.prepare('UPDATE wallets_for_review SET reviewed = ?, added = ? WHERE address = ?');
    const response = updateWalletsForReviewQuery.run(reviewed, added, address);

    if (added) {
      const ensName = await client.getEnsName({ address });

      const insertWalletQuery = db.prepare('INSERT OR IGNORE INTO watched_wallets (address, ensName) VALUES (?, ?)');
      insertWalletQuery.run(address.toLowerCase(), ensName);
    }
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data from the database' });
  }
});

wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.push(ws);

  ws.on('message', async (message) => {
    const command = JSON.parse(message);

    if (command.type === 'getWatchedWalletActivity') {
      const { recentPairs, recentSwaps } = await getWatchedWalletActivity({ client, db });
      ws.send(JSON.stringify({ type: 'watchedWalletScreener', recentPairs, recentSwaps }));
    }

    if (command.type === 'addWallet') {
      const { address } = command;
      const insertWallet = db.prepare('INSERT OR IGNORE INTO watched_wallets (address, ensName) VALUES (?, ?)');
      const ensName = null;
      insertWallet.run(address.toLowerCase(), ensName);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.splice(clients.indexOf(ws), 1);
  });
});

// server.listen(PORT, '192.168.0.179', () => {
//   console.log(`Listening on port ${PORT}`);
// });

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
