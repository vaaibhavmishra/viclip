// @vitest-environment jsdom
import type { ClipData } from "@viclip/types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainContent } from "./MainContent";
import { SettingsPanel } from "./SettingsPanel";

const { navigate, mockUser } = vi.hoisted(() => ({
  navigate: vi.fn(),
  mockUser: {
    uid: "user",
    email: "user@example.invalid",
    displayName: "User",
    photoURL: null,
  },
}));
vi.mock("react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@renderer/components/global-context", () => ({
  useGlobalStore: Object.assign(() => ({ user: mockUser }), {
    getState: () => ({ user: mockUser }),
  }),
}));
vi.mock("../components/Sidebar", () => ({
  Sidebar: ({ clips }: { clips: ClipData[] }) => (
    <div data-testid="clips">{clips.map((clip) => clip.content).join(",")}</div>
  ),
}));
vi.mock("../components/ClipDetail", () => ({ ClipDetail: () => <div /> }));
vi.mock("../components/CommandMenu", () => ({ CommandMenu: () => <div /> }));
vi.mock("../components/ui/select", () => ({
  Select: () => <div />,
  SelectContent: () => <div />,
  SelectItem: () => <div />,
  SelectTrigger: () => <div />,
  SelectValue: () => <div />,
}));

const clip: ClipData = {
  id: "clip",
  content: "current",
  timestamp: "2026-01-01T00:00:00.000Z",
  type: "text",
  sourceDevice: "Synthetic",
};
let host: HTMLDivElement;
let root: Root;
let clipsListener: (clips: Record<string, ClipData>) => void;
let syncListener: (active: boolean) => void;
let unsubscribe: ReturnType<typeof vi.fn>;
let api: Record<string, ReturnType<typeof vi.fn>>;
async function click(button: HTMLButtonElement | null) {
  if (!button) throw new Error("Missing button");
  await act(async () => button.click());
}
function buttonWith(text: string) {
  return (
    Array.from(host.querySelectorAll("button")).find((button) =>
      button.textContent?.includes(text),
    ) ?? null
  );
}

beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  unsubscribe = vi.fn();
  navigate.mockClear();
  mockUser.uid = "user";
  api = {
    getClips: vi.fn().mockResolvedValue({ clip }),
    onClipsUpdate: vi.fn((callback) => {
      clipsListener = callback;
      return unsubscribe;
    }),
    pasteClip: vi.fn().mockResolvedValue(undefined),
    getSyncState: vi.fn().mockResolvedValue(false),
    onSyncStateChanged: vi.fn((callback) => {
      syncListener = callback;
      return vi.fn();
    }),
    getNotificationsEnabled: vi.fn().mockResolvedValue(true),
    getDevices: vi.fn().mockResolvedValue(null),
    getDeviceId: vi.fn().mockResolvedValue("synthetic"),
    getShortcut: vi.fn().mockResolvedValue("CommandOrControl+Shift+V"),
    getAppVersion: vi.fn().mockResolvedValue("2.0.0"),
    toggleNotifications: vi.fn().mockResolvedValue(false),
    toggleClipboardSync: vi.fn().mockResolvedValue(true),
    setShortcut: vi.fn().mockResolvedValue(true),
    signOutUser: vi.fn().mockResolvedValue(undefined),
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
  };
  Object.defineProperty(window, "api", { configurable: true, value: api });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("clipboard view", () => {
  it("does not overwrite a newer sync event with the initial fetch", async () => {
    let resolve!: (value: Record<string, ClipData>) => void;
    api.getClips.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await act(async () => root.render(<MainContent />));
    await act(async () =>
      clipsListener({ clip: { ...clip, content: "newer" } }),
    );
    await act(async () => resolve({ clip: { ...clip, content: "stale" } }));
    expect(host.querySelector('[data-testid="clips"]')?.textContent).toBe(
      "newer",
    );
  });
  it("exposes failed fetches and lets the user retry", async () => {
    api.getClips.mockRejectedValueOnce(new Error("offline"));
    await act(async () => root.render(<MainContent />));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Unable to load",
    );
    await click(buttonWith("Retry"));
    expect(host.querySelector('[data-testid="clips"]')?.textContent).toBe(
      "current",
    );
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
  it("does not paste while an interactive button handles Enter", async () => {
    await act(async () => root.render(<MainContent />));
    const button = host.querySelector("button");
    if (!button) throw new Error("Missing settings button");
    await act(async () =>
      button.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(api.pasteClip).not.toHaveBeenCalled();
  });
  it("reports rejected paste requests and removes its listener on unmount", async () => {
    api.pasteClip.mockRejectedValueOnce(new Error("key unavailable"));
    await act(async () => root.render(<MainContent />));
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })),
    );
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Unable to paste",
    );
    await act(async () => root.render(<div />));
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("settings feedback", () => {
  it("reflects synchronization cancellation pushed by main", async () => {
    await act(async () => root.render(<SettingsPanel />));
    await act(async () => syncListener(true));
    expect(
      host.querySelector('[role="switch"]')?.getAttribute("aria-checked"),
    ).toBe("true");
    await act(async () => syncListener(false));
    expect(
      host.querySelector('[role="switch"]')?.getAttribute("aria-checked"),
    ).toBe("false");
  });
  it("does not overwrite cancellation with an older toggle response", async () => {
    let resolve!: (value: boolean) => void;
    api.toggleClipboardSync.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await act(async () => root.render(<SettingsPanel />));
    await click(host.querySelector<HTMLButtonElement>('[role="switch"]'));
    await act(async () => syncListener(false));
    await act(async () => resolve(true));
    expect(
      host.querySelector('[role="switch"]')?.getAttribute("aria-checked"),
    ).toBe("false");
  });
  it("keeps the last committed toggle when persistence fails", async () => {
    api.toggleClipboardSync.mockRejectedValueOnce(new Error("failed"));
    await act(async () => root.render(<SettingsPanel />));
    await click(host.querySelector<HTMLButtonElement>('[role="switch"]'));
    expect(
      host.querySelector('[role="switch"]')?.getAttribute("aria-checked"),
    ).toBe("false");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Unable to save",
    );
  });
  it("uses the actual main-process state rather than the requested toggle", async () => {
    api.toggleClipboardSync.mockResolvedValueOnce(false);
    await act(async () => root.render(<SettingsPanel />));
    await click(host.querySelector<HTMLButtonElement>('[role="switch"]'));
    expect(api.toggleClipboardSync).toHaveBeenCalledWith(true);
    expect(
      host.querySelector('[role="switch"]')?.getAttribute("aria-checked"),
    ).toBe("false");
  });
  it("retains the old shortcut after registration is rejected", async () => {
    api.setShortcut.mockResolvedValueOnce(false);
    await act(async () => root.render(<SettingsPanel />));
    await click(buttonWith("Cmd/Ctrl+Shift+V"));
    await act(async () =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "y", code: "KeyY", ctrlKey: true }),
      ),
    );
    expect(api.setShortcut).toHaveBeenCalledWith("CommandOrControl+Y");
    expect(buttonWith("Cmd/Ctrl+Shift+V")).not.toBeNull();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });
  it("does not navigate as if logout succeeded when it rejects", async () => {
    api.signOutUser.mockRejectedValueOnce(new Error("failed"));
    await act(async () => root.render(<SettingsPanel />));
    await click(
      host.querySelector<HTMLButtonElement>('button[title="Sign Out"]'),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });
});

