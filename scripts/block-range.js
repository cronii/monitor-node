const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');

const Database = require('better-sqlite3');

const { analyzeBlock } = require('../src/common');
const CONFIG = require('../config.json');

// testing script for range of block analysis
const BLOCK_START = 18050541n;
const BLOCK_END = 18051541n;

// simulate production block times
const SIMULATE = false;
const BLOCK_TIME = 10000;

(async () => {
  try {
    const transport = http(CONFIG.rpcRemote);
    const client = createPublicClient({
      chain: mainnet,
      transport
    });

    const db = new Database('monitor-node.db');

    for (let blockNumber = BLOCK_START; blockNumber <= BLOCK_END; blockNumber++) {
      await analyzeBlock({ client, db, blockNumber, outputToFile: false });

      if (SIMULATE) await new Promise(resolve => setTimeout(resolve, BLOCK_TIME));
    }

    db.close();
  } catch (err) {
    console.error(err);
  }
})();
