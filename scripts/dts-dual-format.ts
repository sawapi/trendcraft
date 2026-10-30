/**
 * vite-plugin-dts options shared by the published packages.
 *
 * Each package ships ESM (.js) and CJS (.cjs) builds under "type": "module".
 * One .d.ts for both made TypeScript treat the require side as ESM, so a CJS
 * consumer under node16 got TS1479, and the extensionless relative imports
 * inside the declarations broke node16/nodenext resolution, leaving imports
 * typed as `any`. Each build now gets its own declarations: .d.mts for ESM
 * and .d.cts for CJS, with .mjs / .cjs on every relative specifier, as the
 * TypeScript handbook and arethetypeswrong ("Masquerading as ESM") ask.
 */

/** Matches a bare directory specifier: '.', '..', '../..', ... */
const DIR_SPECIFIER = /(\bimport\(|\bfrom )(['"])(\.{1,2}(?:\/\.\.)*)\2/g;
/** Matches a relative specifier that already ends in .mjs or .cjs. */
const EXT_SPECIFIER = /(\bimport\(|\bfrom )(['"])(\.[^'"]*?)\.(?:mjs|cjs)\2/g;

// Typed here rather than with vite-plugin-dts's PluginOptions: this file sits
// outside the packages, where that dependency does not resolve.
export const dualFormatDts = {
  outDirs: [
    { dir: "dist", moduleFormat: "esm" as const },
    { dir: "dist", moduleFormat: "cjs" as const },
  ],
  // The plugin adds .mjs / .cjs to relative specifiers, with two gaps this
  // hook closes:
  // - it leaves a bare directory specifier, such as the `import('..')`
  //   TypeScript writes for an inferred type, which node16/nodenext
  //   resolution cannot follow;
  // - in the React and Vue wrappers it writes inline `import('./x.mjs')`
  //   type references into .d.cts files too, which would read the ESM
  //   declarations from CJS.
  beforeWriteFile: (filePath: string, content: string) => {
    const ext = filePath.endsWith(".d.cts") ? ".cjs" : ".mjs";
    return {
      filePath,
      content: content
        .replace(
          DIR_SPECIFIER,
          (_m: string, head: string, q: string, dir: string) => `${head}${q}${dir}/index${ext}${q}`,
        )
        .replace(
          EXT_SPECIFIER,
          (_m: string, head: string, q: string, path: string) => `${head}${q}${path}${ext}${q}`,
        ),
    };
  },
};
