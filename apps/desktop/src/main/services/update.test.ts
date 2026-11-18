import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  dialog: vi.fn(),
  open: vi.fn(),
  copy: vi.fn(),
  check: vi.fn(),
  realpath: vi.fn(),
  readFile: vi.fn(),
  exists: vi.fn(),
  app: { getVersion: () => "2.0.0", isPackaged: true },
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    transports: { file: { level: "info" } },
  },
}));
vi.mock("electron", () => ({
  app: mocks.app,
  dialog: { showMessageBox: mocks.dialog },
}));
vi.mock("node:fs", () => ({
  default: {
    realpathSync: mocks.realpath,
    readFileSync: mocks.readFile,
    existsSync: mocks.exists,
  },
}));
vi.mock("electron-log/main", () => ({ default: mocks.log }));
vi.mock("electron-updater", () => ({
  autoUpdater: { logger: mocks.log, on: vi.fn(), checkForUpdates: mocks.check },
}));
vi.mock("../modules/notification", () => ({ showNotification: vi.fn() }));
vi.mock("../utils/utils", () => ({ openSafeExternal: mocks.open }));
vi.mock("./clipboard", () => ({ writeToClipboard: mocks.copy }));
let updates: typeof import("./update");
const release = {
  tag_name: "v2.1.0",
  html_url: "https://github.com/vaaibhavmishra/viclip/releases/tag/v2.1.0",
  assets: [
    {
      name: "ViClip-2.1.0-mac-arm64.dmg",
      browser_download_url:
        "https://github.com/vaaibhavmishra/viclip/releases/download/v2.1.0/ViClip-2.1.0-mac-arm64.dmg",
    },
  ],
};
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.app.isPackaged = true;
  mocks.realpath
    .mockReset()
    .mockReturnValue("/Applications/ViClip.app/Contents/MacOS/ViClip");
  mocks.readFile.mockReset().mockImplementation(() => {
    throw new Error("No installation receipt");
  });
  mocks.exists.mockReset().mockReturnValue(false);
  mocks.check
    .mockReset()
    .mockResolvedValue({ updateInfo: { version: "2.0.0" } });
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.dialog.mockResolvedValue({ response: 2 });
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify(release)));
  updates = await import("./update");
});

