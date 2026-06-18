import { describe, expect, it, vi } from "vitest";
import { PerformanceCounter } from "../src/core/performance_counter.js";

describe("PerformanceCounter", () => {
  it("reports rolling 5s average and max frame cost", () => {
    const counter = new PerformanceCounter();
    const nowSpy = vi.spyOn(performance, "now");

    nowSpy.mockReturnValue(1000);
    counter.recordUnits(1, 1);
    counter.recordBullets(2, 1);
    counter.recordCollisions(3);
    counter.recordRendertime(4, 5, 6, 1);

    nowSpy.mockReturnValue(2000);
    counter.recordUnits(2, 1);
    counter.recordBullets(3, 1);
    counter.recordCollisions(4);
    counter.recordRendertime(5, 6, 7, 1);

    const report = counter.getReport();

    expect(report).toContain("5s Avg 24.00ms / Max 27.00ms");
  });
});
