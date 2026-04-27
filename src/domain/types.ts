export type Vec3 = [number, number, number];

export type CellRange = {
	aMin: number;
	aMax: number;
	bMin: number;
	bMax: number;
	cMin: number;
	cMax: number;
};

export type Atom = {
	id: string;
	element: string;
	position: Vec3;
	fractional: Vec3;
	sourceIndex: number;
	translation: Vec3;
};

export type Bond = {
	from: number;
	to: number;
};

export type CrystalStructure = {
	name: string;
	fileName: string;
	originalCif: string;
	cell: [Vec3, Vec3, Vec3];
	atoms: Atom[];
	rawAtomCount: number | null;
	preferredMoleculeAtomCount: number | null;
};

export type Molecule = {
	id: string;
	baseId: string;
	translation: Vec3;
	atoms: Atom[];
	bonds: Bond[];
	centroid: Vec3;
};

export type DimerLabel = {
	moleculeId: string;
	label: string;
};

export type DimerWorkspace = {
	crystal: CrystalStructure;
	cellRange: CellRange;
	molecules: Molecule[];
	centerId: string | null;
	selectedDimers: DimerLabel[];
};

export type ExportedDimer = {
	label: string;
	center: Molecule;
	neighbor: Molecule;
	xyz: string;
};

export type ShortContactSettings = {
	tolerance: number;
	maxContactsPerMoleculePair: number;
};

export type ShortContact = {
	id: string;
	visibleMoleculeId: string;
	hiddenMoleculeId: string;
	visibleAtomIndex: number;
	hiddenAtomIndex: number;
	visibleAtomElement: string;
	hiddenAtomElement: string;
	visiblePosition: Vec3;
	hiddenPosition: Vec3;
	distance: number;
	vdwSum: number;
	gap: number;
};
