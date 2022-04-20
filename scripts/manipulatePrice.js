// -- IMPORT PACKAGES -- //
require("dotenv").config();

const Web3 = require('web3')
const {
    ChainId,
    Token,
    WETH
} = require("@uniswap/sdk")
const IUniswapV2Router02 = require('@uniswap/v2-periphery/build/IUniswapV2Router02.json')
const IUniswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json")
const IERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json')

// -- SETUP NETWORK & WEB3 -- //

const chainId = ChainId.MAINNET
const web3 = new Web3('http://127.0.0.1:8545')

// -- IMPORT HELPER FUNCTIONS -- //

const { getPairContract, calculatePrice } = require('../helpers/helpers')

// -- IMPORT & SETUP UNISWAP/SUSHISWAP CONTRACTS -- //

const config = require('../config.json')
const pFactory = new web3.eth.Contract(IUniswapV2Factory.abi, config.PANCAKESWAP.FACTORY_ADDRESS) // PANCAKESWAP FACTORY CONTRACT
const aFactory = new web3.eth.Contract(IUniswapV2Factory.abi, config.APESWAP.FACTORY_ADDRESS) // APESWAP FACTORY CONTRACT
const pRouter = new web3.eth.Contract(IUniswapV2Router02.abi, config.PANCAKESWAP.V2_ROUTER_02_ADDRESS) // PANCAKESWAP ROUTER CONTRACT
const aRouter = new web3.eth.Contract(IUniswapV2Router02.abi, config.APESWAP.V2_ROUTER_02_ADDRESS) // APESWAP ROUTER CONTRACT


// -- CONFIGURE VALUES HERE -- //

const V2_FACTORY_TO_USE = pFactory
const V2_ROUTER_TO_USE = pRouter

const UNLOCKED_ACCOUNT = '0x72A53cDBBcc1b9efa39c834A540550e23463AAcB' // SHIB Unlocked Account
const WBNB_ADDRESS = process.env.ARB_FOR
const ERC20_ADDRESS = process.env.ARB_AGAINST
const AMOUNT = '205000000000' // 205,000,000,000 SHIB -- Tokens will automatically be converted to wei
const GAS = 450000


// -- SETUP ERC20 CONTRACT & TOKEN -- //

const ERC20_CONTRACT = new web3.eth.Contract(IERC20.abi, ERC20_ADDRESS)
const WETH_CONTRACT = new web3.eth.Contract(IERC20.abi, WETH[chainId].address)
const WBNB_CONTRACT = new web3.eth.Contract(IERC20.abi, WBNB_ADDRESS)


// -- MAIN SCRIPT -- //

const main = async () => {
    const accounts = await web3.eth.getAccounts()
    const account = accounts[1] // This will be the account to recieve WBNB after we perform the swap to manipulate price

    const pairContract = await getPairContract(V2_FACTORY_TO_USE, ERC20_ADDRESS, WBNB_ADDRESS)

    let balanceBefore = await WBNB_CONTRACT.methods.balanceOf(account).call()
    balanceBefore = web3.utils.fromWei(balanceBefore.toString())

    console.log(`\nBalance in reciever account: ${balanceBefore} WBNB \n`)

    const token = new Token(
        56,
        ERC20_ADDRESS,
        18,
        await ERC20_CONTRACT.methods.symbol().call(),
        await ERC20_CONTRACT.methods.name().call()
    )

    const wbnbToken = new Token(
        56,
        WBNB_ADDRESS,
        18,
        await WBNB_CONTRACT.methods.symbol().call(),
        await WBNB_CONTRACT.methods.name().call()
    )

    
    // Fetch price of SHIB/WBNB before we execute the swap
    const priceBefore = await calculatePrice(pairContract)
    

    await manipulatePrice(token, account, wbnbToken)

    // Fetch price of SHIB/WBNB after the swap
    const priceAfter = await calculatePrice(pairContract)

    const data = {
        'Price Before': `1 ${wbnbToken.symbol} = ${Number(priceBefore).toFixed(0)} ${token.symbol}`,
        'Price After': `1 ${wbnbToken.symbol} = ${Number(priceAfter).toFixed(0)} ${token.symbol}`,
    }

    console.table(data)

    

    let balance = await WBNB_CONTRACT.methods.balanceOf(account).call()
    balance = web3.utils.fromWei(balance.toString())

    console.log(`\nBalance in reciever account: ${balance} WBNB \n`)
}

main()

// 

async function manipulatePrice(token, account, wbnbToken) {

    console.log(`\nBeginning Swap...\n`)

    console.log(`Input Token: ${token.symbol}`)
    console.log(`Output Token: ${wbnbToken.symbol}\n`)

    const amountIn = new web3.utils.BN(
        web3.utils.toWei(AMOUNT, 'ether')
    )


    const path = [token.address, WBNB_ADDRESS]
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes


    await ERC20_CONTRACT.methods.approve(V2_ROUTER_TO_USE._address, amountIn).send({ from: UNLOCKED_ACCOUNT })
    const receipt = await V2_ROUTER_TO_USE.methods.swapExactTokensForTokens(amountIn, 0, path, account, deadline).send({ from: UNLOCKED_ACCOUNT, gas: GAS });

    console.log(`Swap Complete!\n`)

    return receipt
}

