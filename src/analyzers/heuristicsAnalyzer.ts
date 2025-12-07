import type { Finding, PackageJson } from '../types';

const replacements = [
	{
		pkg: 'moment',
		suggestion:
			'Considera usar dayjs o luxon (moment está en modo mantenimiento).',
	},
	{ pkg: 'request', suggestion: 'request está deprecated; usa fetch o axios.' },
	{ pkg: 'left-pad', suggestion: 'Paquete innecesario.' },
];

export async function heuristicsAnalyzer(
	json: PackageJson,
	allDeps: Record<string, string>,
): Promise<Finding[]> {
	const findings: Finding[] = [];

	for (const r of replacements) {
		if (allDeps[r.pkg]) {
			findings.push({
				type: 'warning',
				message: `Dependencia obsoleta detectada: ${r.pkg}. ${r.suggestion}`,
				dependency: r.pkg,
				tags: ['maintenance', 'replacement'],
			});
		}
	}

	if (json.dependencies && json.devDependencies) {
		for (const dep of Object.keys(json.dependencies)) {
			if (json.devDependencies[dep]) {
				findings.push({
					type: 'warning',
					message: `Dependencia duplicada en dependencies y devDependencies: ${dep}.`,
					dependency: dep,
					tags: ['duplication'],
				});
			}
		}
	}

	if (
		!json.scripts ||
		!json.scripts.test ||
		json.scripts.test.includes('no test')
	) {
		findings.push({
			type: 'info',
			message: 'No se detectaron tests configurados. Añade script "test".',
			tags: ['quality'],
		});
	}

	if (!json.files) {
		findings.push({
			type: 'info',
			message:
				'No existe el campo "files". Añadirlo reduce tamaño del paquete publicado.',
			tags: ['packaging'],
		});
	}

	if (!json.type) {
		findings.push({
			type: 'info',
			message: 'No se detecta "type". Considera usar "type": "module".',
			tags: ['config'],
		});
	}

	return findings;
}
