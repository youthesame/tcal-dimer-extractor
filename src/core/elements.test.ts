import { describe, expect, it } from "vitest";
import {
	atomPickRadius,
	atomRenderRadius,
	covalentRadius,
	elementColor,
	hasElementData,
	vdwRadius,
} from "./elements";

const organicMoleculeElements = [
	"H",
	"D",
	"Li",
	"B",
	"C",
	"N",
	"O",
	"F",
	"Na",
	"Mg",
	"Al",
	"Si",
	"P",
	"S",
	"Cl",
	"K",
	"Ca",
	"Fe",
	"Ni",
	"Cu",
	"Zn",
	"As",
	"Se",
	"Br",
	"Pd",
	"Ag",
	"Sn",
	"Sb",
	"Te",
	"I",
	"Pt",
	"Au",
	"Hg",
	"Pb",
	"Bi",
];

describe("element properties", () => {
	it("covers common organic and molecular-crystal elements", () => {
		for (const element of organicMoleculeElements) {
			expect(hasElementData(element), element).toBe(true);
			expect(covalentRadius(element), element).toBeGreaterThan(0);
			expect(vdwRadius(element), element).toBeGreaterThan(0);
			expect(elementColor(element), element).not.toBe(0xa3a3a3);
			expect(atomRenderRadius(element), element).toBeGreaterThan(0);
			expect(atomPickRadius(element), element).toBeGreaterThan(
				atomRenderRadius(element),
			);
		}
	});

	it("keeps unknown elements usable with neutral fallback values", () => {
		expect(hasElementData("Xx")).toBe(false);
		expect(covalentRadius("Xx")).toBe(0.77);
		expect(vdwRadius("Xx")).toBe(1.7);
		expect(elementColor("Xx")).toBe(0xa3a3a3);
	});
});
