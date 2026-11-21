import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  relaunch: vi.fn(),
  exit: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    relaunch: mocks.relaunch,
    exit: mocks.exit,
  },
}));

import { getLinuxDisplayArgs } from "../../shared/linuxDisplay";
import { restartInX11IfNeeded } from "./linuxDisplay";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("process", {
    ...process,
    platform: "linux",
    argv: ["/usr/bin/viclip", "--hidden", "viclip://open"],
    defaultApp: false,
  });
  vi.stubEnv("XDG_SESSION_TYPE", "wayland");
  vi.stubEnv("WAYLAND_DISPLAY", "wayland-0");
  vi.stubEnv("DISPLAY", ":0");
  vi.stubEnv("APPIMAGE", undefined);
  vi.stubEnv("NODE_ENV_ELECTRON_VITE", "development");
  vi.stubEnv("ELECTRON_RENDERER_URL", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Linux clipboard window display backend", () => {
  it("restarts a Wayland launch in XWayland before startup", () => {
    expect(restartInX11IfNeeded()).toBe(true);

    expect(mocks.relaunch).toHaveBeenCalledWith({
      args: ["--ozone-platform=x11", "--hidden", "viclip://open"],
    });
    expect(mocks.exit).toHaveBeenCalledWith(0);
    expect(mocks.relaunch.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.exit.mock.invocationCallOrder[0],
    );
  });

  it("relaunches the original AppImage rather than its temporary mount", () => {
    vi.stubEnv("APPIMAGE", "/home/test/ViClip.AppImage");

    expect(restartInX11IfNeeded()).toBe(true);

    expect(mocks.relaunch).toHaveBeenCalledWith({
      execPath: "/home/test/ViClip.AppImage",
      args: ["--ozone-platform=x11", "--hidden", "viclip://open"],
    });
  });

  it("prepares development arguments before Electron chooses a backend", () => {
    expect(getLinuxDisplayArgs(["--hidden"], "linux", process.env)).toEqual([
      "--ozone-platform=x11",
      "--hidden",
    ]);
  });

  it("does not restart the development process whose parent owns the renderer", () => {
    vi.stubGlobal("process", {
      ...process,
      defaultApp: true,
      argv: ["/usr/bin/electron", "/project/apps/desktop", "--hidden"],
    });
    vi.stubEnv("APPIMAGE", "/home/test/unrelated.AppImage");

    expect(restartInX11IfNeeded()).toBe(false);
    expect(mocks.relaunch).not.toHaveBeenCalled();
    expect(mocks.exit).not.toHaveBeenCalled();
  });

  it("restarts a preview that skipped config loading and has no dev server", () => {
    vi.stubGlobal("process", {
      ...process,
      defaultApp: true,
      argv: ["/usr/bin/electron", "/project/apps/desktop", "--hidden"],
    });
    vi.stubEnv("NODE_ENV_ELECTRON_VITE", undefined);
    vi.stubEnv("APPIMAGE", "/home/test/unrelated.AppImage");

    expect(restartInX11IfNeeded()).toBe(true);
    expect(mocks.relaunch).toHaveBeenCalledWith({
      args: ["--ozone-platform=x11", "/project/apps/desktop", "--hidden"],
    });
    expect(mocks.exit).toHaveBeenCalledWith(0);
  });

  it("keeps a manually launched development renderer connected", () => {
    vi.stubGlobal("process", { ...process, defaultApp: true });
    vi.stubEnv("NODE_ENV_ELECTRON_VITE", undefined);
    vi.stubEnv("ELECTRON_RENDERER_URL", "http://localhost:5173");

    expect(restartInX11IfNeeded()).toBe(false);
    expect(mocks.relaunch).not.toHaveBeenCalled();
    expect(mocks.exit).not.toHaveBeenCalled();
  });

  it("detects Wayland when only WAYLAND_DISPLAY is provided", () => {
    vi.stubEnv("XDG_SESSION_TYPE", undefined);

    expect(restartInX11IfNeeded()).toBe(true);
    expect(mocks.relaunch).toHaveBeenCalledOnce();
  });

  it.each([
    ["--ozone-platform=x11"],
    ["--ozone-platform=wayland"],
    ["--ozone-platform", "wayland"],
  ])(
    "preserves explicit backend arguments %j and prevents a restart loop",
    (...args) => {
      vi.stubGlobal("process", {
        ...process,
        argv: ["/usr/bin/viclip", ...args],
      });

      expect(restartInX11IfNeeded()).toBe(false);
      expect(mocks.relaunch).not.toHaveBeenCalled();
      expect(mocks.exit).not.toHaveBeenCalled();
    },
  );

  it("preserves a development backend override", () => {
    expect(
      getLinuxDisplayArgs(["--ozone-platform=wayland"], "linux", process.env),
    ).toEqual(["--ozone-platform=wayland"]);
  });

  it("keeps native Wayland when XWayland is unavailable", () => {
    vi.stubEnv("DISPLAY", undefined);

    expect(restartInX11IfNeeded()).toBe(false);
    expect(mocks.relaunch).not.toHaveBeenCalled();
    expect(mocks.exit).not.toHaveBeenCalled();
  });

  it("adds the backend switch before an argument terminator", () => {
    expect(
      getLinuxDisplayArgs(["--", "viclip://open"], "linux", process.env),
    ).toEqual(["--ozone-platform=x11", "--", "viclip://open"]);
  });

  it("does not restart an X11 session", () => {
    vi.stubEnv("XDG_SESSION_TYPE", "x11");
    vi.stubEnv("WAYLAND_DISPLAY", undefined);

    expect(restartInX11IfNeeded()).toBe(false);
    expect(mocks.relaunch).not.toHaveBeenCalled();
  });

  it.each(["darwin", "win32"])("keeps %s startup unchanged", (platform) => {
    vi.stubGlobal("process", { ...process, platform });

    expect(restartInX11IfNeeded()).toBe(false);
    expect(mocks.relaunch).not.toHaveBeenCalled();
  });
});