describe("Homebrew installation and commands", () => {
  const receipt = {
    source: { tap: "vaaibhavmishra/viclip", version: "2.0.0" },
  };
  const managedBundle = "/Applications/ViClip.app";

  function mockHomebrewInstall(prefix = "/opt/homebrew"): void {
    mocks.exists.mockReturnValue(true);
    mocks.readFile.mockImplementation((filename: string) => {
      if (
        filename === `${prefix}/Caskroom/viclip/.metadata/INSTALL_RECEIPT.json`
      )
        return JSON.stringify(receipt);
      throw new Error("No installation receipt");
    });
    mocks.realpath.mockImplementation((filename: string) => {
      if (filename === process.execPath)
        return `${managedBundle}/Contents/MacOS/ViClip`;
      if (filename === `${prefix}/Caskroom/viclip/2.0.0/ViClip.app`)
        return managedBundle;
      throw new Error("No managed app bundle");
    });
  }

  it.each(["/opt/homebrew", "/usr/local"])(
    "recognizes an app moved from %s Caskroom to /Applications",
    (prefix) => {
      vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
      mockHomebrewInstall(prefix);
      expect(updates.isInstalledViaHomebrew()).toBe(true);
    },
  );

  it("does not treat a different running copy as Homebrew-managed", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    mockHomebrewInstall();
    mocks.realpath.mockImplementation((filename: string) =>
      filename === process.execPath
        ? "/Users/example/Downloads/ViClip.app/Contents/MacOS/ViClip"
        : managedBundle,
    );
    expect(updates.isInstalledViaHomebrew()).toBe(false);
  });

  it("ignores missing, malformed, foreign, or unsafe installation receipts", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    expect(updates.isInstalledViaHomebrew()).toBe(false);
    for (const value of [
      "not json",
      JSON.stringify({ source: { tap: "another/tap", version: "2.0.0" } }),
      JSON.stringify({
        source: { tap: "vaaibhavmishra/viclip", version: "../../outside" },
      }),
    ]) {
      mocks.readFile.mockReturnValue(value);
      expect(updates.isInstalledViaHomebrew()).toBe(false);
    }
  });

  it("copies a qualified update and cask upgrade command for a managed app", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    mockHomebrewInstall();
    mocks.dialog.mockResolvedValue({ response: 0 });
    await updates.checkUpdate({ isManual: true });
    expect(mocks.copy).toHaveBeenCalledWith(
      "brew update && brew upgrade --cask vaaibhavmishra/viclip/viclip",
    );
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it("offers a tap and install command when only Homebrew is installed", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    mocks.exists.mockReturnValue(true);
    mocks.dialog.mockResolvedValue({ response: 1 });
    await updates.checkUpdate({ isManual: true });
    expect(mocks.dialog.mock.calls[0]?.[0].buttons).toContain(
      "Copy Homebrew Install Command",
    );
    expect(mocks.copy).toHaveBeenCalledWith(
      "brew tap vaaibhavmishra/viclip https://github.com/vaaibhavmishra/viclip.git && brew install --cask vaaibhavmishra/viclip/viclip",
    );
  });

  it("offers the matching DMG when Homebrew is unavailable", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    vi.spyOn(process, "arch", "get").mockReturnValue("arm64");
    mocks.dialog.mockResolvedValue({ response: 0 });
    await updates.checkUpdate();
    expect(mocks.open).toHaveBeenCalledWith(
      release.assets[0].browser_download_url,
    );
    expect(mocks.copy).not.toHaveBeenCalled();
  });
});
afterEach(() => {
  updates.stopUpdateChecks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("trusted update metadata", () => {
  it("rejects foreign release and download destinations", () => {
    expect(() =>
      updates.parseRelease({
        ...release,
        html_url: "https://evil.invalid/release",
      }),
    ).toThrow("Untrusted");
    expect(() =>
      updates.parseRelease({
        ...release,
        assets: [
          {
            ...release.assets[0],
            browser_download_url: "https://github.com/another/project/download",
          },
        ],
      }),
    ).toThrow("Untrusted");
    expect(() =>
      updates.parseRelease({
        ...release,
        assets: Array.from({ length: 101 }, () => release.assets[0]),
      }),
    ).toThrow();
    expect(() =>
      updates.parseRelease({ ...release, prerelease: true }),
    ).toThrow();
  });
  it("applies semver precedence and rejects malformed versions", () => {
    expect(updates.isNewerVersion("v2.0.1", "2.0.0")).toBe(true);
    expect(updates.isNewerVersion("2.0.0", "2.0.0-rc.1")).toBe(true);
    expect(updates.isNewerVersion("2.0.0-beta.10", "2.0.0-beta.2")).toBe(true);
    expect(updates.isNewerVersion("2.0.0-beta", "2.0.0")).toBe(false);
    expect(updates.isNewerVersion("2.0.0+build", "2.0.0")).toBe(false);
    expect(updates.isNewerVersion("2.0.0-01", "2.0.0")).toBe(false);
    expect(updates.isNewerVersion("2.0.0.1", "2.0.0")).toBe(false);
  });
});
describe("update lifecycle", () => {
  it("checks at startup and every six hours, and clears the schedule on quit", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    vi.useFakeTimers();
    updates.startUpdateChecks();
    updates.startUpdateChecks();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(updates.UPDATE_CHECK_INTERVAL_MS);
    expect(mocks.check).toHaveBeenCalledTimes(2);
    updates.stopUpdateChecks();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(updates.UPDATE_CHECK_INTERVAL_MS);
    expect(mocks.check).toHaveBeenCalledTimes(2);
  });

  it("does not schedule checks in development or after shutdown", () => {
    vi.useFakeTimers();
    mocks.app.isPackaged = false;
    updates.startUpdateChecks();
    expect(vi.getTimerCount()).toBe(0);
    mocks.app.isPackaged = true;
    updates.stopUpdateChecks();
    updates.startUpdateChecks();
    expect(vi.getTimerCount()).toBe(0);
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it("prompts once per version automatically and allows manual rechecks", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    mocks.fetch.mockImplementation(
      async () => new Response(JSON.stringify(release)),
    );
    await updates.checkUpdate();
    await updates.checkUpdate();
    expect(mocks.dialog).toHaveBeenCalledTimes(1);
    await updates.checkUpdate({ isManual: true });
    expect(mocks.dialog).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent checks", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    await Promise.all([
      updates.checkUpdate(),
      updates.checkUpdate({ isManual: true }),
    ]);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.dialog).toHaveBeenCalledTimes(1);
  });
  it("enforces a metadata byte limit while streaming", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    mocks.fetch.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(1000001));
          },
        }),
      ),
    );
    await expect(updates.checkUpdate()).rejects.toThrow("too large");
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it("keeps the timeout active while reading a stalled body", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    vi.useFakeTimers();
    const cancel = vi.fn();
    mocks.fetch.mockResolvedValueOnce(
      new Response(new ReadableStream({ cancel })),
    );
    const pending = updates.checkUpdate();
    const rejected = expect(pending).rejects.toThrow("cancelled");
    await vi.advanceTimersByTimeAsync(15001);
    await rejected;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels a body read at shutdown and produces no prompt", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    const cancel = vi.fn();
    mocks.fetch.mockResolvedValueOnce(
      new Response(new ReadableStream({ cancel })),
    );
    const pending = updates.checkUpdate({ isManual: true });
    const rejected = expect(pending).rejects.toThrow("cancelled");
    await Promise.resolve();
    await Promise.resolve();
    updates.stopUpdateChecks();
    await rejected;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(mocks.dialog).not.toHaveBeenCalled();
  });
  it("handles failed background downloads and cancels pending downloads", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    let reject!: (error: Error) => void;
    const cancellationToken = { cancel: vi.fn() };
    mocks.check.mockResolvedValueOnce({
      updateInfo: { version: "2.1.0" },
      cancellationToken,
      downloadPromise: new Promise((_, fail) => {
        reject = fail;
      }),
    });
    await updates.checkUpdate();
    updates.stopUpdateChecks();
    expect(cancellationToken.cancel).toHaveBeenCalledTimes(1);
    reject(new Error("download failed"));
    await Promise.resolve();
    await Promise.resolve();
  });
  it("does not report malformed Windows update metadata as up to date", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    mocks.check.mockResolvedValueOnce({ updateInfo: { version: "invalid" } });
    await expect(updates.checkUpdate({ isManual: true })).rejects.toThrow(
      "Invalid update version",
    );
    expect(mocks.dialog.mock.calls[0]?.[0].title).toBe("Update Check Failed");
  });
});
