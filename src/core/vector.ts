import type { Vec3 } from "../domain/types";

export function add(a: Vec3, b: Vec3): Vec3 {
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, factor: number): Vec3 {
	return [a[0] * factor, a[1] * factor, a[2] * factor];
}

export function distance(a: Vec3, b: Vec3): number {
	const dx = a[0] - b[0];
	const dy = a[1] - b[1];
	const dz = a[2] - b[2];
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function centroid(points: Vec3[]): Vec3 {
	if (points.length === 0) return [0, 0, 0];
	const sum = points.reduce<Vec3>(
		(acc, point) => [acc[0] + point[0], acc[1] + point[1], acc[2] + point[2]],
		[0, 0, 0],
	);
	return scale(sum, 1 / points.length);
}

export function translateByCell(
	position: Vec3,
	cell: [Vec3, Vec3, Vec3],
	translation: Vec3,
): Vec3 {
	return add(
		add(position, scale(cell[0], translation[0])),
		add(scale(cell[1], translation[1]), scale(cell[2], translation[2])),
	);
}

export function formatDistance(value: number): string {
	return value.toFixed(2);
}
