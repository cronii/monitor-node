const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');

const Database = require('better-sqlite3');

const { analyzeBlock } = require('../src/common');
const CONFIG = require('../config.json');

// testing script for single block analysis
const BLOCK_NUMBER = 17758954;

(async () => {
  try {
    const transport = http(CONFIG.rpcRemote);
    const client = createPublicClient({
      chain: mainnet,
      transport
    });

    const db = new Database('monitor-node.db');

    const blockNumber = process.argv[2] ? BigInt(process.argv[2]) : BLOCK_NUMBER;

    await analyzeBlock({ client, db, blockNumber, outputToFile: false });
    db.close();
  } catch (err) {
    console.error(err);
  }
})();
