const { mainnet } = require('viem/chains');
const { createPublicClient, http, decodeEventLog } = require('viem');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const CONFIG = require('../config.json');
const UniswapV2PairABI = require('../src/abis/UniswapV2Pair.json');

const { isWETH, getContractCreationData, toToken } = require('../src/utils');

// MARBLE/WETH UNISWAP V2
const PAIR_ADDRESS = '0xdcd34cf0bb038821cac55db957c00f9f89f01610';
const CHUNK_SIZE = 50n;

// @TODO: pull all pools from dexscreener
// https://docs.dexscreener.com/api/reference

const SWAP = 'Swap';
const MINT = 'Mint';
const BURN = 'Burn';

const WATCHED_EVENTS = [SWAP, MINT, BURN];

(async () => {
  try {
    console.time('backfill-swaps');
    const transport = http(CONFIG.rpcLocal);
    const client = createPublicClient({
      chain: mainnet,
      transport
    });

    const db = await open({
      filename: 'monitor-node.db',
      driver: sqlite3.Database
    });

    const pairAddress = process.argv[2] ? process.argv[2] : PAIR_ADDRESS;

    const contractCreationData = await getContractCreationData(pairAddress);

    const creationTxData = await client.getTransaction({
      hash: contractCreationData.txHash
    });

    const contractData = {
      ...contractCreationData,
      blockNumber: creationTxData.blockNumber
    }

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

    // Flip Tokens if WETH is token0
    const flipTokens = isWETH(rawPairData[0].result);
    const token0 = await toToken(client, flipTokens ? rawPairData[1].result : rawPairData[0].result);
    const token1 = await toToken(client, flipTokens ? rawPairData[0].result : rawPairData[1].result);

    const token0Symbol = token0.symbol.toUpperCase();
    const token1Symbol = token1.symbol.toUpperCase();

    // @TODO hardcoded for v2
    const pairName = `${token0Symbol}_${token1Symbol}_V2`;

    await db.run(`CREATE TABLE IF NOT EXISTS pairs (
      pair TEXT PRIMARY KEY,
      address TEXT,
      flip_tokens BOOLEAN,
      token0 TEXT, 
      token0_decimals INT,
      token1 TEXT, 
      token1_decimals INT,
      startBlock INT, 
      lastBlock INT)`);
    await db.run(`CREATE TABLE IF NOT EXISTS ${pairName} (
      tx_id INTEGER PRIMARY KEY AUTOINCREMENT,
      block INT,
      tx_index INT,
      log_index INT,
      tx_hash TEXT,
      event_name TEXT,
      sender_address TEXT,
      maker_address TEXT,
      token0_in TEXT,
      token0_out TEXT,
      token1_in TEXT,
      token1_out TEXT,
      CONSTRAINT unique_combination UNIQUE (block, tx_index, log_index))`);

    const getPairsQuery = 'SELECT * FROM pairs WHERE pair = ?';
    const pair = await db.get(getPairsQuery, [pairName]);

    let blockStart;
    if (pair) {
      console.log(pair)
      console.log('Pair already exists, starting from last block ', pair.lastBlock);
      blockStart = BigInt(pair.lastBlock) + 1n;
    } else {
      blockStart = contractData.blockNumber;
    }
    const blockEnd = await client.getBlockNumber();

    const insertPairQuery = 'INSERT OR REPLACE INTO pairs (pair, address, flip_tokens, token0, token0_decimals, token1, token1_decimals, startBlock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    await db.run(insertPairQuery, [pairName, pairAddress, flipTokens, token0Symbol, token0.decimals, token1Symbol, token1.decimals, Number(blockStart)]);

    let counter = 0;
    for (let chunkStart = blockStart; chunkStart <= blockEnd; chunkStart += CHUNK_SIZE) {
      const chunkEnd = chunkStart + CHUNK_SIZE - 1n <= blockEnd ? chunkStart + CHUNK_SIZE - 1n : blockEnd;

      const pairEvents = await client.getLogs({
        address: pairAddress,
        fromBlock: chunkStart,
        toBlock: chunkEnd
      });

      // @TODO make this a batch insert
      pairEvents.forEach(async (pairEvent) => {
        const { eventName, args } = decodeEventLog({ abi: UniswapV2PairABI, data: pairEvent.data, topics: pairEvent.topics });

        if (WATCHED_EVENTS.includes(eventName)) {
          const { blockNumber, transactionIndex, logIndex, transactionHash } = pairEvent;
          const { from: maker } = await client.getTransaction({ hash: transactionHash });
          const { sender } = args;

          let amounts = [];
          if (eventName === 'Mint') {
            const { amount0, amount1 } = args;
            amounts = [amount0.toString(), '0', amount1.toString(), '0'];
          } else if (eventName === 'Burn') {
            const { amount0, amount1 } = args;
            amounts = ['0', amount0.toString(), '0', amount1.toString()];
          } else if (eventName === 'Swap') {
            const { amount0In, amount0Out, amount1In, amount1Out } = args;
            amounts = [amount0In.toString(), amount0Out.toString(), amount1In.toString(), amount1Out.toString()];
          }

          if (flipTokens) amounts = [amounts[2], amounts[3], amounts[0], amounts[1]];

          await db.run(`INSERT INTO ${pairName} (block, tx_index, log_index, tx_hash, event_name, sender_address, maker_address, token0_in, token0_out, token1_in, token1_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [Number(blockNumber), transactionIndex, logIndex, transactionHash, eventName, sender, maker, ...amounts]);

          counter++;
        }
      });
    }

    const updatePairQuery = 'UPDATE pairs SET lastBlock = ? WHERE pair = ?';
    await db.run(updatePairQuery, [Number(blockEnd), pairName]);

    console.timeEnd('backfill-swaps');
    console.log(counter);
  } catch (err) {
    console.error(err);
  }
})();
