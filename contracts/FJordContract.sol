// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./INjord.sol";
import "./SafeMath.sol";
import "./SafeERC20.sol";
import "./Address.sol";
import "./ERC20.sol";
import "./Ownable.sol";

contract FjordContract is ERC20, Ownable {
    using SafeERC20 for ERC20;
    using Address for address;
    using SafeMath for uint256;

    address public immutable NJORD;
    bool public live;

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

    constructor(address _NJORD) ERC20("FJord", "FJORD", 18) Ownable() {
        require(_NJORD != address(0), "NJORD Address cannot be zero");
        NJORD = _NJORD;
        live = false;

        _isFeeExempt[msg.sender] = true;

        autoLiquidityFund = 0x6404e52B500a7685Dd7E9463718A85E3BE7059b7;
        treasuryFund = 0xD03D9e90f91229e372851eB9f7361Ecf266630Ac;
        njordRiskFreeFund = 0xd93D4cE55C79d74e560e1517f3A825ce509f7138;
        supplyControl = 0xf60D9700a3c24a393F7106c0948188b92ec5A44C;
    }

    /**
        @notice wrap NJORD
        @param _amount uint
        @return uint
     */
    function wrap(uint256 _amount) external returns (uint256) {
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
    function unwrap(uint256 _amount) external returns (uint256) {
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
        live = _live;
    }

    /**
        @notice set new fee receivers
        @param _autoLiquidityFund address
        @param _treasuryFund address
        @param _njordRiskFreeFund address
        @param _supplyControl address
     */
    function setFeeReceivers(
        address _autoLiquidityFund,
        address _treasuryFund,
        address _njordRiskFreeFund,
        address _supplyControl
    ) external onlyOwner {
        autoLiquidityFund = _autoLiquidityFund;
        treasuryFund = _treasuryFund;
        njordRiskFreeFund = _njordRiskFreeFund;
        supplyControl = _supplyControl;
    }

    /**
        @notice set new pair address with fee
        @param _addr address
     */
    function setPairFee(address _addr) external onlyOwner {
        _pairWithFee[_addr] = true;
    }

    /**
        @notice set new fee receivers
        @param _addr address
     */
    function toggleWhitelist(address _addr) external onlyOwner {
        _isFeeExempt[_addr] = !_isFeeExempt[_addr];
    }
}