it("ignores an old settings failure after the displayed account changes", async () => {
  let reject!: (error: Error) => void;
  api.getDevices.mockReturnValueOnce(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  await act(async () => root.render(<SettingsPanel />));
  mockUser.uid = "other-user";
  await act(async () => root.render(<SettingsPanel />));
  await act(async () => reject(new Error("old-account offline")));
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.textContent).toContain("Clipboard Sync");
});
it("reenables settings after a pending action finishes across an account change", async () => {
  let resolve!: (value: boolean) => void;
  api.toggleClipboardSync.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await act(async () => root.render(<SettingsPanel />));
  await click(host.querySelector<HTMLButtonElement>('[role="switch"]'));
  mockUser.uid = "other-user";
  await act(async () => root.render(<SettingsPanel />));
  await act(async () => resolve(true));
  expect(host.querySelector("fieldset")?.disabled).toBe(false);
  expect(
    host.querySelector('[role="switch"]')?.getAttribute("aria-checked"),
  ).toBe("false");
});
it("clears the previous account's clips while loading another account", async () => {
  await act(async () => root.render(<MainContent />));
  api.getClips.mockReturnValueOnce(new Promise(() => undefined));
  mockUser.uid = "other-user";
  await act(async () => root.render(<MainContent />));
  expect(api.getClips).toHaveBeenCalledTimes(2);
  expect(host.querySelector('[data-testid="clips"]')).toBeNull();
  const status = host.querySelector('[role="status"]');
  expect(status?.textContent).toContain("Loading clips");
  expect(status?.querySelector("svg")).not.toBeNull();
});
it("ignores a clip snapshot completing for a previous account", async () => {
  let resolve!: (value: Record<string, ClipData>) => void;
  api.getClips.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await act(async () => root.render(<MainContent />));
  mockUser.uid = "other-user";
  await act(async () => root.render(<MainContent />));
  await act(async () =>
    resolve({ clip: { ...clip, content: "previous account" } }),
  );
  expect(host.querySelector('[data-testid="clips"]')?.textContent).toBe(
    "current",
  );
});
it.each(["loading", "failed"])(
  "keeps sign-out available when remote settings are %s",
  async (state) => {
    api.getDevices.mockReturnValueOnce(
      state === "loading"
        ? new Promise(() => undefined)
        : Promise.reject(new Error("offline")),
    );
    await act(async () => root.render(<SettingsPanel />));
    await click(
      host.querySelector<HTMLButtonElement>('button[title="Sign Out"]'),
    );
    expect(api.signOutUser).toHaveBeenCalledTimes(1);
  },
);
