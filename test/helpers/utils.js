const { ethers } = require("hardhat");

const utils = ethers.utils;
const parseUnits = utils.parseUnits;
const formatUnits = utils.formatUnits;
const MaxUint256 = ethers.constants.MaxUint256;

const NJORD_DECIMALS = 5;
const NJORD_TOTAL_SUPPLY = parseUnits("1000000000", NJORD_DECIMALS); // 1B NJORD
const NJORD_INITIAL_SUPPLY = parseUnits("400000", NJORD_DECIMALS); // 400k NJORD
const AIRDROP_VALUE = parseUnits("1000", NJORD_DECIMALS); // 1K NJORD
const SWAP_VALUE = parseUnits("100", NJORD_DECIMALS); // 100 NJORD
const INITIAL_NJORD_LIQUIDITY = parseUnits("300000", NJORD_DECIMALS); // 400k NJORD
const INITIAL_BNB_LIQUIDITY = parseUnits("300", 18); // 400 BNB
const DEFAULT_NJORD_TRANSFER = parseUnits("100", NJORD_DECIMALS); // 100 NJORD

module.exports = {
  utils,
  parseUnits,
  formatUnits,
  MaxUint256,
  NJORD_TOTAL_SUPPLY,
  NJORD_INITIAL_SUPPLY,
  AIRDROP_VALUE,
  INITIAL_BNB_LIQUIDITY,
  INITIAL_NJORD_LIQUIDITY,
  DEFAULT_NJORD_TRANSFER,
  SWAP_VALUE,
  NJORD_DECIMALS,
};
