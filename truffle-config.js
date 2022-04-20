require('babel-register');
require('babel-polyfill');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const fs = require('fs');
const mnemonic = fs.readFileSync(".secret").toString().trim();

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*", // Match any network id
    },
    bsc: {
      provider: () => new HDWalletProvider(mnemonic, `https://speedy-nodes-nyc.moralis.io/"Your Speedy Node"/bsc/mainnet`),
      network_id: 56,
      confirmations: 10,
      timeoutBlocks: 200,
      skipDryRun: true
    }
  },

  compilers: {
    solc: {
      version: '0.8.9',
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
};