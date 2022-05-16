// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require('hardhat');

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy

  const autoLiquidityFund = '0x6404e52b500a7685dd7e9463718a85e3be7059b7';
  const treasuryFund = '0xd03d9e90f91229e372851eb9f7361ecf266630ac';
  const njordRiskFreeFund = '0xd93d4ce55c79d74e560e1517f3a825ce509f7138';
  const supplyControl = '0xf60d9700a3c24a393f7106c0948188b92ec5a44c';

  const NjordContract = await hre.ethers.getContractFactory('NjordContract');
  const njordContract = await NjordContract.deploy(
    autoLiquidityFund,
    treasuryFund,
    njordRiskFreeFund,
    supplyControl,
  );

  await njordContract.deployed();

  console.log('NjordContract deployed to:', njordContract.address);

  const WrappedNjord = await hre.ethers.getContractFactory('WrappedNjord');
  const wrappedNjord = await WrappedNjord.deploy(njordContract.address);

  await wrappedNjord.deployed();

  console.log('WrappedNjord deployed to:', wrappedNjord.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
