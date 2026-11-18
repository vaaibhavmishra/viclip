// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Login } from "./Login";

vi.mock("@renderer/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
let host: HTMLDivElement;
let root: Root;
let api: Record<string, ReturnType<typeof vi.fn>>;
async function input(id: string, value: string) {
  const node = host.querySelector<HTMLInputElement>(`#${id}`);
  if (!node) throw new Error("Missing input");
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit(form: HTMLFormElement | null) {
  if (!form) throw new Error("Missing form");
  await act(async () =>
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
}
async function click(text: string) {
  const node = Array.from(host.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  );
  if (!node) throw new Error("Missing button");
  await act(async () => node.click());
}
beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  api = {
    loginUser: vi.fn(),
    recoverAccount: vi.fn().mockResolvedValue(undefined),
    resetAccountData: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
  };
  Object.defineProperty(window, "api", { configurable: true, value: api });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it.each(["recover", "reset"])(
  "keeps %s tied to credentials from the key-mismatch login",
  async (action) => {
    let reject!: (error: Error) => void;
    api.loginUser.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    await act(async () => root.render(<Login />));
    await input("email", "original@example.invalid");
    await input("password", "Original-password");
    await submit(host.querySelector("form"));
    await input("email", "changed@example.invalid");
    await input("password", "Changed-password");
    await act(async () => reject(new Error("ERR_KEY_DECRYPTION_FAILED")));
    if (action === "recover") {
      await input("old-password", "Old-password");
      await submit(host.querySelector('[role="dialog"] form'));
      expect(api.recoverAccount).toHaveBeenCalledWith(
        "original@example.invalid",
        "Original-password",
        "Old-password",
      );
    } else {
      await click("Start Fresh");
      await click("Confirm Wipe");
      expect(api.resetAccountData).toHaveBeenCalledWith(
        "original@example.invalid",
        "Original-password",
      );
    }
  },
);
it("offers explicit reset when authenticated encryption metadata is missing", async () => {
  api.loginUser.mockRejectedValueOnce(
    new Error("ERR_ENCRYPTION_METADATA_MISSING"),
  );
  await act(async () => root.render(<Login />));
  await input("email", "partial-account@example.invalid");
  await input("password", "Current-password");
  await submit(host.querySelector("form"));
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain(
    "Encryption setup missing",
  );
  expect(host.querySelector('[role="dialog"] form')).toBeNull();
  expect(api.resetAccountData).not.toHaveBeenCalled();
  await click("Delete data & start fresh");
  expect(api.resetAccountData).toHaveBeenCalledWith(
    "partial-account@example.invalid",
    "Current-password",
  );
  expect(api.recoverAccount).not.toHaveBeenCalled();
});
