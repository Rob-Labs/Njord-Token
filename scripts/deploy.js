// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const routerAddress = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";
  const autoLiquidityFund = "0x6404e52b500a7685dd7e9463718a85e3be7059b7";
  const treasuryFund = "0xd03d9e90f91229e372851eb9f7361ecf266630ac";
  const njordRiskFreeFund = "0xd93d4ce55c79d74e560e1517f3a825ce509f7138";
  const supplyControl = "0xf60d9700a3c24a393f7106c0948188b92ec5a44c";

  const NjordContract = await hre.ethers.getContractFactory("NjordContract");
  const njordContract = await NjordContract.deploy(
    routerAddress,
    autoLiquidityFund,
    treasuryFund,
    njordRiskFreeFund,
    supplyControl,
  );

  await njordContract.deployed();

  console.log("NjordContract deployed to:", njordContract.address);

  const FjordContract = await hre.ethers.getContractFactory("FjordContract");
  const fjordContract = await FjordContract.deploy(
    njordContract.address,
    autoLiquidityFund,
    treasuryFund,
    njordRiskFreeFund,
    supplyControl,
  );

  await fjordContract.deployed();

  console.log("FjordContract deployed to:", fjordContract.address);

  try {
    await hre.run("verify", {
      address: njordContract.address,
      constructorArgsParams: [
        routerAddress,
        autoLiquidityFund,
        treasuryFund,
        njordRiskFreeFund,
        supplyControl,
      ],
    });
  } catch (error) {
    console.error(error);
    console.log(
      `Njord Contract at address ${njordContract.address} is already verified`,
    );
  }

  try {
    await hre.run("verify", {
      address: fjordContract.address,
      constructorArgsParams: [
        njordContract.address,
        autoLiquidityFund,
        treasuryFund,
        njordRiskFreeFund,
        supplyControl,
      ],
    });
  } catch (error) {
    console.error(error);
    console.log(
      `Njord Contract at address ${fjordContract.address} is already verified`,
    );
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
