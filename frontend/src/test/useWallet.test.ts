import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useWallet } from "../hooks/useWallet";

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  signTransaction: vi.fn(),
}));

import { isConnected, getAddress } from "@stellar/freighter-api";

const mockIsConnected = vi.mocked(isConnected);
const mockGetAddress = vi.mocked(getAddress);

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConnected.mockResolvedValue({ isConnected: false });
  mockGetAddress.mockResolvedValue({ address: "", error: "" });
});

describe("useWallet", () => {
  it("starts disconnected", () => {
    const { result } = renderHook(() => useWallet());
    expect(result.current.connected).toBe(false);
    expect(result.current.pubKey).toBeNull();
  });

  it("detects existing connection on mount", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockGetAddress.mockResolvedValue({ address: "GABC...1234", error: "" });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });
    expect(result.current.pubKey).toBe("GABC...1234");
  });

  it("stays disconnected when isConnected returns false", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: false });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => {
      expect(mockIsConnected).toHaveBeenCalled();
    });
    expect(result.current.connected).toBe(false);
  });

  it("connects via getAddress", async () => {
    mockGetAddress.mockResolvedValue({ address: "GDEF...5678", error: "" });

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.pubKey).toBe("GDEF...5678");
  });

  it("does not connect when getAddress returns error", async () => {
    mockGetAddress.mockResolvedValue({ address: "", error: "User rejected" });

    const { result } = renderHook(() => useWallet());

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.connected).toBe(false);
  });

  it("disconnects clears state", async () => {
    mockIsConnected.mockResolvedValue({ isConnected: true });
    mockGetAddress.mockResolvedValue({ address: "GABC...1234", error: "" });

    const { result } = renderHook(() => useWallet());

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.pubKey).toBeNull();
  });

  it("handles mount error gracefully", async () => {
    mockIsConnected.mockRejectedValue(new Error("Freighter not found"));

    const { result } = renderHook(() => useWallet());

    await waitFor(() => {
      expect(mockIsConnected).toHaveBeenCalled();
    });
    expect(result.current.connected).toBe(false);
  });

  it("exposes signTransaction from freighter", () => {
    const { result } = renderHook(() => useWallet());
    expect(typeof result.current.signTransaction).toBe("function");
  });
});
