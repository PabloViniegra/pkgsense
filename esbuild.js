const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
	const ctx = await esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'out/extension.js',
		external: ['vscode'],
		// jsonc-parser's default UMD build loads its modules through a require
		// esbuild cannot follow; its ESM build bundles correctly
		mainFields: ['module', 'main'],
		logLevel: 'silent',
		plugins: [
			{
				name: 'watch-plugin',
				setup(build) {
					build.onEnd((result) => {
						if (result.errors.length > 0) {
							console.error('❌ Build failed');
						} else {
							console.log('✅ Build succeeded');
						}
					});
				},
			},
		],
	});

	if (watch) {
		await ctx.watch();
		console.log('👀 Watching for changes...');
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
