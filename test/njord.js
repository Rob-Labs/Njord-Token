const { expect } = require("chai");
const { ethers } = require("hardhat");
// const dotenv = require("dotenv");

const {
  NJORD_TOTAL_SUPPLY,
  INITIAL_NJORD_LIQUIDITY,
  NJORD_INITIAL_SUPPLY,
  NJORD_DECIMALS,
} = require("./helpers/utils");

describe("Njord Token", function () {
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
  });

  describe("Deployment", function () {
    let token;

    before(async function () {
      // Deploy contract
      const Token = await ethers.getContractFactory("NjordContract");
      token = await Token.deploy(
        pancakeRouterContract.address,
        autoLiquidityFund.address,
        treasuryFund.address,
        njordRiskFreeFund.address,
        supplyControl.address,
      );
      await token.deployed();
    });
    it("Has a name (Njord)", async function () {
      expect(await token.name()).to.equal("Njord");
    });

    it("Has a symbol (NJORD)", async function () {
      expect(await token.symbol()).to.equal("NJORD");
    });

    it("Has 5 decimals", async function () {
      expect(await token.decimals()).to.equal(NJORD_DECIMALS);
    });

    it("Has 400 Thousand initial supply tokens with 5 decimal units (400,000 x 1e5)", async function () {
      expect(await token.totalSupply()).to.equal(NJORD_INITIAL_SUPPLY);
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

    it("Launch with disabled Auto rebase", async function () {
      expect(await token._autoRebase()).to.equal(false);
    });

    it("Launch with disabled Transfer", async function () {
      expect(await token.isTransferEnabled()).to.equal(false);
    });

    it("Launch with disabled Trading", async function () {
      expect(await token.isTradingEnabled()).to.equal(false);
    });

    it("Deployer Address is not owner", async function () {
      expect(await token.owner()).to.not.equal(deployer.address);
    });

    it("TreasuryFund Address is Owner", async function () {
      expect(await token.owner()).to.equal(treasuryFund.address);
    });

    it("Njord Token Address is Whitelisted", async function () {
      expect(await token.checkFeeExempt(token.address)).to.equal(true);
    });

    it("TreasuryFund Address is Whitelisted", async function () {
      expect(await token.checkFeeExempt(treasuryFund.address)).to.equal(true);
    });
  });

  describe("Distribution", function () {
    before(async function () {
      // Deploy contract
      const Token = await ethers.getContractFactory("NjordContract");
      token = await Token.deploy(
        pancakeRouterContract.address,
        autoLiquidityFund.address,
        treasuryFund.address,
        njordRiskFreeFund.address,
        supplyControl.address,
      );
      await token.deployed();
    });

    it("TreasuryFund start with 100% balance", async function () {
      expect(await token.balanceOf(treasuryFund.address)).to.equal(
        NJORD_INITIAL_SUPPLY,
      );
    });

    it("Deployer start with empty balance", async function () {
      expect(await token.balanceOf(deployer.address)).to.equal(0);
    });

    it("Users start with empty balance", async function () {
      expect(await token.balanceOf(client1.address)).to.equal(0);
    });
  });

  describe("Transactions at Transfer is Disabled State", function () {
    before(async function () {
      // Deploy contract
      const Token = await ethers.getContractFactory("NjordContract");
      token = await Token.deploy(
        pancakeRouterContract.address,
        autoLiquidityFund.address,
        treasuryFund.address,
        njordRiskFreeFund.address,
        supplyControl.address,
      );
      await token.deployed();
    });

    it("Transfer from Whitelisted Address will Success when Presale Time", async function () {
      // Try to send 500 token from treasuryFund to client1 (0 tokens).
      await token.connect(treasuryFund).transfer(client1.address, 500);
      expect(await token.balanceOf(client1.address)).to.equal(500);
    });

    it("Transfer from Non Whitelisted Address will fails when Presale Time although sender have enough tokens", async function () {
      // Try to send 100 token from client1 (500 tokens) to client5 (0 tokens).
      // `require` will evaluate false and revert the transaction.

      await expect(
        token.connect(client1).transfer(client5.address, 100),
      ).to.be.revertedWith("Transfer State is disabled");
    });
  });

  describe("Only Owner Write Methods (Only TreasuryFund Address can use them)", function () {
    before(async function () {
      // Deploy contract
      const Token = await ethers.getContractFactory("NjordContract");
      token = await Token.deploy(
        pancakeRouterContract.address,
        autoLiquidityFund.address,
        treasuryFund.address,
        njordRiskFreeFund.address,
        supplyControl.address,
      );
      await token.deployed();
    });

    it("Set Auto Rebase", async function () {
      await expect(
        token.connect(client1).setAutoRebase(true),
      ).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(token.connect(treasuryFund).setAutoRebase(true)).to.emit(
        token,
        "LogAutoRebaseChanged",
      );
    });

    it("Toggle Owner Rebase", async function () {
      const initialOwnerRebaseState = await token.isOwnerRebaseEnabled();
      await expect(
        token.connect(client1).toggleOwnerRebase(),
      ).to.be.revertedWith("Ownable: caller is not the owner");

      expect(await token.connect(treasuryFund).toggleOwnerRebase()).to.emit(
        token,
        "LogRebaseRateOwnerChanged",
      );
    });

    it("Toggle Transfer State", async function () {
      await expect(
        token.connect(client1).toggleTransferStatus(),
      ).to.be.revertedWith("Ownable: caller is not the owner");

      expect(await token.connect(treasuryFund).toggleTransferStatus()).to.emit(
        token,
        "LogTransferStatusChanged",
      );
    });

    it("Toggle Trading State", async function () {
      await expect(
        token.connect(client1).toggleTradingStatus(),
      ).to.be.revertedWith("Ownable: caller is not the owner");

      expect().to.emit(token, "LogTradingStatusChanged");
    });

    it("Add Whitelisted Address", async function () {
      expect(
        token.connect(client1).setWhitelist(client5.address),
      ).to.be.revertedWith("Ownable: caller is not the owner");

      expect(
        await token.connect(treasuryFund).setWhitelist(client5.address),
      ).to.emit(token, "LogWhitelistAdded");
    });

    it("Remove Whitelisted Address", async function () {
      expect(
        token.connect(client1).removeWhitelist(client5.address),
      ).to.be.revertedWith("Ownable: caller is not the owner");

      expect(
        await token.connect(treasuryFund).removeWhitelist(client5.address),
      ).to.emit(token, "LogWhitelistRemoved");
    });
  });
});
