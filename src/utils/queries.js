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

const INSERT_SCREENER_PAIR_QUERY = `INSERT OR IGNORE INTO screener_pairs (
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
  deployBlock) VALUES (
  $pair,
  $chainId,
  $pairAddress,
  $flipTokens,
  $token0,
  $token0Symbol,
  $token0Decimals,
  $token1,
  $token1Symbol,
  $token1Decimals,
  $deployBlock)`;

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

const INSERT_SCREENER_EVENT_QUERY = `INSERT OR IGNORE INTO screener_events (
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
  token1Out) VALUES (
  $block,
  $chainId,
  $pairAddress,
  $txIndex,
  $logIndex,
  $txHash,
  $eventName,
  $senderAddress,
  $makerAddress,
  $token0In,
  $token0Out,
  $token1In,
  $token1Out)`;

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
  INSERT_SCREENER_PAIR_QUERY,
  insertScreenerEventQuery,
  INSERT_SCREENER_EVENT_QUERY,
  insertHoneypotIsResultsQuery,
  insertHistoricalPairQuery,
  getHistoricalPairQuery,
  createHistoricalPairTableQuery,
  insertHistoricalEventQuery
};
