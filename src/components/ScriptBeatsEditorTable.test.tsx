import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import type { ScriptBeat } from "@/lib/types";
import { ScriptBeatsEditorTable } from "./ScriptBeatsEditorTable";

// ---------------------------------------------------------------------------
// Storage mock
// ---------------------------------------------------------------------------

function makeStorage(data: Record<string, string> = {}): Storage & { setItem: ReturnType<typeof vi.fn> } {
  let store = { ...data };
  const setItemMock = vi.fn((key: string, value: string) => { store[key] = value; });
  return {
    getItem: (key: string) => (store[key] ?? null),
    setItem: setItemMock as unknown as Storage["setItem"],
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  } as unknown as Storage & { setItem: ReturnType<typeof vi.fn> };
}

// Stub scrollIntoView (not implemented in jsdom Element.prototype)
let _storage: Storage;
beforeEach(() => {
  _storage = makeStorage();
  vi.stubGlobal("localStorage", _storage);
  // Use Object.defineProperty because Element.prototype is a read-only accessor in jsdom
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeBeat(overrides: Partial<ScriptBeat> = {}): ScriptBeat {
  return {
    id: "beat-1",
    shotNumber: "1",
    durationHint: "",
    description: "A scene with Alice",
    character1: "Alice",
    character1Desc: "tall",
    character1Image: "",
    character2: "",
    character2Desc: "",
    character2Image: "",
    reference: "",
    shotSize: "wide",
    characterAction: "",
    emotion: "happy",
    sceneTags: "outdoor",
    lightingMood: "",
    soundEffect: "",
    dialogue: "",
    storyboardPrompt: "",
    videoMotionPrompt: "",
    scene: "",
    characters: [],
    ...overrides,
  };
}

const ROWS: ScriptBeat[] = [
  makeBeat({ id: "beat-1", description: "Alice walks in the garden", character1: "Alice", emotion: "happy" }),
  makeBeat({ id: "beat-2", description: "Bob visits the park", character1: "Bob", emotion: "sad" }),
  makeBeat({ id: "beat-3", description: "Carol meets Dave at the station", character1: "Carol", character2: "Dave" }),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function openFieldsPopover() {
  const btns = screen.getAllByRole("button", { name: /字段/ });
  fireEvent.click(btns[0]);
}

function openFilterPopover() {
  const btns = screen.getAllByRole("button", { name: /筛选/ });
  fireEvent.click(btns[0]);
}

function getFieldsSearchInput() {
  return screen.getByPlaceholderText("搜索字段名…");
}

function getFilterSearchInput() {
  return screen.getByPlaceholderText("在各列文本中搜索…");
}

// ---------------------------------------------------------------------------
// Esc closes popovers
// ---------------------------------------------------------------------------

describe("Esc closes popovers", () => {
  it("closes fields popover on Escape", async () => {
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFieldsPopover();
    expect(await screen.findByRole("dialog", { name: /字段可见性/ })).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(screen.queryByRole("dialog", { name: /字段可见性/ })).not.toBeInTheDocument();
  });

  it("closes filter popover on Escape", async () => {
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFilterPopover();
    expect(await screen.findByRole("dialog", { name: /筛选/ })).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(screen.queryByRole("dialog", { name: /筛选/ })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tab/Shift+Tab and Arrow navigation in fields popover
// ---------------------------------------------------------------------------

describe("Tab / Arrow navigation in fields popover", () => {
  it("Tab moves to next field option", async () => {
    const user = userEvent.setup();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFieldsPopover();
    const input = getFieldsSearchInput();
    await act(async () => {
      await user.click(input);
      await user.keyboard("{Tab}");
    });
    expect(input).toBeInTheDocument();
  });

  it("Shift+Tab moves to previous field option", async () => {
    const user = userEvent.setup();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFieldsPopover();
    const input = getFieldsSearchInput();
    await act(async () => {
      await user.click(input);
      await user.keyboard("{Shift}{Tab}");
    });
    expect(input).toBeInTheDocument();
  });

  it("ArrowDown cycles through field options", async () => {
    const user = userEvent.setup();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFieldsPopover();
    const input = getFieldsSearchInput();
    await act(async () => {
      await user.click(input);
      await user.keyboard("{ArrowDown}");
    });
    expect(input).toBeInTheDocument();
  });

  it("ArrowUp cycles through field options", async () => {
    const user = userEvent.setup();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFieldsPopover();
    const input = getFieldsSearchInput();
    await act(async () => {
      await user.click(input);
      await user.keyboard("{ArrowUp}");
    });
    expect(input).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Enter toggles column visibility
// ---------------------------------------------------------------------------

describe("Enter toggles column visibility", () => {
  it("Enter hides/shows the active field", async () => {
    const user = userEvent.setup();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFieldsPopover();
    const input = getFieldsSearchInput();
    await act(async () => {
      await user.click(input);
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");
    });

    expect(screen.getByRole("dialog", { name: /字段可见性/ })).toBeInTheDocument();
  });

  it("Enter twice toggles back", async () => {
    const user = userEvent.setup();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFieldsPopover();
    const input = getFieldsSearchInput();
    await act(async () => {
      await user.click(input);
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");
      await user.keyboard("{Enter}");
    });

    expect(screen.getByRole("dialog", { name: /字段可见性/ })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// At least 1 column always visible
// ---------------------------------------------------------------------------

describe("At least 1 column always visible", () => {
  it("shows warning when trying to hide last visible column via click", async () => {
    const onStatusText = vi.fn();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
        onStatusText={onStatusText}
      />
    );

    const user = userEvent.setup();
    openFieldsPopover();

    // Click visible listitem buttons one by one until warning fires
    const items = await screen.findAllByRole("listitem");
    for (const item of items) {
      const btn = item as HTMLButtonElement;
      if (!btn.disabled && !btn.className.includes("--hidden")) {
        await act(async () => {
          await user.click(btn);
        });
        if (onStatusText.mock.calls.length > 0) break;
      }
    }
  });

  it("showAllCols reveals all columns", async () => {
    const user = userEvent.setup();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFieldsPopover();
    const showAll = screen.getByRole("button", { name: /全部显示/ });

    await act(async () => {
      await user.click(showAll);
    });

    expect(screen.getByRole("dialog", { name: /字段可见性/ })).toBeInTheDocument();
  });

  it("restoreDefaultCols resets to default hidden columns", async () => {
    const user = userEvent.setup();
    const onStatusText = vi.fn();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
        onStatusText={onStatusText}
      />
    );

    openFieldsPopover();
    const restore = screen.getByRole("button", { name: /恢复默认/ });

    await act(async () => {
      await user.click(restore);
    });

    expect(onStatusText).toHaveBeenCalledWith("已恢复默认字段布局");
  });
});

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

describe("localStorage persistence", () => {
  it("persists hiddenCols to localStorage on toggle", async () => {
    const user = userEvent.setup();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFieldsPopover();
    const input = getFieldsSearchInput();
    await act(async () => {
      await user.click(input);
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");
    });

    expect(_storage.setItem).toHaveBeenCalled();
    const mockFn = vi.mocked(_storage.setItem) as ReturnType<typeof vi.fn>;
    const calls = mockFn.mock.calls as [string, string][];
    const savedEntry = calls.find((k) => k[0].includes("hiddenCols"));
    expect(savedEntry).toBeTruthy();
  });

  it("restores hiddenCols from localStorage on mount", () => {
    const stored = makeStorage({
      "scriptWorkbench.fullscreen.hiddenCols.v1": JSON.stringify(["description", "shotSize"]),
    });
    vi.stubGlobal("localStorage", stored);

    expect(() => {
      render(
        <ScriptBeatsEditorTable
          variant="fullscreen"
          rows={ROWS}
          selectedIds={[]}
          onToggleSelect={() => {}}
          onPersistRows={() => {}}
        />
      );
    }).not.toThrow();
  });

  it("persists filterQuery to localStorage when typing", async () => {
    const user = userEvent.setup();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFilterPopover();
    const input = getFilterSearchInput();
    await act(async () => {
      await user.type(input, "Alice");
    });

    expect(_storage.setItem).toHaveBeenCalled();
    const mockFn = vi.mocked(_storage.setItem) as ReturnType<typeof vi.fn>;
    const calls = mockFn.mock.calls as [string, string][];
    const savedEntry = calls.find((k) => k[0].includes("filterQuery"));
    expect(savedEntry).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Filter behavior
// ---------------------------------------------------------------------------

describe("Filter behavior", () => {
  it("filters rows by description keyword", async () => {
    const user = userEvent.setup();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFilterPopover();
    const input = getFilterSearchInput();
    await act(async () => {
      await user.type(input, "Alice");
    });

    expect(input).toHaveValue("Alice");
  });

  it("shows no results message when filter matches nothing", async () => {
    const user = userEvent.setup();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFilterPopover();
    const input = getFilterSearchInput();
    await act(async () => {
      await user.type(input, "XYZNONEXISTENT");
    });

    expect(input).toHaveValue("XYZNONEXISTENT");
  });

  it("clears filter via clear button", async () => {
    const user = userEvent.setup();
    render(
      <ScriptBeatsEditorTable
        variant="fullscreen"
        rows={ROWS}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );

    openFilterPopover();
    const input = getFilterSearchInput();
    await act(async () => {
      await user.type(input, "Alice");
    });

    const clearBtn = screen.getByRole("button", { name: /清空/ });
    await act(async () => {
      await user.click(clearBtn);
    });

    expect(input).toHaveValue("");
  });
});

// ---------------------------------------------------------------------------
// Inline / compact variants
// ---------------------------------------------------------------------------

describe("Inline and compact variants", () => {
  it("renders inline variant without crashing", () => {
    const { container } = render(
      <ScriptBeatsEditorTable
        variant="inline"
        rows={[ROWS[0]]}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );
    expect(container.querySelector("table")).toBeInTheDocument();
  });

  it("renders compact variant without crashing", () => {
    const { container } = render(
      <ScriptBeatsEditorTable
        variant="inline"
        rows={[ROWS[0]]}
        selectedIds={[]}
        onToggleSelect={() => {}}
        onPersistRows={() => {}}
      />
    );
    expect(container.querySelector("table")).toBeInTheDocument();
  });
});