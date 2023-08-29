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

module.exports = {
  insertScreenerPairQuery,
  insertScreenerEventQuery,
  insertHoneypotIsResultsQuery
};
