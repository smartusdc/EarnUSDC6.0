import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Contract ABI (必要な関数のみ抽出)
const CONTRACT_ABI = [
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "referralCode",
        "type": "uint256"
      }
    ],
    "name": "depositFunds",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "claimDepositReward",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "deposits",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentAPR",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "generateReferralCode",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const USDC_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_spender", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  }
];

const CONTRACT_ADDRESS = '0x3038eBDFF5C17d9B0f07871b66FCDc7B9329fCD8';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC
const BASE_NETWORK_ID = '8453';

const EarnUSDC = () => {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [usdcContract, setUsdcContract] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [userDeposit, setUserDeposit] = useState('0');
  const [usdcBalance, setUsdcBalance] = useState('0');
  const [error, setError] = useState('');
  const [apr, setApr] = useState(24);
  const [isProcessing, setIsProcessing] = useState(false);

  // Web3接続の初期化
  const initWeb3 = async () => {
    try {
      if (window.ethereum) {
        const web3Instance = new Web3(window.ethereum);
        setWeb3(web3Instance);

        // コントラクトのインスタンス化
        const contractInstance = new web3Instance.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        const usdcInstance = new web3Instance.eth.Contract(USDC_ABI, USDC_ADDRESS);
        setContract(contractInstance);
        setUsdcContract(usdcInstance);

        // ネットワーク確認
        const chainId = await web3Instance.eth.getChainId();
        if (chainId.toString() !== BASE_NETWORK_ID) {
          setError('Please switch to Base Network');
          return;
        }

        // アカウント接続
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setAccount(accounts[0]);

        // イベントリスナー
        window.ethereum.on('accountsChanged', (accounts) => {
          setAccount(accounts[0]);
        });

        window.ethereum.on('chainChanged', () => {
          window.location.reload();
        });

      } else {
        setError('Please install MetaMask');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // 残高更新
  const updateBalances = async () => {
    if (!web3 || !account || !contract || !usdcContract) return;

    try {
      const [depositBalance, usdcBal, currentApr] = await Promise.all([
        contract.methods.deposits(account).call(),
        usdcContract.methods.balanceOf(account).call(),
        contract.methods.currentAPR().call()
      ]);

      setUserDeposit(web3.utils.fromWei(depositBalance, 'mwei'));
      setUsdcBalance(web3.utils.fromWei(usdcBal, 'mwei'));
      setApr(currentApr / 100);
    } catch (err) {
      setError('Failed to update balances');
    }
  };

  // 定期的な残高更新
  useEffect(() => {
    if (account) {
      updateBalances();
      const interval = setInterval(updateBalances, 30000);
      return () => clearInterval(interval);
    }
  }, [account, contract, usdcContract]);

  // 入金処理
  const handleDeposit = async () => {
    if (!web3 || !contract || !account || isProcessing) return;
    setIsProcessing(true);
    setError('');

    try {
      const amount = web3.utils.toWei(depositAmount, 'mwei');
      
      // Approve USDC
      await usdcContract.methods.approve(CONTRACT_ADDRESS, amount)
        .send({ from: account });

      // Deposit
      await contract.methods.depositFunds(amount, referralCode || '0')
        .send({ from: account });

      setDepositAmount('');
      updateBalances();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 出金処理
  const handleWithdraw = async () => {
    if (!web3 || !contract || !account || isProcessing) return;
    setIsProcessing(true);
    setError('');

    try {
      const amount = web3.utils.toWei(withdrawAmount, 'mwei');
      await contract.methods.withdraw(amount)
        .send({ from: account });

      setWithdrawAmount('');
      updateBalances();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // 報酬請求
  const handleClaim = async () => {
    if (!contract || !account || isProcessing) return;
    setIsProcessing(true);
    setError('');

    try {
      await contract.methods.claimDepositReward()
        .send({ from: account });
      updateBalances();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // MAX入金ボタン
  const handleMaxDeposit = () => {
    setDepositAmount(usdcBalance);
  };

  // MAX出金ボタン
  const handleMaxWithdraw = () => {
    setWithdrawAmount(userDeposit);
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>EarnUSDC on Base</CardTitle>
        </CardHeader>
        <CardContent>
          {!account ? (
            <Button 
              className="w-full" 
              onClick={initWeb3}
            >
              Connect Wallet
            </Button>
          ) : (
            <div className="space-y-4">
              {/* APR表示 */}
              <div className="text-center mb-4">
                <div className="text-2xl font-bold">Current APR: {apr}%</div>
                <div className="text-sm text-gray-500">
                  Referral Rewards: Referrer 5%, Referred 7%
                </div>
              </div>

              {/* 残高表示 */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-sm text-gray-500">Your USDC Balance</div>
                  <div className="font-bold">{Number(usdcBalance).toFixed(2)} USDC</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Your Deposit</div>
                  <div className="font-bold">{Number(userDeposit).toFixed(2)} USDC</div>
                </div>
              </div>

              {/* 入金フォーム */}
              <div>
                <div className="flex gap-2 mb-2">
                  <Input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Deposit amount"
                    disabled={isProcessing}
                  />
                  <Button 
                    onClick={handleMaxDeposit}
                    variant="outline"
                    disabled={isProcessing}
                  >
                    MAX
                  </Button>
                </div>
                <Input
                  type="number"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="Referral code (optional)"
                  className="mb-2"
                  disabled={isProcessing}
                />
                <Button 
                  className="w-full" 
                  onClick={handleDeposit}
                  disabled={!depositAmount || isProcessing}
                >
                  Deposit
                </Button>
              </div>

              {/* 出金フォーム */}
              <div>
                <div className="flex gap-2 mb-2">
                  <Input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Withdraw amount"
                    disabled={isProcessing}
                  />
                  <Button 
                    onClick={handleMaxWithdraw}
                    variant="outline"
                    disabled={isProcessing}
                  >
                    MAX
                  </Button>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleWithdraw}
                  disabled={!withdrawAmount || isProcessing}
                >
                  Withdraw
                </Button>
              </div>

              {/* 報酬請求ボタン */}
              <Button 
                className="w-full" 
                onClick={handleClaim}
                disabled={isProcessing}
              >
                Claim Rewards
              </Button>

              {/* エラー表示 */}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EarnUSDC;
