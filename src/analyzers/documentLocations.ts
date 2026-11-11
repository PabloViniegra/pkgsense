import { type Node, findNodeAtLocation, parseTree } from 'jsonc-parser';

/** Offset and length of a property key, without its quotes. */
export interface KeySpan {
	readonly offset: number;
	readonly length: number;
}

export interface DocumentLocator {
	/** Key of the property at a JSON path, e.g. ["engines", "node"] */
	findKey(path: readonly string[]): KeySpan | null;
	/** Key of a dependency; "dependencies" wins, as it is the entry npm installs */
	findDependency(name: string): KeySpan | null;
}

function keySpan(root: Node, path: readonly string[]): KeySpan | null {
	const property = findNodeAtLocation(root, [...path])?.parent;
	const key =
		property?.type === 'property' ? property.children?.[0] : undefined;

	return key ? { offset: key.offset + 1, length: key.length - 2 } : null;
}

/**
 * Locates keys in package.json text by parsing it, so positions do not depend
 * on how the file is laid out (one-line sections, keys repeated elsewhere).
 */
export function createDocumentLocator(text: string): DocumentLocator {
	const root = parseTree(text);

	const findKey = (path: readonly string[]) =>
		root ? keySpan(root, path) : null;

	return {
		findKey,
		findDependency: (name) =>
			findKey(['dependencies', name]) ?? findKey(['devDependencies', name]),
	};
}
