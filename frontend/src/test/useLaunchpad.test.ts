import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useLaunchpad } from "../hooks/useLaunchpad";

vi.mock("../lib/stellar", () => ({
  createClient: vi.fn(() => ({})),
  getLaunchpadInfo: vi.fn(),
  getContributorInfo: vi.fn(),
  getClaimable: vi.fn(),
  contribute: vi.fn(),
  claim: vi.fn(),
  refund: vi.fn(),
}));

import {
  createClient,
  getLaunchpadInfo,
  getContributorInfo,
  getClaimable,
  contribute,
  claim,
  refund,
} from "../lib/stellar";

const mockCreateClient = vi.mocked(createClient);
const mockGetLaunchpadInfo = vi.mocked(getLaunchpadInfo);
const mockGetContributorInfo = vi.mocked(getContributorInfo);
const mockGetClaimable = vi.mocked(getClaimable);
const mockContribute = vi.mocked(contribute);
const mockClaim = vi.mocked(claim);
const mockRefund = vi.mocked(refund);

const PROPS = {
  pubKey: "GABC123",
  signTransaction: vi.fn() as never,
  contractId: "CContract123",
};

const MOCK_INFO = {
  admin: "GADMIN",
  token: "G_TOKEN",
  deposit_token: "G_DEPOSIT",
  price: 1000n,
  cap: 1_000_000n,
  soft_cap: 500_000n,
  start: 100n,
  end: 200n,
  cliff: 10n,
  vesting_duration: 100n,
  total_raised: 0n,
  total_tokens_sold: 0n,
  cancelled: false,
};

const MOCK_CONTRIB = {
  contributed: 100n,
  tokens_bought: 100_000n,
  tokens_claimed: 0n,
};

const MOCK_CLAIMABLE = {
  vested: 50_000n,
  available: 50_000n,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLaunchpadInfo.mockResolvedValue(MOCK_INFO as never);
  mockGetContributorInfo.mockResolvedValue(MOCK_CONTRIB as never);
  mockGetClaimable.mockResolvedValue(MOCK_CLAIMABLE as never);
});

describe("useLaunchpad", () => {
  it("fetches launchpad data on mount", async () => {
    const { result } = renderHook(() => useLaunchpad(PROPS));

    await waitFor(() => {
      expect(result.current.info).not.toBeNull();
    });

    expect(result.current.info).toEqual(MOCK_INFO);
    expect(result.current.contrib).toEqual(MOCK_CONTRIB);
    expect(result.current.claimable).toEqual(MOCK_CLAIMABLE);
    expect(result.current.error).toBeNull();
  });

  it("sets error when no launchpad found", async () => {
    mockGetLaunchpadInfo.mockRejectedValue(new Error("not found"));

    const { result } = renderHook(() => useLaunchpad(PROPS));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it("does not fetch when contractId is empty", () => {
    renderHook(() => useLaunchpad({ ...PROPS, contractId: "" }));

    expect(mockGetLaunchpadInfo).not.toHaveBeenCalled();
  });

  it("calls createClient with correct args", () => {
    renderHook(() => useLaunchpad(PROPS));

    expect(mockCreateClient).toHaveBeenCalledWith(
      "CContract123",
      "GABC123",
      PROPS.signTransaction,
    );
  });

  it("doContribute calls contribute and refreshes", async () => {
    mockContribute.mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useLaunchpad(PROPS));

    await waitFor(() => {
      expect(result.current.info).not.toBeNull();
    });

    await act(async () => {
      await result.current.doContribute(500n);
    });

    expect(mockContribute).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("doContribute sets error on failure", async () => {
    mockContribute.mockRejectedValue(new Error("Cap reached"));

    const { result } = renderHook(() => useLaunchpad(PROPS));

    await waitFor(() => {
      expect(result.current.info).not.toBeNull();
    });

    await act(async () => {
      await result.current.doContribute(500n);
    });

    expect(result.current.error).toBe("Cap reached");
    expect(result.current.loading).toBe(false);
  });

  it("doClaim calls claim and refreshes", async () => {
    mockClaim.mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useLaunchpad(PROPS));

    await waitFor(() => {
      expect(result.current.info).not.toBeNull();
    });

    await act(async () => {
      await result.current.doClaim();
    });

    expect(mockClaim).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("doRefund calls refund and refreshes", async () => {
    mockRefund.mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useLaunchpad(PROPS));

    await waitFor(() => {
      expect(result.current.info).not.toBeNull();
    });

    await act(async () => {
      await result.current.doRefund();
    });

    expect(mockRefund).toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("refresh re-fetches all data", async () => {
    const { result } = renderHook(() => useLaunchpad(PROPS));

    await waitFor(() => {
      expect(result.current.info).not.toBeNull();
    });

    mockGetLaunchpadInfo.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetLaunchpadInfo).toHaveBeenCalled();
  });

  it("re-fetches when refreshSignal changes", async () => {
    const { result, rerender } = renderHook(
      ({ refreshSignal }) => useLaunchpad({ ...PROPS, refreshSignal }),
      { initialProps: { refreshSignal: 0 } },
    );

    await waitFor(() => {
      expect(result.current.info).not.toBeNull();
    });

    mockGetLaunchpadInfo.mockClear();

    rerender({ refreshSignal: 1 });

    await waitFor(() => {
      expect(mockGetLaunchpadInfo).toHaveBeenCalled();
    });
  });
});
