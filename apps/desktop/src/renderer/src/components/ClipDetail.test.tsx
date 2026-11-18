// @vitest-environment jsdom
import type { ClipData } from "@viclip/types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClipDetail } from "./ClipDetail";

const clip: ClipData = {
  id: "clip-a",
  content: "original",
  type: "text",
  timestamp: "2026-01-01T00:00:00.000Z",
  sourceDevice: "Synthetic",
};
let host: HTMLDivElement;
let root: Root;
let update: ReturnType<typeof vi.fn>;
async function render(value: ClipData) {
  await act(async () => root.render(<ClipDetail clip={value} />));
}
async function edit(value: string) {
  const textarea = host.querySelector("textarea");
  if (!textarea) throw new Error("Missing editor");
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function save() {
  const textarea = host.querySelector("textarea");
  await act(async () => {
    textarea?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
}
beforeEach(() => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  update = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, "api", {
    configurable: true,
    value: { updateClip: update },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("clip editor", () => {
  it("preserves a dirty draft across unrelated sync snapshots", async () => {
    await render(clip);
    await edit("unsaved draft");
    await render({ ...clip, pinned: true });
    expect(host.querySelector("textarea")?.value).toBe("unsaved draft");
  });
  it("retains a failed draft across selection changes and permits retry", async () => {
    update.mockRejectedValueOnce(new Error("offline"));
    await render(clip);
    await edit("retained draft");
    await save();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Unable to save",
    );
    await render({ ...clip, id: "clip-b", content: "second" });
    await render(clip);
    expect(host.querySelector("textarea")?.value).toBe("retained draft");
    await save();
    expect(update).toHaveBeenLastCalledWith("clip-a", "retained draft");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });
  it("does not save decryption failures or erase a draft containing only spaces", async () => {
    await render({
      ...clip,
      content: "[Encrypted Content - Decryption Failed]",
    });
    expect(host.querySelector("textarea")?.disabled).toBe(true);
    await save();
    expect(update).not.toHaveBeenCalled();
    await render(clip);
    await edit("   ");
    await save();
    expect(update).not.toHaveBeenCalled();
    expect(host.querySelector("textarea")?.value).toBe("   ");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "non-empty",
    );
  });
  it("keeps newer input when an older save completes", async () => {
    let resolve!: () => void;
    update.mockReturnValueOnce(
      new Promise<void>((done) => {
        resolve = done;
      }),
    );
    await render(clip);
    await edit("first");
    await save();
    await edit("newer");
    await save();
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    expect(host.querySelector("textarea")?.value).toBe("newer");
    await save();
    expect(update).toHaveBeenLastCalledWith("clip-a", "newer");
  });
  it("adopts new remote content after a completed clean save", async () => {
    await render(clip);
    await edit("saved");
    await save();
    await render({ ...clip, content: "remote replacement" });
    expect(host.querySelector("textarea")?.value).toBe("remote replacement");
  });
});

it("does not auto-save when focus moves to Discard draft", async () => {
  await render(clip);
  await edit("discard this draft");
  const discard = Array.from(host.querySelectorAll("button")).find(
    (button) => button.textContent === "Discard draft",
  );
  if (!discard) throw new Error("Missing discard button");
  await act(async () => {
    host
      .querySelector("textarea")
      ?.dispatchEvent(
        new FocusEvent("focusout", { bubbles: true, relatedTarget: discard }),
      );
  });
  await act(async () => discard.click());
  expect(update).not.toHaveBeenCalled();
  expect(host.querySelector("textarea")?.value).toBe("original");
});
it("adopts a remote replacement received while a clean save was pending", async () => {
  let resolve!: () => void;
  update.mockReturnValueOnce(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  await render(clip);
  await edit("saved");
  await save();
  await render({ ...clip, content: "saved" });
  await render({ ...clip, content: "newer remote replacement" });
  await act(async () => resolve());
  expect(host.querySelector("textarea")?.value).toBe(
    "newer remote replacement",
  );
});
it.each(["constructor", "__proto__", "toString"])(
  "permits explicit draft saves for the valid clip id %s",
  async (id) => {
    await render({ ...clip, id });
    await edit("edited content");
    const saveButton = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent === "Save draft",
    );
    if (!saveButton) throw new Error("Missing save button");
    expect(saveButton.disabled).toBe(false);
    await act(async () => saveButton.click());
    expect(update).toHaveBeenCalledWith(id, "edited content");
  },
);
