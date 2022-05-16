// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./SafeMathInt.sol";
import "./SafeMath.sol";
import "./IERC20.sol";
import "./ERC20Detailed.sol";
import "./IPancakeSwapPair.sol";
import "./IPancakeSwapRouter.sol";
import "./IPancakeSwapFactory.sol";
import "./Ownable.sol";

contract NjordContract is ERC20Detailed, Ownable {
    using SafeMath for uint256;
    using SafeMathInt for int256;

    event LogRebase(uint256 indexed epoch, uint256 totalSupply);
    event LogRebaseRateChanged(uint256 oldRate, uint256 newRate);
    event LogRebaseRateOwnerChanged(bool oldStatus, bool newStatus);
    event LogAutoRebaseChanged(bool oldValue, bool newValue);
    event LogAutoLiquidityChanged(bool oldValue, bool newValue);
    event LogFeeReceiversChanged(address newAutoLiquidityFund, address newTreasuryFund, address newNjordRiskFreeFund, address newSupplyControl);
    event LogPairAddressChanged(address oldPairAddress, address newPairAddress);
    event LogTradingStatusChanged(bool oldStatus, bool newStatus);
    event LogTransferStatusChanged(bool oldStatus, bool newStatus);
    event LogFallback(address from, uint256 amount);
    event LogReceive(address from, uint256 amount);
    event LogRecoverBNB(address indexed account, uint256 amount);
    event LogRecoverERC20(address indexed tokenAddress, address indexed account, uint256 amount);
    event LogBotBlacklisted(address botAddress, bool blacklistStatus);
    event LogWhitelistAdded(address account);
    event LogWhitelistRemoved(address account);

    IPancakeSwapPair public pairContract;
    mapping(address => bool) public _isFeeExempt;

    modifier validRecipient(address to) {
        require(to != address(0x0), "Address Zero Not Valid Recipient");
        _;
    }

    uint256 public constant DECIMALS = 5;
    uint256 public constant MAX_UINT256 = ~uint256(0);
    uint8 public constant RATE_DECIMALS = 7;

    uint256 private constant INITIAL_FRAGMENTS_SUPPLY = 400 * 10**3 * 10**DECIMALS;

    uint256 public liquidityFee = 40;
    uint256 public treasuryFee = 25;
    uint256 public njordRiskFreeFundFee = 50;
    uint256 public sellFee = 20;
    uint256 public supplyControlFee = 25;
    uint256 public totalFee = liquidityFee.add(treasuryFee).add(njordRiskFreeFundFee).add(supplyControlFee);
    uint256 public feeDenominator = 1000;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    address public constant ZERO = 0x0000000000000000000000000000000000000000;

    address public autoLiquidityFund;
    address public treasuryFund;
    address public njordRiskFreeFund;
    address public supplyControl;
    address public pairAddress;
    bool public swapEnabled = true;
    IPancakeSwapRouter public router;
    bool public inSwap = false;
    modifier swapping() {
        inSwap = true;
        _;
        inSwap = false;
    }

    uint256 private constant TOTAL_GONS = MAX_UINT256 - (MAX_UINT256 % INITIAL_FRAGMENTS_SUPPLY);

    uint256 private constant MAX_SUPPLY = 400 * 10**7 * 10**DECIMALS;

    uint256 public INDEX;

    bool public _autoRebase;
    bool public _autoAddLiquidity;
    uint256 public _initRebaseStartTime;
    uint256 public _lastRebasedTime;
    uint256 public _lastAddLiquidityTime;
    uint256 public _totalSupply;
    uint256 private _gonsPerFragment;

    uint256 public ownerRebaseRate;
    bool public isOwnerRebaseEnabled;

    bool public isTradingEnabled = false;
    bool public isTransferEnabled = false;

    mapping(address => uint256) private _gonBalances;
    mapping(address => mapping(address => uint256)) private _allowedFragments;
    mapping(address => bool) public blacklist;

    constructor(
        address payable _autoLiquidityFund,
        address payable _treasuryFund,
        address payable _njordRiskFreeFund,
        address payable _supplyControl
    ) ERC20Detailed("Njord", "NJORD", uint8(DECIMALS)) Ownable() {
        router = IPancakeSwapRouter( // Router
            // Ethereum mainnet
            // 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
            // Ropsten
            // 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
            // Bsc Mainnet
            // 0x10ED43C718714eb63d5aA57B78B54704E256024E
            // Bsc Testnet
            0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3
            // Polygon Mainnet
            // Mumbai Polygon Testnet
            // 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff
            // AVAX TraderJoe
            // 0x60aE616a2155Ee3d9A68541Ba4544862310933d4
        );

        pairAddress = IPancakeSwapFactory(router.factory()).createPair(router.WETH(), address(this));

        autoLiquidityFund = _autoLiquidityFund;
        treasuryFund = _treasuryFund;
        njordRiskFreeFund = _njordRiskFreeFund;
        supplyControl = _supplyControl;

        _allowedFragments[address(this)][address(router)] = type(uint256).max;
        pairContract = IPancakeSwapPair(pairAddress);

        _totalSupply = INITIAL_FRAGMENTS_SUPPLY;
        _gonBalances[treasuryFund] = TOTAL_GONS;
        _gonsPerFragment = TOTAL_GONS.div(_totalSupply);
        _initRebaseStartTime = block.timestamp;
        _lastRebasedTime = block.timestamp;
        _autoRebase = false;
        _autoAddLiquidity = true;
        _isFeeExempt[treasuryFund] = true;
        _isFeeExempt[address(this)] = true;

        INDEX = gonsForBalance(100000);

        _transferOwnership(treasuryFund);
        emit Transfer(address(0x0), treasuryFund, _totalSupply);
    }

    function setRebaseRate(uint256 _rebaseRate) external onlyOwner {
        emit LogRebaseRateChanged(ownerRebaseRate, _rebaseRate);
        ownerRebaseRate = _rebaseRate;
    }

    function toggleOwnerRebase() external onlyOwner {
        emit LogRebaseRateOwnerChanged(isOwnerRebaseEnabled, isOwnerRebaseEnabled);
        isOwnerRebaseEnabled = !isOwnerRebaseEnabled;
    }

    function rebase() internal {
        if (inSwap) return;
        uint256 rebaseRate;
        uint256 deltaTimeFromInit = block.timestamp - _initRebaseStartTime;
        uint256 deltaTime = block.timestamp - _lastRebasedTime;
        uint256 times = deltaTime.div(15 minutes);
        uint256 epoch = times.mul(15);

        if (deltaTimeFromInit >= (8 * 365 days)) {
            rebaseRate = 8;
        } else if (deltaTimeFromInit >= (5 * 365 days)) {
            rebaseRate = 33;
        } else if (deltaTimeFromInit >= (3 * 365 days)) {
            rebaseRate = 62;
        } else if (deltaTimeFromInit >= (2 * 365 days)) {
            rebaseRate = 125;
        } else if (deltaTimeFromInit >= (365 days)) {
            rebaseRate = 224;
        } else {
            rebaseRate = 2362;
        }

        if (isOwnerRebaseEnabled) {
            rebaseRate = ownerRebaseRate;
        }

        for (uint256 i = 0; i < times; i++) {
            _totalSupply = _totalSupply.mul((10**RATE_DECIMALS).add(rebaseRate)).div(10**RATE_DECIMALS);
        }

        _gonsPerFragment = TOTAL_GONS.div(_totalSupply);
        _lastRebasedTime = _lastRebasedTime.add(times.mul(15 minutes));

        pairContract.sync();

        emit LogRebase(epoch, _totalSupply);
    }

    function toggleTransferStatus() external onlyOwner {
        emit LogTransferStatusChanged(isTransferEnabled, !isTransferEnabled);
        isTransferEnabled = !isTransferEnabled;
    }

    function toggleTradingStatus() external onlyOwner {
        emit LogTradingStatusChanged(isTradingEnabled, !isTradingEnabled);
        isTradingEnabled = !isTradingEnabled;
    }

    function transfer(address to, uint256 value) external override validRecipient(to) returns (bool) {
        _transferFrom(msg.sender, to, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external override validRecipient(to) returns (bool) {
        if (_allowedFragments[from][msg.sender] != type(uint256).max) {
            _allowedFragments[from][msg.sender] = _allowedFragments[from][msg.sender].sub(value, "Insufficient Allowance");
        }
        _transferFrom(from, to, value);
        return true;
    }

    function _basicTransfer(
        address from,
        address to,
        uint256 amount
    ) internal returns (bool) {
        uint256 gonAmount = amount.mul(_gonsPerFragment);
        _gonBalances[from] = _gonBalances[from].sub(gonAmount);
        _gonBalances[to] = _gonBalances[to].add(gonAmount);
        return true;
    }

    function _transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) internal returns (bool) {
        require(!blacklist[sender] && !blacklist[recipient], "in_blacklist");

        if (pairAddress == sender || pairAddress == recipient) {
            require(isTradingEnabled, "Trading State is disabled");
        }

        if (!_isFeeExempt[sender]) {
            require(isTransferEnabled, "Transfer State is disabled");
        }

        if (inSwap) {
            return _basicTransfer(sender, recipient, amount);
        }
        if (shouldRebase()) {
            rebase();
        }

        if (shouldAddLiquidity()) {
            addLiquidity();
        }

        if (shouldSwapBack()) {
            swapBack();
        }

        uint256 gonAmount = amount.mul(_gonsPerFragment);
        _gonBalances[sender] = _gonBalances[sender].sub(gonAmount);
        uint256 gonAmountReceived = shouldTakeFee(sender, recipient) ? takeFee(sender, recipient, gonAmount) : gonAmount;
        _gonBalances[recipient] = _gonBalances[recipient].add(gonAmountReceived);

        emit Transfer(sender, recipient, gonAmountReceived.div(_gonsPerFragment));
        return true;
    }

    function takeFee(
        address sender,
        address recipient,
        uint256 gonAmount
    ) internal returns (uint256) {
        uint256 _totalFee = totalFee;
        uint256 _treasuryFee = treasuryFee;

        if (recipient == pairAddress) {
            _totalFee = totalFee.add(sellFee);
            _treasuryFee = treasuryFee.add(sellFee);
        }

        uint256 feeAmount = gonAmount.div(feeDenominator).mul(_totalFee);

        _gonBalances[supplyControl] = _gonBalances[supplyControl].add(gonAmount.div(feeDenominator).mul(supplyControlFee));
        _gonBalances[address(this)] = _gonBalances[address(this)].add(gonAmount.div(feeDenominator).mul(_treasuryFee.add(njordRiskFreeFundFee)));
        _gonBalances[autoLiquidityFund] = _gonBalances[autoLiquidityFund].add(gonAmount.div(feeDenominator).mul(liquidityFee));

        emit Transfer(sender, address(this), feeAmount.div(_gonsPerFragment));
        return gonAmount.sub(feeAmount);
    }

    function addLiquidity() internal swapping {
        uint256 autoLiquidityAmount = _gonBalances[autoLiquidityFund].div(_gonsPerFragment);
        _gonBalances[address(this)] = _gonBalances[address(this)].add(_gonBalances[autoLiquidityFund]);
        _gonBalances[autoLiquidityFund] = 0;
        uint256 amountToLiquify = autoLiquidityAmount.div(2);
        uint256 amountToSwap = autoLiquidityAmount.sub(amountToLiquify);

        if (amountToSwap == 0) {
            return;
        }
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();

        uint256 balanceBefore = address(this).balance;

        router.swapExactTokensForETHSupportingFeeOnTransferTokens(amountToSwap, 0, path, address(this), block.timestamp);

        uint256 amountETHLiquidity = address(this).balance.sub(balanceBefore);

        if (amountToLiquify > 0 && amountETHLiquidity > 0) {
            router.addLiquidityETH{value: amountETHLiquidity}(address(this), amountToLiquify, 0, 0, autoLiquidityFund, block.timestamp);
        }
        _lastAddLiquidityTime = block.timestamp;
    }

    function swapBack() internal swapping {
        uint256 amountToSwap = _gonBalances[address(this)].div(_gonsPerFragment);

        if (amountToSwap == 0) {
            return;
        }

        uint256 balanceBefore = address(this).balance;
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();

        router.swapExactTokensForETHSupportingFeeOnTransferTokens(amountToSwap, 0, path, address(this), block.timestamp);

        uint256 amountETHToTreasuryAndMRFF = address(this).balance.sub(balanceBefore);
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = payable(treasuryFund).call{value: amountETHToTreasuryAndMRFF.mul(treasuryFee).div(treasuryFee.add(njordRiskFreeFundFee)), gas: 30000}("");
        // solhint-disable-next-line avoid-low-level-calls
        (success, ) = payable(njordRiskFreeFund).call{value: amountETHToTreasuryAndMRFF.mul(njordRiskFreeFundFee).div(treasuryFee.add(njordRiskFreeFundFee)), gas: 30000}("");
    }

    function withdrawAllToTreasury() external swapping onlyOwner {
        uint256 amountToSwap = _gonBalances[address(this)].div(_gonsPerFragment);
        require(amountToSwap > 0, "There's no Token in contract");
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(amountToSwap, 0, path, treasuryFund, block.timestamp);
    }

    function shouldTakeFee(address from, address to) internal view returns (bool) {
        return (pairAddress == from || pairAddress == to) && !_isFeeExempt[from];
    }

    function shouldRebase() internal view returns (bool) {
        return _autoRebase && (_totalSupply < MAX_SUPPLY) && msg.sender != pairAddress && !inSwap && block.timestamp >= (_lastRebasedTime + 15 minutes);
    }

    function shouldAddLiquidity() internal view returns (bool) {
        return _autoAddLiquidity && !inSwap && msg.sender != pairAddress && block.timestamp >= (_lastAddLiquidityTime + 1 days);
    }

    function shouldSwapBack() internal view returns (bool) {
        return !inSwap && msg.sender != pairAddress;
    }

    function setAutoRebase(bool _flag) external onlyOwner {
        emit LogAutoRebaseChanged(_autoRebase, _flag);
        if (_flag) {
            _autoRebase = _flag;
            _lastRebasedTime = block.timestamp;
        } else {
            _autoRebase = _flag;
        }
    }

    function setAutoAddLiquidity(bool _flag) external onlyOwner {
        emit LogAutoLiquidityChanged(_autoAddLiquidity, _flag);
        if (_flag) {
            _autoAddLiquidity = _flag;
            _lastAddLiquidityTime = block.timestamp;
        } else {
            _autoAddLiquidity = _flag;
        }
    }

    function allowance(address owner_, address spender) external view override returns (uint256) {
        return _allowedFragments[owner_][spender];
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
        uint256 oldValue = _allowedFragments[msg.sender][spender];
        if (subtractedValue >= oldValue) {
            _allowedFragments[msg.sender][spender] = 0;
        } else {
            _allowedFragments[msg.sender][spender] = oldValue.sub(subtractedValue);
        }
        emit Approval(msg.sender, spender, _allowedFragments[msg.sender][spender]);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
        _allowedFragments[msg.sender][spender] = _allowedFragments[msg.sender][spender].add(addedValue);
        emit Approval(msg.sender, spender, _allowedFragments[msg.sender][spender]);
        return true;
    }

    function approve(address spender, uint256 value) external override returns (bool) {
        _allowedFragments[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function checkFeeExempt(address _addr) external view returns (bool) {
        return _isFeeExempt[_addr];
    }

    function getCirculatingSupply() public view returns (uint256) {
        return (TOTAL_GONS.sub(_gonBalances[DEAD]).sub(_gonBalances[ZERO])).div(_gonsPerFragment);
    }

    function isNotInSwap() external view returns (bool) {
        return !inSwap;
    }

    function manualSync() external {
        IPancakeSwapPair(pairAddress).sync();
    }

    function setFeeReceivers(
        address _autoLiquidityFund,
        address _treasuryFund,
        address _njordRiskFreeFund,
        address _supplyControl
    ) external onlyOwner {
        emit LogFeeReceiversChanged(_autoLiquidityFund, _treasuryFund, _njordRiskFreeFund, _supplyControl);
        autoLiquidityFund = _autoLiquidityFund;
        treasuryFund = _treasuryFund;
        njordRiskFreeFund = _njordRiskFreeFund;
        supplyControl = _supplyControl;
    }

    function getLiquidityBacking(uint256 accuracy) external view returns (uint256) {
        uint256 liquidityBalance = _gonBalances[pairAddress].div(_gonsPerFragment);
        return accuracy.mul(liquidityBalance.mul(2)).div(getCirculatingSupply());
    }

    function setWhitelist(address _addr) external onlyOwner {
        _isFeeExempt[_addr] = true;
        emit LogWhitelistAdded(_addr);
    }

    function removeWhitelist(address _addr) external onlyOwner {
        _isFeeExempt[_addr] = false;
        emit LogWhitelistRemoved(_addr);
    }

    function setBotBlacklist(address _botAddress, bool _flag) external onlyOwner {
        require(isContract(_botAddress), "Only contract address");
        emit LogBotBlacklisted(_botAddress, _flag);
        blacklist[_botAddress] = _flag;
    }

    function setPairAddress(address _pairAddress) external onlyOwner {
        emit LogPairAddressChanged(pairAddress, _pairAddress);

        pairAddress = _pairAddress;
        pairContract = IPancakeSwapPair(_pairAddress);
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address who) external view override returns (uint256) {
        return _gonBalances[who].div(_gonsPerFragment);
    }

    function isContract(address addr) internal view returns (bool) {
        uint256 size;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }

    function gonsForBalance(uint256 amount) public view returns (uint256) {
        return amount.mul(_gonsPerFragment);
    }

    function balanceForGons(uint256 gons) public view returns (uint256) {
        return gons.div(_gonsPerFragment);
    }

    function index() public view returns (uint256) {
        return balanceForGons(INDEX);
    }

    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(this), "Cannot Recover this address");
        IERC20(tokenAddress).transfer(owner(), tokenAmount);
        emit LogRecoverERC20(tokenAddress, owner(), tokenAmount);
    }

    function recoverBNB(uint256 amount) external onlyOwner {
        // solhint-disable-next-line avoid-low-level-calls, avoid-call-value
        (bool sent, ) = owner().call{value: amount}("");
        require(sent, "Recover BNB Failed");
        emit LogRecoverBNB(owner(), amount);
    }

    receive() external payable {
        emit LogReceive(msg.sender, msg.value);
    }

    fallback() external payable {
        emit LogFallback(msg.sender, msg.value);
    }
}
