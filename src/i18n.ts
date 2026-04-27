import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export const resources = {
	en: {
		translation: {
			app: {
				title: "tcal Dimer Extractor",
			},
			toolbar: {
				switchToDark: "Switch to dark mode",
				switchToLight: "Switch to light mode",
			},
			load: {
				title: "1. Load CIF",
				chooseFile: "Choose CIF",
				dropHint: "or drag and drop a CIF file here",
				currentFile: "Current file",
			},
			expansion: {
				title: "2. Cell Expansion",
				apply: "Apply",
			},
			display: {
				title: "3. Display",
				unitCell: "Unit cell",
				labels: "Labels",
				bonds: "Bonds",
			},
			viewer: {
				empty: "Load a CIF file to begin.",
				instructionBeforeCenter: "Click a ",
				centerTerm: "Center molecule",
				instructionBetween: ", then click ",
				dimerPairTerm: "Dimer pair",
				instructionAfterDimer: " molecules.",
				crystalAxes: "Crystal axes",
				reset: "Reset selection",
			},
			panel: {
				center: "Center Molecule",
				selected: "Selected Dimers",
				nearby: "Dimer Candidates",
				none: "None",
				noDimers: "No dimers selected",
				atoms: "atoms",
				distance: "distance",
				select: "Select",
				add: "Add",
			},
			export: {
				title: "Export",
				xyz: "Export XYZ",
				cifRecipe: "Export CIF + Recipe",
				zip: "Export ZIP",
				preview: "XYZ Preview",
				noPreview: "Select a center molecule and at least one neighbor.",
				status: {
					xyzSingle: "Downloaded {{name}}.",
					xyzZip: "Downloaded {{count}} XYZ files as a ZIP.",
					cifRecipe: "Downloaded CIF + recipe.",
					zip: "Downloaded ZIP with XYZ files and recipe.",
				},
			},
			metrics: {
				molecules: "molecules",
				atoms: "atoms",
			},
		},
	},
	ja: {
		translation: {
			app: {
				title: "tcal Dimer Extractor",
			},
			toolbar: {
				switchToDark: "ダークモードに切替",
				switchToLight: "ライトモードに切替",
			},
			load: {
				title: "1. CIF 読み込み",
				chooseFile: "CIFを選択",
				dropHint: "またはCIFファイルをここにドラッグ&ドロップ",
				currentFile: "読み込み中",
			},
			expansion: {
				title: "2. セル拡張",
				apply: "適用",
			},
			display: {
				title: "3. 表示",
				unitCell: "単位格子",
				labels: "ラベル",
				bonds: "結合",
			},
			viewer: {
				empty: "CIFファイルを読み込んでください。",
				instructionBeforeCenter: "",
				centerTerm: "Center molecule",
				instructionBetween: "をクリックして選び、",
				dimerPairTerm: "Dimer pair",
				instructionAfterDimer: "をクリックして追加します。",
				crystalAxes: "結晶軸",
				reset: "選択をリセット",
			},
			panel: {
				center: "中心分子",
				selected: "選択したダイマー",
				nearby: "ダイマー候補",
				none: "未選択",
				noDimers: "ダイマー未選択",
				atoms: "原子",
				distance: "距離",
				select: "選択",
				add: "追加",
			},
			export: {
				title: "出力",
				xyz: "XYZ出力",
				cifRecipe: "CIF + Recipe出力",
				zip: "ZIP出力",
				preview: "XYZプレビュー",
				noPreview: "中心分子と周辺分子を選択してください。",
				status: {
					xyzSingle: "{{name}} を出力しました。",
					xyzZip: "{{count}} 個のXYZをZIPで出力しました。",
					cifRecipe: "CIF + recipe を出力しました。",
					zip: "XYZとrecipeを含むZIPを出力しました。",
				},
			},
			metrics: {
				molecules: "分子",
				atoms: "原子",
			},
		},
	},
} as const;

i18n.use(initReactI18next).init({
	resources,
	lng: "en",
	fallbackLng: "en",
	interpolation: {
		escapeValue: false,
	},
});

export default i18n;
