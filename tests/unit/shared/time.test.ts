import { describe, expect, test } from "bun:test";
import iso8601DurationToMilliseconds from "../../../src/shared/time.ts";

describe("iso8601DurationToMilliseconds", () => {
    test("converts hours, minutes and seconds", () => {
        expect(iso8601DurationToMilliseconds("PT1H2M3S")).toBe(3_723_000);
    });

    test("converts days together with time components", () => {
        expect(iso8601DurationToMilliseconds("P2DT3H4M5S")).toBe(
            2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000,
        );
    });

    test("accepts single-component durations", () => {
        expect(iso8601DurationToMilliseconds("PT45S")).toBe(45_000);
        expect(iso8601DurationToMilliseconds("PT2M")).toBe(120_000);
        expect(iso8601DurationToMilliseconds("PT3H")).toBe(10_800_000);
        expect(iso8601DurationToMilliseconds("P1D")).toBe(86_400_000);
    });

    test("treats an empty duration as zero", () => {
        expect(iso8601DurationToMilliseconds("P")).toBe(0);
        expect(iso8601DurationToMilliseconds("PT")).toBe(0);
        expect(iso8601DurationToMilliseconds("PT0S")).toBe(0);
    });

    test("keeps a day component when T has no fields", () => {
        expect(iso8601DurationToMilliseconds("P1DT")).toBe(86_400_000);
    });

    test("throws for malformed input", () => {
        for (const bad of ["", "1H", "P1H", "PT1S2M", "PT1.5S", "hello"]) {
            expect(() => iso8601DurationToMilliseconds(bad)).toThrow("Invalid duration string format");
        }
    });
});
