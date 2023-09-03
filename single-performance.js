const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { mainnet } = require('viem/chains');
const { createPublicClient, http, formatUnits } = require('viem');

const CONFIG = require('./config.json');
const UniswapV2PairABI = require('./src/abis/UniswapV2Pair.json');
const { generatePerformanceData } = require('./src/performance');
const { writeToFile } = require('./src/utils');

(async () => {
  const db = await open({
    filename: 'monitor-node.db',
    driver: sqlite3.Database
  });

  const transport = http(CONFIG.rpcRemote);
  const client = createPublicClient({
    chain: mainnet,
    transport
  });

  const tableName = 'TETRIS_WETH_V2'
  const {
    address: pairAddress,
    token0_decimals: token0Decimals,
    token1_decimals: token1Decimals,
    flip_token: flipTokens
  } = await db.get('SELECT * FROM pairs');

  const pairReserves = await client.readContract({
    address: pairAddress,
    abi: UniswapV2PairABI,
    functionName: 'getReserves'
  });

  const token0 = flipTokens ? pairReserves[0] : pairReserves[1];
  const token1 = flipTokens ? pairReserves[1] : pairReserves[0];

  const token0Balance = formatUnits(token0, token0Decimals);
  const token1Balance = formatUnits(token1, token1Decimals);
  const currentPrice = flipTokens ? token0Balance / token1Balance : token1Balance / token0Balance;

  const swaps = await db.all(`SELECT * FROM ${tableName} WHERE event_name = ? ORDER BY block, tx_index, log_index`, ['Swap']);
  const performanceData = generatePerformanceData(swaps, token0Decimals, token1Decimals, currentPrice);

  writeToFile('./reports/performance.json', performanceData);
})();
