import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Molecule, Vec3 } from "../domain/types";

const elementColors: Record<string, number> = {
	H: 0xd8dee9,
	C: 0x9aa7b2,
	N: 0x5aa9ff,
	O: 0xff6b6b,
	S: 0xffc857,
	F: 0x8bd66f,
	Cl: 0x8bd66f,
	Br: 0xb7794a,
	I: 0x8d6cc9,
};

const clickMoveTolerancePx = 4;

export function MoleculeViewer(props: {
	cell?: [Vec3, Vec3, Vec3];
	molecules: Molecule[];
	centerId: string | null;
	selectedIds: string[];
	showBonds: boolean;
	showLabels: boolean;
	showUnitCell: boolean;
	viewKey?: string;
	onMoleculeClick: (moleculeId: string) => void;
}) {
	const mountRef = useRef<HTMLDivElement | null>(null);
	const clickHandlerRef = useRef(props.onMoleculeClick);
	const viewStateRef = useRef<{
		key?: string;
		position: THREE.Vector3;
		target: THREE.Vector3;
	} | null>(null);
	clickHandlerRef.current = props.onMoleculeClick;

	useEffect(() => {
		const mount = mountRef.current;
		if (!mount) return;
		const container = mount;

		container.replaceChildren();

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(getCssColor("--viewer-bg"));

		const camera = new THREE.PerspectiveCamera(
			45,
			container.clientWidth / container.clientHeight,
			0.1,
			3000,
		);
		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(container.clientWidth, container.clientHeight, false);
		container.appendChild(renderer.domElement);

		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = false;

		const ambient = new THREE.AmbientLight(0xffffff, 1.7);
		scene.add(ambient);
		const keyLight = new THREE.DirectionalLight(0xffffff, 2.3);
		keyLight.position.set(30, 40, 60);
		scene.add(keyLight);

		const clickable: THREE.Object3D[] = [];
		const pickMaterial = new THREE.MeshBasicMaterial({
			transparent: true,
			opacity: 0,
			depthWrite: false,
		});
		const selectedIndexById = new Map(
			props.selectedIds.map((id, index) => [id, index + 1]),
		);
		const moleculeById = new Map(
			props.molecules.map((molecule) => [molecule.id, molecule]),
		);
		const bounds = new THREE.Box3();
		let hasBounds = false;

		for (const molecule of props.molecules) {
			const selectedNumber = selectedIndexById.get(molecule.id);
			const role =
				molecule.id === props.centerId
					? "center"
					: selectedNumber
						? "selected"
						: "idle";
			const group = new THREE.Group();
			group.userData.moleculeId = molecule.id;

			for (const atom of molecule.atoms) {
				const material = new THREE.MeshPhongMaterial({
					color: roleColor(role, atom.element),
					emissive:
						role === "center"
							? 0x0e7490
							: role === "selected"
								? 0x92400e
								: 0x000000,
					emissiveIntensity: role === "idle" ? 0 : 0.55,
					shininess: role === "idle" ? 24 : 48,
				});
				const sphere = new THREE.Mesh(
					new THREE.SphereGeometry(atomRadius(atom.element, role), 16, 12),
					material,
				);
				sphere.position.set(
					atom.position[0],
					atom.position[1],
					atom.position[2],
				);
				sphere.userData.moleculeId = molecule.id;
				sphere.userData.pickKind = "atom";
				group.add(sphere);
				clickable.push(sphere);
				const pickSphere = new THREE.Mesh(
					new THREE.SphereGeometry(atomPickRadius(atom.element), 12, 8),
					pickMaterial,
				);
				pickSphere.position.copy(sphere.position);
				pickSphere.userData.moleculeId = molecule.id;
				pickSphere.userData.pickKind = "atom";
				group.add(pickSphere);
				clickable.push(pickSphere);
				bounds.expandByPoint(sphere.position);
				hasBounds = true;
			}

			const moleculePickSphere = new THREE.Mesh(
				new THREE.SphereGeometry(moleculePickRadius(molecule), 18, 12),
				pickMaterial,
			);
			moleculePickSphere.position.set(
				molecule.centroid[0],
				molecule.centroid[1],
				molecule.centroid[2],
			);
			moleculePickSphere.userData.moleculeId = molecule.id;
			moleculePickSphere.userData.pickKind = "molecule";
			group.add(moleculePickSphere);
			clickable.push(moleculePickSphere);

			if (props.showBonds) {
				for (const bond of molecule.bonds) {
					const from = molecule.atoms[bond.from]?.position;
					const to = molecule.atoms[bond.to]?.position;
					if (!from || !to) continue;
					const cylinder = makeBond(
						from,
						to,
						role === "idle"
							? 0x4b5563
							: role === "center"
								? 0x67e8f9
								: 0xfbbf24,
						role === "idle" ? 0.045 : 0.12,
					);
					cylinder.userData.moleculeId = molecule.id;
					cylinder.userData.pickKind = "bond";
					group.add(cylinder);
					clickable.push(cylinder);
				}
			}

			if (props.showLabels && role !== "idle") {
				const label = makeLabel(
					role === "center" ? "CENTER" : `DIMER #${selectedNumber}`,
					role,
				);
				label.position.set(
					molecule.centroid[0],
					molecule.centroid[1] + 1.8,
					molecule.centroid[2],
				);
				group.add(label);
			}

			scene.add(group);
		}

		if (props.cell && props.showUnitCell) {
			scene.add(makeUnitCell(props.cell));
			scene.add(makeCrystalAxes(props.cell));
		}

		const center = new THREE.Vector3();
		const size = new THREE.Vector3();
		if (hasBounds) {
			bounds.getCenter(center);
			bounds.getSize(size);
		}
		const maxSize = Math.max(size.x, size.y, size.z, 10);
		camera.near = 0.1;
		camera.far = maxSize * 20;
		const savedView = viewStateRef.current;
		if (savedView && savedView.key === props.viewKey) {
			camera.position.copy(savedView.position);
			controls.target.copy(savedView.target);
			camera.lookAt(controls.target);
		} else {
			camera.position.set(
				center.x + maxSize * 1.1,
				center.y + maxSize * 0.85,
				center.z + maxSize * 1.25,
			);
			controls.target.copy(center);
			camera.lookAt(center);
		}
		camera.updateProjectionMatrix();
		controls.update();

		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2();
		let pointerDownHit: { moleculeId: string; x: number; y: number } | null =
			null;

		function onPointerDown(event: PointerEvent) {
			if (event.button !== 0) return;
			const moleculeId = pickMoleculeIdAt(event);
			pointerDownHit = moleculeId
				? { moleculeId, x: event.clientX, y: event.clientY }
				: null;
		}

		function onPointerUp(event: PointerEvent) {
			if (event.button !== 0 || !pointerDownHit) {
				pointerDownHit = null;
				return;
			}
			const moved = Math.hypot(
				event.clientX - pointerDownHit.x,
				event.clientY - pointerDownHit.y,
			);
			const moleculeId =
				moved <= clickMoveTolerancePx ? pickMoleculeIdAt(event) : undefined;
			if (moleculeId && moleculeId === pointerDownHit.moleculeId) {
				clickHandlerRef.current(moleculeId);
			}
			pointerDownHit = null;
		}

		function onPointerCancel() {
			pointerDownHit = null;
		}

		function pickMoleculeIdAt(event: PointerEvent): string | undefined {
			const rect = renderer.domElement.getBoundingClientRect();
			pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
			raycaster.setFromCamera(pointer, camera);
			const hits = raycaster.intersectObjects(clickable, false);
			const hit = props.centerId ? pickNeighborHit(hits) : pickCenterHit(hits);
			return hit?.object.userData.moleculeId as string | undefined;
		}

		function pickCenterHit(
			hits: THREE.Intersection[],
		): THREE.Intersection | undefined {
			return (
				hits.find((item) => item.object.userData.pickKind !== "molecule") ??
				hits[0]
			);
		}

		function pickNeighborHit(
			hits: THREE.Intersection[],
		): THREE.Intersection | undefined {
			const selectableHits = hits.filter((item) => {
				const moleculeId = item.object.userData.moleculeId as
					| string
					| undefined;
				return isCenterHit(moleculeId) || isSelectableNeighbor(moleculeId);
			});
			return (
				selectableHits.find((item) => isSelectedVisibleHit(item)) ??
				selectableHits.find((item) => isVisibleHit(item)) ??
				selectableHits.find((item) =>
					isCenterHit(item.object.userData.moleculeId as string | undefined),
				) ??
				selectableHits.find((item) => isSelectedHit(item)) ??
				selectableHits[0]
			);
		}

		function isCenterHit(moleculeId: string | undefined): boolean {
			return !!props.centerId && moleculeId === props.centerId;
		}

		function isVisibleHit(hit: THREE.Intersection): boolean {
			return hit.object.userData.pickKind !== "molecule";
		}

		function isSelectedHit(hit: THREE.Intersection): boolean {
			return selectedIndexById.has(hit.object.userData.moleculeId as string);
		}

		function isSelectedVisibleHit(hit: THREE.Intersection): boolean {
			return isSelectedHit(hit) && isVisibleHit(hit);
		}

		function isSelectableNeighbor(moleculeId: string | undefined): boolean {
			if (!moleculeId || moleculeId === props.centerId || !props.centerId)
				return false;
			const centerMolecule = moleculeById.get(props.centerId);
			const molecule = moleculeById.get(moleculeId);
			if (!centerMolecule || !molecule) return false;
			return distanceVec3(centerMolecule.centroid, molecule.centroid) > 0.5;
		}

		function onResize() {
			const width = container.clientWidth;
			const height = container.clientHeight;
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height, false);
		}

		renderer.domElement.addEventListener("pointerdown", onPointerDown);
		renderer.domElement.addEventListener("pointerup", onPointerUp);
		renderer.domElement.addEventListener("pointercancel", onPointerCancel);
		renderer.domElement.addEventListener("pointerleave", onPointerCancel);
		window.addEventListener("resize", onResize);

		let frame = 0;
		function render() {
			frame = requestAnimationFrame(render);
			controls.update();
			renderer.render(scene, camera);
		}
		render();

		return () => {
			cancelAnimationFrame(frame);
			renderer.domElement.removeEventListener("pointerdown", onPointerDown);
			renderer.domElement.removeEventListener("pointerup", onPointerUp);
			renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
			renderer.domElement.removeEventListener("pointerleave", onPointerCancel);
			window.removeEventListener("resize", onResize);
			viewStateRef.current = {
				key: props.viewKey,
				position: camera.position.clone(),
				target: controls.target.clone(),
			};
			controls.dispose();
			renderer.dispose();
			scene.traverse((object) => {
				if (
					object instanceof THREE.Mesh ||
					object instanceof THREE.Line ||
					object instanceof THREE.LineSegments ||
					object instanceof THREE.Sprite
				) {
					disposeObject(object);
				}
			});
			container.replaceChildren();
		};
	}, [
		props.cell,
		props.centerId,
		props.molecules,
		props.selectedIds,
		props.showBonds,
		props.showLabels,
		props.showUnitCell,
		props.viewKey,
	]);

	return (
		<div className="viewer" data-testid="molecule-viewer" ref={mountRef} />
	);
}

