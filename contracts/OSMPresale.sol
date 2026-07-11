// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OSMPresale
 * @notice Presale contract for Osmotix (OSM) token.
 *
 * Details:
 *   - Total presale allocation : 25,800,000 OSM (6% of supply)
 *   - Price                    : 0.000016 ETH per OSM
 *   - Duration                 : 23 weeks from activation
 *   - Network                  : Base Mainnet
 *   - First come, first serve  : no per-wallet cap
 *
 * Flow:
 *   1. Deploy this contract.
 *   2. Owner transfers 25,800,000 OSM to this contract address.
 *   3. Owner calls activatePresale() to start the 23-week window.
 *   4. Buyers call buyOSM() with ETH — OSM is sent immediately.
 *   5. Owner calls withdrawETH() at any time to collect raised ETH.
 *   6. After presale ends, owner calls withdrawUnsoldOSM() to reclaim unsold tokens.
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract OSMPresale {

    // ── Constants ──────────────────────────────────────────────
    uint256 public constant PRICE_PER_OSM    = 16000000000000; // 0.000016 ETH (in wei)
    uint256 public constant TOTAL_ALLOCATION = 25_800_000e18;  // 25.8M OSM
    uint256 public constant PRESALE_DURATION = 23 weeks;
    uint256 public constant DECIMALS         = 18;

    // ── State ──────────────────────────────────────────────────
    address public owner;
    IERC20  public osmToken;

    bool    public presaleActive;
    uint256 public presaleStart;
    uint256 public presaleEnd;

    uint256 public totalSold;     // OSM sold so far (in wei units)
    uint256 public totalRaised;   // ETH raised so far (in wei)

    mapping(address => uint256) public purchased; // OSM purchased per wallet

    // ── Events ─────────────────────────────────────────────────
    event PresaleActivated(uint256 start, uint256 end);
    event TokensPurchased(address indexed buyer, uint256 ethSpent, uint256 osmReceived);
    event ETHWithdrawn(address indexed to, uint256 amount);
    event UnsoldOSMWithdrawn(address indexed to, uint256 amount);

    // ── Modifiers ──────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier presaleOpen() {
        require(presaleActive, "presale not active");
        require(block.timestamp >= presaleStart, "presale not started");
        require(block.timestamp <= presaleEnd, "presale ended");
        _;
    }

    // ── Constructor ────────────────────────────────────────────
    constructor(address _osmToken) {
        require(_osmToken != address(0), "zero address");
        owner    = msg.sender;
        osmToken = IERC20(_osmToken);
    }

    // ── Admin ──────────────────────────────────────────────────

    /**
     * @notice Activate the presale. Contract must hold the full 25.8M OSM allocation.
     */
    function activatePresale() external onlyOwner {
        require(!presaleActive, "already active");
        require(
            osmToken.balanceOf(address(this)) >= TOTAL_ALLOCATION,
            "insufficient OSM balance - fund contract first"
        );

        presaleActive = true;
        presaleStart  = block.timestamp;
        presaleEnd    = block.timestamp + PRESALE_DURATION;

        emit PresaleActivated(presaleStart, presaleEnd);
    }

    /**
     * @notice Withdraw ETH raised from the presale.
     */
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "no ETH to withdraw");
        (bool ok, ) = owner.call{value: balance}("");
        require(ok, "ETH transfer failed");
        emit ETHWithdrawn(owner, balance);
    }

    /**
     * @notice Withdraw unsold OSM after presale ends.
     */
    function withdrawUnsoldOSM() external onlyOwner {
        require(block.timestamp > presaleEnd, "presale still active");
        uint256 unsold = osmToken.balanceOf(address(this));
        require(unsold > 0, "no OSM to withdraw");
        osmToken.transfer(owner, unsold);
        emit UnsoldOSMWithdrawn(owner, unsold);
    }

    /**
     * @notice Transfer ownership.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        owner = newOwner;
    }

    // ── Buy ────────────────────────────────────────────────────

    /**
     * @notice Buy OSM with ETH.
     * @dev Sends OSM immediately. Any excess ETH is refunded.
     */
    function buyOSM() external payable presaleOpen {
        require(msg.value > 0, "send ETH");

        // Calculate how much OSM the buyer gets
        uint256 osmAmount = (msg.value * 1e18) / PRICE_PER_OSM;
        require(osmAmount > 0, "amount too small");

        // Cap at remaining allocation
        uint256 remaining = TOTAL_ALLOCATION - totalSold;
        require(remaining > 0, "sold out");

        uint256 refund = 0;
        if (osmAmount > remaining) {
            osmAmount = remaining;
            // Recalculate ETH needed for capped amount
            uint256 ethNeeded = (osmAmount * PRICE_PER_OSM) / 1e18;
            refund = msg.value - ethNeeded;
        }

        totalSold   += osmAmount;
        totalRaised += (msg.value - refund);
        purchased[msg.sender] += osmAmount;

        // Send OSM to buyer
        require(osmToken.transfer(msg.sender, osmAmount), "OSM transfer failed");

        // Refund excess ETH if sold out mid-purchase
        if (refund > 0) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            require(ok, "refund failed");
        }

        emit TokensPurchased(msg.sender, msg.value - refund, osmAmount);
    }

    // ── View helpers ───────────────────────────────────────────

    /// @notice OSM remaining for sale.
    function remainingOSM() external view returns (uint256) {
        return TOTAL_ALLOCATION - totalSold;
    }

    /// @notice ETH required to buy a given amount of OSM.
    function ethForOSM(uint256 osmAmount) external pure returns (uint256) {
        return (osmAmount * PRICE_PER_OSM) / 1e18;
    }

    /// @notice OSM you get for a given ETH amount.
    function osmForETH(uint256 ethAmount) external pure returns (uint256) {
        return (ethAmount * 1e18) / PRICE_PER_OSM;
    }

    /// @notice Time remaining in presale (seconds).
    function timeRemaining() external view returns (uint256) {
        if (!presaleActive || block.timestamp > presaleEnd) return 0;
        return presaleEnd - block.timestamp;
    }

    /// @notice Whether the presale is currently open.
    function isPresaleOpen() external view returns (bool) {
        return presaleActive &&
               block.timestamp >= presaleStart &&
               block.timestamp <= presaleEnd &&
               totalSold < TOTAL_ALLOCATION;
    }

    receive() external payable {
        // Allow direct ETH sends to trigger buyOSM
        if (presaleActive && block.timestamp >= presaleStart && block.timestamp <= presaleEnd) {
            this.buyOSM{value: msg.value}();
        }
    }
}
