const { ethers, network, run } = require("hardhat");

const TREASURY_ADDRESS = "0xcfCDD0108E4B6b344c04EF98e47b54de2F2Bc8F8";

// ─── Formatting helpers ──────────────────────────────────────────────────────

function fmt(wei) {
  return Number(ethers.formatEther(wei)).toLocaleString("en-US") + " OSM";
}

function fmtDate(ts) {
  return new Date(Number(ts) * 1000).toISOString().split("T")[0];
}

async function main() {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  Osmotix (OSM) — Deployment Script");
  console.log("══════════════════════════════════════════════════\n");

  const [deployer] = await ethers.getSigners();

  console.log(`Network    : ${network.name}`);
  console.log(`Deployer   : ${deployer.address}`);
  console.log(`Treasury   : ${TREASURY_ADDRESS}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`ETH balance: ${ethers.formatEther(balance)} ETH\n`);

  // ─── Deploy ────────────────────────────────────────────────────────────────

  console.log("Deploying OSM contract...");
  const OSM = await ethers.getContractFactory("OSM");
  const osm = await OSM.deploy(TREASURY_ADDRESS);
  await osm.waitForDeployment();

  const contractAddress = await osm.getAddress();
  const deployedAt = await osm.deployedAt();

  console.log(`\n✓ OSM deployed to: ${contractAddress}`);
  console.log(`  Deployed at    : ${fmtDate(deployedAt)} (${deployedAt})`);

  // ─── Verify post-deploy state ─────────────────────────────────────────────

  console.log("\n── Token Details ─────────────────────────────────");
  console.log(`  Name       : ${await osm.name()}`);
  console.log(`  Symbol     : ${await osm.symbol()}`);
  console.log(`  Decimals   : ${await osm.decimals()}`);
  console.log(`  Max Supply : ${fmt(await osm.MAX_SUPPLY())}`);
  console.log(`  Circulating: ${fmt(await osm.totalSupply())}`);

  console.log("\n── Unlock Schedule ───────────────────────────────");
  const years = [1, 2, 3, 4];
  for (const y of years) {
    const ts = await osm.unlockTimestamp(y);
    const claimed = await osm.unlockClaimed(y);
    console.log(
      `  Year ${y}: ${fmtDate(ts)}  claimed=${claimed}`
    );
  }

  // ─── Save deployment artefact ─────────────────────────────────────────────

  const deployment = {
    network: network.name,
    chainId: network.config.chainId,
    contract: contractAddress,
    treasury: TREASURY_ADDRESS,
    deployer: deployer.address,
    deployedAt: Number(deployedAt),
    deployedAtISO: fmtDate(deployedAt),
    maxSupply: "430000000",
    genesisSupply: "64500000",
    annualUnlock: "91375000",
    unlockSchedule: years.map((y) => ({
      year: y,
      unlockDate: fmtDate(deployedAt + BigInt(y) * BigInt(365 * 24 * 60 * 60)),
    })),
  };

  const fs = require("fs");
  const outDir = "./deployments";
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outPath = `${outDir}/${network.name}.json`;
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\n✓ Deployment info saved to ${outPath}`);

  // ─── Source verification ───────────────────────────────────────────────────

  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting 5 confirmations before verification...");
    await osm.deploymentTransaction().wait(5);

    console.log("Verifying on Basescan...");
    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: [TREASURY_ADDRESS],
      });
      console.log("✓ Contract verified on Basescan");
    } catch (err) {
      if (err.message.includes("Already Verified")) {
        console.log("✓ Contract already verified");
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
