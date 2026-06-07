interface Props {
  connected: boolean;
  pubKey: string | null;
  onConnect: () => void;
}

export function WalletBar({ connected, pubKey, onConnect }: Props) {
  return (
    <div className="flex items-center gap-3">
      {connected ? (
        <span className="text-sm text-gray-400 font-mono">
          {pubKey?.slice(0, 6)}...{pubKey?.slice(-4)}
        </span>
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
