import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../App";

vi.mock("../hooks/useWallet", () => ({
  useWallet: vi.fn(),
}));

vi.mock("../hooks/useLaunchpad", () => ({
  useLaunchpad: vi.fn(() => ({
    info: null,
    contrib: null,
    claimable: null,
    loading: false,
    error: null,
    doContribute: vi.fn(),
    doClaim: vi.fn(),
    doRefund: vi.fn(),
    refresh: vi.fn(),
  })),
}));

vi.mock("../lib/stellar", () => ({
  createClient: vi.fn(() => ({})),
  getLaunchpadInfo: vi.fn(),
  getContributorInfo: vi.fn(),
  getClaimable: vi.fn(),
  contribute: vi.fn(),
  claim: vi.fn(),
  refund: vi.fn(),
  toHumanReadable: vi.fn((v: bigint) => v.toString()),
  fromHumanReadable: vi.fn(),
}));

import { useWallet } from "../hooks/useWallet";

const mockUseWallet = vi.mocked(useWallet);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("App", () => {
  it("shows connect prompt when disconnected", () => {
    mockUseWallet.mockReturnValue({
      pubKey: null,
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText("Token Launchpad")).toBeInTheDocument();
    expect(screen.getByText("Connect your Freighter wallet to start")).toBeInTheDocument();
    expect(screen.getByText("Connect Freighter")).toBeInTheDocument();
  });

  it("shows main layout when connected", () => {
    mockUseWallet.mockReturnValue({
      pubKey: "GADMIN123",
      connected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText("Token Launchpad")).toBeInTheDocument();
    expect(screen.getByText("Admin mode")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("G... or C...")).toBeInTheDocument();
  });

  it("shows contract panels when contractId is present", () => {
    vi.stubEnv("VITE_CONTRACT_ID", "CContract123");

    mockUseWallet.mockReturnValue({
      pubKey: "GADMIN123",
      connected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
    });

    render(<App />);
    expect(screen.getByText("No launchpad found at this contract.")).toBeInTheDocument();

    vi.unstubAllEnvs();
  });

  it("shows placeholder when no contractId", () => {
    vi.stubEnv("VITE_CONTRACT_ID", "");

    mockUseWallet.mockReturnValue({
      pubKey: "GADMIN123",
      connected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
    });

    render(<App />);
    expect(
      screen.getByText("Enter a contract ID above to interact with a launchpad."),
    ).toBeInTheDocument();

    vi.unstubAllEnvs();
  });

  it("toggles admin mode checkbox", () => {
    vi.stubEnv("VITE_CONTRACT_ID", "CContract123");

    mockUseWallet.mockReturnValue({
      pubKey: "GADMIN123",
      connected: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
    });

    render(<App />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    vi.unstubAllEnvs();
  });

  it("calls connect when connect button clicked in disconnected state", () => {
    const connect = vi.fn();
    mockUseWallet.mockReturnValue({
      pubKey: null,
      connected: false,
      connect,
      disconnect: vi.fn(),
      signTransaction: vi.fn(),
    });

    render(<App />);
    fireEvent.click(screen.getByText("Connect Freighter"));
    expect(connect).toHaveBeenCalled();
  });
});
