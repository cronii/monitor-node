const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');

const { analyzeBlock } = require('../src/common');
const CONFIG = require('../config.json');

// testing script for range of block analysis
const BLOCK_START = 17551367n;
const BLOCK_END = 17551400n;

(async () => {
  try {
    const transport = http(CONFIG.rpcLocal);
    const client = createPublicClient({
      chain: mainnet,
      transport
    });

    for (let blockNumber = BLOCK_START; blockNumber <= BLOCK_END; blockNumber++) {
      await analyzeBlock({ client, blockNumber, output: false });
    }
  } catch (err) {
    console.error(err);
  }
})();
