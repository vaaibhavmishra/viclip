import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const switches = vi.hoisted(() => new Map<string, string>());

vi.mock("electron", () => ({
  app: {
    commandLine: {
      hasSwitch: (name: string) => switches.has(name),
      appendSwitch: (name: string, value: string) => switches.set(name, value),
    },
  },
}));

import { configurePasswordStore } from "./passwordStore";

beforeEach(() => {
  switches.clear();
  vi.stubGlobal("process", { ...process, platform: "linux" });
  for (const name of [
    "XDG_CURRENT_DESKTOP",
    "XDG_SESSION_DESKTOP",
    "DESKTOP_SESSION",
    "KDE_SESSION_VERSION",
  ]) {
    vi.stubEnv(name, undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Linux password storage at startup", () => {
  it.each([undefined, "GNOME", "ubuntu:GNOME", "sway"])(
    "selects GNOME Secret Service when the desktop is %s",
    (desktop) => {
      vi.stubEnv("XDG_CURRENT_DESKTOP", desktop);

      configurePasswordStore();

      expect(switches.get("password-store")).toBe("gnome-libsecret");
    },
  );

  it.each(["gnome-libsecret", "kwallet6", "basic", ""])(
    "preserves an explicit password-store=%s override",
    (backend) => {
      switches.set("password-store", backend);

      configurePasswordStore();

      expect(switches.get("password-store")).toBe(backend);
    },
  );

  it.each([
    ["XDG_CURRENT_DESKTOP", "KDE"],
    ["XDG_CURRENT_DESKTOP", "GNOME:KDE"],
    ["XDG_SESSION_DESKTOP", "KDE"],
    ["DESKTOP_SESSION", "plasma"],
    ["DESKTOP_SESSION", "plasmawayland"],
    ["DESKTOP_SESSION", "plasmax11"],
    ["KDE_SESSION_VERSION", "6"],
  ])("keeps KWallet auto-selection for %s=%s", (name, value) => {
    vi.stubEnv(name, value);

    configurePasswordStore();

    expect(switches.has("password-store")).toBe(false);
  });

  it.each(["darwin", "win32"])(
    "keeps native storage selection on %s",
    (platform) => {
      vi.stubGlobal("process", { ...process, platform });

      configurePasswordStore();

      expect(switches.has("password-store")).toBe(false);
    },
  );
});
