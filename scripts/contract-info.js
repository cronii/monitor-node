const fetch = require('node-fetch');
const { mainnet } = require('viem/chains');
const { createPublicClient, http } = require('viem');

const CONFIG = require('../config.json');
const { analyzeBlock } = require('../src/common');

async function getContractCreationData(address) {
  const apiCall = `https://api.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${CONFIG.etherscanApiKey}`;

  const response = await fetch(apiCall);
  const data = await response.json();

  return data.result[0];
}

// given a contract, get deployment block, deployer address, deployment block

// MARBLE
const CONTRACT_ADDRESS = '0x8ea9bedb8bb7e99643844ec79543f4faa78453e4';
const POOL_ADDRESS = '0xdcd34cf0bb038821cac55db957c00f9f89f01610';

(async () => {
  try {
    const transport = http(CONFIG.rpcRemote);
    const client = createPublicClient({
      chain: mainnet,
      transport
    });

    // const contractCreationData = await getContractCreationData(CONTRACT_ADDRESS);

    // const creationTxData = await client.getTransaction({
    //   hash: contractCreationData.txHash
    // });

    // const contractData = {
    //   ...contractCreationData,
    //   blockNumber: creationTxData.blockNumber
    // }

    // console.log(contractData);

    for (let blockNumber = 17758120; blockNumber <= 17758140; blockNumber++) {
      await analyzeBlock({ client, blockNumber, outputToFile: false, pool: POOL_ADDRESS });
    }
  } catch (err) {
    console.error(err);
  }
})();
