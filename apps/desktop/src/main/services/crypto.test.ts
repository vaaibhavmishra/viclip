import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearActiveDEK,
  getActiveDEK,
  isKeyLoaded,
  setActiveDEK,
  waitForKeyLoaded,
} from "./crypto";

afterEach(() => {
  clearActiveDEK();
  vi.useRealTimers();
});

describe("account encryption key lifecycle", () => {
  it("refuses to expose another account's key", () => {
    setActiveDEK(Buffer.alloc(32, 1), "account-a");
    expect(isKeyLoaded("account-a")).toBe(true);
    expect(isKeyLoaded("account-b")).toBe(false);
    expect(() => getActiveDEK("account-b")).toThrow();
    expect(getActiveDEK("account-a")).toEqual(Buffer.alloc(32, 1));
  });

  it("rejects unbound keys", () => {
    expect(() => setActiveDEK(Buffer.alloc(32), "")).toThrow();
    expect(isKeyLoaded("")).toBe(false);
  });

  it("cancels key waiters on logout and removes their timeout", async () => {
    vi.useFakeTimers();
    const waiting = waitForKeyLoaded(10000, "account-a");
    expect(vi.getTimerCount()).toBe(1);
    clearActiveDEK();
    await expect(waiting).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("only resolves an account's waiter after its key is loaded", async () => {
    vi.useFakeTimers();
    const waiting = waitForKeyLoaded(10000, "account-a");
    setActiveDEK(Buffer.alloc(32, 2), "account-b");
    expect(vi.getTimerCount()).toBe(1);
    setActiveDEK(Buffer.alloc(32, 3), "account-a");
    await expect(waiting).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("expires without a key and does not retain timers", async () => {
    vi.useFakeTimers();
    const waiting = waitForKeyLoaded(100, "account-a");
    await vi.advanceTimersByTimeAsync(100);
    await expect(waiting).resolves.toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
