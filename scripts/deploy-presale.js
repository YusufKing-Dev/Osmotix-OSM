const { ethers, network, run } = require("hardhat");

// ── CONFIG ─────────────────────────────────────────────────────
// OSM token contract address on Base Mainnet
const OSM_TOKEN_ADDRESS = "0xf13ad6eAD69fb561049bf21449b79039589651a9";

async function main() {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  OSM Presale — Deployment Script");
  console.log("══════════════════════════════════════════════════\n");

  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log(`Network  : ${network.name}`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(balance)} ETH\n`);

  console.log("Deploying OSMPresale contract...");
  const OSMPresale = await ethers.getContractFactory("OSMPresale");
  const presale    = await OSMPresale.deploy(OSM_TOKEN_ADDRESS);
  await presale.waitForDeployment();

  const address = await presale.getAddress();
  console.log(`\n✓ OSMPresale deployed to: ${address}`);
  console.log(`  OSM Token            : ${OSM_TOKEN_ADDRESS}`);
  console.log(`  Price per OSM        : 0.000016 ETH`);
  console.log(`  Total Allocation     : 25,800,000 OSM`);
  console.log(`  Duration             : 23 weeks after activation`);

  console.log("\n── Next Steps ────────────────────────────────────");
  console.log(`  1. Transfer 25,800,000 OSM to: ${address}`);
  console.log(`  2. Call activatePresale() to start the presale`);
  console.log(`  3. Share the presale contract address with buyers`);

  // Save deployment info
  const fs = require("fs");
  const outDir = "./deployments";
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(
    `${outDir}/presale-${network.name}.json`,
    JSON.stringify({
      network: network.name,
      presaleContract: address,
      osmToken: OSM_TOKEN_ADDRESS,
      pricePerOSM: "0.000016",
      totalAllocation: "25800000",
      duration: "23 weeks",
    }, null, 2)
  );
  console.log(`\n✓ Deployment info saved to deployments/presale-${network.name}.json`);

  // Verify on Basescan
  if (network.name === "base") {
    console.log("\nWaiting 5 confirmations before verification...");
    await presale.deploymentTransaction().wait(5);
    console.log("Verifying on Basescan...");
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [OSM_TOKEN_ADDRESS],
      });
      console.log("✓ Contract verified on Basescan");
    } catch (err) {
      if (err.message.includes("Already Verified")) {
        console.log("✓ Already verified");
      } else {
        console.warn("⚠ Verification failed:", err.message);
      }
    }
  }

  console.log("\n══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
