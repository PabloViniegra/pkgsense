import { CONSTANTS } from '../shared/constants';
import { type InfallibleResult, infallible } from '../shared/result';
import { FINDING_TAGS, type Finding } from '../types';
import type { Analyzer, AnalysisContext } from './types';

/**
 * Metadata Analyzer - Validates package.json metadata fields.
 *
 * Checks for missing or incomplete metadata that affects package discoverability,
 * documentation, and professionalism.
 *
 * Detects:
 * - Missing repository field (affects source code discovery)
 * - Missing bugs URL (affects issue reporting)
 * - Missing homepage (affects package landing page)
 * - Missing or empty description (affects package understanding)
 * - Missing or empty keywords (affects discoverability)
 * - Missing author (affects attribution)
 * - Missing license (legal/compliance issues)
 *
 * @example
 * ```typescript
 * const analyzer = createMetadataAnalyzer();
 * const result = await analyzer.analyze(context);
 * if (result.success) {
 *   console.log(`Found ${result.data.length} metadata issues`);
 * }
 * ```
 */

/**
 * Checks if repository field is missing or incomplete.
 */
function checkRepository(pkg: AnalysisContext['packageJson']): Finding[] {
	const findings: Finding[] = [];

	if (!pkg.repository) {
		findings.push({
			type: 'info',
			message:
				'Missing "repository" field. Add repository URL for better discoverability.',
			tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.QUALITY],
		});
		return findings;
	}

	// Check if repository is a string (URL) or object with url
	const repoUrl =
		typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url;

	if (!repoUrl || repoUrl.trim().length === 0) {
		findings.push({
			type: 'info',
			message: 'Repository URL is empty. Provide a valid repository URL.',
			tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.QUALITY],
		});
	}

	return findings;
}

/**
 * Checks if bugs field is missing.
 */
function checkBugs(pkg: AnalysisContext['packageJson']): Finding[] {
	const findings: Finding[] = [];

	if (!pkg.bugs) {
		findings.push({
			type: 'info',
			message:
				'Missing "bugs" field. Add bugs URL to help users report issues.',
			tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.QUALITY],
		});
		return findings;
	}

	// Check if bugs is a string (URL) or object with url
	const bugsUrl = typeof pkg.bugs === 'string' ? pkg.bugs : pkg.bugs.url;

	if (!bugsUrl || bugsUrl.trim().length === 0) {
		findings.push({
			type: 'info',
			message: 'Bugs URL is empty. Provide a valid bugs URL.',
			tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.QUALITY],
		});
	}

	return findings;
}

/**
 * Checks if homepage field is missing.
 */
function checkHomepage(pkg: AnalysisContext['packageJson']): Finding[] {
	if (!pkg.homepage) {
		return [
			{
				type: 'info',
				message:
					'Missing "homepage" field. Add homepage URL for package landing page.',
				tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.QUALITY],
			},
		];
	}

	return [];
}

/**
 * Checks if description field is missing or empty.
 */
function checkDescription(pkg: AnalysisContext['packageJson']): Finding[] {
	if (!pkg.description) {
		return [
			{
				type: 'warning',
				message:
					'Missing "description" field. Add a description to help users understand your package.',
				tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.QUALITY],
			},
		];
	}

	if (pkg.description.trim().length === 0) {
		return [
			{
				type: 'warning',
				message: 'Description is empty. Provide a meaningful description.',
				tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.QUALITY],
			},
		];
	}

	// Warn if description is too short
	if (pkg.description.trim().length < CONSTANTS.MIN_DESCRIPTION_LENGTH) {
		return [
			{
				type: 'info',
				message: 'Description is very short. Consider adding more details.',
				tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.QUALITY],
			},
		];
	}

	return [];
}

/**
 * Checks if keywords field is missing or empty.
 */
function checkKeywords(pkg: AnalysisContext['packageJson']): Finding[] {
	if (!pkg.keywords) {
		return [
			{
				type: 'info',
				message:
					'Missing "keywords" field. Add keywords to improve package discoverability.',
				tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.QUALITY],
			},
		];
	}

	if (pkg.keywords.length === 0) {
		return [
			{
				type: 'info',
				message: 'Keywords array is empty. Add relevant keywords.',
				tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.QUALITY],
			},
		];
	}

	return [];
}

/**
 * Checks if author field is missing.
 */
function checkAuthor(pkg: AnalysisContext['packageJson']): Finding[] {
	if (!pkg.author) {
		return [
			{
				type: 'info',
				message:
					'Missing "author" field. Add author information for proper attribution.',
				tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.QUALITY],
			},
		];
	}

	// If author is an object, check if name is provided
	if (typeof pkg.author === 'object' && !pkg.author.name) {
		return [
			{
				type: 'info',
				message: 'Author name is missing. Provide author name.',
				tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.QUALITY],
			},
		];
	}

	return [];
}

/**
 * Checks if license field is missing.
 */
function checkLicense(pkg: AnalysisContext['packageJson']): Finding[] {
	if (!pkg.license) {
		return [
			{
				type: 'warning',
				message:
					'Missing "license" field. Specify a license for legal clarity (e.g., MIT, ISC).',
				tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.LICENSE],
			},
		];
	}

	// Warn about UNLICENSED
	if (pkg.license === 'UNLICENSED') {
		return [
			{
				type: 'warning',
				message:
					'Package is unlicensed. Consider using a standard open-source license.',
				tags: [FINDING_TAGS.PACKAGING, FINDING_TAGS.LICENSE],
			},
		];
	}

	return [];
}

/**
 * Analyzes package.json metadata for completeness and quality.
 * This analyzer never fails - it always returns findings (even if empty).
 */
async function analyze(
	context: AnalysisContext,
): Promise<InfallibleResult<Finding[]>> {
	const findings: Finding[] = [];
	const pkg = context.packageJson;

	// Run all metadata checks
	findings.push(...checkRepository(pkg));
	findings.push(...checkBugs(pkg));
	findings.push(...checkHomepage(pkg));
	findings.push(...checkDescription(pkg));
	findings.push(...checkKeywords(pkg));
	findings.push(...checkAuthor(pkg));
	findings.push(...checkLicense(pkg));

	return infallible(findings);
}

/**
 * Creates a MetadataAnalyzer instance.
 *
 * @returns Analyzer instance for metadata validation
 */
export function createMetadataAnalyzer(): Analyzer {
	return {
		name: 'metadata',
		analyze,
	};
}

/**
 * Default MetadataAnalyzer instance.
 */
export const metadataAnalyzer = createMetadataAnalyzer();
