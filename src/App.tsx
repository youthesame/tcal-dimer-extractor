import {
	Box,
	Download,
	FileArchive,
	FileCode2,
	FileUp,
	Languages,
	Moon,
	RotateCcw,
	Sun,
	Trash2,
} from "lucide-react";
import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoleculeViewer } from "./components/MoleculeViewer";
import {
	buildMolecules,
	normalizeDisorderSelection,
	parseCrystalFromCif,
	resolveDisorderCrystal,
} from "./core/cif";
import {
	buildExportedDimers,
	buildZip,
	dimerDistance,
	downloadBlob,
	downloadText,
	slugify,
} from "./core/export";
import {
	appendRecipeToCif,
	makeRecipe,
	readRecipeFromCif,
} from "./core/recipe";
import {
	normalizeAutoDimerLabels,
	reconcileSelectionWithMoleculeIds,
	updateSelectionFromMoleculeClick,
} from "./core/selection";
import {
	computeExternalShortContacts,
	defaultShortContactSettings,
} from "./core/shortContacts";
import { centroid, formatDistance } from "./core/vector";
import type {
	CellRange,
	CrystalStructure,
	DimerLabel,
	DisorderSelection,
	DisorderSummary,
	Molecule,
} from "./domain/types";

const defaultRange: CellRange = {
	aMin: 0,
	aMax: 1,
	bMin: 0,
	bMax: 1,
	cMin: 0,
	cMax: 1,
};

