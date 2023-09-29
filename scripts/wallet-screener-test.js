const { createPublicClient, http, decodeEventLog, formatUnits } = require('viem');
const { mainnet } = require('viem/chains');

// const Database = require('better-sqlite3');
const { UniswapV2PairABI, UniswapV3PairABI } = require('../src/abis');
const { UNI_V2_SWAP_TOPIC, UNI_V3_SWAP_TOPIC } = require('../src/utils/constants');
const { toToken } = require('../src/utils');

const WALLETS = require('../input/wallets.json');
const CONFIG = require('../config.json');

// testing script for range of block analysis
// const BLOCK_START = 18179968n;
// const BLOCK_END = 18179969n;

const BLOCK_START = 18187946n;
const BLOCK_END = 18190559n;

const SWAP_TOPICS = [UNI_V2_SWAP_TOPIC, UNI_V3_SWAP_TOPIC];
const TOPIC_MAPPINGS = {
  [UNI_V2_SWAP_TOPIC]: { abi: UniswapV2PairABI, logger: logUniswapV2Swap },
  [UNI_V3_SWAP_TOPIC]: { abi: UniswapV3PairABI, logger: logUniswapV3Swap }
};

const WHITELISTED_CONTRACTS = [
  '0x9008d19f58aabd9ed0d60971565aa8510560ab41' // cowswap
];

// const WHITELISTED_CONTRACTS = ['0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad'];

// const contracts = [
//   '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', // uniswap universal router
//   '0x6a9e45482bf17cf746e659fd4a13b8a348221f12',
//   '0x3999d2c5207c06bbc5cf8a6bea52966cabb76d41', // unibot router
//   '0xe6a000b4c80591082229274712277a58a06f0335',
//   '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // uniswap v2 router 2
//   '0xcac0f1a06d3f02397cfb6d7077321d73b504916e', // maestro?
//   '0xb99ee7b6affbb06ca27bbc5aa23e3b95961d54fc',
//   '0xf51f3b3c45cc8b96f646f0427cecd179344f8171',
//   '0x2ec705d306b51e486b1bc0d6ebee708e0661add1', // ??
//   '0x6216f4f38745a41ea048e273ee20cfe5a8e8c2f4',
//   '0x3033e38684ebe71e89701c343ed3a8e77ebadfd3',
//   '0x69d29f1b0cc37d8d3b61583c99ad0ab926142069',
//   '0x839f29cec31d108bf04449fba8a542da83adae06',
//   '0xf25836a9c2ac5d8b519313718d2f09c4eede0e81',
//   '0x6213f40e00f4595aa038fa710e3f837b492d6757'
// ]

/**
 * Given a list of wallets, simulate watching them for a given block range
 */
(async () => {
  try {
    const transport = http(CONFIG.rpcLocal);
    const client = createPublicClient({
      chain: mainnet,
      transport
    });

    const walletSet = new Set(WALLETS.map(wallet => wallet.toLowerCase()));
    const contractSet = new Set(WHITELISTED_CONTRACTS.map(contract => contract.toLowerCase()));

    const tempPairs = {};

    // const db = new Database('monitor-node.db');

    for (let blockNumber = BLOCK_START; blockNumber <= BLOCK_END; blockNumber++) {
      // const blockNumberString = blockNumber.toString();
      // console.time(blockNumberString);

      const block = await client.getBlock({ blockNumber });
      const events = await client.getLogs({ blockHash: block.hash });

      console.log(block.timestamp);

      // get all swap events and their corresponding txs
      const { swapEvents, txPromises } = events.reduce((acc, event) => {
        const { transactionHash, transactionIndex, topics } = event;
        if (SWAP_TOPICS.includes(topics[0])) {
          acc.swapEvents.push(event);
          acc.txPromises[transactionIndex] = client.getTransaction({ hash: transactionHash });
        }
        return acc;
      }, { swapEvents: [], txPromises: new Array(block.transactions.length) });

      const txs = await Promise.all(txPromises);

      for (const event of swapEvents) {
        const { transactionIndex, topics, data, address: pairAddress } = event;
        const { from: maker, to } = txs[transactionIndex];

        // currently this accounts when maker is a watched wallet, or the to is a watched contract
        if (walletSet.has(maker.toLowerCase()) || contractSet.has(to.toLowerCase())) {
          const topicMapping = TOPIC_MAPPINGS[topics[0]];

          if (topicMapping) {
            const { abi, logger } = topicMapping;
            const { args } = decodeEventLog({ abi, data, topics });

            if (tempPairs[pairAddress] === undefined) {
              tempPairs[pairAddress] = await getPairData({ client, abi, pairAddress });
            }

            const { token0, token1 } = tempPairs[pairAddress];
            logger({ args, token0, token1, maker });
          } else {
            throw new Error(`Unknown swap topic: ${topics[0]}`);
          }
        }
      }

      // console.timeEnd(blockNumberString);
    }

    // const contracts = Array.from(contractSet);
    // console.log(contracts);

    // db.close();
  } catch (err) {
    console.error(err);
  }
})();

function logUniswapV2Swap({ args, token0, token1, maker }) {
  const { amount0In, amount0Out, amount1In, amount1Out } = args;
  const isBuy = amount1Out > 0n;

  isBuy ? logSwap(maker, token0, amount0In, token1, amount1Out) : logSwap(maker, token1, amount1In, token0, amount0Out);
}

function logUniswapV3Swap({ args, token0, token1, maker }) {
  const { amount0, amount1 } = args;
  const isBuy = amount0 > 0n;

  isBuy ? logSwap(maker, token0, amount0, token1, amount1) : logSwap(maker, token1, amount1, token0, amount0);
}

function logSwap(maker, tokenSold, amountSold, tokenBought, amountBought) {
  const displayMaker = truncateAddress(maker);
  const displayAmountSold = truncateDecimal(formatUnits(amountSold, tokenSold.decimals));
  const displayTokenSold = tokenSold.symbol;
  const displayAmountBought = truncateDecimal(formatUnits(amountBought, tokenBought.decimals));
  const displayTokenBought = tokenBought.symbol;

  console.log(`[${displayMaker}] ${displayAmountSold} ${displayTokenSold} -> ${displayAmountBought} ${displayTokenBought}`);
}

async function getPairData({ client, abi, pairAddress }) {
  const pairContract = {
    address: pairAddress,
    abi
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

  // const flipTokens = isWETH(rawPairData[0].result.toLowerCase());
  const token0 = await toToken(client, rawPairData[0].result);
  const token1 = await toToken(client, rawPairData[1].result);

  return {
    // flipTokens,
    token0,
    token1
  };
}

function truncateAddress(hexString, length = 6) {
  if (hexString.length <= 2 * length) {
    return hexString; // No need to truncate if the string is already shorter
  }

  const prefix = hexString.slice(0, length); // Include the "0x" prefix
  const suffix = hexString.slice(-length);

  return `${prefix}...${suffix}`;
}

function truncateDecimal(numberString, decimalPlaces = 4) {
  // Parse the number string into a floating-point number
  const number = parseFloat(numberString);

  // Check if the parsed number is a valid finite number
  if (!isFinite(number)) {
    throw new Error('Input is not a valid number');
  }

  // Use toFixed to round and format the number to the specified decimal places
  const truncatedNumber = number.toFixed(decimalPlaces);

  return truncatedNumber;
}
