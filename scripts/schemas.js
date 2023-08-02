const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

(async () => {
  const db = await open({
    filename: 'monitor-node.db',
    driver: sqlite3.Database
  });

  await db.run(`CREATE TABLE IF NOT EXISTS scripts (
    script TEXT PRIMARY KEY,
    start_block INT,
    last_block INT)`);
  await db.run(`CREATE TABLE IF NOT EXISTS wallets (
    address TEXT PRIMARY KEY,
    name TEXT)`);
  await db.run(`CREATE TABLE IF NOT EXISTS wallet_tags (
    wallet_tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT,
    tag TEXT,
    FOREIGN KEY (address) REFERENCES wallets (address))`);
})();
