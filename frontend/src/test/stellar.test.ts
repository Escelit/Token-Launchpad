import { describe, it, expect } from "vitest";
import { toHumanReadable, fromHumanReadable } from "../lib/stellar";

describe("toHumanReadable", () => {
  it("converts 1 token (7 decimals)", () => {
    expect(toHumanReadable(10_000_000n)).toBe("1.0000000");
  });

  it("converts 0", () => {
    expect(toHumanReadable(0n)).toBe("0.0000000");
  });

  it("converts large amount", () => {
    expect(toHumanReadable(1_000_000_000n)).toBe("100.0000000");
  });

  it("converts fractional amount", () => {
    expect(toHumanReadable(1n)).toBe("0.0000001");
  });

  it("respects custom decimals", () => {
    expect(toHumanReadable(1234n, 2)).toBe("12.34");
  });
});

describe("fromHumanReadable", () => {
  it("parses whole number", () => {
    expect(fromHumanReadable("1")).toBe(10_000_000n);
  });

  it("parses decimal", () => {
    expect(fromHumanReadable("1.5")).toBe(15_000_000n);
  });

  it("parses zero", () => {
    expect(fromHumanReadable("0")).toBe(0n);
  });

  it("parses without leading integer", () => {
    expect(fromHumanReadable(".5")).toBe(5_000_000n);
  });

  it("truncates excess precision", () => {
    expect(fromHumanReadable("1.123456789", 7)).toBe(11_234_567n);
  });

  it("respects custom decimals", () => {
    expect(fromHumanReadable("12.34", 2)).toBe(1234n);
  });
});

describe("roundtrip", () => {
  it("toHumanReadable ∘ fromHumanReadable recovers value", () => {
    const cases = ["0", "0.0000001", "1", "100.5", "99999999.9999999"];
    for (const s of cases) {
      const recovered = toHumanReadable(fromHumanReadable(s));
      expect(fromHumanReadable(recovered)).toBe(fromHumanReadable(s));
    }
  });
});
