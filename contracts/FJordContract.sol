// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./interfaces/INJORD.sol";
import "./libraries/SafeMath.sol";
import "./libraries/SafeERC20.sol";
import "./libraries/Address.sol";
import "./libraries/ERC20.sol";
import "./libraries/Ownable.sol";
import "./libraries/ReentrancyGuard.sol";

contract FjordContract is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for ERC20;
    using Address for address;
    using SafeMath for uint256;

    address public immutable NJORD;
    bool public live;

    // events
    event LogAutoLiquidityFundChanged(address oldAutoLiquidityFund, address newAutoLiquidityFund);
    event LogTreasuryFundChanged(address oldTreasuryFund, address newTreasuryFund);
    event LogRiskFreeFundChanged(address oldRiskFreeFund, address newRiskFreeFund);
    event LogSupplyControlChanged(address oldSupplyControl, address newSupplyControl);
    event LogAddressWhitelistChanged(address addr, bool oldStatus, bool newStatus);
    event LogLiveStatusChanged(bool oldStatus, bool newStatus);
    event LogSetPairWithFee(address pairAdrress);
    event LogWrap(address addr, uint256 amount);
    event LogUnwrap(address addr, uint256 amount);
    event LogFeeChanged(uint256 liquidityFee, uint256 treasuryFee, uint256 njordRiskFreeFundFee, uint256 supplyControlFee, uint256 sellFee);

    // Fees section
    mapping(address => bool) public _pairWithFee;
    mapping(address => bool) public _isFeeExempt;
    uint256 public liquidityFee = 40;
    uint256 public treasuryFee = 25;
    uint256 public njordRiskFreeFundFee = 50;
    uint256 public sellFee = 20;
    uint256 public supplyControlFee = 25;
    uint256 public totalFee = liquidityFee.add(treasuryFee).add(njordRiskFreeFundFee).add(supplyControlFee);
    uint256 public feeDenominator = 1000;

    // System addresses section
    address public autoLiquidityFund;
    address public treasuryFund;
    address public njordRiskFreeFund;
    address public supplyControl;

    // modifier
    modifier validRecipient(address to) {
        require(to != address(0x0), "Address Zero Not Accepted");
        _;
    }

    constructor(
        address _NJORD,
        address payable _autoLiquidityFund,
        address payable _treasuryFund,
        address payable _njordRiskFreeFund,
        address payable _supplyControl
    ) ERC20("Fjord", "FJORD", 18) Ownable() {
        NJORD = _NJORD;
        live = false;

        _isFeeExempt[msg.sender] = true;

        autoLiquidityFund = _autoLiquidityFund;
        treasuryFund = _treasuryFund;
        njordRiskFreeFund = _njordRiskFreeFund;
        supplyControl = _supplyControl;
    }

    /**
        @notice wrap NJORD
        @param _amount uint
        @return uint
     */
    function wrap(uint256 _amount) external nonReentrant returns (uint256) {
        require(live == true, "FJORD: wrapping disabled");

        IERC20(NJORD).transferFrom(msg.sender, address(this), _amount);
        uint256 value = NJORDToFJORD(_amount);
        _mint(msg.sender, value);
        return value;
    }

    /**
        @notice unwrap NJORD
        @param _amount uint
        @return uint
     */
    function unwrap(uint256 _amount) external nonReentrant returns (uint256) {
        require(live == true, "FJORD: unwrapping disabled");

        _burn(msg.sender, _amount);

        uint256 value = FJORDToNJORD(_amount);
        IERC20(NJORD).transfer(msg.sender, value);
        return value;
    }

    /**
        @notice converts FJORD amount to NJORD
        @param _amount uint
        @return uint
     */
    function FJORDToNJORD(uint256 _amount) public view returns (uint256) {
        return _amount.mul(INJORD(NJORD).index()).div(10**decimals());
    }

    /**
        @notice converts NJORD amount to FJORD
        @param _amount uint
        @return uint
     */
    function NJORDToFJORD(uint256 _amount) public view returns (uint256) {
        return _amount.mul(10**decimals()).div(INJORD(NJORD).index());
    }

    /**
        @notice only take fee if on _pairWithFee mapping
        @param from address
        @param to address
        @return bool
     */
    function shouldTakeFee(address from, address to) internal view returns (bool) {
        return (_pairWithFee[from] || _pairWithFee[to]) && !_isFeeExempt[from];
    }

    /**
        @notice transfer ERC20 override
        @param to address
        @param value uint256
        @return bool
     */
    function transfer(address to, uint256 value) public override returns (bool) {
        _transferFrom(msg.sender, to, value);
        return true;
    }

    /**
        @notice transferFrom ERC20 override
        @param from address
        @param to address
        @param value uint256
        @return bool
     */
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public override returns (bool) {
        if (_allowances[from][msg.sender] != type(uint256).max) {
            _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(value, "FJORD: insufficient allowance");
        }

        _transferFrom(from, to, value);
        return true;
    }

    /**
        @notice transferFrom main function
        @param sender address
        @param recipient address
        @param amount uint256
        @return bool
     */
    function _transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) internal returns (bool) {
        uint256 amountReceived = shouldTakeFee(sender, recipient) ? takeFee(recipient, amount) : amount;

        _balances[sender] = _balances[sender].sub(amountReceived, "FJORD: transfer amount exceeds balance");
        _balances[recipient] = _balances[recipient].add(amountReceived);

        emit Transfer(sender, recipient, amountReceived);
        return true;
    }

    /**
        @notice take fee from _transferFrom function
        @param recipient address
        @param amount uint256
        @return bool
     */
    function takeFee(address recipient, uint256 amount) internal returns (uint256) {
        uint256 _totalFee = totalFee;
        uint256 _treasuryFee = treasuryFee;

        if (_pairWithFee[recipient]) {
            _totalFee = totalFee.add(sellFee);
            _treasuryFee = treasuryFee.add(sellFee);
        }

        uint256 feeAmount = amount.mul(_totalFee).div(feeDenominator);
        _balances[autoLiquidityFund] = _balances[autoLiquidityFund].add(amount.mul(liquidityFee).div(feeDenominator));
        _balances[treasuryFund] = _balances[treasuryFund].add(amount.mul(treasuryFee).div(feeDenominator));
        _balances[njordRiskFreeFund] = _balances[njordRiskFreeFund].add(amount.mul(njordRiskFreeFundFee).div(feeDenominator));
        _balances[supplyControl] = _balances[supplyControl].add(amount.mul(supplyControlFee).div(feeDenominator));

        return amount.sub(feeAmount);
    }

    /**
        @notice set live status
        @param _live bool
     */
    function setLiveStatus(bool _live) external onlyOwner {
        require(live != _live, "Nothing Changed");
        emit LogLiveStatusChanged(live, _live);
        live = _live;
    }

    function setFee(
        uint256 _liquidityFee,
        uint256 _treasuryFee,
        uint256 _njordRiskFreeFundFee,
        uint256 _supplyControlFee,
        uint256 _sellFee
    ) external onlyOwner {
        emit LogFeeChanged(_liquidityFee, _treasuryFee, _njordRiskFreeFundFee, _supplyControlFee, _sellFee);
        liquidityFee = _liquidityFee;
        treasuryFee = _treasuryFee;
        njordRiskFreeFundFee = _njordRiskFreeFundFee;
        supplyControlFee = _supplyControlFee;
        sellFee = _sellFee;
    }

    /**
        @notice set new pair address with fee
        @param _addr address
     */
    function setPairFee(address _addr) external validRecipient(_addr) onlyOwner {
        require(!_pairWithFee[_addr], "Already Set");
        emit LogSetPairWithFee(_addr);
        _pairWithFee[_addr] = true;
    }

    /**
        @notice set new fee receivers
        @param _addr address
     */
    function toggleWhitelist(address _addr) external onlyOwner {
        emit LogAddressWhitelistChanged(_addr, _isFeeExempt[_addr], !_isFeeExempt[_addr]);
        _isFeeExempt[_addr] = !_isFeeExempt[_addr];
    }

    function setAutoLiquidityFund(address _autoLiquidityFund) external onlyOwner validRecipient(_autoLiquidityFund) {
        require(_autoLiquidityFund != autoLiquidityFund, "Nothing Changed");
        emit LogAutoLiquidityFundChanged(autoLiquidityFund, _autoLiquidityFund);
        autoLiquidityFund = _autoLiquidityFund;
    }

    function setTreasuryFund(address _treasuryFund) external onlyOwner validRecipient(_treasuryFund) {
        require(_treasuryFund != treasuryFund, "Nothing Changed");
        emit LogTreasuryFundChanged(treasuryFund, _treasuryFund);
        treasuryFund = _treasuryFund;
    }

    function setRiskFreeFund(address _njordRiskFreeFund) external onlyOwner validRecipient(_njordRiskFreeFund) {
        require(_njordRiskFreeFund != njordRiskFreeFund, "Nothing Changed");
        emit LogRiskFreeFundChanged(njordRiskFreeFund, _njordRiskFreeFund);
        njordRiskFreeFund = _njordRiskFreeFund;
    }

    function setSupplyControl(address _supplyControl) external onlyOwner validRecipient(_supplyControl) {
        require(_supplyControl != supplyControl, "Nothing Changed");
        emit LogSupplyControlChanged(supplyControl, _supplyControl);
        supplyControl = _supplyControl;
    }
}
