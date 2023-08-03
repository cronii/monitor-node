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
    type TEXT,
    FOREIGN KEY (address) REFERENCES wallets (address))`);
  await db.run(`CREATE VIEW IF NOT EXISTS v_wallet_tags AS 
    SELECT address, count(CASE WHEN type = "Token" THEN 1 END) as tokens, count(CASE WHEN type = "Behavior" THEN 1 END) as behavior, count(CASE WHEN type = "TG Bot" THEN 1 END) as tg_bot
    FROM wallet_tags
    GROUP BY address
    ORDER BY tokens DESC`);
})();
