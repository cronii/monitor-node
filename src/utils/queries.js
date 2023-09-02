const insertScreenerPairQuery = `INSERT OR IGNORE INTO screener_pairs (
  pair,
  chainId,
  pairAddress,
  flipTokens,
  token0,
  token0Symbol,
  token0Decimals,
  token1,
  token1Symbol,
  token1Decimals,
  deployBlock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const insertScreenerEventQuery = `INSERT INTO screener_events (
  block,
  chainId,
  pairAddress, 
  txIndex, 
  logIndex, 
  txHash, 
  eventName, 
  senderAddress, 
  makerAddress, 
  token0In, 
  token0Out, 
  token1In, 
  token1Out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const insertHoneypotIsResultsQuery = `INSERT INTO honeypot_is_results (
  token, 
  pairAddress, 
  chainId, 
  isHoneypot, 
  simulatedSuccess, 
  buyTax, 
  sellTax, 
  transferTax) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

const insertHistoricalPairQuery = `INSERT OR REPLACE INTO historical_pairs (
  pair, 
  pairAddress, 
  chainId,
  flipTokens, 
  token0, 
  token0Symbol,
  token0Decimals, 
  token1, 
  token1Symbol,
  token1Decimals, 
  deployBlock,
  lastBlock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const getHistoricalPairQuery = 'SELECT * FROM historical_pairs WHERE pair = ?';

const createHistoricalPairTableQuery = (tableName) => {
  return `CREATE TABLE IF NOT EXISTS ${tableName} (
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
    CONSTRAINT unique_combination UNIQUE (block, txIndex, logIndex))`;
}

const insertHistoricalEventQuery = (pairName) => {
  return `INSERT INTO ${pairName} (
    block,
    chainId,
    pairAddress, 
    txIndex, 
    logIndex, 
    txHash, 
    eventName, 
    senderAddress, 
    makerAddress, 
    token0In, 
    token0Out, 
    token1In, 
    token1Out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
}

module.exports = {
  insertScreenerPairQuery,
  insertScreenerEventQuery,
  insertHoneypotIsResultsQuery,
  insertHistoricalPairQuery,
  getHistoricalPairQuery,
  createHistoricalPairTableQuery,
  insertHistoricalEventQuery
};
