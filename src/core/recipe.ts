import { z } from "zod";
import type { CellRange, DimerLabel, Molecule } from "../domain/types";

const recipeBlockName = "data_tcal_dimer_extractor_recipe";

export const recipeSchema = z.object({
	schemaVersion: z.literal(1),
	sourceFileName: z.string(),
	sourceHash: z.string(),
	cellRange: z.object({
		aMin: z.number(),
		aMax: z.number(),
		bMin: z.number(),
		bMax: z.number(),
		cMin: z.number(),
		cMax: z.number(),
	}),
	centerMoleculeId: z.string(),
	centerAtomCount: z.number(),
	selectedDimers: z.array(
		z.object({
			moleculeId: z.string(),
			label: z.string(),
			atomCount: z.number(),
		}),
	),
	atomOrder: z.literal("center-first-neighbor-second"),
});

export type TcalRecipe = z.infer<typeof recipeSchema>;

export async function makeRecipe(input: {
	cifText: string;
	fileName: string;
	cellRange: CellRange;
	center: Molecule;
	selected: DimerLabel[];
	molecules: Molecule[];
}): Promise<TcalRecipe> {
	const moleculeMap = new Map(
		input.molecules.map((molecule) => [molecule.id, molecule]),
	);
	return {
		schemaVersion: 1,
		sourceFileName: input.fileName,
		sourceHash: await sha256(input.cifText),
		cellRange: input.cellRange,
		centerMoleculeId: input.center.id,
		centerAtomCount: input.center.atoms.length,
		selectedDimers: input.selected.map((item) => ({
			moleculeId: item.moleculeId,
			label: item.label,
			atomCount: moleculeMap.get(item.moleculeId)?.atoms.length ?? 0,
		})),
		atomOrder: "center-first-neighbor-second",
	};
}

export function appendRecipeToCif(cifText: string, recipe: TcalRecipe): string {
	const clean = stripRecipeFromCif(cifText).trimEnd();
	return `${clean}\n\n${recipeBlockName}\n_tcal_dimer_extractor_schema_version 1\n_tcal_dimer_extractor_recipe_json\n;\n${JSON.stringify(recipe, null, 2)}\n;\n`;
}

export function readRecipeFromCif(cifText: string): TcalRecipe | null {
	const marker = "_tcal_dimer_extractor_recipe_json";
	const markerIndex = cifText.indexOf(marker);
	if (markerIndex < 0) return null;
	const afterMarker = cifText.slice(markerIndex + marker.length);
	const match = afterMarker.match(/\n;\n([\s\S]*?)\n;/);
	if (!match) return null;
	const parsed = recipeSchema.safeParse(JSON.parse(match[1]));
	return parsed.success ? parsed.data : null;
}

function stripRecipeFromCif(cifText: string): string {
	const blockIndex = cifText.indexOf(recipeBlockName);
	return blockIndex < 0 ? cifText : cifText.slice(0, blockIndex);
}

async function sha256(text: string): Promise<string> {
	const bytes = new TextEncoder().encode(text);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
