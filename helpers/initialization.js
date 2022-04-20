require("dotenv").config();
const config = require('../config.json')

const Web3 = require('web3')
let web3

if (!config.PROJECT_SETTINGS.isLocal) {
    web3 = new Web3(`wss://speedy-nodes-nyc.moralis.io/"Your Speedy Node"/bsc/mainnet/ws`)
} else {
    web3 = new Web3('ws://127.0.0.1:8545')
}

const IUniswapV2Router02 = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json')
const IUniswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json")

const pFactory = new web3.eth.Contract(IUniswapV2Factory.abi, config.PANCAKESWAP.FACTORY_ADDRESS) // PANCAKESWAP FACTORY CONTRACT
const pRouter = new web3.eth.Contract(IUniswapV2Router02.abi, config.PANCAKESWAP.V2_ROUTER_02_ADDRESS) // PANCAKESWAP ROUTER CONTRACT
const aFactory = new web3.eth.Contract(IUniswapV2Factory.abi, config.APESWAP.FACTORY_ADDRESS) // APESWAP FACTORY CONTRACT
const aRouter = new web3.eth.Contract(IUniswapV2Router02.abi, config.APESWAP.V2_ROUTER_02_ADDRESS) // APESWAP ROUTER CONTRACT

const IArbitrage = require('../build/contracts/Arbitrage.json')
const arbitrage = new web3.eth.Contract(IArbitrage.abi, IArbitrage.networks[56].address);

module.exports = {
    pFactory,
    pRouter,
    aFactory,
    aRouter,
    web3,
    arbitrage
}