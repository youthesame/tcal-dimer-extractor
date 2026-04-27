import type { Atom, Bond, Molecule, Vec3 } from "../domain/types";
import { centroid, distance, translateByCell } from "./vector";

const covalentRadii: Record<string, number> = {
	H: 0.31,
	B: 0.85,
	C: 0.76,
	N: 0.71,
	O: 0.66,
	F: 0.57,
	P: 1.07,
	S: 1.05,
	Cl: 1.02,
	Br: 1.2,
	I: 1.39,
};

export function groupMolecules(
	atoms: Atom[],
	cell?: [Vec3, Vec3, Vec3],
): Molecule[] {
	const bonds = cell ? inferPeriodicBonds(atoms, cell) : inferBonds(atoms);
	const components = connectedComponents(atoms.length, bonds);

	return components
		.map((indices, moleculeIndex) => {
			const atomIndexMap = new Map(
				indices.map((atomIndex, localIndex) => [atomIndex, localIndex]),
			);
			const moleculeAtoms = indices.map((atomIndex) => atoms[atomIndex]);
			const moleculeBonds = bonds
				.filter(
					(bond) => atomIndexMap.has(bond.from) && atomIndexMap.has(bond.to),
				)
				.map((bond) => ({
					from: atomIndexMap.get(bond.from)!,
					to: atomIndexMap.get(bond.to)!,
				}));

			return {
				id: `mol-${moleculeIndex}`,
				baseId: `mol-${moleculeIndex}`,
				translation: [0, 0, 0] as [number, number, number],
				atoms: moleculeAtoms,
				bonds: moleculeBonds,
				centroid: centroid(moleculeAtoms.map((atom) => atom.position)),
			};
		})
		.filter((molecule) => molecule.atoms.length > 1);
}

function inferPeriodicBonds(atoms: Atom[], cell: [Vec3, Vec3, Vec3]): Bond[] {
	const unique = new Map<string, Bond>();
	const translations: Vec3[] = [];
	for (let a = -1; a <= 1; a += 1) {
		for (let b = -1; b <= 1; b += 1) {
			for (let c = -1; c <= 1; c += 1) {
				translations.push([a, b, c]);
			}
		}
	}

	for (let i = 0; i < atoms.length; i += 1) {
		for (let j = 0; j < atoms.length; j += 1) {
			for (const translation of translations) {
				if (
					i === j &&
					translation[0] === 0 &&
					translation[1] === 0 &&
					translation[2] === 0
				) {
					continue;
				}
				const threshold = bondThreshold(atoms[i].element, atoms[j].element);
				const shifted = translateByCell(atoms[j].position, cell, translation);
				const length = distance(atoms[i].position, shifted);
				if (length >= 0.35 && length <= threshold) {
					const from = Math.min(i, j);
					const to = Math.max(i, j);
					unique.set(`${from}-${to}`, { from, to });
				}
			}
		}
	}

	return Array.from(unique.values());
}

export function inferBonds(atoms: Atom[]): Bond[] {
	const bonds: Bond[] = [];

	for (let i = 0; i < atoms.length; i += 1) {
		for (let j = i + 1; j < atoms.length; j += 1) {
			const threshold = bondThreshold(atoms[i].element, atoms[j].element);
			const length = distance(atoms[i].position, atoms[j].position);
			if (length >= 0.35 && length <= threshold) {
				bonds.push({ from: i, to: j });
			}
		}
	}

	return bonds;
}

export function unwrapMoleculeAcrossPbc(
	atoms: Atom[],
	cell: [Vec3, Vec3, Vec3],
): Atom[] {
	if (atoms.length < 2) return atoms;

	const edges = inferPeriodicBondEdges(atoms, cell);
	const adjacency = Array.from(
		{ length: atoms.length },
		() => [] as Array<{ to: number; shift: Vec3 }>,
	);

	for (const edge of edges) {
		adjacency[edge.from].push({ to: edge.to, shift: edge.shift });
		adjacency[edge.to].push({
			to: edge.from,
			shift: [-edge.shift[0], -edge.shift[1], -edge.shift[2]],
		});
	}

	const offsets: Array<Vec3 | null> = Array.from(
		{ length: atoms.length },
		() => null,
	);
	for (let start = 0; start < atoms.length; start += 1) {
		if (offsets[start]) continue;
		offsets[start] = [0, 0, 0];
		const queue = [start];

		while (queue.length > 0) {
			const current = queue.shift()!;
			const currentOffset = offsets[current]!;
			for (const edge of adjacency[current]) {
				if (offsets[edge.to]) continue;
				offsets[edge.to] = [
					currentOffset[0] + edge.shift[0],
					currentOffset[1] + edge.shift[1],
					currentOffset[2] + edge.shift[2],
				];
				queue.push(edge.to);
			}
		}
	}

	return atoms.map((atom, index) => {
		const offset = offsets[index] ?? [0, 0, 0];
		return {
			...atom,
			fractional: [
				atom.fractional[0] + offset[0],
				atom.fractional[1] + offset[1],
				atom.fractional[2] + offset[2],
			],
			position: translateByCell(atom.position, cell, offset),
		};
	});
}

function inferPeriodicBondEdges(
	atoms: Atom[],
	cell: [Vec3, Vec3, Vec3],
): Array<Bond & { shift: Vec3 }> {
	const edges: Array<Bond & { shift: Vec3 }> = [];
	const translations = nearbyTranslations();

	for (let i = 0; i < atoms.length; i += 1) {
		for (let j = i + 1; j < atoms.length; j += 1) {
			const threshold = bondThreshold(atoms[i].element, atoms[j].element);
			let bestDistance = Number.POSITIVE_INFINITY;
			let bestShift: Vec3 = [0, 0, 0];

			for (const translation of translations) {
				const shifted = translateByCell(atoms[j].position, cell, translation);
				const length = distance(atoms[i].position, shifted);
				if (length < bestDistance) {
					bestDistance = length;
					bestShift = translation;
				}
			}

			if (bestDistance >= 0.35 && bestDistance <= threshold) {
				edges.push({ from: i, to: j, shift: bestShift });
			}
		}
	}

	return edges;
}

function bondThreshold(a: string, b: string): number {
	const radiusA = covalentRadii[a] ?? 0.77;
	const radiusB = covalentRadii[b] ?? 0.77;
	return (radiusA + radiusB) * 1.25 + 0.15;
}

function nearbyTranslations(): Vec3[] {
	const translations: Vec3[] = [];
	for (let a = -1; a <= 1; a += 1) {
		for (let b = -1; b <= 1; b += 1) {
			for (let c = -1; c <= 1; c += 1) {
				translations.push([a, b, c]);
			}
		}
	}
	return translations;
}

function connectedComponents(size: number, bonds: Bond[]): number[][] {
	const adjacency = Array.from({ length: size }, () => new Set<number>());
	for (const bond of bonds) {
		adjacency[bond.from].add(bond.to);
		adjacency[bond.to].add(bond.from);
	}

	const visited = new Set<number>();
	const components: number[][] = [];

	for (let start = 0; start < size; start += 1) {
		if (visited.has(start)) continue;
		const stack = [start];
		const component: number[] = [];
		visited.add(start);

		while (stack.length > 0) {
			const current = stack.pop()!;
			component.push(current);
			for (const next of adjacency[current]) {
				if (!visited.has(next)) {
					visited.add(next);
					stack.push(next);
				}
			}
		}

		components.push(component.sort((a, b) => a - b));
	}

	return components.sort((a, b) => b.length - a.length);
}
