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
