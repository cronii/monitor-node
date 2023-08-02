const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cors = require('cors');

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

app.get('/api/wallets', async (req, res) => {
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
