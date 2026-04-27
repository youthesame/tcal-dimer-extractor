declare module "crystcif-parse" {
	export type CifAtoms = {
		length(): number;
		get_positions(): number[][];
		get_scaled_positions(): number[][];
		get_chemical_symbols(): string[];
		get_cell(): number[][];
	};

	export function parseCifStructures(cifText: string): Record<string, CifAtoms>;
	export function parseCif(cifText: string): Record<string, unknown>;
}
