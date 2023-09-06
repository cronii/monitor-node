const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const { generateNaivePerformanceData } = require('../src/performance-naive');
const { writeToFile } = require('../src/utils');

(async () => {
  const db = await open({
    filename: 'monitor-node.db',
    driver: sqlite3.Database
  });

  const screenerPairs = await db.all('SELECT * FROM screener_pairs');

  for (const screenerPair of screenerPairs) {
    const { pairAddress, token0Decimals, token1Decimals } = screenerPair

    const swaps = await db.all('SELECT * FROM screener_events WHERE pairAddress = ? and eventName = ? ORDER BY block, txIndex, logIndex', [pairAddress, 'Swap']);

    if (swaps.length < 10) continue;
    const performanceData = generateNaivePerformanceData(swaps, token0Decimals, token1Decimals);

    if (performanceData.topPerformers.length > 0) {
      await writeToFile(`./reports/performance-${pairAddress}.json`, performanceData);

      for (const topPerformer of performanceData.topPerformers) {
        const insertWalletToReviewQuery = 'INSERT OR IGNORE INTO wallets_for_review (address) VALUES (?)'
        await db.run(insertWalletToReviewQuery, topPerformer);
      }
    }
  }
})();
