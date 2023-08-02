const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { mainnet } = require('viem/chains');
const { createPublicClient, http } = require('viem');

const { tagWallet } = require('../src/utils');
const CONFIG = require('../config.json');

const TABLE_NAME = 'TETRIS_WETH_V2';
const WALLET_TAG = 'Banana Gun Wallet';
const TAG_TYPE = 'TG Bot';
const ALLOW_DUPE_TAG = false;

(async () => {
  const db = await open({
    filename: 'monitor-node.db',
    driver: sqlite3.Database
  });

  const transport = http(CONFIG.rpcLocal);
  const client = createPublicClient({
    chain: mainnet,
    transport
  });

  const BANANA_GUN_ROUTER = '0x66D0b8f1C539a395Fb402CC25adE893b109e187f';
  const BANANA_GUN_CONTRACTS = [
    '0xdc13700db7f7cda382e10dba643574abded4fd5b',
    '0x58524214e69966a0722deff50bbb261b1977cb5c',
    '0x1e5249dca89d43bd917b7d05199e4eff4fb9a4df',
    '0x96d491789efea52f127f58e24709282517f3d73d',
    '0xa0a23c6a4a22e7dd981d5e24c0cd79dc358ff8d0',
    '0x136f79961b7ab2a91104ec892c288e225e100214'
  ];

  const getBananaGunUsersQuery = `SELECT * FROM ${TABLE_NAME} WHERE event_name = ? and sender_address = ?`;
  const bananaGunSwaps = await db.all(getBananaGunUsersQuery, ['Swap', BANANA_GUN_ROUTER]);

  const uniqueMakers = bananaGunSwaps.reduce((uniqueSet, tx) => {
    uniqueSet.add(tx.maker_address);
    return uniqueSet;
  }, new Set());

  const uniqueTxHashes = bananaGunSwaps.reduce((uniqueSet, tx) => {
    uniqueSet.add(tx.tx_hash);
    return uniqueSet;
  }, new Set());

  const promises = [];
  for (const hash of uniqueTxHashes) {
    promises.push(client.getTransaction({ hash }));
  }

  const transactions = await Promise.all(promises);
  const uniqueToAddresses = transactions.reduce((uniqueSet, tx) => {
    uniqueSet.add(tx.to);
    return uniqueSet;
  }, new Set());

  // ensure each to address is a banana gun contract
  for (const address of uniqueToAddresses) {
    if (!BANANA_GUN_CONTRACTS.includes(address)) {
      throw new Error(`Address ${address} is not a banana gun contract`);
    }
  }

  for (const maker of uniqueMakers) {
    await tagWallet(db, maker, WALLET_TAG, TAG_TYPE, ALLOW_DUPE_TAG);
  }
})();
