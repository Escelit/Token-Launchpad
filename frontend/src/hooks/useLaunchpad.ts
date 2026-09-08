import { useState, useEffect, useCallback } from "react";
import {
  createClient,
  getLaunchpadInfo,
  getContributorInfo,
  getClaimable,
  contribute,
  claim,
  refund,
} from "../lib/stellar";
import type { LaunchpadInfo, ContributorInfo, ClaimableAmount } from "contract";
import type { ClientOptions } from "@stellar/stellar-sdk/contract";

interface Props {
  pubKey: string;
  signTransaction: NonNullable<ClientOptions["signTransaction"]>;
  contractId: string;
  refreshSignal?: number;
}

export function useLaunchpad({ pubKey, signTransaction, contractId, refreshSignal = 0 }: Props) {
  const client = createClient(contractId, pubKey, signTransaction);
  const [info, setInfo] = useState<LaunchpadInfo | null>(null);
  const [contrib, setContrib] = useState<ContributorInfo | null>(null);
  const [claimable, setClaimable] = useState<ClaimableAmount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!contractId) return;
    try {
      const [i, c, cl] = await Promise.all([
        getLaunchpadInfo(client).catch(() => null),
        getContributorInfo(client, pubKey).catch(() => null),
        getClaimable(client, pubKey).catch(() => null),
      ]);
      setInfo(i);
      setContrib(c);
      setClaimable(cl);
    } catch {
      // not initialized
    }
  }, [contractId, pubKey]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshSignal]);

  const doContribute = async (amount: bigint) => {
    setLoading(true);
    setError(null);
    try {
      await contribute(client, amount);
      await refresh();
    } catch (e: any) {
      setError(e.message || String(e));
    }
    setLoading(false);
  };

  const doClaim = async () => {
    setLoading(true);
    setError(null);
    try {
      await claim(client);
      await refresh();
    } catch (e: any) {
      setError(e.message || String(e));
    }
    setLoading(false);
  };

  const doRefund = async () => {
    setLoading(true);
    setError(null);
    try {
      await refund(client);
      await refresh();
    } catch (e: any) {
      setError(e.message || String(e));
    }
    setLoading(false);
  };

  return { info, contrib, claimable, loading, error, doContribute, doClaim, doRefund, refresh };
}
