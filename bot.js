// -- HANDLE INITIAL SETUP -- //

require('./helpers/server')
require("dotenv").config();

const config = require('./config.json')
const { getTokenAndContract, getPairContract, calculatePrice, getEstimatedReturn, getReserves } = require('./helpers/helpers')
const { pFactory, pRouter, aFactory, aRouter, web3, arbitrage } = require('./helpers/initialization')

// -- .ENV VALUES HERE -- //

const arbFor = process.env.ARB_FOR // This is the address of token we are attempting to arbitrage (WBNB))
const arbAgainst = process.env.ARB_AGAINST // SHIB
const account = process.env.ACCOUNT // Account to recieve profit
const units = process.env.UNITS // Used for price display/reporting
const difference = process.env.PRICE_DIFFERENCE
const gas = process.env.GAS_LIMIT
const estimatedGasCost = process.env.GAS_PRICE // Estimated Gas: 0.008453220000006144 ETH + ~10%

let pPair, aPair, amount
let isExecuting = false

const main = async () => {
    const { token0Contract, token1Contract, token0, token1 } = await getTokenAndContract(arbFor, arbAgainst)
    pPair = await getPairContract(pFactory, token0.address, token1.address)
    aPair = await getPairContract(aFactory, token0.address, token1.address)

    pPair.events.Swap({}, async () => {
        if (!isExecuting) {
            isExecuting = true

            const priceDifference = await checkPrice('Pancakeswap', token0, token1)
            const routerPath = await determineDirection(priceDifference)

            if (!routerPath) {
                console.log(`No Arbitrage Currently Available\n`)
                console.log(`-----------------------------------------\n`)
                isExecuting = false
                return
            }

            const isProfitable = await determineProfitability(routerPath, token0Contract, token0, token1)

            if (!isProfitable) {
                console.log(`No Arbitrage Currently Available\n`)
                console.log(`-----------------------------------------\n`)
                isExecuting = false
                return
            }

            const receipt = await executeTrade(routerPath, token0Contract, token1Contract)

            isExecuting = false
        }
    })

    aPair.events.Swap({}, async () => {
        if (!isExecuting) {
            isExecuting = true

            const priceDifference = await checkPrice('Apeswap', token0, token1)
            const routerPath = await determineDirection(priceDifference)

            if (!routerPath) {
                console.log(`No Arbitrage Currently Available\n`)
                console.log(`-----------------------------------------\n`)
                isExecuting = false
                return
            }

            const isProfitable = await determineProfitability(routerPath, token0Contract, token0, token1)

            if (!isProfitable) {
                console.log(`No Arbitrage Currently Available\n`)
                console.log(`-----------------------------------------\n`)
                isExecuting = false
                return
            }

            const receipt = await executeTrade(routerPath, token0Contract, token1Contract)

            isExecuting = false
        }
    })

    console.log("Waiting for swap event...")
}

const checkPrice = async (exchange, token0, token1) => {
    isExecuting = true

    console.log(`Swap Initiated on ${exchange}, Checking Price...\n`)

    const currentBlock = await web3.eth.getBlockNumber()

    const uPrice = await calculatePrice(pPair)
    const sPrice = await calculatePrice(aPair)

    const uFPrice = Number(uPrice).toFixed(units)
    const sFPrice = Number(sPrice).toFixed(units)
    const priceDifference = (((uFPrice - sFPrice) / sFPrice) * 100).toFixed(2)

    console.log(`Current Block: ${currentBlock}`)
    console.log(`-----------------------------------------`)
    console.log(`Pancakeswap   | ${token1.symbol}/${token0.symbol}\t | ${uFPrice}`)
    console.log(`Apeswap | ${token1.symbol}/${token0.symbol}\t | ${sFPrice}\n`)
    console.log(`Percentage Difference: ${priceDifference}%\n`)

    return priceDifference
}

const determineDirection = async (priceDifference) => {
    console.log(`Determining Direction...\n`)

    if (priceDifference >= difference) {

        console.log(`Potential Arbitrage Direction:\n`)
        console.log(`Buy\t -->\t Pancakeswap`)
        console.log(`Sell\t -->\t Apeswap\n`)
        return [pRouter, aRouter]

    } else if (priceDifference <= -(difference)) {

        console.log(`Potential Arbitrage Direction:\n`)
        console.log(`Buy\t -->\t Apeswap`)
        console.log(`Sell\t -->\t Pancakeswap\n`)
        return [aRouter, pRouter]

    } else {
        return null
    }
}

