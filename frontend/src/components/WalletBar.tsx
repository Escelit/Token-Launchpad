import { useState } from "react";

interface Props {
  connected: boolean;
  pubKey: string | null;
  onConnect: () => void;
  onDisconnect?: () => void;
}

export function WalletBar({ connected, pubKey, onConnect, onDisconnect }: Props) {
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!pubKey) return;
    try {
      await navigator.clipboard.writeText(pubKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="flex items-center gap-3">
      {connected ? (
        <>
          <button
            onClick={copyAddress}
            title="Copy address"
            className="text-sm text-gray-400 font-mono hover:text-gray-200 transition-colors"
          >
            {copied ? "Copied!" : `${pubKey?.slice(0, 6)}...${pubKey?.slice(-4)}`}
          </button>
          {onDisconnect && (
            <button
              onClick={onDisconnect}
              title="Disconnect wallet"
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Disconnect
            </button>
          )}
        </>
      ) : (
        <button
          onClick={onConnect}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Connect Freighter
        </button>
      )}
    </div>
  );
}
