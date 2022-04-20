const Arbitrage = artifacts.require("Arbitrage")

const config = require("../config.json")

module.exports = async function (deployer) {
    await deployer.deploy(
        Arbitrage,
        config.APESWAP.V2_ROUTER_02_ADDRESS,
        config.PANCAKESWAP.V2_ROUTER_02_ADDRESS
    );
};