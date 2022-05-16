// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./IERC20.sol";

interface INJORD is IERC20 {
    function getCirculatingSupply() external view returns (uint256);

    function gonsForBalance(uint256 amount) external view returns (uint256);

    function balanceForGons(uint256 gons) external view returns (uint256);

    function index() external view returns (uint256);
}
