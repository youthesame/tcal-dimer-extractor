import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CellRange } from "../domain/types";
import { buildMolecules, parseCrystalFromCif } from "./cif";
import { toDimerXyz } from "./export";
import { inferBonds } from "./molecule";
import { appendRecipeToCif, makeRecipe, readRecipeFromCif } from "./recipe";
import { centroid } from "./vector";

const root = process.cwd();

const samples = [
	{ fileName: "BTBT.cif", expectedAtoms: 96, monomerAtoms: 24, dimerAtoms: 48 },
	{
		fileName: "Pentacene.cif",
		expectedAtoms: 144,
		monomerAtoms: 36,
		dimerAtoms: 72,
	},
	{
		fileName: "PhC2-BQQDI.cif",
		expectedAtoms: 280,
		monomerAtoms: 70,
		dimerAtoms: 140,
	},
	{
		fileName: "XUYNOX.cif",
		expectedAtoms: 216,
		monomerAtoms: 54,
		dimerAtoms: 108,
	},
];

const unitRange: CellRange = {
	aMin: 0,
	aMax: 1,
	bMin: 0,
	bMax: 1,
	cMin: 0,
	cMax: 1,
};

const emptyRange: CellRange = {
	aMin: 0,
	aMax: 0,
	bMin: 0,
	bMax: 0,
	cMin: 0,
	cMax: 0,
};

describe("CIF to tcal dimer extraction", () => {
	for (const sample of samples) {
		it(`loads ${sample.fileName} and groups unit-cell molecules`, () => {
			const cifText = readSample(sample.fileName);
			const crystal = parseCrystalFromCif(cifText, sample.fileName);
			const molecules = buildMolecules(crystal, unitRange);

			expect(crystal.atoms).toHaveLength(sample.expectedAtoms);
			expect(molecules).toHaveLength(4);
			expect(molecules.map((molecule) => molecule.atoms.length)).toEqual([
				sample.monomerAtoms,
				sample.monomerAtoms,
				sample.monomerAtoms,
				sample.monomerAtoms,
			]);
			for (const molecule of molecules) {
				expect(
					isConnectedByCurrentCoordinates(
						molecule.atoms.length,
						inferBonds(molecule.atoms),
					),
				).toBe(true);
			}
		});

		it(`exports ${sample.fileName} dimers center-first`, () => {
			const cifText = readSample(sample.fileName);
			const crystal = parseCrystalFromCif(cifText, sample.fileName);
			const [center, neighbor] = buildMolecules(crystal, unitRange);
			const xyz = toDimerXyz(center, neighbor);
			const lines = xyz.trimEnd().split("\n");

			expect(lines[0]).toBe(String(sample.dimerAtoms));
			expect(lines[1]).toContain(`center_atoms=${sample.monomerAtoms}`);
			expect(lines).toHaveLength(sample.dimerAtoms + 2);
			expect(lines[2].split(/\s+/)[0]).toBe(center.atoms[0].element);
			expect(lines[sample.monomerAtoms + 2].split(/\s+/)[0]).toBe(
				neighbor.atoms[0].element,
			);
		});
	}

	it("embeds and restores a CIF recipe block", async () => {
		const fileName = "Pentacene.cif";
		const cifText = readSample(fileName);
		const crystal = parseCrystalFromCif(cifText, fileName);
		const [center, neighbor] = buildMolecules(crystal, unitRange);
		const recipe = await makeRecipe({
			cifText,
			fileName,
			cellRange: unitRange,
			center,
			selected: [{ moleculeId: neighbor.id, label: "A pi-stack" }],
			molecules: [center, neighbor],
		});

		const cifWithRecipe = appendRecipeToCif(cifText, recipe);
		const restored = readRecipeFromCif(cifWithRecipe);

		expect(restored?.schemaVersion).toBe(1);
		expect(restored?.centerMoleculeId).toBe(center.id);
		expect(restored?.centerAtomCount).toBe(36);
		expect(restored?.selectedDimers[0].label).toBe("A pi-stack");
	});

	it("treats equal cell expansion boundaries as an empty half-open range", () => {
		const fileName = "Pentacene.cif";
		const cifText = readSample(fileName);
		const crystal = parseCrystalFromCif(cifText, fileName);

		expect(buildMolecules(crystal, emptyRange)).toHaveLength(0);
		expect(buildMolecules(crystal, unitRange)).toHaveLength(4);
	});

	it("filters fractional sub-cell ranges by molecule centroid instead of rounding to whole cells", () => {
		const fileName = "BTBT.cif";
		const cifText = readSample(fileName);
		const crystal = parseCrystalFromCif(cifText, fileName);

		const molecules = buildMolecules(crystal, { ...unitRange, aMax: 0.5 });

		expect(molecules.length).toBeLessThanOrEqual(
			buildMolecules(crystal, unitRange).length,
		);
		for (const molecule of molecules) {
			const fractional = centroid(
				molecule.atoms.map((atom) => atom.fractional),
			);
			expect(fractional[0]).toBeGreaterThanOrEqual(0);
			expect(fractional[0]).toBeLessThan(0.5);
		}
	});

	it("anchors displayed molecules to the same periodic image used for fractional range filtering", () => {
		const fileName = "BTBT.cif";
		const cifText = readSample(fileName);
		const crystal = parseCrystalFromCif(cifText, fileName);
		const range = { ...unitRange, aMax: 0.1 };
		const molecules = buildMolecules(crystal, range);

		expect(molecules.length).toBeGreaterThan(0);
		for (const molecule of molecules) {
			const fractional = centroid(
				molecule.atoms.map((atom) => atom.fractional),
			);
			expect(fractional[0]).toBeGreaterThanOrEqual(range.aMin);
			expect(fractional[0]).toBeLessThan(range.aMax);
		}
	});

	it("does not add a full neighboring cell for a small fractional expansion", () => {
		const fileName = "Pentacene.cif";
		const cifText = readSample(fileName);
		const crystal = parseCrystalFromCif(cifText, fileName);
		const unitMolecules = buildMolecules(crystal, unitRange);
		const slightlyExpanded = buildMolecules(crystal, {
			...unitRange,
			aMax: 1.1,
		});

		expect(slightlyExpanded.length).toBeGreaterThanOrEqual(
			unitMolecules.length,
		);
		expect(slightlyExpanded.length).toBeLessThan(unitMolecules.length * 2);
	});
});

function readSample(fileName: string): string {
	return readFileSync(join(root, "data", "cifs", fileName), "utf8");
}

function isConnectedByCurrentCoordinates(
	size: number,
	bonds: Array<{ from: number; to: number }>,
): boolean {
	const adjacency = Array.from({ length: size }, () => [] as number[]);
	for (const bond of bonds) {
		adjacency[bond.from].push(bond.to);
		adjacency[bond.to].push(bond.from);
	}
	const visited = new Set<number>([0]);
	const queue = [0];
	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const next of adjacency[current]) {
			if (!visited.has(next)) {
				visited.add(next);
				queue.push(next);
			}
		}
	}
	return visited.size === size;
}
