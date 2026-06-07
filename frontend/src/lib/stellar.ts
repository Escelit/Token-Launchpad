import type { LaunchpadInfo, ClaimableAmount, ContributorInfo } from "contract";
import type { ClientOptions } from "@stellar/stellar-sdk/contract";
import { Client } from "contract";

const RPC_URL = import.meta.env.VITE_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";

export function createClient(contractId: string, pubKey: string, signTransaction?: ClientOptions["signTransaction"]) {
  return new Client({
    contractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey: pubKey,
    signTransaction,
  });
}

export async function getLaunchpadInfo(client: Client): Promise<LaunchpadInfo> {
  const tx = await client.get_launchpad_info();
  return tx.result;
}

export async function getContributorInfo(client: Client, address: string): Promise<ContributorInfo> {
  const tx = await client.get_contributor_info({ address });
  return tx.result;
}

export async function getClaimable(client: Client, address: string): Promise<ClaimableAmount> {
  const tx = await client.get_claimable({ address });
  return tx.result;
}

export async function contribute(client: Client, amount: bigint) {
  const tx = await client.contribute({ caller: client.options.publicKey!, amount });
  return tx.signAndSend();
}

export async function claim(client: Client) {
  const tx = await client.claim({ caller: client.options.publicKey! });
  return tx.signAndSend();
}

export async function refund(client: Client) {
  const tx = await client.refund({ caller: client.options.publicKey! });
  return tx.signAndSend();
}

export async function initialize(client: Client, params: {
  admin: string;
  token: string;
  deposit_token: string;
  price: bigint;
  cap: bigint;
  soft_cap: bigint;
  start: bigint;
  end: bigint;
  cliff: bigint;
  vesting_duration: bigint;
}) {
  const tx = await client.initialize(params);
  return tx.signAndSend();
}

export async function fund(client: Client, amount: bigint) {
  const tx = await client.fund({ admin: client.options.publicKey!, amount });
  return tx.signAndSend();
}

export async function withdrawDeposits(client: Client) {
  const tx = await client.withdraw_deposits({ admin: client.options.publicKey! });
  return tx.signAndSend();
}

export async function cancel(client: Client) {
  const tx = await client.cancel({ admin: client.options.publicKey! });
  return tx.signAndSend();
}

export function toHumanReadable(amount: bigint, decimals: number = 7): string {
  const divisor = 10n ** BigInt(decimals);
  const integer = amount / divisor;
  const fraction = amount % divisor;
  return `${integer}.${fraction.toString().padStart(decimals, "0")}`;
}

export function fromHumanReadable(amount: string, decimals: number = 7): bigint {
  const parts = amount.split(".");
  const integer = parts[0] || "0";
  const fraction = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
  return BigInt(integer) * 10n ** BigInt(decimals) + BigInt(fraction);
}
