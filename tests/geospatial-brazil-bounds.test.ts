// STAGE 1 -- WP1.3 Brazil Geographic Bounds tests.
import { describe, it, expect } from "vitest";
import { classifyBrazilBounds, suspectedLatLonSwap, BRAZIL_BOUNDS } from "@/services/geospatial/brazil-bounds";

describe("services/geospatial/brazil-bounds", () => {
  it("classifies a comfortably-interior coordinate as inside (Brasilia)", () => {
    expect(classifyBrazilBounds(-15.7942, -47.8825)).toBe("inside");
  });

  it("classifies coordinates right at the edge of the bounding box as near_border", () => {
    expect(classifyBrazilBounds(BRAZIL_BOUNDS.maxLatitude - 0.1, -47)).toBe("near_border");
    expect(classifyBrazilBounds(BRAZIL_BOUNDS.minLatitude + 0.1, -47)).toBe("near_border");
    expect(classifyBrazilBounds(-15, BRAZIL_BOUNDS.minLongitude + 0.1)).toBe("near_border");
    expect(classifyBrazilBounds(-15, BRAZIL_BOUNDS.maxLongitude - 0.1)).toBe("near_border");
  });

  it("classifies a coordinate just outside the box as near_border, and one far outside as outside", () => {
    expect(classifyBrazilBounds(BRAZIL_BOUNDS.maxLatitude + 0.2, -47)).toBe("near_border");
    expect(classifyBrazilBounds(40, -47)).toBe("outside"); // New York-ish latitude
    expect(classifyBrazilBounds(-15, -100)).toBe("outside"); // Pacific ocean longitude
  });

  it("classifies missing/non-finite coordinates as cannot_validate", () => {
    expect(classifyBrazilBounds(null, -47)).toBe("cannot_validate");
    expect(classifyBrazilBounds(-15, undefined)).toBe("cannot_validate");
    expect(classifyBrazilBounds(Number.NaN, -47)).toBe("cannot_validate");
    expect(classifyBrazilBounds(-15, Number.POSITIVE_INFINITY)).toBe("cannot_validate");
  });

  it("detects a suspected lat/lon swap: raw pair outside Brazil, swapped pair inside", () => {
    // Brasilia's real pair is (-15.7942, -47.8825). Swapped: (-47.8825, -15.7942).
    expect(suspectedLatLonSwap(-47.8825, -15.7942)).toBe(true);
  });

  it("does not flag a swap when the raw pair is already inside Brazil", () => {
    expect(suspectedLatLonSwap(-15.7942, -47.8825)).toBe(false);
  });

  it("does not flag a swap when neither orientation lands in Brazil", () => {
    expect(suspectedLatLonSwap(40, -100)).toBe(false);
  });

  it("does not flag a swap for non-finite input", () => {
    expect(suspectedLatLonSwap(null, -47)).toBe(false);
  });
});
