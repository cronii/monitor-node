const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');

const Database = require('better-sqlite3');

const { analyzeBlock } = require('../src/wallet-watcher-common');
const CONFIG = require('../config.json');

// testing script for range of block analysis
const BLOCK_START = 18233149n;
const BLOCK_END = 18237148n;

(async () => {
  try {
    const transport = http(CONFIG.rpcRemote);
    const client = createPublicClient({
      chain: mainnet,
      transport
    });

    const blockStart = process.argv[2] ? BigInt(process.argv[2]) : BLOCK_START;
    const blockEnd = process.argv[3] ? BigInt(process.argv[3]) : BLOCK_END;

    for (let blockNumber = blockStart; blockNumber <= blockEnd; blockNumber++) {
      const db = new Database('monitor-node.db');
      db.pragma('journal_mode = WAL');

      await analyzeBlock({ client, db, blockNumber });
      db.close();
    }
  } catch (err) {
    console.error(err);
  }
})();
