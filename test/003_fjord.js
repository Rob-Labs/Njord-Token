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

  describe("Function Test", function () {
    describe("setFee Function Test", function () {
      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setFee(20, 20, 20, 20, 20),
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(token.connect(deployer).setFee(20, 20, 20, 20, 20)).to.not
          .be.reverted;
      });

      it("Should set correct value and emit event LogFeeChanged", async function () {
        expect(await token.connect(deployer).setFee(10, 10, 10, 10, 10))
          .to.emit(token, "LogFeeChanged")
          .withArgs(10, 10, 10, 10, 10);

        expect(await token.liquidityFee()).to.eq(10);
        expect(await token.treasuryFee()).to.eq(10);
        expect(await token.njordRiskFreeFundFee()).to.eq(10);
        expect(await token.supplyControlFee()).to.eq(10);
        expect(await token.sellFee()).to.eq(10);
      });
    });

    describe("toggleWhitelist Function Test", function () {
      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).toggleWhitelist(client2.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(token.connect(deployer).toggleWhitelist(client2.address))
          .to.not.be.reverted;
      });

      it("Should set correct value and emit event LogAddressWhitelistChanged", async function () {
        const oldStatus = await token._isFeeExempt(client1.address);
        /**
         * event fired :
         * LogAddressWhitelistChanged(oldStatus, newStatus)
         *
         */
        expect(await token.connect(deployer).toggleWhitelist(client1.address))
          .to.emit(token, "LogAddressWhitelistChanged")
          .withArgs(oldStatus, !oldStatus);

        const newStatus = await await token._isFeeExempt(client1.address);
        expect(newStatus).to.eq(!oldStatus);
      });
    });

    describe("setLiveStatus Function Test", function () {
      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setLiveStatus(true),
        ).to.be.revertedWith("Ownable: caller is not the owner");
        await expect(token.connect(deployer).setLiveStatus(true)).to.not.be
          .reverted;
      });

      it("Should Can't set value, if new value is same with old value", async function () {
        const oldStatus = await token.live();
        // so if we set same value again, its will revert
        await expect(
          token.connect(deployer).setLiveStatus(oldStatus),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogLiveStatusChanged", async function () {
        const oldStatus = await token.live();
        const newStatus = !oldStatus;

        expect(await token.connect(deployer).setLiveStatus(newStatus))
          .to.emit(token, "LogLiveStatusChanged")
          .withArgs(oldStatus, newStatus);

        const newLiveStatus = await token.live();
        expect(newLiveStatus).to.eq(newStatus);
      });
    });

    describe("setAutoLiquidityFund Function Test", function () {
      it("Only Onwer can call this function", async function () {
        await expect(
          token
            .connect(client1)
            .setAutoLiquidityFund(newAutoLiquidityFund.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
          token
            .connect(deployer)
            .setAutoLiquidityFund(newAutoLiquidityFund.address),
        ).to.not.be.reverted;
      });

      it("Should Revert / Fail if set to Zero address", async function () {
        await expect(
          token.connect(deployer).setAutoLiquidityFund(zeroAddress),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should Revert / Fail if set with same Value", async function () {
        await expect(
          token
            .connect(deployer)
            .setAutoLiquidityFund(newAutoLiquidityFund.address),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogAutoLiquidityFundChanged", async function () {
        expect(
          await token
            .connect(deployer)
            .setAutoLiquidityFund(autoLiquidityFund.address),
        )
          .to.emit(token, "LogAutoLiquidityFundChanged")
          .withArgs(newAutoLiquidityFund.address, autoLiquidityFund.address);
        expect(await token.autoLiquidityFund()).to.eq(
          autoLiquidityFund.address,
        );
      });
    });

    describe("setTreasuryFund Function Test", function () {
      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setTreasuryFund(newTreasuryFund.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
          token.connect(deployer).setTreasuryFund(newTreasuryFund.address),
        ).to.not.be.reverted;
      });

      it("Should Revert / Fail if set to Zero address", async function () {
        await expect(
          token.connect(deployer).setTreasuryFund(zeroAddress),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should Revert / Fail if set with same Value", async function () {
        await expect(
          token.connect(deployer).setTreasuryFund(newTreasuryFund.address),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogTreasuryFundChanged", async function () {
        expect(
          await token.connect(deployer).setTreasuryFund(treasuryFund.address),
        )
          .to.emit(token, "LogTreasuryFundChanged")
          .withArgs(newTreasuryFund.address, treasuryFund.address);
        expect(await token.treasuryFund()).to.eq(treasuryFund.address);
      });
    });

    describe("setRiskFreeFund Function Test", function () {
      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setRiskFreeFund(newNjordRiskFreeFund.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
          token.connect(deployer).setRiskFreeFund(newNjordRiskFreeFund.address),
        ).to.not.be.reverted;
      });

      it("Should Revert / Fail if set to Zero address", async function () {
        await expect(
          token.connect(deployer).setRiskFreeFund(zeroAddress),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should Revert / Fail if set with same Value", async function () {
        await expect(
          token.connect(deployer).setRiskFreeFund(newNjordRiskFreeFund.address),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogRiskFreeFundChanged", async function () {
        expect(
          await token
            .connect(deployer)
            .setRiskFreeFund(njordRiskFreeFund.address),
        )
          .to.emit(token, "LogRiskFreeFundChanged")
          .withArgs(newNjordRiskFreeFund.address, njordRiskFreeFund.address);
        expect(await token.njordRiskFreeFund()).to.eq(
          njordRiskFreeFund.address,
        );
      });
    });

    describe("setSupplyControl Function Test", function () {
      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setSupplyControl(newSupplyControl.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(
          token.connect(deployer).setSupplyControl(newSupplyControl.address),
        ).to.not.be.reverted;
      });

      it("Should Revert / Fail if set to Zero address", async function () {
        await expect(
          token.connect(deployer).setSupplyControl(zeroAddress),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should Revert / Fail if set with same Value", async function () {
        await expect(
          token.connect(deployer).setSupplyControl(newSupplyControl.address),
        ).to.be.revertedWith("Nothing Changed");
      });

      it("Should set correct value and emit event LogSupplyControlChanged", async function () {
        expect(
          await token.connect(deployer).setSupplyControl(supplyControl.address),
        )
          .to.emit(token, "LogSupplyControlChanged")
          .withArgs(newSupplyControl.address, supplyControl.address);
        expect(await token.supplyControl()).to.eq(supplyControl.address);
      });
    });

    describe("setPairFee Function Test", function () {
      it("Only Onwer can call this function", async function () {
        await expect(
          token.connect(client1).setPairFee(newWallet.address),
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(token.connect(deployer).setPairFee(newWallet.address)).to
          .not.be.reverted;
      });

      it("Should Revert / Fail if set to Zero address", async function () {
        await expect(
          token.connect(deployer).setPairFee(zeroAddress),
        ).to.be.revertedWith("Address Zero Not Accepted");
      });

      it("Should Revert / Fail if set with same Value", async function () {
        await expect(
          token.connect(deployer).setPairFee(newWallet.address),
        ).to.be.revertedWith("Already Set");
      });

      it("Should set correct value and emit event LogSetPairWithFee", async function () {
        expect(await token.connect(deployer).setPairFee(emptyAddr.address))
          .to.emit(token, "LogSetPairWithFee")
          .withArgs(emptyAddr.address);
        expect(await token._pairWithFee(emptyAddr.address)).to.eq(true);
      });
    });
  });
});
