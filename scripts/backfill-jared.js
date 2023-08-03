const { mainnet } = require('viem/chains');
const { createPublicClient, http, getAbiItem } = require('viem');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const CONFIG = require('../config.json');
const UniswapV2PairABI = require('../src/abis/UniswapV2Pair.json');

const { isWETH, toToken } = require('../src/utils');

const SCRIPT_NAME = 'backfill-jared';
const JARED = '0xae2fc483527b8ef99eb5d9b44875f005ba1fae13';
const CHUNK_SIZE = 25n;

(async () => {
  try {
    console.time(SCRIPT_NAME);
    const transport = http(CONFIG.rpcLocal);
    const client = createPublicClient({
      chain: mainnet,
      transport
    });

    const db = await open({
      filename: 'monitor-node.db',
      driver: sqlite3.Database
    });

    const blockStart = 17834000n;
    // const blockEnd = 17834000n;
    const blockEnd = await client.getBlockNumber();

    const pairAddresses = new Set();

    for (let chunkStart = blockStart; chunkStart <= blockEnd; chunkStart += CHUNK_SIZE) {
      console.time(`${chunkStart}`);
      const chunkEnd = chunkStart + CHUNK_SIZE - 1n <= blockEnd ? chunkStart + CHUNK_SIZE - 1n : blockEnd;
      const swapEvents = await client.getLogs({
        event: getAbiItem({ abi: UniswapV2PairABI, name: 'Swap' }),
        fromBlock: chunkStart,
        toBlock: chunkEnd
      });

      const txHashes = swapEvents.flatMap(event => event.transactionHash);

      const txPromises = [];
      for (const transactionHash of txHashes) {
        txPromises.push(client.getTransaction({ hash: transactionHash }));
      }

      const transactions = await Promise.all(txPromises);
      const jaredTxs = new Set();

      for (const tx of transactions) {
        if (tx.from === JARED) jaredTxs.add(tx.hash);
      }

      const jaredSwaps = swapEvents.filter(event => jaredTxs.has(event.transactionHash));
      jaredSwaps.map(event => pairAddresses.add(event.address));

      console.log(`${chunkStart}: ${jaredSwaps.length} txs`);
      console.log(`${chunkStart}: ${pairAddresses.size} pairs`);
      console.timeEnd(`${chunkStart}`);
    }

    for (const pairAddress of pairAddresses) {
      try {
        const { token0, token1, flipTokens } = await getPairData(client, pairAddress);
        const token0Symbol = token0.symbol.toUpperCase();
        const token1Symbol = token1.symbol.toUpperCase();
        const pairName = `${token0Symbol}_${token1Symbol}_V2`;

        const insertPairQuery = 'INSERT OR IGNORE INTO jared_pairs (pair, address, flip_tokens, token0, token0_address, token0_decimals, token1, token1_address, token1_decimals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        const { changes } = await db.run(insertPairQuery, [pairName, pairAddress, flipTokens, token0Symbol, token0.address, token0.decimals, token1Symbol, token1.address, token1.decimals]);
        if (changes > 0) console.log(`New Pair: ${pairName}`);
      } catch (err) {
        console.error(err);
      }
    }

    console.timeEnd(SCRIPT_NAME);
  } catch (err) {
    console.error(err);
  }
})();

async function getPairData(client, pairAddress) {
  const pairContract = {
    address: pairAddress,
    abi: UniswapV2PairABI
  };

  const rawPairData = await client.multicall({
    contracts: [
      {
        ...pairContract,
        functionName: 'token0'
      },
      {
        ...pairContract,
        functionName: 'token1'
      }
    ]
  });

  if (rawPairData.some(result => result.status === 'failure')) throw new Error(`Failed Pair Read: ${pairAddress}`);

  const flipTokens = isWETH(rawPairData[0].result);
  const token0 = await toToken(client, flipTokens ? rawPairData[1].result : rawPairData[0].result);
  const token1 = await toToken(client, flipTokens ? rawPairData[0].result : rawPairData[1].result);

  return { token0, token1, flipTokens };
}