function roleColor(
	role: "center" | "selected" | "idle",
	element: string,
): number {
	if (role === "center") return 0x67e8f9;
	if (role === "selected") return 0xfbbf24;
	return elementColors[element] ?? 0xa3a3a3;
}

function atomRadius(
	element: string,
	role: "center" | "selected" | "idle",
): number {
	const scale = role === "idle" ? 1 : 1.35;
	if (element === "H") return 0.16 * scale;
	if (element === "S" || element === "Cl") return 0.27 * scale;
	return 0.22 * scale;
}

function atomPickRadius(element: string): number {
	if (element === "H") return 0.42;
	if (element === "S" || element === "Cl") return 0.62;
	return 0.56;
}

function moleculePickRadius(molecule: Molecule): number {
	const maxAtomDistance = molecule.atoms.reduce((maxDistance, atom) => {
		return Math.max(
			maxDistance,
			distanceVec3(atom.position, molecule.centroid),
		);
	}, 0);
	return Math.max(maxAtomDistance + 0.7, 1);
}

function distanceVec3(a: Vec3, b: Vec3): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function makeBond(
	from: Vec3,
	to: Vec3,
	color: number,
	radius: number,
): THREE.Mesh {
	const start = new THREE.Vector3(from[0], from[1], from[2]);
	const end = new THREE.Vector3(to[0], to[1], to[2]);
	const midpoint = new THREE.Vector3()
		.addVectors(start, end)
		.multiplyScalar(0.5);
	const direction = new THREE.Vector3().subVectors(end, start);
	const length = direction.length();
	const geometry = new THREE.CylinderGeometry(radius, radius, length, 10);
	const material = new THREE.MeshPhongMaterial({
		color,
		transparent: true,
		opacity: radius > 0.05 ? 0.96 : 0.72,
	});
	const cylinder = new THREE.Mesh(geometry, material);
	cylinder.position.copy(midpoint);
	cylinder.quaternion.setFromUnitVectors(
		new THREE.Vector3(0, 1, 0),
		direction.normalize(),
	);
	return cylinder;
}

