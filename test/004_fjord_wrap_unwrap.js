const { expect } = require("chai");
const { ethers } = require("hardhat");
const { uniswapV2PairAbi } = require("./helpers/abi");
// const dotenv = require("dotenv");

const { zeroAddress, deadAddress } = require("./helpers/address");
const { increase, duration, advanceBlock } = require("./helpers/time");
const provider = ethers.provider;
const {
  NJORD_TOTAL_SUPPLY,
  INITIAL_NJORD_LIQUIDITY,
  NJORD_INITIAL_SUPPLY,
  NJORD_DECIMALS,
  DEFAULT_NJORD_TRANSFER,
  MaxUint256,
  INITIAL_BNB_LIQUIDITY,
  parseUnits,
  FJORD_DECIMALS,
} = require("./helpers/utils");

describe("Fjord Token", function () {
  let deployer;
  let autoLiquidityFund;
  let treasuryFund;
  let njordRiskFreeFund;
  let supplyControl;
  let newAutoLiquidityFund;
  let newTreasuryFund;
  let newNjordRiskFreeFund;
  let newSupplyControl;
  let client1;
  let client2;
  let client3;
  let client4;
  let client5;
  let emptyAddr;
  let newWallet;
  let pancakeDeployer;
  let pancakeFeeReceiver;

  let pancakeFactoryContract;
  let pancakeRouterContract;
  let pancakePairContract;
  let wbnbContract;

  let njord;
  let token;

  let buyPath;
  let sellPath;

  before(async function () {
    [
      deployer,
      autoLiquidityFund,
      treasuryFund,
      njordRiskFreeFund,
      supplyControl,
      newAutoLiquidityFund,
      newTreasuryFund,
      newNjordRiskFreeFund,
      newSupplyControl,
      client1,
      client2,
      client3,
      client4,
      client5,
      emptyAddr,
      newWallet,
      pancakeDeployer,
      pancakeFeeReceiver,
    ] = await ethers.getSigners();
    // deploy pancake factory first
    const PancakeFactory = await ethers.getContractFactory(
      "PancakeFactory",
      pancakeDeployer,
    );
    pancakeFactoryContract = await PancakeFactory.deploy(
      pancakeFeeReceiver.address,
    );
    await pancakeFactoryContract.deployed();

    // deploy WBNB factory first
    const WBNBContract = await ethers.getContractFactory(
      "WBNB",
      pancakeDeployer,
    );
    wbnbContract = await WBNBContract.deploy();
    await wbnbContract.deployed();

    // deploy Pancake Router first
    const routerContract = await ethers.getContractFactory(
      "PancakeRouter",
      pancakeDeployer,
    );
    pancakeRouterContract = await routerContract.deploy(
      pancakeFactoryContract.address,
      wbnbContract.address,
    );
    await pancakeRouterContract.deployed();

    const Njord = await ethers.getContractFactory("NjordContract");
    njord = await Njord.deploy(
      pancakeRouterContract.address,
      autoLiquidityFund.address,
      treasuryFund.address,
      njordRiskFreeFund.address,
      supplyControl.address,
    );
    await njord.deployed();

    const Token = await ethers.getContractFactory("FjordContract");
    token = await Token.deploy(
      njord.address,
      autoLiquidityFund.address,
      treasuryFund.address,
      njordRiskFreeFund.address,
      supplyControl.address,
    );
    await token.deployed();
  });

  describe("Deployment", function () {
    it("Has a name (Fjord)", async function () {
      expect(await token.name()).to.equal("Fjord");
    });

    it("Has a symbol (FJORD)", async function () {
      expect(await token.symbol()).to.equal("FJORD");
    });

    it("Has 18 decimals", async function () {
      expect(await token.decimals()).to.equal(FJORD_DECIMALS);
    });

    it("Total Supply is 0 at deployment", async function () {
      expect(await token.totalSupply()).to.equal(0);
    });

    it("Correct TreasuryFund address wallet", async function () {
      expect(await token.treasuryFund()).to.equal(treasuryFund.address);
    });

    it("Correct autoLiquidityFund address wallet", async function () {
      expect(await token.autoLiquidityFund()).to.equal(
        autoLiquidityFund.address,
      );
    });

    it("Correct njordRiskFreeFund address wallet", async function () {
      expect(await token.njordRiskFreeFund()).to.equal(
        njordRiskFreeFund.address,
      );
    });

    it("Correct supplyControl address wallet", async function () {
      expect(await token.supplyControl()).to.equal(supplyControl.address);
    });

    it("Launch with disabled wrap unwrap (not Live)", async function () {
      expect(await token.live()).to.equal(false);
    });
  });
});
