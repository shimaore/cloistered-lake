import esbuild from 'esbuild'

esbuild.build({
  entryPoints: [ 'index.ts' ],
  bundle: true,
  format: 'cjs',
  outfile: 'index.cjs',
  platform: 'node',
  target: 'node18',
})

esbuild.build({
  entryPoints: [ 'index.ts' ],
  bundle: true,
  format: 'esm',
  outfile: 'index.mjs',
  platform: 'node',
  target: 'node18',
})
