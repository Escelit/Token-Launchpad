import { useState, useEffect, useCallback } from "react";
import { isConnected, getAddress, signTransaction } from "@stellar/freighter-api";

export function useWallet() {
  const [pubKey, setPubKey] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    isConnected().then((res: any) => {
      if (res.isConnected) {
        getAddress().then((k: any) => {
          setPubKey(k.address);
          setConnected(true);
        });
      }
    });
  }, []);

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

  return { pubKey, connected, connect, signTransaction };
}
