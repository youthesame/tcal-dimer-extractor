import { describe, expect, it } from "vitest";
import type { Molecule, Vec3 } from "../domain/types";
import { computeExternalShortContacts } from "./shortContacts";

describe("external short contacts", () => {
	it("finds atom pairs from visible molecules to hidden molecules within the vdW threshold", () => {
		const visible = [makeMolecule("mol-visible", [["C", [0, 0, 0]]])];
		const search = [
			...visible,
			makeMolecule("mol-hidden", [["O", [3.1, 0, 0]]]),
		];
		const contacts = computeExternalShortContacts(visible, search);

		expect(contacts).toHaveLength(1);
		expect(contacts[0]).toMatchObject({
			visibleMoleculeId: "mol-visible",
			hiddenMoleculeId: "mol-hidden",
			visibleAtomElement: "C",
			hiddenAtomElement: "O",
		});
		expect(contacts[0].gap).toBeCloseTo(-0.12);
	});

	it("uses tolerance to include near contacts outside the vdW threshold", () => {
		const visible = [makeMolecule("mol-visible", [["C", [0, 0, 0]]])];
		const search = [
			...visible,
			makeMolecule("mol-hidden", [["O", [3.3, 0, 0]]]),
		];

		expect(computeExternalShortContacts(visible, search)).toHaveLength(0);
		expect(
			computeExternalShortContacts(visible, search, {
				tolerance: 0.1,
				maxContactsPerMoleculePair: 4,
			}),
		).toHaveLength(1);
	});

	it("does not create contacts within a visible molecule", () => {
		const visible = [
			makeMolecule("mol-a", [
				["C", [0, 0, 0]],
				["O", [1.2, 0, 0]],
			]),
		];
		const contacts = computeExternalShortContacts(visible, visible);

		expect(contacts).toHaveLength(0);
	});

	it("does not create contacts between visible molecules", () => {
		const visible = [
			makeMolecule("mol-a", [["C", [0, 0, 0]]]),
			makeMolecule("mol-b", [["O", [3.1, 0, 0]]]),
		];

		expect(computeExternalShortContacts(visible, visible)).toHaveLength(0);
	});

	it("limits contacts per visible molecule pair and keeps shortest gaps first", () => {
		const visible = [
			makeMolecule("mol-visible", [
				["C", [0, 0, 0]],
				["C", [0, 1, 0]],
			]),
		];
		const search = [
			...visible,
			makeMolecule("mol-hidden", [
				["O", [3.0, 0, 0]],
				["O", [3.1, 1, 0]],
			]),
		];
		const contacts = computeExternalShortContacts(visible, search, {
			tolerance: 0,
			maxContactsPerMoleculePair: 1,
		});

		expect(contacts).toHaveLength(1);
		expect(contacts[0].distance).toBeCloseTo(3.0);
	});
});

function makeMolecule(
	id: string,
	atoms: Array<[element: string, position: Vec3]>,
): Molecule {
	return {
		id,
		baseId: id,
		translation: [0, 0, 0],
		atoms: atoms.map(([element, position], index) => ({
			id: `${id}-atom-${index}`,
			element,
			position,
			fractional: position,
			sourceIndex: index,
			translation: [0, 0, 0],
		})),
		bonds: [],
		centroid: [0, 0, 0],
	};
}
