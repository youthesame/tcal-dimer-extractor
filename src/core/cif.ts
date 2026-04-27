import { parseCif, parseCifStructures } from "crystcif-parse";
import type {
	Atom,
	Bond,
	CellRange,
	CrystalStructure,
	Molecule,
	Vec3,
} from "../domain/types";
import {
	groupMolecules,
	inferBonds,
	unwrapMoleculeAcrossPbc,
} from "./molecule";
import { centroid, translateByCell } from "./vector";

const rangeEpsilon = 1e-8;

const defaultRange: CellRange = {
	aMin: 0,
	aMax: 1,
	bMin: 0,
	bMax: 1,
	cMin: 0,
	cMax: 1,
};

export function parseCrystalFromCif(
	cifText: string,
	fileName: string,
): CrystalStructure {
	const structures = parseCifStructures(cifText);
	const [name, atoms] = Object.entries(structures)[0] ?? [];
	if (!name || !atoms) {
		throw new Error("No CIF data block with atom coordinates was found.");
	}

	const symbols = atoms.get_chemical_symbols();
	const positions = atoms.get_positions();
	const fractional = atoms.get_scaled_positions();
	const cell = atoms.get_cell() as [Vec3, Vec3, Vec3];

	const rawAtomCount = getRawAtomCount(cifText);

	return {
		name,
		fileName,
		originalCif: cifText,
		cell,
		atoms: symbols.map((element, index) => ({
			id: `atom-${index}`,
			element,
			position: toVec3(positions[index]),
			fractional: toVec3(fractional[index]),
			sourceIndex: index,
			translation: [0, 0, 0],
		})),
		rawAtomCount,
		preferredMoleculeAtomCount: inferPreferredMoleculeAtomCount(
			cifText,
			symbols,
			positions.map(toVec3),
			fractional.map(toVec3),
			cell,
		),
	};
}

export function buildMolecules(
	crystal: CrystalStructure,
	range: CellRange = defaultRange,
): Molecule[] {
	const baseMolecules =
		crystal.rawAtomCount &&
		crystal.preferredMoleculeAtomCount &&
		crystal.atoms.length % crystal.rawAtomCount === 0 &&
		crystal.rawAtomCount % crystal.preferredMoleculeAtomCount === 0
			? buildSymmetryOrderedMolecules(
					crystal.atoms,
					crystal.rawAtomCount,
					crystal.preferredMoleculeAtomCount,
					crystal.cell,
				)
			: groupMolecules(crystal.atoms, crystal.cell);
	const molecules: Molecule[] = [];

	if (isEmptyRange(range)) return molecules;
	const translationRange = translationSearchRange(range);

	for (let a = translationRange.aMin; a <= translationRange.aMax; a += 1) {
		for (let b = translationRange.bMin; b <= translationRange.bMax; b += 1) {
			for (let c = translationRange.cMin; c <= translationRange.cMax; c += 1) {
				const translation: Vec3 = [a, b, c];
				for (const base of baseMolecules) {
					const baseFractionalCentroid = getFractionalCentroid(base);
					const wrappedBaseCentroid = wrapFractionalPoint(
						baseFractionalCentroid,
					);
					const imageOffset = subFractional(
						wrappedBaseCentroid,
						baseFractionalCentroid,
					);
					const visibleTranslation = translateFractional(
						imageOffset,
						translation,
					);
					const fractionalCentroid = translateFractional(
						wrappedBaseCentroid,
						translation,
					);
					if (!isFractionalPointInsideRange(fractionalCentroid, range))
						continue;

					const atoms: Atom[] = base.atoms.map((atom) => ({
						...atom,
						id: `${atom.id}@${a},${b},${c}`,
						position: translateByCell(
							atom.position,
							crystal.cell,
							visibleTranslation,
						),
						fractional: [
							atom.fractional[0] + visibleTranslation[0],
							atom.fractional[1] + visibleTranslation[1],
							atom.fractional[2] + visibleTranslation[2],
						],
						translation: visibleTranslation,
					}));

					molecules.push({
						id: `${base.id}@${a},${b},${c}`,
						baseId: base.id,
						translation: visibleTranslation,
						atoms,
						bonds: base.bonds,
						centroid: translateByCell(
							base.centroid,
							crystal.cell,
							visibleTranslation,
						),
					});
				}
			}
		}
	}

	return molecules;
}

function isEmptyRange(range: CellRange): boolean {
	return (
		range.aMin >= range.aMax ||
		range.bMin >= range.bMax ||
		range.cMin >= range.cMax
	);
}

function translationSearchRange(range: CellRange): CellRange {
	return {
		aMin: Math.floor(range.aMin) - 1,
		aMax: Math.ceil(range.aMax),
		bMin: Math.floor(range.bMin) - 1,
		bMax: Math.ceil(range.bMax),
		cMin: Math.floor(range.cMin) - 1,
		cMax: Math.ceil(range.cMax),
	};
}

function getFractionalCentroid(molecule: Molecule): Vec3 {
	return centroid(molecule.atoms.map((atom) => atom.fractional));
}

function wrapFractionalPoint(fractional: Vec3): Vec3 {
	return [
		wrapUnit(fractional[0]),
		wrapUnit(fractional[1]),
		wrapUnit(fractional[2]),
	];
}