function App() {
	const { t, i18n } = useTranslation();
	const [theme, setTheme] = useState<"dark" | "light">("dark");
	const [crystal, setCrystal] = useState<CrystalStructure | null>(null);
	const [range, setRange] = useState<CellRange>(defaultRange);
	const [display, setDisplay] = useState({
		unitCell: true,
		labels: true,
		bonds: true,
		shortContacts: false,
	});
	const [shortContactTolerance, setShortContactTolerance] = useState(
		defaultShortContactSettings.tolerance,
	);
	const [disorderSelection, setDisorderSelection] = useState<DisorderSelection>(
		{},
	);
	const [centerId, setCenterId] = useState<string | null>(null);
	const [selected, setSelected] = useState<DimerLabel[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [exportStatus, setExportStatus] = useState<string | null>(null);
	const [isDraggingCif, setIsDraggingCif] = useState(false);

	const activeCrystal = useMemo(
		() =>
			crystal ? resolveDisorderCrystal(crystal, disorderSelection) : null,
		[crystal, disorderSelection],
	);
	const molecules = useMemo(
		() => (activeCrystal ? buildMolecules(activeCrystal, range) : []),
		[activeCrystal, range],
	);
	const moleculeMap = useMemo(
		() => new Map(molecules.map((molecule) => [molecule.id, molecule])),
		[molecules],
	);
	const center = centerId ? moleculeMap.get(centerId) : undefined;
	const shortContacts = useMemo(
		() =>
			crystal && display.shortContacts
				? computeExternalShortContacts(
						molecules,
						buildMolecules(
							activeCrystal ?? crystal,
							shortContactSearchRange(range),
						),
						{
							tolerance: shortContactTolerance,
							maxContactsPerMoleculePair:
								defaultShortContactSettings.maxContactsPerMoleculePair,
						},
					)
				: [],
		[
			activeCrystal,
			crystal,
			display.shortContacts,
			molecules,
			range,
			shortContactTolerance,
		],
	);
	const exportedDimers = useMemo(
		() => buildExportedDimers(center, molecules, selected),
		[center, molecules, selected],
	);
	const preview = exportedDimers[0]?.xyz ?? "";

	function loadCif(cifText: string, fileName: string) {
		try {
			const parsed = parseCrystalFromCif(cifText, fileName);
			const recipe = readRecipeFromCif(cifText);
			const nextDisorderSelection = normalizeDisorderSelection(
				parsed.disorderSummary,
				recipe?.disorderSelection,
			);
			const nextCrystal = resolveDisorderCrystal(
				parsed,
				nextDisorderSelection,
			);
			setCrystal(parsed);
			setDisorderSelection(nextDisorderSelection);
			setRange(recipe?.cellRange ?? defaultRange);
			const nextMolecules = buildMolecules(
				nextCrystal,
				recipe?.cellRange ?? defaultRange,
			);
			const ids = new Set(nextMolecules.map((molecule) => molecule.id));
			const restoredSelection = recipe
				? reconcileSelectionWithMoleculeIds(
						recipe.centerMoleculeId,
						recipe.selectedDimers,
						ids,
					)
				: { centerId: null, selected: [] };
			setCenterId(restoredSelection.centerId);
			setSelected(restoredSelection.selected);
			setError(null);
			setExportStatus(null);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Failed to load CIF.",
			);
		}
	}

	async function handleFile(file: File | undefined) {
		if (!file) return;
		loadCif(await file.text(), file.name);
	}

	function handleDragOver(event: DragEvent<HTMLLabelElement>) {
		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
		setIsDraggingCif(true);
	}

	function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
		if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
			setIsDraggingCif(false);
		}
	}

	function handleDrop(event: DragEvent<HTMLLabelElement>) {
		event.preventDefault();
		setIsDraggingCif(false);
		const file = Array.from(event.dataTransfer.files).find((item) =>
			item.name.toLowerCase().endsWith(".cif"),
		);
		void handleFile(file);
	}

	function handleMoleculeClick(moleculeId: string) {
		setExportStatus(null);
		const nextSelection = updateSelectionFromMoleculeClick(
			centerId,
			selected,
			moleculeId,
		);
		setCenterId(nextSelection.centerId);
		setSelected(nextSelection.selected);
	}

	function revealHiddenMolecule(moleculeId: string) {
		if (!activeCrystal) return;
		const molecule = buildMolecules(
			activeCrystal,
			shortContactSearchRange(range),
		).find((item) => item.id === moleculeId);
		if (!molecule) return;
		setRange(rangeIncludingMolecule(range, molecule));
		setExportStatus(null);
	}

	function updateRange(key: keyof CellRange, value: number) {
		applyRange({ ...range, [key]: value });
	}

	function resetRange() {
		setRange(defaultRange);
		setCenterId(null);
		setSelected([]);
		setExportStatus(null);
	}

	function applyRange(nextRange: CellRange) {
		setRange(nextRange);
		setExportStatus(null);
		if (!activeCrystal) return;

		const ids = new Set(
			buildMolecules(activeCrystal, nextRange).map((molecule) => molecule.id),
		);
		const reconciled = reconcileSelectionWithMoleculeIds(
			centerId,
			selected,
			ids,
		);
		setCenterId(reconciled.centerId);
		setSelected(reconciled.selected);
	}

	function updateDisorderGroup(assembly: string, group: string) {
		if (!crystal) return;
		const nextSelection = { ...disorderSelection, [assembly]: group };
		const nextCrystal = resolveDisorderCrystal(crystal, nextSelection);
		const ids = new Set(
			buildMolecules(nextCrystal, range).map((molecule) => molecule.id),
		);
		const reconciled = reconcileSelectionWithMoleculeIds(
			centerId,
			selected,
			ids,
		);
		setDisorderSelection(nextSelection);
		setCenterId(reconciled.centerId);
		setSelected(reconciled.selected);
		setExportStatus(null);
	}

	function updateLabel(moleculeId: string, label: string) {
		setSelected((current) =>
			current.map((item) =>
				item.moleculeId === moleculeId ? { ...item, label } : item,
			),
		);
	}

	async function exportCifWithRecipe() {
		if (!crystal || !center) return;
		const recipe = await makeRecipe({
			cifText: crystal.originalCif,
			fileName: crystal.fileName,
			cellRange: range,
			center,
			selected,
			molecules,
			disorderSelection,
			disorderSummary: crystal.disorderSummary,
		});
		downloadText(
			`${withoutExtension(crystal.fileName)}_tcal_recipe.cif`,
			appendRecipeToCif(crystal.originalCif, recipe),
			"chemical/x-cif",
		);
		setExportStatus(t("export.status.cifRecipe"));
	}

	async function exportXyz() {
		if (!crystal || exportedDimers.length === 0) return;
		if (exportedDimers.length === 1) {
			const [dimer] = exportedDimers;
			downloadText(`${slugify(dimer.label)}.xyz`, dimer.xyz, "chemical/x-xyz");
			setExportStatus(
				t("export.status.xyzSingle", { name: `${slugify(dimer.label)}.xyz` }),
			);
			return;
		}
		const files = exportedDimers.map((dimer) => ({
			name: `${slugify(dimer.label)}.xyz`,
			content: dimer.xyz,
		}));
		downloadBlob(
			`${withoutExtension(crystal.fileName)}_xyz.zip`,
			await buildZip(files),
		);
		setExportStatus(
			t("export.status.xyzZip", { count: exportedDimers.length }),
		);
	}

	async function exportZip() {
		if (!crystal || !center) return;
		const recipe = await makeRecipe({
			cifText: crystal.originalCif,
			fileName: crystal.fileName,
			cellRange: range,
			center,
			selected,
			molecules,
			disorderSelection,
			disorderSummary: crystal.disorderSummary,
		});
		const files = [
			...exportedDimers.map((dimer) => ({
				name: `${slugify(dimer.label)}.xyz`,
				content: dimer.xyz,
			})),
			{
				name: `${withoutExtension(crystal.fileName)}_tcal_recipe.cif`,
				content: appendRecipeToCif(crystal.originalCif, recipe),
			},
		];
		downloadBlob(
			`${withoutExtension(crystal.fileName)}_tcal_dimers.zip`,
			await buildZip(files),
		);
		setExportStatus(t("export.status.zip", { count: exportedDimers.length }));
	}

	return (
		<div className="app" data-theme={theme}>
			<header className="topbar">
				<div className="brand">
					<Box aria-hidden="true" size={22} />
					<div>
						<h1>{t("app.title")}</h1>
						<p>{crystal?.fileName ?? "No CIF loaded"}</p>
					</div>
				</div>
				<div className="topbar-actions">
					<button
						className="segmented"
						type="button"
						onClick={() =>
							i18n.changeLanguage(i18n.language === "en" ? "ja" : "en")
						}
					>
						<Languages aria-hidden="true" size={16} />
						<span className={i18n.language === "en" ? "active" : ""}>EN</span>
						<span className={i18n.language === "ja" ? "active" : ""}>JA</span>
					</button>
					<button
						aria-label={
							theme === "dark"
								? t("toolbar.switchToLight")
								: t("toolbar.switchToDark")
						}
						className="icon-button icon-only"
						title={
							theme === "dark"
								? t("toolbar.switchToLight")
								: t("toolbar.switchToDark")
						}
						type="button"
						onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
					>
						{theme === "dark" ? (
							<Sun aria-hidden="true" size={18} />
						) : (
							<Moon aria-hidden="true" size={18} />
						)}
					</button>
				</div>
			</header>

			<main className="workbench">
				<aside className="sidebar left-panel">
					<section>
						<h2>{t("load.title")}</h2>
						<label
							className={`file-picker drop-zone${isDraggingCif ? " dragging" : ""}`}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
						>
							<FileUp aria-hidden="true" size={16} />
							<span>{t("load.chooseFile")}</span>
							<small>{t("load.dropHint")}</small>
							<input
								accept=".cif"
								type="file"
								onChange={(event) =>
									void handleFile(event.currentTarget.files?.[0])
								}
							/>
						</label>
						{error ? <p className="error">{error}</p> : null}
						<p className="meta-line">
							{t("load.currentFile")}: {crystal?.name ?? "-"}
						</p>
					</section>

					{crystal?.disorderSummary.hasDisorder ? (
						<DisorderSelector
							selection={disorderSelection}
							summary={crystal.disorderSummary}
							onChange={updateDisorderGroup}
						/>
					) : null}

					<section>
						<div className="section-heading">
							<h2>{t("expansion.title")}</h2>
							<button
								className="secondary-button"
								type="button"
								onClick={resetRange}
							>
								<RotateCcw aria-hidden="true" size={14} />
								{t("expansion.reset")}
							</button>
						</div>
						<RangeRow
							axis="a"
							minKey="aMin"
							maxKey="aMax"
							range={range}
							onChange={updateRange}
						/>
						<RangeRow
							axis="b"
							minKey="bMin"
							maxKey="bMax"
							range={range}
							onChange={updateRange}
						/>
						<RangeRow
							axis="c"
							minKey="cMin"
							maxKey="cMax"
							range={range}
							onChange={updateRange}
						/>
					</section>

					<section>
						<h2>{t("display.title")}</h2>
						<Toggle
							label={t("display.unitCell")}
							checked={display.unitCell}
							onChange={(checked) =>
								setDisplay((current) => ({ ...current, unitCell: checked }))
							}
						/>
						<Toggle
							label={t("display.labels")}
							checked={display.labels}
							onChange={(checked) =>
								setDisplay((current) => ({ ...current, labels: checked }))
							}
						/>
						<Toggle
							label={t("display.bonds")}
							checked={display.bonds}
							onChange={(checked) =>
								setDisplay((current) => ({ ...current, bonds: checked }))
							}
						/>
						<Toggle
							label={t("display.shortContacts")}
							checked={display.shortContacts}
							onChange={(checked) =>
								setDisplay((current) => ({
									...current,
									shortContacts: checked,
								}))
							}
						/>
						{display.shortContacts ? (
							<label className="setting-row">
								<span>{t("display.shortContactTolerance")}</span>
								<input
									aria-label={t("display.shortContactTolerance")}
									min={0}
									step={0.05}
									type="number"
									value={shortContactTolerance}
									onChange={(event) =>
										setShortContactTolerance(
											Math.max(0, Number(event.currentTarget.value)),
										)
									}
								/>
							</label>
						) : null}
					</section>
				</aside>

				<section className="viewer-shell">
					<div className="viewer-caption">
						{crystal ? <ViewerInstruction /> : <p>{t("viewer.empty")}</p>}
					</div>
					<div className="axis-legend" aria-label={t("viewer.crystalAxes")}>
						<strong>{t("viewer.crystalAxes")}</strong>
						<span>
							<i className="axis-chip axis-a" />a
						</span>
						<span>
							<i className="axis-chip axis-b" />b
						</span>
						<span>
							<i className="axis-chip axis-c" />c
						</span>
					</div>
					<MoleculeViewer
						cell={activeCrystal?.cell}
						molecules={molecules}
						centerId={centerId}
						selectedIds={selected.map((item) => item.moleculeId)}
						showBonds={display.bonds}
						showLabels={display.labels}
						showShortContacts={display.shortContacts}
						showUnitCell={display.unitCell}
						shortContacts={shortContacts}
						viewKey={`${crystal?.fileName ?? ""}:${JSON.stringify(disorderSelection)}`}
						onHiddenMoleculeClick={revealHiddenMolecule}
						onMoleculeClick={handleMoleculeClick}
					/>
					<button
						className="reset-button"
						type="button"
						onClick={() => {
							setCenterId(null);
							setSelected([]);
						}}
					>
						<RotateCcw aria-hidden="true" size={16} />
						{t("viewer.reset")}
					</button>
				</section>

				<aside className="sidebar right-panel">
					<section>
						<h2>{t("panel.center")}</h2>
						{center ? (
							<MoleculeSummary molecule={center} />
						) : (
							<p className="empty-state">{t("panel.none")}</p>
						)}
					</section>

					<section className="selected-list">
						<h2>{t("panel.selected")}</h2>
						{selected.length === 0 ? (
							<p className="empty-state">{t("panel.noDimers")}</p>
						) : null}
						{selected.map((item, index) => {
							const molecule = moleculeMap.get(item.moleculeId);
							if (!molecule || !center) return null;
							return (
								<div className="dimer-row" key={item.moleculeId}>
									<span className="dimer-number">#{index + 1}</span>
									<input
										value={item.label}
										onChange={(event) =>
											updateLabel(item.moleculeId, event.currentTarget.value)
										}
									/>
									<span>
										{formatDistance(dimerDistance(center, molecule))} Å
									</span>
									<button
										type="button"
										aria-label="Remove dimer"
										onClick={() =>
											setSelected((current) =>
												normalizeAutoDimerLabels(
													current.filter(
														(dimer) => dimer.moleculeId !== item.moleculeId,
													),
												),
											)
										}
									>
										<Trash2 aria-hidden="true" size={15} />
									</button>
								</div>
							);
						})}
					</section>

					<section>
						<h2>{t("export.title")}</h2>
						<div className="export-buttons">
							<button
								type="button"
								disabled={exportedDimers.length === 0}
								onClick={() => void exportXyz()}
							>
								<Download aria-hidden="true" size={16} />
								{t("export.xyz")}
							</button>
							<button
								type="button"
								disabled={!center}
								onClick={() => void exportCifWithRecipe()}
							>
								<FileCode2 aria-hidden="true" size={16} />
								{t("export.cifRecipe")}
							</button>
							<button
								type="button"
								disabled={exportedDimers.length === 0}
								onClick={() => void exportZip()}
							>
								<FileArchive aria-hidden="true" size={16} />
								{t("export.zip")}
							</button>
						</div>
						{exportStatus ? (
							<p className="export-status">{exportStatus}</p>
						) : null}
						<h3>{t("export.preview")}</h3>
						<pre className="xyz-preview">
							{preview || t("export.noPreview")}
						</pre>
					</section>
				</aside>
			</main>
		</div>
	);
}

