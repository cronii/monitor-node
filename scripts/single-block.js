const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');

const { analyzeBlock } = require('../src/common');
const CONFIG = require('../config.json');

// testing script for single block analysis
const BLOCK_NUMBER = 17556072n;

(async () => {
  try {
    const transport = http(CONFIG.rpcLocal);
    const client = createPublicClient({
      chain: mainnet,
      transport
    });

    const blockNumber = process.argv[2] ? BigInt(process.argv[2]) : BLOCK_NUMBER;

    await analyzeBlock({ client, blockNumber, outputToFile: true });
  } catch (err) {
    console.error(err);
  }
})();