function translateFractional(fractional: Vec3, translation: Vec3): Vec3 {
	return [
		fractional[0] + translation[0],
		fractional[1] + translation[1],
		fractional[2] + translation[2],
	];
}

function subFractional(a: Vec3, b: Vec3): Vec3 {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function isFractionalPointInsideRange(point: Vec3, range: CellRange): boolean {
	return (
		point[0] >= range.aMin - rangeEpsilon &&
		point[0] < range.aMax &&
		point[1] >= range.bMin - rangeEpsilon &&
		point[1] < range.bMax &&
		point[2] >= range.cMin - rangeEpsilon &&
		point[2] < range.cMax
	);
}

function wrapUnit(value: number): number {
	const wrapped = ((value % 1) + 1) % 1;
	if (wrapped < rangeEpsilon || wrapped > 1 - rangeEpsilon) return 0;
	return wrapped;
}

function buildSymmetryOrderedMolecules(
	atoms: Atom[],
	rawAtomCount: number,
	moleculeAtomCount: number,
	cell: [Vec3, Vec3, Vec3],
): Molecule[] {
	const symmetryCount = atoms.length / rawAtomCount;
	const rawMoleculeCount = rawAtomCount / moleculeAtomCount;
	const molecules: Molecule[] = [];

	for (
		let symmetryIndex = 0;
		symmetryIndex < symmetryCount;
		symmetryIndex += 1
	) {
		for (
			let rawMoleculeIndex = 0;
			rawMoleculeIndex < rawMoleculeCount;
			rawMoleculeIndex += 1
		) {
			const rawStart = rawMoleculeIndex * moleculeAtomCount;
			const moleculeAtoms = unwrapMoleculeAcrossPbc(
				Array.from({ length: moleculeAtomCount }, (_, offset) => {
					const rawIndex = rawStart + offset;
					return atoms[rawIndex * symmetryCount + symmetryIndex];
				}),
				cell,
			);
			const bonds = inferBonds(moleculeAtoms);
			molecules.push({
				id: `mol-${molecules.length}`,
				baseId: `mol-${molecules.length}`,
				translation: [0, 0, 0],
				atoms: moleculeAtoms,
				bonds: bonds.map((bond): Bond => ({ from: bond.from, to: bond.to })),
				centroid: centroid(moleculeAtoms.map((atom) => atom.position)),
			});
		}
	}
	return molecules;
}

function inferPreferredMoleculeAtomCount(
	cifText: string,
	symbols: string[],
	positions: Vec3[],
	fractional: Vec3[],
	cell: [Vec3, Vec3, Vec3],
): number | null {
	const rawAtomCount = getRawAtomCount(cifText);
	if (!rawAtomCount || rawAtomCount <= 0) return null;

	const symmetryCount = positions.length / rawAtomCount;
	if (!Number.isInteger(symmetryCount) || symmetryCount < 1) return rawAtomCount;

	const rawAtoms = Array.from({ length: rawAtomCount }, (_, rawIndex): Atom => {
		const atomIndex = rawIndex * symmetryCount;
		return {
			id: `raw-atom-${rawIndex}`,
			element: symbols[atomIndex],
			position: positions[atomIndex],
			fractional: fractional[atomIndex],
			sourceIndex: rawIndex,
			translation: [0, 0, 0],
		};
	});

	for (const atomCount of moleculeAtomCountCandidates(rawAtomCount)) {
		if (rawAtomCount % atomCount !== 0) continue;
		const chunksAreConnected = range(0, rawAtomCount, atomCount).every((start) =>
			isConnectedMoleculeChunk(rawAtoms.slice(start, start + atomCount), cell),
		);
		if (chunksAreConnected) {
			return atomCount;
		}
	}

	return rawAtomCount;
}

function moleculeAtomCountCandidates(rawAtomCount: number): number[] {
	const candidates: number[] = [];
	for (let atomCount = rawAtomCount; atomCount >= 2; atomCount -= 1) {
		if (rawAtomCount % atomCount === 0) candidates.push(atomCount);
	}
	return candidates;
}

function range(start: number, end: number, step: number): number[] {
	const values: number[] = [];
	for (let value = start; value < end; value += step) {
		values.push(value);
	}
	return values;
}

function isConnectedMoleculeChunk(
	atoms: Atom[],
	cell: [Vec3, Vec3, Vec3],
): boolean {
	const unwrapped = unwrapMoleculeAcrossPbc(atoms, cell);
	const bonds = inferBonds(unwrapped);
	if (atoms.length < 2 || bonds.length === 0) return false;

	const adjacency = Array.from({ length: atoms.length }, () => [] as number[]);
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
	return visited.size === atoms.length;
}

function getRawAtomCount(cifText: string): number | null {
	const parsed = parseCif(cifText);
	const block = Object.values(parsed)[0] as
		| Record<string, { value?: unknown[] }>
		| undefined;
	return block?._atom_site_label?.value?.length ?? null;
}

function toVec3(values: number[] | undefined): Vec3 {
	if (!values || values.length < 3) {
		throw new Error("Expected a 3D coordinate.");
	}
	return [values[0], values[1], values[2]];
}
