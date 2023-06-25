const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');

const { analyzeBlock } = require('../src/common');
const CONFIG = require('../config.json');

// testing script for single block analysis
const BLOCK_NUMBER = 17551367n;

(async () => {
  try {
    const transport = http(CONFIG.rpcLocal);
    const client = createPublicClient({
      chain: mainnet,
      transport
    });

    await analyzeBlock({ client, blockNumber: BLOCK_NUMBER, output: true });
  } catch (err) {
    console.error(err);
  }
})();
