import { useState } from "react";
import { createClient, initialize, fromHumanReadable, fund, withdrawDeposits, cancel } from "../lib/stellar";
import type { ClientOptions } from "@stellar/stellar-sdk/contract";

interface Props {
  pubKey: string;
  signTransaction: NonNullable<ClientOptions["signTransaction"]>;
  contractId: string;
  onSuccess: () => void;
}

export function AdminPanel({ pubKey, signTransaction, contractId, onSuccess }: Props) {
  const [creating, setCreating] = useState(false);
  const [funding, setFunding] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    token: "",
    deposit_token: "",
    price: "",
    cap: "",
    soft_cap: "",
    start: "",
    end: "",
    cliff: "",
    vesting_duration: "",
  });
  const [fundAmount, setFundAmount] = useState("");

  const client = createClient(contractId, pubKey, signTransaction);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const now = Math.floor(Date.now() / 1000);
      await initialize(client, {
        admin: pubKey,
        token: form.token,
        deposit_token: form.deposit_token,
        price: BigInt(form.price),
        cap: BigInt(form.cap),
        soft_cap: BigInt(form.soft_cap),
        start: BigInt(form.start || String(now + 60)),
        end: BigInt(form.end || String(now + 3600)),
        cliff: BigInt(form.cliff || "0"),
        vesting_duration: BigInt(form.vesting_duration || "0"),
      });
      setSuccess("Launchpad created");
      onSuccess();
    } catch (e: any) {
      setError(e.message || String(e));
    }
    setCreating(false);
  };

  const handleFund = async () => {
    setFunding(true);
    setError(null);
    setSuccess(null);
    try {
      const amount = fromHumanReadable(fundAmount || "0");
      await fund(client, amount);
      setSuccess("Launchpad funded");
      onSuccess();
    } catch (e: any) {
      setError(e.message || String(e));
    }
    setFunding(false);
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    setError(null);
    setSuccess(null);
    try {
      await withdrawDeposits(client);
      setSuccess("Deposits withdrawn");
      onSuccess();
    } catch (e: any) {
      setError(e.message || String(e));
    }
    setWithdrawing(false);
  };

  const handleCancel = async () => {
    setCancelling(true);
    setError(null);
    setSuccess(null);
    try {
      await cancel(client);
      setSuccess("Sale cancelled");
      onSuccess();
    } catch (e: any) {
      setError(e.message || String(e));
    }
    setCancelling(false);
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Admin Panel</h2>

      {error && (
        <div className="bg-red-900/50 border border-red-700 p-3 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-900/50 border border-emerald-700 p-3 rounded-lg text-emerald-300 text-sm">
          {success}
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-5 space-y-4">
        <h3 className="text-white font-medium">Create Launchpad</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="Token address"
            value={form.token}
            onChange={set("token")}
            className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm col-span-2"
          />
          <input
            placeholder="Deposit token address"
            value={form.deposit_token}
            onChange={set("deposit_token")}
            className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm col-span-2"
          />
          <input
            placeholder="Price (units per deposit)"
            value={form.price}
            onChange={set("price")}
            type="number"
            className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
          />
          <input
            placeholder="Cap"
            value={form.cap}
            onChange={set("cap")}
            type="number"
            className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
          />
          <input
            placeholder="Soft cap"
            value={form.soft_cap}
            onChange={set("soft_cap")}
            type="number"
            className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
          />
          <input
            placeholder="Start (unix ts)"
            value={form.start}
            onChange={set("start")}
            type="number"
            className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
          />
          <input
            placeholder="End (unix ts)"
            value={form.end}
            onChange={set("end")}
            type="number"
            className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
          />
          <input
            placeholder="Cliff (seconds)"
            value={form.cliff}
            onChange={set("cliff")}
            type="number"
            className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
          />
          <input
            placeholder="Vesting duration (seconds)"
            value={form.vesting_duration}
            onChange={set("vesting_duration")}
            type="number"
            className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {creating ? "Creating..." : "Create Launchpad"}
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl p-5 space-y-3">
        <h3 className="text-white font-medium">Fund Launchpad</h3>
        <input
          placeholder="Amount (human readable)"
          value={fundAmount}
          onChange={(e) => setFundAmount(e.target.value)}
          className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm w-full"
        />
        <button
          onClick={handleFund}
          disabled={funding}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
        >
          {funding ? "Funding..." : "Fund Tokens"}
        </button>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleWithdraw}
          disabled={withdrawing}
          className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
        >
          {withdrawing ? "..." : "Withdraw Deposits"}
        </button>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
        >
          {cancelling ? "..." : "Cancel Sale"}
        </button>
      </div>
    </div>
  );
}
