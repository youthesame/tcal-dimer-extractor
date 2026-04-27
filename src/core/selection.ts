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

export function updateSelectionFromMoleculeClick(
	centerId: string | null,
	selected: DimerLabel[],
	moleculeId: string,
): { centerId: string | null; selected: DimerLabel[] } {
	if (!centerId) {
		return {
			centerId: moleculeId,
			selected: normalizeAutoDimerLabels(
				selected.filter((item) => item.moleculeId !== moleculeId),
			),
		};
	}

	if (moleculeId === centerId) {
		return { centerId: null, selected };
	}

	if (selected.some((item) => item.moleculeId === moleculeId)) {
		return {
			centerId,
			selected: normalizeAutoDimerLabels(
				selected.filter((item) => item.moleculeId !== moleculeId),
			),
		};
	}

	return {
		centerId,
		selected: normalizeAutoDimerLabels([
			...selected,
			{
				moleculeId,
				label: nextDimerLabel(selected.length),
			},
		]),
	};
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
