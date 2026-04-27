import JSZip from "jszip";
import type { DimerLabel, ExportedDimer, Molecule } from "../domain/types";
import { distance } from "./vector";

export function buildExportedDimers(
	center: Molecule | undefined,
	molecules: Molecule[],
	labels: DimerLabel[],
): ExportedDimer[] {
	if (!center) return [];
	const byId = new Map(molecules.map((molecule) => [molecule.id, molecule]));
	return labels.flatMap((item) => {
		const neighbor = byId.get(item.moleculeId);
		if (!neighbor) return [];
		return [
			{
				label: item.label,
				center,
				neighbor,
				xyz: toDimerXyz(center, neighbor),
			},
		];
	});
}

export function toDimerXyz(center: Molecule, neighbor: Molecule): string {
	const atoms = [...center.atoms, ...neighbor.atoms];
	const lines = [
		String(atoms.length),
		`center_atoms=${center.atoms.length} neighbor_atoms=${neighbor.atoms.length}`,
		...atoms.map(
			(atom) =>
				`${atom.element} ${formatCoord(atom.position[0])} ${formatCoord(atom.position[1])} ${formatCoord(atom.position[2])}`,
		),
	];
	return `${lines.join("\n")}\n`;
}

export function dimerDistance(center: Molecule, neighbor: Molecule): number {
	return distance(center.centroid, neighbor.centroid);
}

export async function buildZip(
	files: { name: string; content: string }[],
): Promise<Blob> {
	const zip = new JSZip();
	for (const file of files) {
		zip.file(file.name, file.content);
	}
	return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function downloadText(
	name: string,
	content: string,
	mimeType = "text/plain",
): void {
	downloadBlob(name, new Blob([content], { type: mimeType }));
}

export function downloadBlob(name: string, blob: Blob): void {
	const href = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = href;
	link.download = name;
	link.style.display = "none";
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function slugify(value: string): string {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || "dimer";
}

function formatCoord(value: number): string {
	return value.toFixed(6);
}
