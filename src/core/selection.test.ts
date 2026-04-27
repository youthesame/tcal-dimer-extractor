import { describe, expect, it } from "vitest";
import { nextDimerLabel, normalizeAutoDimerLabels } from "./selection";

describe("dimer selection labels", () => {
	it("creates one-based default dimer labels", () => {
		expect(nextDimerLabel(0)).toBe("dimer_1");
		expect(nextDimerLabel(5)).toBe("dimer_6");
	});

	it("renumbers automatic dimer labels without gaps or duplicates", () => {
		expect(
			normalizeAutoDimerLabels([
				{ moleculeId: "mol-a", label: "dimer_1" },
				{ moleculeId: "mol-c", label: "dimer_3" },
				{ moleculeId: "mol-d", label: "dimer_3" },
			]),
		).toEqual([
			{ moleculeId: "mol-a", label: "dimer_1" },
			{ moleculeId: "mol-c", label: "dimer_2" },
			{ moleculeId: "mol-d", label: "dimer_3" },
		]);
	});

	it("preserves user-defined non-default labels", () => {
		expect(
			normalizeAutoDimerLabels([
				{ moleculeId: "mol-a", label: "pi-stack" },
				{ moleculeId: "mol-b", label: "dimer_4" },
			]),
		).toEqual([
			{ moleculeId: "mol-a", label: "pi-stack" },
			{ moleculeId: "mol-b", label: "dimer_2" },
		]);
	});
});
