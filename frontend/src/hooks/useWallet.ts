import { useState, useEffect, useCallback } from "react";
import { isConnected, getAddress, signTransaction } from "@stellar/freighter-api";

export function useWallet() {
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const refreshConnection = useCallback(async () => {
    try {
      const res = await isConnected();
      if (res.isConnected) {
        const key = await getAddress();
        if (key.address) {
          setPubKey(key.address);
          setConnected(true);
          return;
        }
      }
      setConnected(false);
      setPubKey(null);
    } catch {
      setConnected(false);
      setPubKey(null);
    }
  }, []);

  useEffect(() => {
    refreshConnection();

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshConnection();
    };
    const onFocus = () => refreshConnection();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshConnection]);

  const connect = useCallback(async () => {
    try {
      const res = await getAddress();
      if (res.error) throw new Error(res.error);
      setPubKey(res.address);
      setConnected(true);
    } catch (e) {
      console.error("Failed to connect Freighter:", e);
    }
  }, []);

  const disconnect = useCallback(() => {
    setPubKey(null);
    setConnected(false);
  }, []);

  return { pubKey, connected, connect, disconnect, signTransaction };
}
