import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContributePanel } from "../components/ContributePanel";
import type { LaunchpadInfo, ContributorInfo, ClaimableAmount } from "contract";

vi.mock("../hooks/useLaunchpad", () => ({
  useLaunchpad: vi.fn(),
}));

import { useLaunchpad } from "../hooks/useLaunchpad";

const mockUseLaunchpad = vi.mocked(useLaunchpad);

const PROPS = {
  pubKey: "GABC123",
  signTransaction: vi.fn() as never,
  contractId: "CContract123",
  refreshSignal: 0,
};

const MOCK_INFO: LaunchpadInfo = {
  admin: "GADMIN",
  token: "G_TOKEN",
  deposit_token: "G_DEPOSIT",
  price: 10_000_000n,
  cap: 1_000_000_000_000n,
  soft_cap: 500_000_000_000n,
  start: BigInt(Math.floor(Date.now() / 1000) - 100),
  end: BigInt(Math.floor(Date.now() / 1000) + 86400),
  cliff: 0n,
  vesting_duration: 0n,
  total_raised: 100_000_000_000n,
  total_tokens_sold: 1_000_000_000_000n,
  cancelled: false,
};

const MOCK_CONTRIB: ContributorInfo = {
  contributed: 10_000_000_000n,
  tokens_bought: 100_000_000_000n,
  tokens_claimed: 0n,
};

const MOCK_CLAIMABLE: ClaimableAmount = {
  vested: 50_000_000_000n,
  available: 50_000_000_000n,
};

function stubHook(overrides: Partial<ReturnType<typeof useLaunchpad>> = {}) {
  mockUseLaunchpad.mockReturnValue({
    info: MOCK_INFO,
    contrib: MOCK_CONTRIB,
    claimable: MOCK_CLAIMABLE,
    loading: false,
    error: null,
    doContribute: vi.fn(),
    doClaim: vi.fn(),
    doRefund: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ContributePanel", () => {
  it("shows 'No launchpad found' when info is null", () => {
    stubHook({ info: null });
    render(<ContributePanel {...PROPS} />);
    expect(screen.getByText("No launchpad found at this contract.")).toBeInTheDocument();
  });

  it("renders launchpad stats when info present", () => {
    stubHook();
    render(<ContributePanel {...PROPS} />);
    expect(screen.getByText("Launchpad")).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
    expect(screen.getByText("Raised")).toBeInTheDocument();
    expect(screen.getByText("Soft cap")).toBeInTheDocument();
    expect(screen.getByText("Tokens sold")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    expect(screen.getByText("Vesting")).toBeInTheDocument();
  });

  it("shows contribute input when sale is live", () => {
    stubHook();
    render(<ContributePanel {...PROPS} />);
    expect(screen.getByPlaceholderText("Amount to contribute")).toBeInTheDocument();
    expect(screen.getByText("Contribute", { selector: "button" })).toBeInTheDocument();
  });

  it("hides contribute input when sale is not live", () => {
    stubHook({
      info: {
        ...MOCK_INFO,
        start: BigInt(Math.floor(Date.now() / 1000) + 86400),
        end: BigInt(Math.floor(Date.now() / 1000) + 172800),
      },
    });
    render(<ContributePanel {...PROPS} />);
    expect(screen.queryByPlaceholderText("Amount to contribute")).not.toBeInTheDocument();
  });

  it("shows position section when contributor has contributed", () => {
    stubHook();
    render(<ContributePanel {...PROPS} />);
    expect(screen.getByText("Your Position")).toBeInTheDocument();
    expect(screen.getByText("Contributed")).toBeInTheDocument();
    expect(screen.getByText("Tokens bought")).toBeInTheDocument();
    expect(screen.getByText("Tokens claimed")).toBeInTheDocument();
  });

  it("hides position section when no contribution", () => {
    stubHook({
      contrib: { contributed: 0n, tokens_bought: 0n, tokens_claimed: 0n },
    });
    render(<ContributePanel {...PROPS} />);
    expect(screen.queryByText("Your Position")).not.toBeInTheDocument();
  });

  it("shows claim button when claimable available > 0", () => {
    stubHook();
    render(<ContributePanel {...PROPS} />);
    expect(screen.getByText("Claim", { selector: "button" })).toBeInTheDocument();
  });

  it("hides claim button when nothing claimable", () => {
    stubHook({ claimable: { vested: 100n, available: 0n } });
    render(<ContributePanel {...PROPS} />);
    expect(screen.queryByText("Claim", { selector: "button" })).not.toBeInTheDocument();
  });

  it("shows refund button when sale cancelled", () => {
    stubHook({
      info: { ...MOCK_INFO, cancelled: true },
    });
    render(<ContributePanel {...PROPS} />);
    expect(screen.getByText("Refund")).toBeInTheDocument();
  });

  it("shows error banner when error present", () => {
    stubHook({ error: "Transaction failed" });
    render(<ContributePanel {...PROPS} />);
    expect(screen.getByText("Transaction failed")).toBeInTheDocument();
  });

  it("shows refresh button", () => {
    stubHook();
    render(<ContributePanel {...PROPS} />);
    expect(screen.getByText(/Refresh/)).toBeInTheDocument();
  });
});
