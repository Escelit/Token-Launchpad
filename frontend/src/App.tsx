import { useState } from "react";
import { useWallet } from "./hooks/useWallet";
import { WalletBar } from "./components/WalletBar";
import { AdminPanel } from "./components/AdminPanel";
import { ContributePanel } from "./components/ContributePanel";

export default function App() {
  const { connected, pubKey, connect, signTransaction } = useWallet();
  const [contractId, setContractId] = useState(
    import.meta.env.VITE_CONTRACT_ID || ""
  );
  const [isAdmin, setIsAdmin] = useState(false);

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-white">Token Launchpad</h1>
          <p className="text-gray-400">Connect your Freighter wallet to start</p>
          <WalletBar connected={connected} pubKey={pubKey} onConnect={connect} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <header className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Token Launchpad</h1>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                className="accent-indigo-500"
              />
              Admin mode
            </label>
            <WalletBar connected={connected} pubKey={pubKey} onConnect={connect} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-1">Contract ID</label>
          <input
            type="text"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            placeholder="G... or C..."
            className="w-full bg-gray-800 border border-gray-700 text-white px-4 py-2 rounded-lg text-sm font-mono"
          />
        </div>

        {contractId ? (
          <div className="grid md:grid-cols-2 gap-6">
            <ContributePanel
              pubKey={pubKey!}
              signTransaction={signTransaction}
              contractId={contractId}
            />
            {isAdmin && (
              <AdminPanel
                pubKey={pubKey!}
                signTransaction={signTransaction}
                contractId={contractId}
                onSuccess={() => {}}
              />
            )}
          </div>
        ) : (
          <p className="text-center text-gray-500 mt-12">
            Enter a contract ID above to interact with a launchpad.
          </p>
        )}
      </main>
    </div>
  );
}
