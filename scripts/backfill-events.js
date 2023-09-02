const { mainnet } = require('viem/chains');
const { createPublicClient, http, decodeEventLog } = require('viem');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const CONFIG = require('../config.json');
const UniswapV2PairABI = require('../src/abis/UniswapV2Pair.json');

const { isWETH, getContractCreationData, toToken } = require('../src/utils');
const {
  createHistoricalPairTableQuery,
  insertHistoricalPairQuery,
  getHistoricalPairQuery,
  insertHistoricalEventQuery
} = require('../src/utils/queries');
const { ETH_CHAIN_ID } = require('../src/utils/constants');

const PAIR_ADDRESS = '0x9b0e1c344141fb361b842d397df07174e1cdb988';
const CHUNK_SIZE = 50n;
const TX_LIMIT = 5000;

const SWAP = 'Swap';
const MINT = 'Mint';
const BURN = 'Burn';

const TOKEN_TAG = 'token';

const WATCHED_EVENTS = [SWAP, MINT, BURN];

(async () => {
  try {
    console.time('historical-events');
    const transport = http(CONFIG.rpcRemote);
    const client = createPublicClient({
      chain: mainnet,
      transport
    });

    const db = await open({
      filename: 'monitor-node.db',
      driver: sqlite3.Database
    });

    const pairAddress = process.argv[2] ? process.argv[2] : PAIR_ADDRESS;
    const txLimit = process.argv[3] ? process.argv[3] : TX_LIMIT;

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
    const flipTokens = isWETH(rawPairData[0].result.toLowerCase());
    const token0 = await toToken(client, flipTokens ? rawPairData[1].result : rawPairData[0].result);
    const token1 = await toToken(client, flipTokens ? rawPairData[0].result : rawPairData[1].result);

    const token0Symbol = token0.symbol.toUpperCase();
    const token1Symbol = token1.symbol.toUpperCase();

    // @TODO hardcoded for v2
    const pairName = `${token0Symbol}_${token1Symbol}_V2`;
    await db.run(createHistoricalPairTableQuery(pairName));

    const pair = await db.get(getHistoricalPairQuery, [pairName]);

    let blockStart;
    if (pair) {
      console.log('Pair already exists, starting from last block ', pair.lastBlock);
      blockStart = BigInt(pair.lastBlock) + 1n;
    } else {
      blockStart = contractData.blockNumber;
    }
    const blockEnd = await client.getBlockNumber();

    await db.run(insertHistoricalPairQuery, [pairName, pairAddress, ETH_CHAIN_ID, flipTokens, token0.address, token0Symbol, token0.decimals, token1.address, token1Symbol, token1.decimals, Number(blockStart)]);

    let counter = 0;
    for (let chunkStart = blockStart; chunkStart <= blockEnd; chunkStart += CHUNK_SIZE) {
      const chunkEnd = chunkStart + CHUNK_SIZE - 1n <= blockEnd ? chunkStart + CHUNK_SIZE - 1n : blockEnd;
      if (counter >= txLimit) break;

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

          await db.run(insertHistoricalEventQuery(pairName),
            [Number(blockNumber), ETH_CHAIN_ID, pairAddress, transactionIndex, logIndex, transactionHash, eventName, sender, maker, ...amounts]);

          // insert and tag unique wallets
          const insertMakerWallet = 'INSERT OR IGNORE INTO wallets (address) VALUES (?)';
          await db.run(insertMakerWallet, [maker.toLowerCase()]);

          const insertMakerWalletTag = 'INSERT OR IGNORE INTO wallet_tags (address, tag, type) VALUES (?, ?, ?)';
          await db.run(insertMakerWalletTag, [maker.toLowerCase(), token0Symbol, TOKEN_TAG]);

          counter++;
        }
      });
    }

    const updatePairQuery = 'UPDATE historical_pairs SET lastBlock = ? WHERE pair = ?';
    await db.run(updatePairQuery, [Number(blockEnd), pairName]);

    console.timeEnd('historical-events');
    console.log(counter);
  } catch (err) {
    console.error(err);
  }
})();
