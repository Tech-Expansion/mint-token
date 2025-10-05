import Head from "next/head";
import { CardanoWallet, useWallet } from "@meshsdk/react";
import { MeshTxBuilder, ForgeScript, resolveScriptHash, stringToHex } from '@meshsdk/core';
import { BlockfrostProvider } from "@meshsdk/core";
import { useState, useEffect } from "react";

export default function Home() {
  const { connected, wallet } = useWallet();
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [quantity, setQuantity] = useState("1000000");
  const [network, setNetwork] = useState("preprod"); // default to preprod

  const TIMEOUTS = {
    WALLET_OPERATIONS: 10000,  // 10 seconds
    TRANSACTION: 120000,       // 2 minutes
    NETWORK_DETECTION: 5000    // 5 seconds
  } as const;

  const timeout = (ms: number): Promise<never> => 
    new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), ms));
  const [metadata, setMetadata] = useState({
    name: "TEX Token",
    image: "ipfs://Qma7xj3oKJ2rghLSDVb5csGzMC5StGGzzYNLYzYwSA4WfN",
    mediaType: "image/jpg",
    description: "This NFT was minted by TEX (https://www.texblabs.com)"
  });
  const [provider, setProvider] = useState(() => {
    const initialKey = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY_PREPROD;
    return new BlockfrostProvider(initialKey || '');
  });

  useEffect(() => {
    let isMounted = true;
    
    async function checkNetwork() {
      if (connected && wallet) {
        try {
          const networkId = await Promise.race([
            wallet.getNetworkId(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Network detection timeout')), 5000)
            )
          ]);
          
          if (isMounted) {
            const detectedNetwork = networkId === 1 ? 'mainnet' : 'preprod';
            setNetwork(detectedNetwork);
          }
        } catch (error) {
          console.error('Error detecting network:', error);
          if (isMounted) {
            setError('Network detection failed. Please check your wallet connection.');
          }
        }
      }
    }
    
    checkNetwork();
    return () => { isMounted = false; };
  }, [connected, wallet]);

  useEffect(() => {
    const apiKey = network === 'mainnet' 
      ? process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY_MAINNET
      : process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY_PREPROD;
    if (!apiKey) {
      setError('Missing Blockfrost API key for the selected network. Please configure environment variables.');
      return;
    }
    setProvider(new BlockfrostProvider(apiKey));
  }, [network]);

  async function mintNft() {
    setLoading(true);
    setError("");
    setTxHash("");

    try {
      if (!connected || !wallet) {
        throw new Error("Please connect your wallet first.");
      }

      setLoadingMessage("Checking network...");
      const networkId = await Promise.race([
        wallet.getNetworkId(),
        timeout(TIMEOUTS.NETWORK_DETECTION)
      ]);

      const isMainnet = networkId === 1;
      if ((isMainnet && network !== 'mainnet') || (!isMainnet && network !== 'preprod')) {
        throw new Error(`Wallet is connected to ${isMainnet ? 'mainnet' : 'testnet'} but trying to mint on ${network}. Please switch your wallet network.`);
      }

      // Fetch wallet data in parallel with timeouts
      setLoadingMessage("Loading wallet data...");
      const [addresses, utxos, changeAddress] = await Promise.all([
        Promise.race([wallet.getUsedAddresses(), timeout(TIMEOUTS.WALLET_OPERATIONS)]),
        Promise.race([wallet.getUtxos(), timeout(TIMEOUTS.WALLET_OPERATIONS)]),
        Promise.race([wallet.getChangeAddress(), timeout(TIMEOUTS.WALLET_OPERATIONS)])
      ]);

      if (!addresses?.length) throw new Error("No used addresses found in the wallet.");
      if (!utxos?.length) throw new Error("No UTXOs found. Please make sure you have enough ADA in your wallet.");
      if (!changeAddress) throw new Error("Failed to get change address.");

      // Create transaction with timeout
      setLoadingMessage("Creating minting transaction...");
      const mintingProcess = async () => {
        const forgingScript = ForgeScript.withOneSignature(changeAddress);
        const policyId = resolveScriptHash(forgingScript);
        const tokenNameHex = stringToHex(metadata.name);
        const assetMetadata = { [policyId]: { [metadata.name]: { ...metadata } } };

        const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });
        const unsignedTx = await txBuilder
          .mint(quantity, policyId, tokenNameHex)
          .mintingScript(forgingScript)
          .metadataValue(721, assetMetadata)
          .changeAddress(changeAddress)
          .selectUtxosFrom(utxos)
          .complete();

        // Sign transaction
        setLoadingMessage("Waiting for transaction signature...");
        let signedTx: string;
        try {
          signedTx = await wallet.signTx(unsignedTx);
        } catch (e: any) {
          const msg = String(e?.message || e || '').toLowerCase();
          if (
            msg.includes('declined') ||
            msg.includes('denied') ||
            msg.includes('rejected') ||
            msg.includes('cancelled') ||
            msg.includes('canceled')
          ) {
            setError('Transaction signing was cancelled by the user.');
          } else {
            setError(e?.message || 'Failed to sign transaction.');
          }
          setLoadingMessage('');
          return; // abort minting if not signed
        }

        // Submit transaction
        setLoadingMessage("Submitting transaction to network...");
        try {
          const hash = await wallet.submitTx(signedTx);
          setTxHash(hash);
          return hash;
        } catch (e: any) {
          setError(e?.message || 'Failed to submit transaction.');
          setLoadingMessage('');
          return;
        }
      };

      await Promise.race([
        mintingProcess(),
        timeout(TIMEOUTS.TRANSACTION)
      ]);

    } catch (error: any) {
      console.error("Minting error:", error);
      setError(error.message || "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Head>
        <title>Cardano NFT Minter</title>
        <meta name="description" content="Create and mint your NFTs on Cardano" />
      </Head>

      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
            Cardano NFT Minter
          </h1>
          <p className="mt-4 text-gray-400 text-lg">Create and mint your unique NFTs on Cardano blockchain</p>
        </header>

        <div className="max-w-xl mx-auto">
          <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-gray-700">
            <div className="mb-8 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Select Network</label>
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg">
                  <span className={`w-2 h-2 rounded-full ${network === 'mainnet' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                  <span className="text-gray-300">
                    {network === 'mainnet' ? 'Mainnet' : 'Preprod Testnet'}
                  </span>
                </div>
              </div>
              <CardanoWallet />
            </div>

            {connected ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Quantity</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="1"
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">NFT Name</label>
                    <input
                      type="text"
                      value={metadata.name}
                      onChange={(e) => setMetadata({...metadata, name: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">IPFS Image URL</label>
                  <input
                    type="text"
                    value={metadata.image}
                    onChange={(e) => setMetadata({...metadata, image: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="ipfs://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Media Type</label>
                  <select
                    value={metadata.mediaType}
                    onChange={(e) => setMetadata({...metadata, mediaType: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    <option value="image/png">PNG Image</option>
                    <option value="image/jpeg">JPEG Image</option>
                    <option value="image/gif">GIF Image</option>
                    <option value="image/svg+xml">SVG Image</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
                  <textarea
                    value={metadata.description}
                    onChange={(e) => setMetadata({...metadata, description: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all min-h-[120px] resize-none"
                    placeholder="Describe your NFT..."
                  />
                </div>

                <button
                  onClick={mintNft}
                  disabled={loading}
                  className={`w-full py-3 rounded-lg text-lg font-semibold transition-all duration-200
                    ${loading 
                      ? 'bg-gray-600 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transform hover:scale-[1.02]'}`}
                >
                  {loading ? (
                    <div className="flex flex-col items-center">
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {loadingMessage || "Minting..."}
                      </span>
                      <span className="text-sm text-gray-400 mt-2">This may take a few moments</span>
                    </div>
                  ) : "Mint NFT"}
                </button>

                {error && (
                  <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg animate-fade-in">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {txHash && (
                  <div className="p-4 bg-green-900/20 border border-green-500/50 rounded-lg animate-fade-in">
                    <p className="text-emerald-400 font-medium">NFT Minted Successfully! 🎉</p>
                    <p className="text-xs text-emerald-500/80 break-all mt-2">
                      Transaction Hash: {txHash}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">Connect your wallet to start minting NFTs</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
