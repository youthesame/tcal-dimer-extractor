import { describe, expect, it } from "vitest";
import {
	nextDimerLabel,
	normalizeAutoDimerLabels,
	reconcileSelectionWithMoleculeIds,
	updateSelectionFromMoleculeClick,
} from "./selection";

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

	it("keeps center and selected dimers that still exist after molecule rebuild", () => {
		expect(
			reconcileSelectionWithMoleculeIds(
				"mol-center@0,0,0",
				[{ moleculeId: "mol-neighbor@0,0,0", label: "pi-stack" }],
				new Set(["mol-center@0,0,0", "mol-neighbor@0,0,0"]),
			),
		).toEqual({
			centerId: "mol-center@0,0,0",
			selected: [{ moleculeId: "mol-neighbor@0,0,0", label: "pi-stack" }],
		});
	});

	it("drops only selected dimers that no longer exist after molecule rebuild", () => {
		expect(
			reconcileSelectionWithMoleculeIds(
				"mol-center@0,0,0",
				[
					{ moleculeId: "mol-neighbor-a@0,0,0", label: "dimer_1" },
					{ moleculeId: "mol-neighbor-b@0,0,0", label: "A" },
					{ moleculeId: "mol-neighbor-c@0,0,0", label: "dimer_3" },
				],
				new Set([
					"mol-center@0,0,0",
					"mol-neighbor-a@0,0,0",
					"mol-neighbor-c@0,0,0",
				]),
			),
		).toEqual({
			centerId: "mol-center@0,0,0",
			selected: [
				{ moleculeId: "mol-neighbor-a@0,0,0", label: "dimer_1" },
				{ moleculeId: "mol-neighbor-c@0,0,0", label: "dimer_2" },
			],
		});
	});

	it("clears selected dimers when the center no longer exists after molecule rebuild", () => {
		expect(
			reconcileSelectionWithMoleculeIds(
				"mol-center@0,0,0",
				[{ moleculeId: "mol-neighbor@0,0,0", label: "pi-stack" }],
				new Set(["mol-neighbor@0,0,0"]),
			),
		).toEqual({ centerId: null, selected: [] });
	});
});

describe("molecule click selection", () => {
	it("sets the center molecule when no center is selected", () => {
		expect(updateSelectionFromMoleculeClick(null, [], "mol-center")).toEqual({
			centerId: "mol-center",
			selected: [],
		});
	});

	it("preserves selected dimers when setting a new center", () => {
		expect(
			updateSelectionFromMoleculeClick(
				null,
				[
					{ moleculeId: "mol-neighbor-a", label: "dimer_1" },
					{ moleculeId: "mol-neighbor-b", label: "pi-stack" },
				],
				"mol-center",
			),
		).toEqual({
			centerId: "mol-center",
			selected: [
				{ moleculeId: "mol-neighbor-a", label: "dimer_1" },
				{ moleculeId: "mol-neighbor-b", label: "pi-stack" },
			],
		});
	});

	it("removes the new center from selected dimers when re-centering", () => {
		expect(
			updateSelectionFromMoleculeClick(
				null,
				[
					{ moleculeId: "mol-neighbor-a", label: "dimer_1" },
					{ moleculeId: "mol-neighbor-b", label: "dimer_2" },
				],
				"mol-neighbor-a",
			),
		).toEqual({
			centerId: "mol-neighbor-a",
			selected: [{ moleculeId: "mol-neighbor-b", label: "dimer_1" }],
		});
	});

	it("clears only the center when clicking the selected center", () => {
		expect(
			updateSelectionFromMoleculeClick(
				"mol-center",
				[
					{ moleculeId: "mol-neighbor-a", label: "dimer_1" },
					{ moleculeId: "mol-neighbor-b", label: "pi-stack" },
				],
				"mol-center",
			),
		).toEqual({
			centerId: null,
			selected: [
				{ moleculeId: "mol-neighbor-a", label: "dimer_1" },
				{ moleculeId: "mol-neighbor-b", label: "pi-stack" },
			],
		});
	});

	it("adds a neighbor dimer when the center is already selected", () => {
		expect(
			updateSelectionFromMoleculeClick("mol-center", [], "mol-neighbor"),
		).toEqual({
			centerId: "mol-center",
			selected: [{ moleculeId: "mol-neighbor", label: "dimer_1" }],
		});
	});

	it("removes a selected neighbor dimer and renumbers automatic labels", () => {
		expect(
			updateSelectionFromMoleculeClick(
				"mol-center",
				[
					{ moleculeId: "mol-neighbor-a", label: "dimer_1" },
					{ moleculeId: "mol-neighbor-b", label: "dimer_2" },
					{ moleculeId: "mol-neighbor-c", label: "custom" },
				],
				"mol-neighbor-a",
			),
		).toEqual({
			centerId: "mol-center",
			selected: [
				{ moleculeId: "mol-neighbor-b", label: "dimer_1" },
				{ moleculeId: "mol-neighbor-c", label: "custom" },
			],
		});
	});
});
