// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandMenu } from "./CommandMenu";

vi.mock("@renderer/components/ui/command", () => ({
  CommandDialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandEmpty: () => null,
  CommandGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandInput: () => null,
  CommandList: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandSeparator: () => null,
  CommandItem: ({
    children,
    onSelect,
    disabled,
  }: {
    children: React.ReactNode;
    onSelect: () => void;
    disabled: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={onSelect}>
      {children}
    </button>
  ),
}));
let host: HTMLDivElement;
let root: Root;
let pin: ReturnType<typeof vi.fn>;
let close: ReturnType<typeof vi.fn<(open: boolean) => void>>;
const render = async (id = "clip-a") => {
  await act(async () =>
    root.render(<CommandMenu open onOpenChange={close} selectedClipId={id} />),
  );
};
const clickPin = async () => {
  await act(async () => host.querySelector("button")?.click());
};
beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  pin = vi.fn().mockResolvedValue(undefined);
  close = vi.fn<(open: boolean) => void>();
  Object.defineProperty(window, "api", {
    configurable: true,
    value: { pinClip: pin },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("command mutation feedback", () => {
  it("keeps the command menu open and reports a failed mutation", async () => {
    pin.mockRejectedValueOnce(new Error("offline"));
    await render();
    await clickPin();
    expect(close).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Unable to complete",
    );
    await clickPin();
    expect(close).toHaveBeenCalledWith(false);
  });
  it("coalesces clicks and ignores completion for a replaced selection", async () => {
    let resolve!: () => void;
    pin.mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    await render();
    await clickPin();
    await clickPin();
    expect(pin).toHaveBeenCalledTimes(1);
    await render("clip-b");
    await act(async () => resolve());
    expect(close).not.toHaveBeenCalled();
    await clickPin();
    expect(pin).toHaveBeenLastCalledWith("clip-b", true);
    expect(close).toHaveBeenCalledWith(false);
  });
});
