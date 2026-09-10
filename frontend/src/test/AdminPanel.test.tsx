import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminPanel } from "../components/AdminPanel";

vi.mock("../lib/stellar", () => ({
  createClient: vi.fn(() => ({})),
  initialize: vi.fn(),
  fund: vi.fn(),
  withdrawDeposits: vi.fn(),
  cancel: vi.fn(),
  fromHumanReadable: vi.fn((s: string) => BigInt(s) * 10_000_000n),
}));

import { initialize, fund, withdrawDeposits, cancel } from "../lib/stellar";

const mockInitialize = vi.mocked(initialize);
const mockFund = vi.mocked(fund);
const mockWithdrawDeposits = vi.mocked(withdrawDeposits);
const mockCancel = vi.mocked(cancel);

const PROPS = {
  pubKey: "GADMIN123",
  signTransaction: vi.fn() as never,
  contractId: "CContract123",
  onSuccess: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminPanel", () => {
  it("renders admin panel heading", () => {
    render(<AdminPanel {...PROPS} />);
    expect(screen.getByText("Admin Panel")).toBeInTheDocument();
  });

  it("renders create launchpad form with all inputs", () => {
    render(<AdminPanel {...PROPS} />);
    expect(screen.getByRole("heading", { name: "Create Launchpad" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Token address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Deposit token address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Price (units per deposit)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cap")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Soft cap")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Start (unix ts)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("End (unix ts)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cliff (seconds)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Vesting duration (seconds)")).toBeInTheDocument();
  });

  it("renders fund section", () => {
    render(<AdminPanel {...PROPS} />);
    expect(screen.getByText("Fund Launchpad")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Amount (human readable)")).toBeInTheDocument();
    expect(screen.getByText("Fund Tokens")).toBeInTheDocument();
  });

  it("renders withdraw and cancel buttons", () => {
    render(<AdminPanel {...PROPS} />);
    expect(screen.getByText("Withdraw Deposits")).toBeInTheDocument();
    expect(screen.getByText("Cancel Sale")).toBeInTheDocument();
  });

  it("handleCreate calls initialize and shows success", async () => {
    mockInitialize.mockResolvedValue(undefined as never);

    render(<AdminPanel {...PROPS} />);

    fireEvent.change(screen.getByPlaceholderText("Token address"), {
      target: { value: "G_TOKEN" },
    });
    fireEvent.change(screen.getByPlaceholderText("Deposit token address"), {
      target: { value: "G_DEPOSIT" },
    });
    fireEvent.change(screen.getByPlaceholderText("Price (units per deposit)"), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByPlaceholderText("Cap"), {
      target: { value: "1000000" },
    });
    fireEvent.change(screen.getByPlaceholderText("Soft cap"), {
      target: { value: "500000" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Launchpad" }));

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalled();
    });
    expect(screen.getByText("Launchpad created")).toBeInTheDocument();
    expect(PROPS.onSuccess).toHaveBeenCalled();
  });

  it("handleCreate shows error on failure", async () => {
    mockInitialize.mockRejectedValue(new Error("Already initialized"));

    render(<AdminPanel {...PROPS} />);

    fireEvent.change(screen.getByPlaceholderText("Token address"), { target: { value: "T" } });
    fireEvent.change(screen.getByPlaceholderText("Deposit token address"), { target: { value: "D" } });
    fireEvent.change(screen.getByPlaceholderText("Price (units per deposit)"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("Cap"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("Soft cap"), { target: { value: "1" } });

    fireEvent.click(screen.getByRole("button", { name: "Create Launchpad" }));

    await waitFor(() => {
      expect(screen.getByText("Already initialized")).toBeInTheDocument();
    });
  });

  it("handleFund calls fund and shows success", async () => {
    mockFund.mockResolvedValue(undefined as never);

    render(<AdminPanel {...PROPS} />);

    fireEvent.change(screen.getByPlaceholderText("Amount (human readable)"), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByText("Fund Tokens"));

    await waitFor(() => {
      expect(mockFund).toHaveBeenCalled();
    });
    expect(screen.getByText("Launchpad funded")).toBeInTheDocument();
  });

  it("handleWithdraw calls withdrawDeposits and shows success", async () => {
    mockWithdrawDeposits.mockResolvedValue(undefined as never);

    render(<AdminPanel {...PROPS} />);
    fireEvent.click(screen.getByText("Withdraw Deposits"));

    await waitFor(() => {
      expect(mockWithdrawDeposits).toHaveBeenCalled();
    });
    expect(screen.getByText("Deposits withdrawn")).toBeInTheDocument();
  });

  it("handleCancel calls cancel and shows success", async () => {
    mockCancel.mockResolvedValue(undefined as never);

    render(<AdminPanel {...PROPS} />);
    fireEvent.click(screen.getByText("Cancel Sale"));

    await waitFor(() => {
      expect(mockCancel).toHaveBeenCalled();
    });
    expect(screen.getByText("Sale cancelled")).toBeInTheDocument();
  });

  it("handleWithdraw shows error on failure", async () => {
    mockWithdrawDeposits.mockRejectedValue(new Error("Sale not ended"));

    render(<AdminPanel {...PROPS} />);
    fireEvent.click(screen.getByText("Withdraw Deposits"));

    await waitFor(() => {
      expect(screen.getByText("Sale not ended")).toBeInTheDocument();
    });
  });

  it("handleCancel shows error on failure", async () => {
    mockCancel.mockRejectedValue(new Error("Not admin"));

    render(<AdminPanel {...PROPS} />);
    fireEvent.click(screen.getByText("Cancel Sale"));

    await waitFor(() => {
      expect(screen.getByText("Not admin")).toBeInTheDocument();
    });
  });
});
