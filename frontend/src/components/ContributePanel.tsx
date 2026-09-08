import { useState } from "react";
import { useLaunchpad } from "../hooks/useLaunchpad";
import { toHumanReadable, fromHumanReadable } from "../lib/stellar";
import type { LaunchpadInfo } from "contract";
import type { ClientOptions } from "@stellar/stellar-sdk/contract";

interface Props {
  pubKey: string;
  signTransaction: NonNullable<ClientOptions["signTransaction"]>;
  contractId: string;
  refreshSignal?: number;
}

function StatusBadge({ info }: { info: LaunchpadInfo }) {
  const now = Math.floor(Date.now() / 1000);
  if (info.cancelled) return <span className="text-red-400 text-xs font-medium">CANCELLED</span>;
  if (now < Number(info.start)) return <span className="text-yellow-400 text-xs font-medium">UPCOMING</span>;
  if (now <= Number(info.end)) return <span className="text-emerald-400 text-xs font-medium">LIVE</span>;
  return <span className="text-blue-400 text-xs font-medium">ENDED</span>;
}

export function ContributePanel({ pubKey, signTransaction, contractId, refreshSignal }: Props) {
  const { info, contrib, claimable, loading, error, doContribute, doClaim, doRefund, refresh } =
    useLaunchpad({ pubKey, signTransaction, contractId, refreshSignal });
  const [amount, setAmount] = useState("");

  if (!info) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
        No launchpad found at this contract.
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const isLive = now >= Number(info.start) && now <= Number(info.end) && !info.cancelled;
  const progress = Number(info.cap) > 0 ? (Number(info.total_raised) / Number(info.cap)) * 100 : 0;
  const humanPrice = toHumanReadable(info.price);
  const remaining = Number(info.cap) - Number(info.total_raised);

  const handleContribute = async () => {
    const amt = fromHumanReadable(amount || "0");
    if (amt <= 0n) return;
    await doContribute(amt);
    setAmount("");
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Launchpad</h2>
          <StatusBadge info={info} />
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Price</span>
            <span className="text-white font-mono">{humanPrice} deposit / token</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Raised</span>
            <span className="text-white font-mono">
              {toHumanReadable(info.total_raised)} / {toHumanReadable(info.cap)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Soft cap</span>
            <span className="text-white font-mono">{toHumanReadable(info.soft_cap)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Tokens sold</span>
            <span className="text-white font-mono">{toHumanReadable(info.total_tokens_sold)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Remaining</span>
            <span className="text-white font-mono">{toHumanReadable(BigInt(remaining > 0 ? remaining : 0))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Vesting</span>
            <span className="text-white font-mono">
              cliff={info.cliff}s / duration={info.vesting_duration}s
            </span>
          </div>
        </div>

        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        {isLive && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Amount to contribute"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
            />
            <button
              onClick={handleContribute}
              disabled={loading || !amount}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {loading ? "..." : "Contribute"}
            </button>
          </div>
        )}
      </div>

      {contrib && Number(contrib.contributed) > 0 && (
        <div className="bg-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="text-white font-medium">Your Position</h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Contributed</span>
              <span className="text-white font-mono">{toHumanReadable(contrib.contributed)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tokens bought</span>
              <span className="text-white font-mono">{toHumanReadable(contrib.tokens_bought)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tokens claimed</span>
              <span className="text-white font-mono">{toHumanReadable(contrib.tokens_claimed)}</span>
            </div>
            {claimable && (
              <div className="flex justify-between text-emerald-400">
                <span>Claimable now</span>
                <span className="font-mono">{toHumanReadable(claimable.available)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {claimable && Number(claimable.available) > 0 && (
              <button
                onClick={doClaim}
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
              >
                {loading ? "..." : "Claim"}
              </button>
            )}
            {info.cancelled && (
              <button
                onClick={doRefund}
                disabled={loading}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
              >
                {loading ? "..." : "Refund"}
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/50 border border-red-700 p-3 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={refresh}
        className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
      >
        ↻ Refresh
      </button>
    </div>
  );
}
