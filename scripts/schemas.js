const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

(async () => {
  const db = await open({
    filename: 'monitor-node.db',
    driver: sqlite3.Database
  });

  await db.run(`CREATE TABLE IF NOT EXISTS wallets (
    address TEXT UNIQUE PRIMARY KEY,
    name TEXT)`);
  await db.run(`CREATE TABLE IF NOT EXISTS contracts (
    address TEXT UNIQUE PRIMARY KEY,
    name TEXT)`);
  await db.run(`CREATE TABLE IF NOT EXISTS wallet_tags (
    wallet_tag_id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT,
    tag TEXT,
    type TEXT,
    FOREIGN KEY (address) REFERENCES wallets (address),
    CONSTRAINT unique_combination UNIQUE (address, tag))`);

  await db.run(`CREATE VIEW IF NOT EXISTS v_wallet_tags AS 
    SELECT address, count(CASE WHEN type = "token" THEN 1 END) as tokens, count(CASE WHEN type = "behavior" THEN 1 END) as behavior, count(CASE WHEN type = "tg bot" THEN 1 END) as tg_bot
    FROM wallet_tags
    GROUP BY address
    ORDER BY tokens DESC`);

  await db.run(`CREATE TABLE IF NOT EXISTS screener_pairs (
    pair TEXT PRIMARY KEY,
    pairAddress TEXT,
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
    CONSTRAINT unique_combination UNIQUE (pair, pairAddress, chainId))`);

  await db.run(`CREATE TABLE IF NOT EXISTS screener_events (
    txId INTEGER PRIMARY KEY AUTOINCREMENT,
    pairAddress TEXT,
    chainId INT,
    block INT,
    txIndex INT,
    logIndex INT,
    txHash TEXT,
    eventName TEXT,
    senderAddress TEXT,
    makerAddress TEXT,
    token0In TEXT,
    token0Out TEXT,
    token1In TEXT,
    token1Out TEXT,
    CONSTRAINT unique_combination UNIQUE (block, txIndex, logIndex))`);

  await db.run(`CREATE TABLE IF NOT EXISTS historical_pairs (
    pair TEXT PRIMARY KEY,
    pairAddress TEXT,
    chainId INT,
    flipTokens BOOLEAN,
    token0 TEXT,
    token0Symbol TEXT,
    token0Decimals INT,
    token1 TEXT,
    token1Symbol TEXT,
    token1Decimals INT,
    deployBlock INT,
    lastBlock INT,
    lastUpdateBlock INT,
    createdTimestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_combination UNIQUE (pair, pairAddress, chainId))`);

  await db.run(`CREATE TABLE IF NOT EXISTS honeypot_is_results (
    honeypotId INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT,
    pairAddress TEXT,
    chainId INT,
    isHoneypot BOOLEAN,
    simulatedSuccess BOOLEAN,
    buyTax INT,
    sellTax INT,
    transferTax INT,
    CONSTRAINT unique_combination UNIQUE (token, pairAddress, chainId))`);

  await db.run(`CREATE TABLE IF NOT EXISTS wallets_for_review (
    address TEXT UNIQUE PRIMARY KEY,
    reviewed BOOLEAN)`);

  await db.run(`CREATE VIEW IF NOT EXISTS watched_pairs AS
    SELECT sp.token0Symbol, sp.token1Symbol, sp.token0, sp.token1, sp.pair, sp.pairAddress, sp.chainId, flipTokens, deployBlock, lastUpdateBlock, buyTax, sellTax, transferTax, createdTimestamp
    FROM screener_pairs sp
    INNER JOIN honeypot_is_results hir ON sp.pairAddress = hir.pairAddress
    WHERE hir.isHoneypot = false
    AND hir.simulatedSuccess = true
    AND hir.buyTax < 6
    AND hir.sellTax < 6
    AND createdTimestamp >= datetime('now', '-12 hours')
    ORDER BY sp.deployBlock DESC`);
})();
