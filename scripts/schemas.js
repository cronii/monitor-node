const Database = require('better-sqlite3');

(async () => {
  const db = new Database('monitor-node.db');

  // await db.run(`CREATE TABLE IF NOT EXISTS wallets (
  //   address TEXT UNIQUE PRIMARY KEY,
  //   name TEXT)`);
  // await db.run(`CREATE TABLE IF NOT EXISTS contracts (
  //   address TEXT UNIQUE PRIMARY KEY,
  //   name TEXT)`);
  // await db.run(`CREATE TABLE IF NOT EXISTS wallet_tags (
  //   wallet_tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
  //   address TEXT,
  //   tag TEXT,
  //   type TEXT,
  //   FOREIGN KEY (address) REFERENCES wallets (address),
  //   CONSTRAINT unique_combination UNIQUE (address, tag))`);

  // await db.run(`CREATE VIEW IF NOT EXISTS v_wallet_tags AS
  //   SELECT address, count(CASE WHEN type = "token" THEN 1 END) as tokens, count(CASE WHEN type = "behavior" THEN 1 END) as behavior, count(CASE WHEN type = "tg bot" THEN 1 END) as tg_bot
  //   FROM wallet_tags
  //   GROUP BY address
  //   ORDER BY tokens DESC`);

  // await db.run(`CREATE TABLE IF NOT EXISTS screener_pairs (
  //   pair TEXT PRIMARY KEY,
  //   pairAddress TEXT,
  //   chainId INT,
  //   flipTokens BOOLEAN,
  //   token0 TEXT,
  //   token0Symbol TEXT,
  //   token0Decimals INT,
  //   token1 TEXT,
  //   token1Symbol TEXT,
  //   token1Decimals INT,
  //   deployBlock INT,
  //   lastUpdateBlock INT,
  //   createdTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //   CONSTRAINT unique_combination UNIQUE (pair, pairAddress, chainId))`);

  // await db.run(`CREATE TABLE IF NOT EXISTS screener_events (
  //   txId INTEGER PRIMARY KEY AUTOINCREMENT,
  //   pairAddress TEXT,
  //   chainId INT,
  //   block INT,
  //   txIndex INT,
  //   logIndex INT,
  //   txHash TEXT,
  //   eventName TEXT,
  //   senderAddress TEXT,
  //   makerAddress TEXT,
  //   token0In TEXT,
  //   token0Out TEXT,
  //   token1In TEXT,
  //   token1Out TEXT,
  //   CONSTRAINT unique_combination UNIQUE (block, txIndex, logIndex))`);

  // await db.run(`CREATE TABLE IF NOT EXISTS historical_pairs (
  //   pair TEXT PRIMARY KEY,
  //   pairAddress TEXT,
  //   chainId INT,
  //   flipTokens BOOLEAN,
  //   token0 TEXT,
  //   token0Symbol TEXT,
  //   token0Decimals INT,
  //   token1 TEXT,
  //   token1Symbol TEXT,
  //   token1Decimals INT,
  //   deployBlock INT,
  //   lastBlock INT,
  //   lastUpdateBlock INT,
  //   createdTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //   CONSTRAINT unique_combination UNIQUE (pair, pairAddress, chainId))`);

  // await db.run(`CREATE TABLE IF NOT EXISTS honeypot_is_results (
  //   honeypotId INTEGER PRIMARY KEY AUTOINCREMENT,
  //   token TEXT,
  //   pairAddress TEXT,
  //   chainId INT,
  //   isHoneypot BOOLEAN,
  //   simulatedSuccess BOOLEAN,
  //   buyTax INT,
  //   sellTax INT,
  //   transferTax INT,
  //   CONSTRAINT unique_combination UNIQUE (token, pairAddress, chainId))`);

  // await db.run(`CREATE TABLE IF NOT EXISTS wallets_for_review (
  //   address TEXT UNIQUE PRIMARY KEY,
  //   reviewed BOOLEAN)`);

  // WITH HONEYPOT TABLE JOIN
  // await db.run(`CREATE VIEW IF NOT EXISTS watched_pairs AS
  //   SELECT sp.token0Symbol, sp.token1Symbol, sp.token0, sp.token1, sp.pair, sp.pairAddress, sp.chainId, flipTokens, deployBlock, lastUpdateBlock, buyTax, sellTax, transferTax, createdTimestamp
  //   FROM screener_pairs sp
  //   INNER JOIN honeypot_is_results hir ON sp.pairAddress = hir.pairAddress
  //   WHERE hir.isHoneypot = false
  //   AND hir.simulatedSuccess = true
  //   AND hir.buyTax < 6
  //   AND hir.sellTax < 6
  //   AND createdTimestamp >= datetime('now', '-12 hours')
  //   ORDER BY sp.deployBlock DESC`);

  // db.run('DROP VIEW IF EXISTS watched_pairs');
  // db.run(`CREATE VIEW watched_pairs AS
  //   SELECT *
  //   FROM screener_pairs
  //   WHERE createdTimestamp >= datetime('now', '-24 hours')
  //   ORDER BY deployBlock DESC`);

  db.prepare(`CREATE TABLE IF NOT EXISTS watched_wallets (
    address TEXT UNIQUE PRIMARY KEY NOT NULL,
    name TEXT,
    ensName TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS watched_wallet_swaps (
    txId INTEGER PRIMARY KEY AUTOINCREMENT,
    maker TEXT,
    txHash TEXT NOT NULL,
    chainId INT,
    block INT,
    txIndex INT,
    logIndex INT,
    pairAddress TEXT,
    tokenSold TEXT,
    amountSold TEXT,
    tokenBought TEXT,
    amountBought TEXT,
    timestamp INT,
    CONSTRAINT unique_combination UNIQUE (chainId, block, txIndex, logIndex))`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS watched_wallet_pairs (
    pairName TEXT NOT NULL,
    pairAddress TEXT PRIMARY KEY NOT NULL,
    chainId INT,
    flipTokens BOOLEAN,
    token0 TEXT,
    token0Symbol TEXT,
    token0Decimals INT,
    token1 TEXT,
    token1Symbol TEXT,
    token1Decimals INT,
    deployBlock INT,
    lastUpdateBlock INT,
    createdTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_combination UNIQUE (pairAddress, chainId))`).run();

  db.prepare('DROP VIEW IF EXISTS watched_wallet_view').run();
  db.prepare(`CREATE VIEW IF NOT EXISTS watched_wallet_view AS
    SELECT
    t1.timestamp,
    t1.chainId,
    t2.pairName,
    t1.pairAddress,
    t1.maker,
    t3.ensName,
    t1.txHash,
    t2.flipTokens,
    t1.amountSold,
    CASE
        WHEN t1.tokenSold = t2.token0 THEN t2.token0Symbol
        WHEN t1.tokenSold = t2.token1 THEN t2.token1Symbol
    END AS tokenSoldSymbol,
    t1.amountBought,
    CASE
        WHEN t1.tokenBought = t2.token0 THEN t2.token0Symbol
        WHEN t1.tokenBought = t2.token1 THEN t2.token1Symbol
    END AS tokenBoughtSymbol,
    t1.block,
    t1.txIndex,
    t1.logIndex
  FROM watched_wallet_swaps AS t1
  INNER JOIN watched_wallet_pairs AS t2 ON t1.pairAddress = t2.pairAddress
  LEFT JOIN watched_wallets t3 ON t1.maker = t3.address`).run();
})();
