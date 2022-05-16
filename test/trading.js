const { expect } = require('chai');
const { ethers } = require('hardhat');
// const dotenv = require("dotenv");

const uniswapV2FactoryAbi = require('./abi/IUniswapV2Factory.json').abi;
const uniswapV2RouterAbi = require('./abi/IUniswapV2Router02.json').abi;
const uniswapV2PairAbi = require('./abi/IUniswapV2Pair.json').abi;
const factoryAddress = '0xB7926C0430Afb07AA7DEfDE6DA862aE0Bde767bc';
const routerAddress = '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3';
const deadAddress = '0x000000000000000000000000000000000000dEaD';
const zeroAddress = '0x0000000000000000000000000000000000000000';
const router = new ethers.Contract(routerAddress, uniswapV2RouterAbi);

describe('Njord Token', function () {
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
  let client6;
  let client7;
  let client8;
  let client9;
  let client10;
  let emptyAddr;
  let newWallet;
  let addrs;

  let token;

  const maxSupplyBn = ethers.BigNumber.from('400000000000000');
  const initialSupplyBn = ethers.BigNumber.from('40000000000');

  beforeEach(async function () {
    // await ethers.provider.send("hardhat_reset"); // This resets removes the fork
    // Reset the fork
    await ethers.provider.send('hardhat_reset', [
      {
        forking: {
          jsonRpcUrl: process.env.BSCTESTNET_URL,
        },
      },
    ]);
    // Get signers
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
      client6,
      client7,
      client8,
      client9,
      client10,
      emptyAddr,
      newWallet,
      ...addrs
    ] = await ethers.getSigners();
    // Deploy contract
    const Token = await ethers.getContractFactory('NjordContract');
    token = await Token.deploy(
      autoLiquidityFund.address,
      treasuryFund.address,
      njordRiskFreeFund.address,
      supplyControl.address,
    );
    await token.deployed();

    await token.connect(treasuryFund).toggleTradingStatus();
    await token.connect(treasuryFund).toggleTransferStatus();

    // get router and pair
  });

  describe('Trading on Pancakeswap', function () {
    it('Make sure adding liquidity works', async function () {
      await token
        .connect(treasuryFund)
        .approve(router.address, initialSupplyBn);
      await router
        .connect(treasuryFund)
        .addLiquidityETH(
          token.address,
          initialSupplyBn,
          initialSupplyBn,
          ethers.utils.parseEther('200'),
          treasuryFund.address,
          Math.floor(Date.now() / 1000) + 60 * 10,
          { value: ethers.utils.parseEther('200') },
        );
      expect(await token.balanceOf(treasuryFund.address)).to.equal(0);
      expect(await token.balanceOf(token.pairAddress())).to.equal(
        initialSupplyBn,
      );
    });
  });
});
