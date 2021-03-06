// SPDX-License-Identifier: MIT
pragma solidity <=0.8.13;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDODO {
    function flashLoan(
        uint256 baseAmount,
        uint256 quoteAmount,
        address assetTo,
        bytes calldata data
    ) external;

    function _BASE_TOKEN_() external view returns (address);
}


contract Arbitrage {
    IUniswapV2Router02 public immutable aRouter;
    IUniswapV2Router02 public immutable pRouter;

    address public owner;

    constructor(address _aRouter, address _pRouter) {
        aRouter = IUniswapV2Router02(_aRouter); // Apeswap
        pRouter = IUniswapV2Router02(_pRouter); // Pancakeswap
        owner = msg.sender;
    }

    function dodoFlashLoan(
    address flashLoanPool, //You will make a flashloan from this DODOV2 pool
    address loanToken,
    uint256 loanAmount,
    bool startOnUniswap,
    address token1,
    uint256 balanceBefore 

    ) internal  {
        //Note: The data can be structured with any variables required by your logic. The following code is just an example
        bytes memory data = abi.encode(flashLoanPool, loanToken, loanAmount, startOnUniswap, token1, balanceBefore);
        address flashLoanBase = IDODO(flashLoanPool)._BASE_TOKEN_();
        if(flashLoanBase == loanToken) {
            IDODO(flashLoanPool).flashLoan(loanAmount, 0, address(this), data);
        } else {
            IDODO(flashLoanPool).flashLoan(0, loanAmount, address(this), data);
        }
    }

    function executeTrade(
        address _flashLoanPool,
        bool _startOnUniswap,
        address _token0,
        address _token1,
        uint256 _flashAmount
    ) external {
        
        uint256 balanceBefore = IERC20(_token0).balanceOf(address(this));

        dodoFlashLoan(_flashLoanPool, _token0, _flashAmount, _startOnUniswap, _token1, balanceBefore); // execution should trigger callback function
    }

     function DVMFlashLoanCall(
        address sender, 
        uint256 baseAmount, 
        uint256 quoteAmount,
        bytes calldata data
        ) external {
        _flashLoanCallBack(sender,baseAmount,quoteAmount,data);
    }

    //Note: CallBack function executed by DODOV2(DPP) flashLoan pool
    function DPPFlashLoanCall(
        address sender,
        uint256 baseAmount,
        uint256 quoteAmount,
        bytes calldata data
           ) external {
        _flashLoanCallBack(sender,baseAmount,quoteAmount,data);
    }

    //Note: CallBack function executed by DODOV2(DSP) flashLoan pool
    function DSPFlashLoanCall(
        address sender, 
        uint256 baseAmount, 
        uint256 quoteAmount,
        bytes calldata data
         ) external {
        _flashLoanCallBack(sender,baseAmount,quoteAmount,data);
    }


    function _flashLoanCallBack(
        address sender, 
        uint256, 
        uint256,
        bytes calldata data
        ) internal {
        (
            address flashLoanPool,
            address token0,
            uint256 flashAmount,
            bool startOnUniswap,
            address token1,
            uint256 balanceBefore
        ) = abi.decode(data, (address, address, uint256, bool, address, uint256));

        uint256 balanceAfter = IERC20(token0).balanceOf(address(this));

        require(sender == address(this) && msg.sender == flashLoanPool, "HANDLE_FLASH_DENIED");
        require(balanceAfter - balanceBefore == flashAmount, "contract did not get the loan");

        // Use the money here!
        address[] memory path = new address[](2);

        path[0] = token0;
        path[1] = token1;

        if (startOnUniswap) {
            _swapOnUniswap(path, flashAmount, 0);

            path[0] = token1;
            path[1] = token0;

            _swapOnSushiswap(
                path,
                IERC20(token1).balanceOf(address(this)),
                (flashAmount + 1)
            );
        } else {
            _swapOnSushiswap(path, flashAmount, 0);

            path[0] = token1;
            path[1] = token0;

            _swapOnUniswap(
                path,
                IERC20(token1).balanceOf(address(this)),
                (flashAmount + 1)
            );
        }

        IERC20(token0).transfer(owner, IERC20(token0).balanceOf(address(this)) - (flashAmount + 1));
        IERC20(token0).transfer(flashLoanPool, flashAmount);
    }

    // -- INTERNAL FUNCTIONS -- //

    function _swapOnUniswap(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _amountOut
    ) internal {
        require(
            IERC20(_path[0]).approve(address(pRouter), _amountIn),
            "Pancakeswap approval failed."
        );

        pRouter.swapExactTokensForTokens(
            _amountIn,
            _amountOut,
            _path,
            address(this),
            (block.timestamp + 1200)
        );
    }

    function _swapOnSushiswap(
        address[] memory _path,
        uint256 _amountIn,
        uint256 _amountOut
    ) internal {
        require(
            IERC20(_path[0]).approve(address(aRouter), _amountIn),
            "Apeswap approval failed."
        );

        aRouter.swapExactTokensForTokens(
            _amountIn,
            _amountOut,
            _path,
            address(this),
            (block.timestamp + 1200)
        );
    }
}
