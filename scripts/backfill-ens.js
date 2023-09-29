const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');
const Database = require('better-sqlite3');

const CONFIG = require('../config.json');

(async () => {
  try {
    const transport = http(CONFIG.rpcLocal);
    const client = createPublicClient({
      chain: mainnet,
      transport
    });

    const db = new Database('monitor-node.db');
    db.pragma('journal_mode = WAL');

    const getWatchedWalletsQuery = db.prepare('SELECT * FROM watched_wallets');
    const watchedWallets = getWatchedWalletsQuery.all();

    for (const watchedWallet of watchedWallets) {
      const { address } = watchedWallet;
      const ensName = await client.getEnsName({ address });
      if (ensName) {
        const updateEns = db.prepare('UPDATE watched_wallets SET ensName = ? WHERE address = ?');
        updateEns.run(ensName, address);
      };
    }

    db.close();
  } catch (err) {
    console.error(err);
  }
})();
