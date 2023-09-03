const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

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

    const db = await open({
      filename: 'monitor-node.db',
      driver: sqlite3.Database
    });

    for (let blockNumber = BLOCK_START; blockNumber <= BLOCK_END; blockNumber++) {
      await analyzeBlock({ client, db, blockNumber, outputToFile: false });

      if (SIMULATE) await new Promise(resolve => setTimeout(resolve, BLOCK_TIME));
    }

    await db.close();
  } catch (err) {
    console.error(err);
  }
})();