function makeUnitCell(cell: [Vec3, Vec3, Vec3]): THREE.LineSegments {
	const [a, b, c] = cell.map((v) => new THREE.Vector3(v[0], v[1], v[2])) as [
		THREE.Vector3,
		THREE.Vector3,
		THREE.Vector3,
	];
	const origin = new THREE.Vector3(0, 0, 0);
	const points = [
		origin,
		a,
		origin,
		b,
		origin,
		c,
		a,
		new THREE.Vector3().addVectors(a, b),
		a,
		new THREE.Vector3().addVectors(a, c),
		b,
		new THREE.Vector3().addVectors(a, b),
		b,
		new THREE.Vector3().addVectors(b, c),
		c,
		new THREE.Vector3().addVectors(a, c),
		c,
		new THREE.Vector3().addVectors(b, c),
		new THREE.Vector3().addVectors(a, b),
		new THREE.Vector3().addVectors(new THREE.Vector3().addVectors(a, b), c),
		new THREE.Vector3().addVectors(a, c),
		new THREE.Vector3().addVectors(new THREE.Vector3().addVectors(a, b), c),
		new THREE.Vector3().addVectors(b, c),
		new THREE.Vector3().addVectors(new THREE.Vector3().addVectors(a, b), c),
	];
	const geometry = new THREE.BufferGeometry().setFromPoints(points);
	return new THREE.LineSegments(
		geometry,
		new THREE.LineBasicMaterial({ color: 0x64748b }),
	);
}

