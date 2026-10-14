import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import commonjs from '@rollup/plugin-commonjs';
import pkg from './package.json' with { type: 'json' };
export default {
 input: './src/Manifest.response.js',
 output: {
  file: './dist/Manifest.response.bundle.js', format: 'es',
  banner: `console.log(${JSON.stringify(`DualSubs LeoGray ${pkg.version}: official Chinese first; Mac rendition fix`)});`,
 },
 plugins: [nodeResolve(),commonjs(),terser()],
};
