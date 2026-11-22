import type { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const privateTitle = "synthetic-private-title";
const privateBody = "synthetic-private-clipboard-body";
const privateError = "synthetic-private-native-error";

const mocks = vi.hoisted(() => ({
  enabled: true,
  supported: true,
  failure: null as "support" | "constructor" | "show" | null,
  failDuringShow: false,
  notifications: [] as EventEmitter[],
  shown: [] as Array<{ title: string; body: string }>,
  warn: vi.fn(),
}));

vi.mock("electron/main", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    Notification: class extends EventEmitter {
      static isSupported(): boolean {
        if (mocks.failure === "support") throw new Error(privateError);
        return mocks.supported;
      }

      constructor(public options: { title: string; body: string }) {
        super();
        if (mocks.failure === "constructor") throw new Error(privateError);
        mocks.notifications.push(this);
      }

      show(): void {
        if (mocks.failure === "show") throw new Error(privateError);
        mocks.shown.push(this.options);
        if (mocks.failDuringShow) this.emit("failed", {}, privateError);
      }
    },
  };
});
vi.mock("electron-log/main", () => ({ default: { warn: mocks.warn } }));
vi.mock("../globalStates", () => ({
  getNotificationsEnabled: () => mocks.enabled,
}));

import { showNotification } from "./notification";

beforeEach(() => {
  mocks.enabled = true;
  mocks.supported = true;
  mocks.failure = null;
  mocks.failDuringShow = false;
  mocks.notifications.length = 0;
  mocks.shown.length = 0;
});

function expectPrivateFailureDiagnostic(): void {
  expect(mocks.warn).toHaveBeenCalledOnce();
  expect(mocks.warn.mock.calls[0]).toHaveLength(1);
  const diagnostic = mocks.warn.mock.calls[0][0];
  expect(diagnostic).toEqual(expect.any(String));
  expect(diagnostic).toMatch(/notification.*failed|failed.*notification/i);
  expect(diagnostic).toMatch(
    /check.*permission|check.*settings|check.*service/i,
  );
  const logged = JSON.stringify(mocks.warn.mock.calls);
  for (const privateValue of [privateTitle, privateBody, privateError]) {
    expect(logged).not.toContain(privateValue);
  }
}

describe("system notification failures", () => {
  it("reports asynchronous native failures without crashing or logging private data", async () => {
    expect(() => showNotification(privateTitle, privateBody)).not.toThrow();
    expect(mocks.shown).toEqual([{ title: privateTitle, body: privateBody }]);
    await Promise.resolve();

    expect(() =>
      mocks.notifications[0].emit("failed", {}, privateError),
    ).not.toThrow();

    expectPrivateFailureDiagnostic();
  });

  it("captures native failures emitted as showing starts", () => {
    mocks.failDuringShow = true;

    expect(() => showNotification(privateTitle, privateBody)).not.toThrow();

    expectPrivateFailureDiagnostic();
  });

  it.each(["support", "constructor", "show"] as const)(
    "keeps a synchronous %s failure nonfatal and private",
    (failure) => {
      mocks.failure = failure;

      expect(() => showNotification(privateTitle, privateBody)).not.toThrow();

      expectPrivateFailureDiagnostic();
    },
  );
});

describe("system notification gating", () => {
  it.each([
    [false, true],
    [true, false],
  ])(
    "skips notifications with enabled=%s and supported=%s",
    (enabled, supported) => {
      mocks.enabled = enabled;
      mocks.supported = supported;

      showNotification(privateTitle, privateBody);

      expect(mocks.notifications).toHaveLength(0);
      expect(mocks.shown).toHaveLength(0);
      expect(mocks.warn).not.toHaveBeenCalled();
    },
  );
});
