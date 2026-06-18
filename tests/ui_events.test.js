import { describe, expect, it, vi } from "vitest";

describe("UI event wiring", () => {
  it("toggles debug display without corrupting display value", async () => {
    vi.spyOn(console, "table").mockImplementation(() => {});
    const { game } = await import("../src/core/game.js");
    await import("../src/core/btn_event.js");

    game.btn_showdebug.click();
    expect(game.info_debug.style.display).toBe("block");
    expect(game.btn_showdebug.style.backgroundColor).toBe("green");

    game.btn_showdebug.click();
    expect(game.info_debug.style.display).toBe("none");
    expect(game.btn_showdebug.style.backgroundColor).toBe("blue");
  });

  it("registers a single wheel zoom handler", async () => {
    vi.resetModules();
    const { world } = await import("../src/core/game.js");
    const zoomSpy = vi.spyOn(world.viewport, "handleZoom").mockImplementation((event) => {
      event.preventDefault();
    });

    await import("../src/core/btn_event.js");

    world.canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 1, cancelable: true }));
    expect(zoomSpy).toHaveBeenCalledTimes(1);
  });
});
