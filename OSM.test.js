const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// ─── Constants ────────────────────────────────────────────────────────────────

const DECIMALS       = 18n;
const ONE            = 10n ** DECIMALS;
const MAX_SUPPLY     = 430_000_000n * ONE;
const GENESIS_SUPPLY =  64_500_000n * ONE;
const ANNUAL_UNLOCK  =  91_375_000n * ONE;
const YEAR_SECONDS   = 365n * 24n * 3600n;

// ─── Fixture ─────────────────────────────────────────────────────────────────

async function deployFixture() {
  const [deployer, treasury, alice, bob] = await ethers.getSigners();
  const OSM = await ethers.getContractFactory("OSM");
  const osm = await OSM.deploy(treasury.address);
  await osm.waitForDeployment();
  return { osm, deployer, treasury, alice, bob };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OSM Token", function () {
  // ── 1. Deployment ───────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("sets name and symbol correctly", async function () {
      const { osm } = await loadFixture(deployFixture);
      expect(await osm.name()).to.equal("Osmotix");
      expect(await osm.symbol()).to.equal("OSM");
    });

    it("sets 18 decimals", async function () {
      const { osm } = await loadFixture(deployFixture);
      expect(await osm.decimals()).to.equal(18);
    });

    it("stores the treasury address immutably", async function () {
      const { osm, treasury } = await loadFixture(deployFixture);
      expect(await osm.treasury()).to.equal(treasury.address);
    });

    it("mints GENESIS_SUPPLY to treasury at deployment", async function () {
      const { osm, treasury } = await loadFixture(deployFixture);
      expect(await osm.balanceOf(treasury.address)).to.equal(GENESIS_SUPPLY);
      expect(await osm.totalSupply()).to.equal(GENESIS_SUPPLY);
    });

    it("reports MAX_SUPPLY correctly", async function () {
      const { osm } = await loadFixture(deployFixture);
      expect(await osm.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });

    it("reports remainingMintable correctly after genesis", async function () {
      const { osm } = await loadFixture(deployFixture);
      expect(await osm.remainingMintable()).to.equal(MAX_SUPPLY - GENESIS_SUPPLY);
    });

    it("reverts with zero-address treasury", async function () {
      const OSM = await ethers.getContractFactory("OSM");
      await expect(OSM.deploy(ethers.ZeroAddress)).to.be.revertedWith(
        "OSM: treasury is zero address"
      );
    });
  });

  // ── 2. Annual Unlock ─────────────────────────────────────────────────────────
  describe("Annual Unlock", function () {
    it("reverts before year 1 unlock window", async function () {
      const { osm, alice } = await loadFixture(deployFixture);
      await expect(osm.connect(alice).claimAnnualUnlock(1)).to.be.revertedWith(
        "OSM: unlock not yet available"
      );
    });

    it("allows anyone to trigger the unlock once the window is open", async function () {
      const { osm, alice, treasury } = await loadFixture(deployFixture);
      await time.increase(Number(YEAR_SECONDS));
      await expect(osm.connect(alice).claimAnnualUnlock(1)).to.not.be.reverted;
      // Tokens land in treasury, not in alice's wallet
      expect(await osm.balanceOf(alice.address)).to.equal(0n);
      expect(await osm.balanceOf(treasury.address)).to.equal(
        GENESIS_SUPPLY + ANNUAL_UNLOCK
      );
    });

    it("emits AnnualUnlockClaimed event with correct args", async function () {
      const { osm } = await loadFixture(deployFixture);
      await time.increase(Number(YEAR_SECONDS));
      const tx = await osm.claimAnnualUnlock(1);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      await expect(tx)
        .to.emit(osm, "AnnualUnlockClaimed")
        .withArgs(1, ANNUAL_UNLOCK, BigInt(block.timestamp));
    });

    it("cannot claim the same year twice", async function () {
      const { osm } = await loadFixture(deployFixture);
      await time.increase(Number(YEAR_SECONDS));
      await osm.claimAnnualUnlock(1);
      await expect(osm.claimAnnualUnlock(1)).to.be.revertedWith(
        "OSM: already claimed"
      );
    });

    it("correctly unlocks all four annual tranches", async function () {
      const { osm, treasury } = await loadFixture(deployFixture);
      let expectedSupply = GENESIS_SUPPLY;

      for (let y = 1; y <= 4; y++) {
        await time.increase(Number(YEAR_SECONDS));
        await osm.claimAnnualUnlock(y);
        expectedSupply += ANNUAL_UNLOCK;

        expect(await osm.totalSupply()).to.equal(expectedSupply);
        expect(await osm.unlockClaimed(y)).to.be.true;
      }

      expect(await osm.totalSupply()).to.equal(MAX_SUPPLY);
    });

    it("total supply equals MAX_SUPPLY after all unlocks", async function () {
      const { osm } = await loadFixture(deployFixture);
      await time.increase(Number(YEAR_SECONDS) * 4);
      for (let y = 1; y <= 4; y++) {
        await osm.claimAnnualUnlock(y);
      }
      expect(await osm.totalSupply()).to.equal(MAX_SUPPLY);
      expect(await osm.remainingMintable()).to.equal(0n);
    });

    it("cannot claim year 5 (invalid year)", async function () {
      const { osm } = await loadFixture(deployFixture);
      await time.increase(Number(YEAR_SECONDS) * 5);
      await expect(osm.claimAnnualUnlock(5)).to.be.revertedWith(
        "OSM: invalid year"
      );
      await expect(osm.claimAnnualUnlock(0)).to.be.revertedWith(
        "OSM: invalid year"
      );
    });

    it("can claim year 3 before year 2 if time has passed for both", async function () {
      const { osm } = await loadFixture(deployFixture);
      await time.increase(Number(YEAR_SECONDS) * 3);
      // Year 3 should be claimable even if year 2 hasn't been claimed yet
      await expect(osm.claimAnnualUnlock(3)).to.not.be.reverted;
      await expect(osm.claimAnnualUnlock(2)).to.not.be.reverted;
    });
  });

  // ── 3. Unlock Schedule View Helpers ─────────────────────────────────────────
  describe("View Helpers", function () {
    it("unlockTimestamp returns correct timestamps", async function () {
      const { osm } = await loadFixture(deployFixture);
      const deployedAt = await osm.deployedAt();
      for (let y = 1n; y <= 4n; y++) {
        expect(await osm.unlockTimestamp(y)).to.equal(
          deployedAt + y * YEAR_SECONDS
        );
      }
    });

    it("claimedUnlocks increments as unlocks are claimed", async function () {
      const { osm } = await loadFixture(deployFixture);
      expect(await osm.claimedUnlocks()).to.equal(0n);

      await time.increase(Number(YEAR_SECONDS));
      await osm.claimAnnualUnlock(1);
      expect(await osm.claimedUnlocks()).to.equal(1n);

      await time.increase(Number(YEAR_SECONDS));
      await osm.claimAnnualUnlock(2);
      expect(await osm.claimedUnlocks()).to.equal(2n);
    });

    it("remainingMintable decreases as unlocks are claimed", async function () {
      const { osm } = await loadFixture(deployFixture);
      expect(await osm.remainingMintable()).to.equal(MAX_SUPPLY - GENESIS_SUPPLY);

      await time.increase(Number(YEAR_SECONDS));
      await osm.claimAnnualUnlock(1);
      expect(await osm.remainingMintable()).to.equal(
        MAX_SUPPLY - GENESIS_SUPPLY - ANNUAL_UNLOCK
      );
    });
  });

  // ── 4. ERC-20 Standard Behaviour ────────────────────────────────────────────
  describe("ERC-20 Transfers", function () {
    it("allows standard transfers with no tax", async function () {
      const { osm, treasury, alice } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1000");
      await osm.connect(treasury).transfer(alice.address, amount);
      expect(await osm.balanceOf(alice.address)).to.equal(amount);
    });

    it("allows approve + transferFrom with no tax", async function () {
      const { osm, treasury, alice, bob } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("500");
      await osm.connect(treasury).approve(alice.address, amount);
      await osm.connect(alice).transferFrom(treasury.address, bob.address, amount);
      expect(await osm.balanceOf(bob.address)).to.equal(amount);
    });
  });

  // ── 5. Supply Cap Invariant ──────────────────────────────────────────────────
  describe("Supply Cap", function () {
    it("total supply never exceeds MAX_SUPPLY after all unlocks", async function () {
      const { osm } = await loadFixture(deployFixture);
      await time.increase(Number(YEAR_SECONDS) * 4);
      for (let y = 1; y <= 4; y++) {
        await osm.claimAnnualUnlock(y);
      }
      expect(await osm.totalSupply()).to.be.lte(MAX_SUPPLY);
    });
  });
});
