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

  describe("Function Test", function () {
    describe("setRebaseRate Function Test", function () {
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

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setRebaseRate(2000),
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(token.connect(treasuryFund).setAutoRebase(2000)).to.not.be
          .reverted;
      });

      it("Should Can't set value, if new value is same with old value", async function () {
        // set to 2000 first
        await token.connect(treasuryFund).setRebaseRate(2000);
        // so if we set 2000 again, its will revert
        await expect(
          token.connect(treasuryFund).setRebaseRate(2000),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogRebaseRateChanged", async function () {
        const rebaseRateSet = 2475;
        const oldRebaseRate = await token.ownerRebaseRate();

        /**
         * event fired :
         * LogRebaseRateChanged(oldRate, newRate)
         *
         */
        expect(await token.connect(treasuryFund).setRebaseRate(rebaseRateSet))
          .to.emit(token, "LogRebaseRateChanged")
          .withArgs(oldRebaseRate, rebaseRateSet);

        const newRebaseRate = await token.ownerRebaseRate();
        expect(newRebaseRate).to.eq(rebaseRateSet);
      });
    });

    describe("toggleOwnerRebase Function Test", function () {
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

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).toggleOwnerRebase(),
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(token.connect(treasuryFund).toggleOwnerRebase()).to.not.be
          .reverted;
      });

      it("Should set correct value and emit event LogRebaseOwnerChanged", async function () {
        const oldStatus = await token.isOwnerRebaseEnabled();
        /**
         * event fired :
         * LogRebaseOwnerChanged(oldStatus, newStatus)
         *
         */
        expect(await token.connect(treasuryFund).toggleOwnerRebase())
          .to.emit(token, "LogRebaseOwnerChanged")
          .withArgs(oldStatus, !oldStatus);

        const newStatus = await token.isOwnerRebaseEnabled();
        expect(newStatus).to.eq(!oldStatus);
      });
    });

    describe("toggleTransferStatus Function Test", function () {
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

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).toggleTransferStatus(),
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(token.connect(treasuryFund).toggleTransferStatus()).to.not
          .be.reverted;
      });

      it("Should set correct value and emit event LogTransferStatusChanged", async function () {
        const oldStatus = await token.isTransferEnabled();
        /**
         * event fired :
         * LogTransferStatusChanged(oldStatus, newStatus)
         *
         */
        expect(await token.connect(treasuryFund).toggleTransferStatus())
          .to.emit(token, "LogTransferStatusChanged")
          .withArgs(oldStatus, !oldStatus);

        const newStatus = await token.isTransferEnabled();
        expect(newStatus).to.eq(!oldStatus);
      });
    });

    describe("toggleTradingStatus Function Test", function () {
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

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).toggleTradingStatus(),
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(token.connect(treasuryFund).toggleTradingStatus()).to.not
          .be.reverted;
      });

      it("Should set correct value and emit event LogTradingStatusChanged", async function () {
        const oldStatus = await token.isTradingEnabled();
        /**
         * event fired :
         * LogTradingStatusChanged(oldStatus, newStatus)
         *
         */
        expect(await token.connect(treasuryFund).toggleTradingStatus())
          .to.emit(token, "LogTradingStatusChanged")
          .withArgs(oldStatus, !oldStatus);

        const newStatus = await token.isTradingEnabled();
        expect(newStatus).to.eq(!oldStatus);
      });
    });

    describe("setAutoRebase Function Test", function () {
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

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setAutoRebase(true),
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(token.connect(treasuryFund).setAutoRebase(true)).to.not.be
          .reverted;
      });

      it("Should Can't set value, if new value is same with old value", async function () {
        const oldStatus = await token._autoRebase();
        // so if we set same value again, its will revert
        await expect(
          token.connect(treasuryFund).setAutoRebase(oldStatus),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogAutoRebaseChanged", async function () {
        const oldStatus = await token._autoRebase();
        const newStatus = !oldStatus;
        /**
         * event fired :
         * LogAutoRebaseChanged(oldRate, newRate)
         *
         */
        expect(await token.connect(treasuryFund).setAutoRebase(newStatus))
          .to.emit(token, "LogAutoRebaseChanged")
          .withArgs(oldStatus, newStatus);

        const newRebaseStatus = await token._autoRebase();
        expect(newRebaseStatus).to.eq(newStatus);
      });
    });

    describe("setAutoAddLiquidity Function Test", function () {
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

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setAutoAddLiquidity(true),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        // because if we set same value, it will be reverted
        const oldStatus = await token._autoAddLiquidity();
        await expect(
          token.connect(treasuryFund).setAutoAddLiquidity(!oldStatus),
        ).to.not.be.reverted;
      });

      it("Should Can't set value, if new value is same with old value", async function () {
        const oldStatus = await token._autoAddLiquidity();
        // so if we set same value again, its will revert
        await expect(
          token.connect(treasuryFund).setAutoAddLiquidity(oldStatus),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogAutoLiquidityChanged", async function () {
        const oldStatus = await token._autoAddLiquidity();
        const newStatus = !oldStatus;
        /**
         * event fired :
         * LogAutoLiquidityChanged(oldRate, newRate)
         *
         */
        expect(await token.connect(treasuryFund).setAutoAddLiquidity(newStatus))
          .to.emit(token, "LogAutoLiquidityChanged")
          .withArgs(oldStatus, newStatus);

        const newRebaseStatus = await token._autoAddLiquidity();
        expect(newRebaseStatus).to.eq(newStatus);
      });
    });

    describe("setWhitelist Function Test", function () {
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

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setWhitelist(client2.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(token.connect(treasuryFund).setWhitelist(client2.address))
          .to.not.be.reverted;
      });

      it("Should Can't whitelist address if already whitelisted", async function () {
        await token.connect(treasuryFund).setWhitelist(client3.address);
        // so if we set same value again, its will revert
        await expect(
          token.connect(treasuryFund).setWhitelist(client3.address),
        ).to.be.revertedWith("Already Whitelisted");
      });

      it("Should Can't whitelist Zero address", async function () {
        await expect(
          token.connect(treasuryFund).setWhitelist(zeroAddress),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should set correct value and emit event LogWhitelistAdded", async function () {
        expect(await token.connect(treasuryFund).setWhitelist(client4.address))
          .to.emit(token, "LogWhitelistAdded")
          .withArgs(client4.address);

        const isExempt = await token.checkFeeExempt(client4.address);
        expect(isExempt).to.eq(true);
      });
    });

    describe("removeWhitelist Function Test", function () {
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
        // we whitelisted client1, client2 first, so can be removed later
        await token.connect(treasuryFund).setWhitelist(client1.address);
        await token.connect(treasuryFund).setWhitelist(client2.address);
      });

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).removeWhitelist(client2.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
          token.connect(treasuryFund).removeWhitelist(client1.address),
        ).to.not.be.reverted;
      });

      it("Should Can't remove whitelist if address already non whitelisted", async function () {
        // client 3 is non whitelisted address
        await expect(
          token.connect(treasuryFund).removeWhitelist(client3.address),
        ).to.be.revertedWith("Already Not Whitelisted");
      });

      it("Should Can't whitelist Zero address", async function () {
        await expect(
          token.connect(treasuryFund).removeWhitelist(zeroAddress),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should set correct value and emit event LogWhitelistRemoved", async function () {
        expect(
          await token.connect(treasuryFund).removeWhitelist(client2.address),
        )
          .to.emit(token, "LogWhitelistRemoved")
          .withArgs(client2.address);

        const isExempt = await token.checkFeeExempt(client2.address);
        expect(isExempt).to.eq(false);
      });
    });

    describe("setBotBlacklist Function Test", function () {
      let asBot1;

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

        asBot1 = await Token.deploy(
          pancakeRouterContract.address,
          autoLiquidityFund.address,
          treasuryFund.address,
          njordRiskFreeFund.address,
          supplyControl.address,
        );
        // just deploy bot for test
        await asBot1.deployed();
      });

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setBotBlacklist(asBot1.address, true),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
          token.connect(treasuryFund).setBotBlacklist(asBot1.address, true),
        ).to.not.be.reverted;
      });

      it("Should only contract can be marked as bot blacklist", async function () {
        // client 3 is non contract
        await expect(
          token.connect(treasuryFund).setBotBlacklist(client3.address, true),
        ).to.be.revertedWith("Only contract address");
      });

      it("Should set correct value and emit event LogBotBlacklisted", async function () {
        expect(await token.blacklist(asBot1.address)).to.eq(true);
        expect(
          await token
            .connect(treasuryFund)
            .setBotBlacklist(asBot1.address, false),
        )
          .to.emit(token, "LogBotBlacklisted")
          .withArgs(asBot1.address, false);

        expect(await token.blacklist(asBot1.address)).to.eq(false);
      });
    });

    describe("setAutoLiquidityFund Function Test", function () {
      beforeEach(async function () {
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

      it("Only Onwer can call this function", async function () {
        await expect(
          token
            .connect(client1)
            .setAutoLiquidityFund(newAutoLiquidityFund.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
          token
            .connect(treasuryFund)
            .setAutoLiquidityFund(newAutoLiquidityFund.address),
        ).to.not.be.reverted;
      });

      it("Should Revert / Fail if set to Zero address", async function () {
        await expect(
          token.connect(treasuryFund).setAutoLiquidityFund(zeroAddress),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should Revert / Fail if set with same Value", async function () {
        expect(await token.autoLiquidityFund()).to.eq(
          autoLiquidityFund.address,
        );
        await expect(
          token
            .connect(treasuryFund)
            .setAutoLiquidityFund(autoLiquidityFund.address),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogAutoLiquidityFundChanged", async function () {
        expect(
          await token
            .connect(treasuryFund)
            .setAutoLiquidityFund(newAutoLiquidityFund.address),
        )
          .to.emit(token, "LogAutoLiquidityFundChanged")
          .withArgs(autoLiquidityFund.address, newAutoLiquidityFund.address);
        expect(await token.autoLiquidityFund()).to.eq(
          newAutoLiquidityFund.address,
        );
      });
    });

    describe("setTreasuryFund Function Test", function () {
      beforeEach(async function () {
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

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setTreasuryFund(newTreasuryFund.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
          token.connect(treasuryFund).setTreasuryFund(newTreasuryFund.address),
        ).to.not.be.reverted;
      });

      it("Should Revert / Fail if set to Zero address", async function () {
        await expect(
          token.connect(treasuryFund).setTreasuryFund(zeroAddress),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should Revert / Fail if set with same Value", async function () {
        await expect(
          token.connect(treasuryFund).setTreasuryFund(treasuryFund.address),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogTreasuryFundChanged", async function () {
        expect(
          await token
            .connect(treasuryFund)
            .setTreasuryFund(newTreasuryFund.address),
        )
          .to.emit(token, "LogTreasuryFundChanged")
          .withArgs(treasuryFund.address, newTreasuryFund.address);
        expect(await token.treasuryFund()).to.eq(newTreasuryFund.address);
      });
    });

    describe("setRiskFreeFund Function Test", function () {
      beforeEach(async function () {
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

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setRiskFreeFund(newNjordRiskFreeFund.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
          token
            .connect(treasuryFund)
            .setRiskFreeFund(newNjordRiskFreeFund.address),
        ).to.not.be.reverted;
      });

      it("Should Revert / Fail if set to Zero address", async function () {
        await expect(
          token.connect(treasuryFund).setRiskFreeFund(zeroAddress),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should Revert / Fail if set with same Value", async function () {
        await expect(
          token
            .connect(treasuryFund)
            .setRiskFreeFund(njordRiskFreeFund.address),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogRiskFreeFundChanged", async function () {
        expect(
          await token
            .connect(treasuryFund)
            .setRiskFreeFund(newNjordRiskFreeFund.address),
        )
          .to.emit(token, "LogRiskFreeFundChanged")
          .withArgs(njordRiskFreeFund.address, newNjordRiskFreeFund.address);
        expect(await token.njordRiskFreeFund()).to.eq(
          newNjordRiskFreeFund.address,
        );
      });
    });

    describe("setSupplyControl Function Test", function () {
      beforeEach(async function () {
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

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setSupplyControl(newSupplyControl.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
          token
            .connect(treasuryFund)
            .setSupplyControl(newSupplyControl.address),
        ).to.not.be.reverted;
      });

      it("Should Revert / Fail if set to Zero address", async function () {
        await expect(
          token.connect(treasuryFund).setSupplyControl(zeroAddress),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should Revert / Fail if set with same Value", async function () {
        await expect(
          token.connect(treasuryFund).setSupplyControl(supplyControl.address),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogSupplyControlChanged", async function () {
        expect(
          await token
            .connect(treasuryFund)
            .setSupplyControl(newSupplyControl.address),
        )
          .to.emit(token, "LogSupplyControlChanged")
          .withArgs(supplyControl.address, newSupplyControl.address);
        expect(await token.supplyControl()).to.eq(newSupplyControl.address);
      });
    });

    describe("setPairAddress Function Test", function () {
      beforeEach(async function () {
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

      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setPairAddress(newWallet.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
          token.connect(treasuryFund).setPairAddress(newWallet.address),
        ).to.not.be.reverted;
      });

      it("Should Revert / Fail if set to Zero address", async function () {
        await expect(
          token.connect(treasuryFund).setPairAddress(zeroAddress),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should Revert / Fail if set with same Value", async function () {
        let pairAddress = await token.pairAddress();
        await expect(
          token.connect(treasuryFund).setPairAddress(pairAddress),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogPairAddressChanged", async function () {
        let pairAddress = await token.pairAddress();
        expect(
          await token.connect(treasuryFund).setPairAddress(newWallet.address),
        )
          .to.emit(token, "LogPairAddressChanged")
          .withArgs(pairAddress, newWallet.address);
        expect(await token.pairAddress()).to.eq(newWallet.address);
      });
    });

    /**
     * @TODO
     * function recoverERC20
     * function recoverBNB
     * function manualSync
     * function withdrawAllToTreasury
     */
  });

  describe("Transfer Test", function () {
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

    describe("Transactions Test", function () {
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

        await token.connect(treasuryFund).toggleTradingStatus();
        await token.connect(treasuryFund).toggleTransferStatus();
      });

      it("Should Revert if transfer to zero address", async function () {
        await expect(
          token
            .connect(treasuryFund)
            .transfer(zeroAddress, DEFAULT_NJORD_TRANSFER),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should reduce Circulating Supply if transfer to Dead Address", async function () {
        const oldCirc = await token.getCirculatingSupply();
        await token
          .connect(treasuryFund)
          .transfer(deadAddress, DEFAULT_NJORD_TRANSFER);
        expect(await token.getCirculatingSupply()).to.eq(
          oldCirc.sub(DEFAULT_NJORD_TRANSFER),
        );
      });
    });

    describe("Liquidity Test", function () {
      beforeEach(async function () {
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

        await token.connect(treasuryFund).toggleTradingStatus();
        await token.connect(treasuryFund).toggleTransferStatus();
      });

      it("Should be able to add liquidityETH", async function () {
        await token
          .connect(treasuryFund)
          .approve(pancakeRouterContract.address, MaxUint256);
        const pairAddress = await token.pairAddress();
        const oldTreasuryBal = await token.balanceOf(treasuryFund.address);
        const oldPairBal = await token.balanceOf(pairAddress);
        pancakePairContract = ethers.getContractAt(
          uniswapV2PairAbi,
          pairAddress,
          ethers.provider,
        );

        expect(
          await pancakeRouterContract
            .connect(treasuryFund)
            .addLiquidityETH(
              token.address,
              INITIAL_NJORD_LIQUIDITY,
              INITIAL_NJORD_LIQUIDITY,
              INITIAL_BNB_LIQUIDITY,
              treasuryFund.address,
              Math.floor(Date.now() / 1000) + 60 * 10,
              { value: INITIAL_BNB_LIQUIDITY },
            ),
        )
          .to.emit(token, "Transfer")
          .withArgs(treasuryFund, pairAddress, INITIAL_NJORD_LIQUIDITY)
          .to.emit(wbnbContract, "Deposit")
          .withArgs(pancakeRouterContract.address, INITIAL_BNB_LIQUIDITY)
          .to.emit(wbnbContract, "Transfer")
          .withArgs(
            pancakeRouterContract.address,
            pairAddress,
            INITIAL_BNB_LIQUIDITY,
          )
          .to.emit(pancakePairContract, "Sync")
          .withArgs(INITIAL_NJORD_LIQUIDITY, INITIAL_BNB_LIQUIDITY)
          .to.emit(pancakePairContract, "Mint")
          .withArgs(INITIAL_NJORD_LIQUIDITY, INITIAL_BNB_LIQUIDITY);

        const newTreasuryBal = await token.balanceOf(treasuryFund.address);
        const newPairBal = await token.balanceOf(pairAddress);

        expect(newTreasuryBal).to.eq(
          oldTreasuryBal.sub(INITIAL_NJORD_LIQUIDITY),
        );
        expect(newPairBal).to.eq(oldPairBal.add(INITIAL_NJORD_LIQUIDITY));
      });

      /**
       * help meeee
       */
      // it("Should be able to Remove liquidityETH", async function () {
      //   await token
      //     .connect(treasuryFund)
      //     .approve(pancakeRouterContract.address, MaxUint256);
      //   const pairAddress = await token.pairAddress();
      //   pancakePairContract = await ethers.getContractAt(
      //     uniswapV2PairAbi,
      //     pairAddress,
      //     ethers.provider,
      //   );

      //   await pancakeRouterContract
      //     .connect(treasuryFund)
      //     .addLiquidityETH(
      //       token.address,
      //       INITIAL_NJORD_LIQUIDITY,
      //       INITIAL_NJORD_LIQUIDITY,
      //       INITIAL_BNB_LIQUIDITY,
      //       treasuryFund.address,
      //       Math.floor(Date.now() / 1000) + 60 * 10,
      //       { value: INITIAL_BNB_LIQUIDITY },
      //     );

      //   /**
      //    * remove liquidity
      //    */

      //   await pancakePairContract
      //     .connect(treasuryFund)
      //     .approve(pancakeRouterContract.address, MaxUint256);
      //   await wbnbContract
      //     .connect(treasuryFund)
      //     .approve(pancakeRouterContract.address, MaxUint256);

      //   const liquidityBalance = await pancakePairContract.balanceOf(
      //     treasuryFund.address,
      //   );
      //   const njordPairBal = await token.balanceOf(pairAddress);
      //   const njordBal = await token.balanceOf(token.address);

      //   console.log(njordBal);
      //   console.log(njordPairBal);
      //   console.log(liquidityBalance);
      //   await pancakeRouterContract
      //     .connect(treasuryFund)
      //     .removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
      //       token.address,
      //       liquidityBalance,
      //       0,
      //       0,
      //       treasuryFund.address,
      //       MaxUint256,
      //     );
      //   const liquidityBalanceAfter = await pairContract.balanceOf(
      //     treasuryFund.address,
      //   );
      //   expect(liquidityBalanceAfter).to.be.equal(0);
      // });
    });
  });
});