function ViewerInstruction() {
	const { t } = useTranslation();
	return (
		<p className="viewer-instruction">
			{t("viewer.instructionBeforeCenter")}
			<span className="instruction-center">{t("viewer.centerTerm")}</span>
			{t("viewer.instructionBetween")}
			<span className="instruction-dimer">{t("viewer.dimerPairTerm")}</span>
			{t("viewer.instructionAfterDimer")}
		</p>
	);
}

function RangeRow(props: {
	axis: "a" | "b" | "c";
	minKey: keyof CellRange;
	maxKey: keyof CellRange;
	range: CellRange;
	onChange: (key: keyof CellRange, value: number) => void;
}) {
	return (
		<div className="range-row">
			<span>{props.axis}</span>
			<input
				aria-label={`${props.axis} min`}
				min={-3}
				step={0.1}
				type="number"
				value={props.range[props.minKey]}
				onChange={(event) =>
					props.onChange(props.minKey, Number(event.currentTarget.value))
				}
			/>
			<input
				aria-label={`${props.axis} max`}
				max={3}
				step={0.1}
				type="number"
				value={props.range[props.maxKey]}
				onChange={(event) =>
					props.onChange(props.maxKey, Number(event.currentTarget.value))
				}
			/>
		</div>
	);
}

function Toggle(props: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="toggle">
			<input
				type="checkbox"
				checked={props.checked}
				onChange={(event) => props.onChange(event.currentTarget.checked)}
			/>
			<span>{props.label}</span>
		</label>
	);
}

