import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WalletBar } from "../components/WalletBar";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("WalletBar", () => {
  it("shows connect button when disconnected", () => {
    render(<WalletBar connected={false} pubKey={null} onConnect={vi.fn()} />);
    expect(screen.getByText("Connect Freighter")).toBeInTheDocument();
  });

  it("calls onConnect when connect button clicked", () => {
    const onConnect = vi.fn();
    render(<WalletBar connected={false} pubKey={null} onConnect={onConnect} />);
    fireEvent.click(screen.getByText("Connect Freighter"));
    expect(onConnect).toHaveBeenCalled();
  });

  it("shows truncated pubkey when connected", () => {
    render(<WalletBar connected={true} pubKey="GABCDEF1234567890XYZ" onConnect={vi.fn()} />);
    expect(screen.getByText("GABCDE...0XYZ")).toBeInTheDocument();
  });

  it("shows disconnect button when connected and onDisconnect provided", () => {
    const onDisconnect = vi.fn();
    render(
      <WalletBar
        connected={true}
        pubKey="GABCDEF1234567890XYZ"
        onConnect={vi.fn()}
        onDisconnect={onDisconnect}
      />,
    );
    fireEvent.click(screen.getByText("Disconnect"));
    expect(onDisconnect).toHaveBeenCalled();
  });

  it("hides disconnect button when onDisconnect not provided", () => {
    render(<WalletBar connected={true} pubKey="GABCDEF1234567890XYZ" onConnect={vi.fn()} />);
    expect(screen.queryByText("Disconnect")).not.toBeInTheDocument();
  });

  it("copies address to clipboard on click", async () => {
    render(<WalletBar connected={true} pubKey="GABCDEF1234567890XYZ" onConnect={vi.fn()} />);
    fireEvent.click(screen.getByText("GABCDE...0XYZ"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("GABCDEF1234567890XYZ");
  });
});
