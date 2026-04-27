import type {
	Molecule,
	ShortContact,
	ShortContactSettings,
} from "../domain/types";
import { vdwRadius } from "./elements";
import { distance } from "./vector";

const minimumContactDistance = 0.35;

export const defaultShortContactSettings: ShortContactSettings = {
	tolerance: 0,
	maxContactsPerMoleculePair: 4,
};

export function computeExternalShortContacts(
	visibleMolecules: Molecule[],
	searchMolecules: Molecule[],
	settings: ShortContactSettings = defaultShortContactSettings,
): ShortContact[] {
	const contacts: ShortContact[] = [];
	const tolerance = Math.max(settings.tolerance, 0);
	const maxPerPair = Math.max(
		1,
		Math.floor(settings.maxContactsPerMoleculePair),
	);
	const visibleIds = new Set(visibleMolecules.map((molecule) => molecule.id));
	const hiddenMolecules = searchMolecules.filter(
		(molecule) => !visibleIds.has(molecule.id),
	);

	for (const visibleMolecule of visibleMolecules) {
		for (const hiddenMolecule of hiddenMolecules) {
			const pairContacts = computeMoleculePairContacts(
				visibleMolecule,
				hiddenMolecule,
				tolerance,
			);
			contacts.push(...pairContacts.slice(0, maxPerPair));
		}
	}

	return contacts.sort((a, b) => a.gap - b.gap || a.distance - b.distance);
}

function computeMoleculePairContacts(
	visibleMolecule: Molecule,
	hiddenMolecule: Molecule,
	tolerance: number,
): ShortContact[] {
	const contacts: ShortContact[] = [];

	for (
		let visibleAtomIndex = 0;
		visibleAtomIndex < visibleMolecule.atoms.length;
		visibleAtomIndex += 1
	) {
		for (
			let hiddenAtomIndex = 0;
			hiddenAtomIndex < hiddenMolecule.atoms.length;
			hiddenAtomIndex += 1
		) {
			const visibleAtom = visibleMolecule.atoms[visibleAtomIndex];
			const hiddenAtom = hiddenMolecule.atoms[hiddenAtomIndex];
			const contactDistance = distance(
				visibleAtom.position,
				hiddenAtom.position,
			);
			if (contactDistance < minimumContactDistance) continue;

			const vdwSum =
				vdwRadius(visibleAtom.element) + vdwRadius(hiddenAtom.element);
			if (contactDistance > vdwSum + tolerance) continue;

			contacts.push({
				id: `${visibleMolecule.id}:${visibleAtomIndex}-${hiddenMolecule.id}:${hiddenAtomIndex}`,
				visibleMoleculeId: visibleMolecule.id,
				hiddenMoleculeId: hiddenMolecule.id,
				visibleAtomIndex,
				hiddenAtomIndex,
				visibleAtomElement: visibleAtom.element,
				hiddenAtomElement: hiddenAtom.element,
				visiblePosition: visibleAtom.position,
				hiddenPosition: hiddenAtom.position,
				distance: contactDistance,
				vdwSum,
				gap: contactDistance - vdwSum,
			});
		}
	}

	return contacts.sort((a, b) => a.gap - b.gap || a.distance - b.distance);
}