function DisorderSelector(props: {
	summary: DisorderSummary;
	selection: DisorderSelection;
	onChange: (assembly: string, group: string) => void;
}) {
	const { t } = useTranslation();
	return (
		<section>
			<h2>{t("disorder.title")}</h2>
			<p className="meta-line">{t("disorder.description")}</p>
			<div className="disorder-list">
				{props.summary.assemblies.map((assembly) => (
					<div className="disorder-assembly" key={assembly.assembly}>
						<div className="disorder-heading">
							<strong>
								{t("disorder.assembly", { assembly: assembly.assembly })}
							</strong>
							<span>
								{t("disorder.major", { group: assembly.majorGroup })}
							</span>
						</div>
						<div className="disorder-groups">
							{assembly.groups.map((group) => {
								const selected =
									props.selection[assembly.assembly] === group.group;
								return (
									<button
										className={selected ? "selected" : ""}
										key={group.group}
										type="button"
										onClick={() =>
											props.onChange(assembly.assembly, group.group)
										}
									>
										<span>
											{t("disorder.group", { group: group.group })}
										</span>
										<small>
											{formatOccupancy(group.occupancy)} / {group.atomCount}{" "}
											{t("metrics.atoms")}
										</small>
									</button>
								);
							})}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}

function formatOccupancy(occupancy: number | null): string {
	return occupancy === null ? "occ -" : `occ ${occupancy.toFixed(3)}`;
}

function shortContactSearchRange(range: CellRange): CellRange {
	return {
		aMin: Math.floor(range.aMin) - 1,
		aMax: Math.ceil(range.aMax) + 1,
		bMin: Math.floor(range.bMin) - 1,
		bMax: Math.ceil(range.bMax) + 1,
		cMin: Math.floor(range.cMin) - 1,
		cMax: Math.ceil(range.cMax) + 1,
	};
}

function rangeIncludingMolecule(range: CellRange, molecule: Molecule): CellRange {
	const fractional = centroid(molecule.atoms.map((atom) => atom.fractional));
	return {
		aMin: Math.min(range.aMin, Math.floor(fractional[0])),
		aMax: Math.max(range.aMax, Math.floor(fractional[0]) + 1),
		bMin: Math.min(range.bMin, Math.floor(fractional[1])),
		bMax: Math.max(range.bMax, Math.floor(fractional[1]) + 1),
		cMin: Math.min(range.cMin, Math.floor(fractional[2])),
		cMax: Math.max(range.cMax, Math.floor(fractional[2]) + 1),
	};
}

function MoleculeSummary({ molecule }: { molecule: Molecule }) {
	const fractionalCenter = molecule.atoms
		.reduce<[number, number, number]>(
			(sum, atom) => [
				sum[0] + atom.fractional[0],
				sum[1] + atom.fractional[1],
				sum[2] + atom.fractional[2],
			],
			[0, 0, 0],
		)
		.map((value) => wrapUnit(value / molecule.atoms.length));
	const cell = fractionalCenter.map(formatCellValue).join(", ");
	return (
		<div className="molecule-summary">
			<strong>{molecule.id}</strong>
			<span>{molecule.atoms.length} atoms</span>
			<span>cell [{cell}]</span>
		</div>
	);
}

function formatCellValue(value: number): string {
	return (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);
}

function wrapUnit(value: number): number {
	const wrapped = ((value % 1) + 1) % 1;
	return wrapped > 0.995 || wrapped < 0.005 ? 0 : wrapped;
}

function withoutExtension(fileName: string): string {
	return fileName.replace(/\.[^.]+$/, "");
}

export default App;
