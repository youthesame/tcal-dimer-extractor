import type { DimerLabel } from "../domain/types";

const autoDimerLabelPattern = /^dimer_\d+$/;

export function nextDimerLabel(index: number): string {
	return `dimer_${index + 1}`;
}

export function normalizeAutoDimerLabels(dimers: DimerLabel[]): DimerLabel[] {
	return dimers.map((dimer, index) =>
		autoDimerLabelPattern.test(dimer.label)
			? { ...dimer, label: nextDimerLabel(index) }
			: dimer,
	);
}

export function reconcileSelectionWithMoleculeIds(
	centerId: string | null,
	selected: DimerLabel[],
	moleculeIds: ReadonlySet<string>,
): { centerId: string | null; selected: DimerLabel[] } {
	if (!centerId || !moleculeIds.has(centerId)) {
		return { centerId: null, selected: [] };
	}

	return {
		centerId,
		selected: normalizeAutoDimerLabels(
			selected.filter((item) => moleculeIds.has(item.moleculeId)),
		),
	};
}