const determineProfitability = async (_routerPath, _token0Contract, _token0, _token1) => {
    console.log(`Determining Profitability...\n`)

    // This is where you can customize your conditions on whether a profitable trade is possible.
    // This is a basic example of trading WBNB/SHIB...

    let reserves, exchangeToBuy, exchangeToSell

    if (_routerPath[0]._address == pRouter._address) {
        reserves = await getReserves(aPair)
        exchangeToBuy = 'Pancakeswap'
        exchangeToSell = 'Apeswap'
    } else {
        reserves = await getReserves(pPair)
        exchangeToBuy = 'Apeswap'
        exchangeToSell = 'Pancakeswap'
    }

    console.log(`Reserves on ${_routerPath[1]._address}`)
    console.log(`SHIB: ${Number(web3.utils.fromWei(reserves[0].toString(), 'ether')).toFixed(0)}`)
    console.log(`WBNB: ${web3.utils.fromWei(reserves[1].toString(), 'ether')}\n`)

    try {

        // This returns the amount of WBNB needed
        let result = await _routerPath[0].methods.getAmountsIn(reserves[0], [_token0.address, _token1.address]).call()

        const token0In = result[0] // WBNB
        const token1In = result[1] // SHIB

        result = await _routerPath[1].methods.getAmountsOut(token1In, [_token1.address, _token0.address]).call()

        console.log(`Estimated amount of WBNB needed to buy enough Shib on ${exchangeToBuy}\t\t| ${web3.utils.fromWei(token0In, 'ether')}`)
        console.log(`Estimated amount of WBNB returned after swapping SHIB on ${exchangeToSell}\t| ${web3.utils.fromWei(result[1], 'ether')}\n`)

        const { amountIn, amountOut } = await getEstimatedReturn(token0In, _routerPath, _token0, _token1)

        let ethBalanceBefore = await web3.eth.getBalance(account)
        ethBalanceBefore = web3.utils.fromWei(ethBalanceBefore, 'ether')
        const ethBalanceAfter = ethBalanceBefore - estimatedGasCost

        const amountDifference = amountOut - amountIn
        let wbnbBalanceBefore = await _token0Contract.methods.balanceOf(account).call()
        wbnbBalanceBefore = web3.utils.fromWei(wbnbBalanceBefore, 'ether')

        const wbnbBalanceAfter = amountDifference + Number(wbnbBalanceBefore)
        const wbnbBalanceDifference = wbnbBalanceAfter - Number(wbnbBalanceBefore)

        const totalGained = wbnbBalanceDifference - Number(estimatedGasCost)

        const data = {
            'ETH Balance Before': ethBalanceBefore,
            'ETH Balance After': ethBalanceAfter,
            'ETH Spent (gas)': estimatedGasCost,
            '-': {},
            'WBNB Balance BEFORE': wbnbBalanceBefore,
            'WBNB Balance AFTER': wbnbBalanceAfter,
            'WBNB Gained/Lost': wbnbBalanceDifference,
            '-': {},
            'Total Gained/Lost': totalGained
        }

        console.table(data)

        if (amountOut < amountIn) {
            return false
        }

        amount = token0In
        return true

    } catch (error) {
        console.log(error.data.stack)
        console.log(`\nError occured while trying to determine profitability...\n`)
        console.log(`This can typically happen because an issue with reserves, see README for more information.\n`)
        return false
    }
}

const executeTrade = async (_routerPath, _token0Contract, _token1Contract) => {
    console.log(`Attempting Arbitrage...\n`)

    let startOnUniswap
    let _flashLoanPool = "0x0fe261aeE0d1C4DFdDee4102E82Dd425999065F4"

    if (_routerPath[0]._address == pRouter._address) {
        startOnUniswap = true
    } else {
        startOnUniswap = false
    }

    // Fetch token balance before
    const balanceBefore = await _token0Contract.methods.balanceOf(account).call()
    const ethBalanceBefore = await web3.eth.getBalance(account)

    if (config.PROJECT_SETTINGS.isDeployed) {
        await _token0Contract.methods.approve(arbitrage._address, amount).send({ from: account })
        await arbitrage.methods.executeTrade(_flashLoanPool, startOnUniswap, _token0Contract._address, _token1Contract._address, amount).send({ from: account, gas: gas })
    }

    console.log(`Trade Complete:\n`)

    // Fetch token balance after
    const balanceAfter = await _token0Contract.methods.balanceOf(account).call()
    const ethBalanceAfter = await web3.eth.getBalance(account)

    const balanceDifference = balanceAfter - balanceBefore
    const totalSpent = ethBalanceBefore - ethBalanceAfter

    const data = {
        'ETH Balance Before': web3.utils.fromWei(ethBalanceBefore, 'ether'),
        'ETH Balance After': web3.utils.fromWei(ethBalanceAfter, 'ether'),
        'ETH Spent (gas)': web3.utils.fromWei((ethBalanceBefore - ethBalanceAfter).toString(), 'ether'),
        '-': {},
        'WBNB Balance BEFORE': web3.utils.fromWei(balanceBefore.toString(), 'ether'),
        'WBNB Balance AFTER': web3.utils.fromWei(balanceAfter.toString(), 'ether'),
        'WBNB Gained/Lost': web3.utils.fromWei(balanceDifference.toString(), 'ether'),
        '-': {},
        'Total Gained/Lost': `${web3.utils.fromWei((balanceDifference - totalSpent).toString(), 'ether')}`
    }

    console.table(data)
}

main()