function makeCrystalAxes(cell: [Vec3, Vec3, Vec3]): THREE.Group {
	const group = new THREE.Group();
	const axes = [
		{ label: "a", vector: cell[0], color: 0xef4444 },
		{ label: "b", vector: cell[1], color: 0x22c55e },
		{ label: "c", vector: cell[2], color: 0x38bdf8 },
	];

	for (const axis of axes) {
		const vector = new THREE.Vector3(
			axis.vector[0],
			axis.vector[1],
			axis.vector[2],
		);
		const length = vector.length();
		if (length === 0) continue;
		const direction = vector.clone().normalize();
		const arrow = new THREE.ArrowHelper(
			direction,
			new THREE.Vector3(0, 0, 0),
			length,
			axis.color,
			length * 0.16,
			length * 0.07,
		);
		group.add(arrow);

		const label = makeAxisLabel(
			axis.label,
			`#${axis.color.toString(16).padStart(6, "0")}`,
		);
		label.position.copy(vector.clone().multiplyScalar(1.08));
		group.add(label);
	}

	return group;
}

function makeLabel(text: string, role: "center" | "selected"): THREE.Sprite {
	const canvas = document.createElement("canvas");
	canvas.width = 360;
	canvas.height = 128;
	const context = canvas.getContext("2d")!;
	const color = role === "center" ? "#67e8f9" : "#fbbf24";
	const fill =
		role === "center" ? "rgba(8, 77, 93, 0.94)" : "rgba(120, 76, 8, 0.94)";
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = fill;
	roundRect(context, 16, 18, 328, 84, 20);
	context.fill();
	context.lineWidth = 6;
	context.strokeStyle = color;
	context.stroke();
	context.font = "800 40px Figtree, system-ui, sans-serif";
	context.fillStyle = "#f8fafc";
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillText(text, 180, 60);
	const texture = new THREE.CanvasTexture(canvas);
	const sprite = new THREE.Sprite(
		new THREE.SpriteMaterial({ map: texture, transparent: true }),
	);
	sprite.scale.set(6.2, 2.25, 1);
	return sprite;
}

function makeAxisLabel(text: string, color: string): THREE.Sprite {
	const canvas = document.createElement("canvas");
	canvas.width = 128;
	canvas.height = 128;
	const context = canvas.getContext("2d")!;
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = "rgba(5, 10, 20, 0.84)";
	context.beginPath();
	context.arc(64, 64, 38, 0, Math.PI * 2);
	context.fill();
	context.font = "700 52px Figtree, system-ui, sans-serif";
	context.fillStyle = color;
	context.textAlign = "center";
	context.textBaseline = "middle";
	context.fillText(text, 64, 61);
	const texture = new THREE.CanvasTexture(canvas);
	const sprite = new THREE.Sprite(
		new THREE.SpriteMaterial({ map: texture, transparent: true }),
	);
	sprite.scale.set(2.4, 2.4, 1);
	return sprite;
}

function roundRect(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	context.beginPath();
	context.moveTo(x + radius, y);
	context.arcTo(x + width, y, x + width, y + height, radius);
	context.arcTo(x + width, y + height, x, y + height, radius);
	context.arcTo(x, y + height, x, y, radius);
	context.arcTo(x, y, x + width, y, radius);
	context.closePath();
}

function disposeObject(
	object: THREE.Mesh | THREE.Line | THREE.LineSegments | THREE.Sprite,
) {
	const material = object.material;
	object.geometry?.dispose();
	if (Array.isArray(material)) {
		material.forEach((item) => item.dispose());
	} else {
		material.dispose();
	}
}

function getCssColor(name: string): string {
	return (
		getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
		"#0b1018"
	);
}
