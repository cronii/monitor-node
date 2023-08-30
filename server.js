const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');

const app = express();
const PORT = 5001;
app.use(cors());

app.get('/api/events', async (req, res) => {
  const { chain } = req.query;
  const pair = req.query.pair.toLowerCase();

  try {
    const db = await open({
      filename: 'monitor-node.db',
      driver: sqlite3.Database
    });

    const getEventsQuery = `SELECT * FROM screener_events 
      WHERE chainId = ? AND pairAddress = ?
      ORDER BY block, txIndex, logIndex`;

    const results = await db.all(getEventsQuery, [chain, pair]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data from the database' });
  }
});

app.get('/api/pairs', async (req, res) => {
  try {
    const db = await open({
      filename: 'monitor-node.db',
      driver: sqlite3.Database
    });

    const getPairsQuery = `SELECT sp.*, COUNT(se.txId) AS eventCount
      FROM screener_pairs sp
      LEFT JOIN screener_events se ON sp.pairAddress = se.pairAddress AND sp.chainId = se.chainId
      GROUP BY sp.pairAddress;
      ORDER BY deployBlock DESC`;

    const results = await db.all(getPairsQuery);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data from the database' });
  }
});

app.get('/api/pair', async (req, res) => {
  const { chain } = req.query;
  const pair = req.query.pair.toLowerCase();

  try {
    const db = await open({
      filename: 'monitor-node.db',
      driver: sqlite3.Database
    });

    const getPairQuery = `SELECT * FROM screener_pairs
      WHERE chainId = ? AND pairAddress = ?
      ORDER BY deployBlock DESC`;

    const results = await db.get(getPairQuery, [chain, pair]);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data from the database' });
  }
});

app.get('/api/watched-pairs', async (req, res) => {
  try {
    const db = await open({
      filename: 'monitor-node.db',
      driver: sqlite3.Database
    });

    const getWatchedPairsQuery = `SELECT wp.*, COUNT(se.txId) AS eventCount
      FROM watched_pairs wp
      LEFT JOIN screener_events se ON wp.pairAddress = se.pairAddress AND wp.chainId = se.chainId
      GROUP BY wp.pairAddress
      ORDER BY deployBlock DESC`;

    const results = await db.all(getWatchedPairsQuery);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch data from the database' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
