const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');
// const { mainnet } = require('viem/chains');
// const { createPublicClient, http } = require('viem');
// const { generatePerformanceData } = require('./src/performance');

// const CONFIG = require('./config.json');
// const UniswapV2PairABI = require('./src/abis/UniswapV2Pair.json');

// const transport = http(CONFIG.rpcLocal);
// const client = createPublicClient({
//   chain: mainnet,
//   transport
// });

const app = express();
const PORT = 5001;
app.use(cors());

app.get('/api/swaps', async (req, res) => {
  const quote = req.query.quote;
  const base = req.query.base;
  const pool = req.query.pool;

  try {
    const db = await open({
      filename: 'monitor-node.db',
      driver: sqlite3.Database
    });

    const tableName = `${quote}_${base}_${pool}`.toUpperCase();
    const getSwapsQuery = `SELECT * FROM ${tableName} ORDER BY block, tx_index, log_index`;

    const results = await db.all(getSwapsQuery);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data from the database' });
  }
});

app.get('/api/pairs', async (req, res) => {
  const quote = req.query.quote;
  const base = req.query.base;
  const pool = req.query.pool;

  try {
    const db = await open({
      filename: 'monitor-node.db',
      driver: sqlite3.Database
    });

    const tableName = `${quote}_${base}_${pool}`.toUpperCase();
    const results = await db.get('SELECT * FROM pairs WHERE pair = ?', [tableName]);

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data from the database' });
  }
});

// app.get('/api/swaps/performance', async (req, res) => {
//   const quote = req.query.quote;
//   const base = req.query.base;
//   const pool = req.query.pool;

//   const tableName = `${quote}_${base}_${pool}`.toUpperCase();
//   const { address: pairAddress, flip_tokens: flipTokens } = await db.get('SELECT * FROM pairs WHERE pair = ?', [tableName]);

//   const pairReserves = await client.readContract({
//     address: pairAddress,
//     abi: UniswapV2PairABI,
//     functionName: 'getReserves'
//   });

//   const currentPrice = flipTokens ? pairReserves[1] / pairReserves[0] : pairReserves[0] / pairReserves[1];

//   db.all(`SELECT * FROM ${tableName} WHERE event_name = ? ORDER BY block, tx_index, log_index`, ['Mint'], async (err, rows) => {
//     if (err) {
//       console.error(err);
//       res.status(500).json({ error: 'Failed to fetch data from the database' });
//     } else {
//       const performanceData = generatePerformanceData(rows, currentPrice);
//       res.json(performanceData);
//     }
//   });
// });

app.get('/api/wallets', async (req, res) => {
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
