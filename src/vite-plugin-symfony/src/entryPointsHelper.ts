import type { ResolvedConfig } from "vite";
import { getLegacyName, prepareRollupInputs } from "./utils";
import { EntryPoints, EntryPoint, StringMapping, GeneratedFiles, FileInfos, FilesMetadatas } from "./types";

export const getDevEntryPoints = (config: ResolvedConfig, viteDevServerUrl: string): EntryPoints => {
  const entryPoints: EntryPoints = {};

  for (const [entryName, { inputRelPath, inputType }] of Object.entries(prepareRollupInputs(config))) {
    entryPoints[entryName] = {
      [inputType]: [`${viteDevServerUrl}${config.base}${inputRelPath}`],
    };
  }
  return entryPoints;
};

export const getFilesMetadatas = (base: string, generatedFiles: GeneratedFiles): FilesMetadatas => {
  return Object.fromEntries(
    Object.values(generatedFiles)
      .filter((fileInfos: FileInfos) => fileInfos.hash)
      .map((fileInfos: FileInfos) => [
        `${base}${fileInfos.outputRelPath}`,
        {
          hash: fileInfos.hash,
        },
      ]),
  );
};

export const getBuildEntryPoints = (
  generatedFiles: GeneratedFiles,
  viteConfig: ResolvedConfig,
  inputRelPath2outputRelPath: StringMapping,
): EntryPoints => {
  const entryPoints: EntryPoints = {};
  let hasLegacyEntryPoint = false;

  /** get an Array of entryPoints from build.rollupOptions.input inside vite config file  */
  const entryFiles = prepareRollupInputs(viteConfig);

  for (const [entryName, entry] of Object.entries(entryFiles)) {
    const outputRelPath = inputRelPath2outputRelPath[entry.inputRelPath];
    const fileInfos = generatedFiles[outputRelPath];

    if (!outputRelPath || !fileInfos) {
      console.error("unable to map generatedFile", entry, outputRelPath, fileInfos, inputRelPath2outputRelPath);
      process.exit(1);
    }

    const legacyInputRelPath = getLegacyName(entry.inputRelPath);
    const legacyFileInfos = generatedFiles[inputRelPath2outputRelPath[legacyInputRelPath]] ?? null;

    if (legacyFileInfos) {
      hasLegacyEntryPoint = true;
      entryPoints[`${entryName}-legacy`] = resolveEntrypoint(legacyFileInfos, generatedFiles, viteConfig, false);
    }

    entryPoints[entryName] = resolveEntrypoint(
      fileInfos,
      generatedFiles,
      viteConfig,
      hasLegacyEntryPoint ? `${entryName}-legacy` : false,
    );
  }

  if (hasLegacyEntryPoint && inputRelPath2outputRelPath["vite/legacy-polyfills"]) {
    const fileInfos = generatedFiles[inputRelPath2outputRelPath["vite/legacy-polyfills"]] ?? null;
    if (fileInfos) {
      entryPoints["polyfills-legacy"] = resolveEntrypoint(fileInfos, generatedFiles, viteConfig, false);
    }
  }

  return entryPoints;
};

export const resolveEntrypoint = (
  fileInfos: FileInfos,
  generatedFiles: GeneratedFiles,
  config: ResolvedConfig,
  legacyEntryName: boolean | string,
  resolvedImportOutputRelPaths: string[] = [],
): EntryPoint => {
  const css: string[] = [];
  const js: string[] = [];
  const preload: string[] = [];
  const dynamic: string[] = [];

  resolvedImportOutputRelPaths.push(fileInfos.outputRelPath);

  if (fileInfos.type === "js") {
    for (const importOutputRelPath of fileInfos.imports) {
      if (resolvedImportOutputRelPaths.indexOf(importOutputRelPath) !== -1) {
        continue;
      }
      resolvedImportOutputRelPaths.push(importOutputRelPath);

      const importFileInfos = generatedFiles[importOutputRelPath];
      if (!importFileInfos) {
        throw new Error(`Unable to find ${importOutputRelPath}`);
      }

      const {
        css: importCss,
        dynamic: importDynamic,
        js: importJs,
        preload: importPreload,
      } = resolveEntrypoint(importFileInfos, generatedFiles, config, false, resolvedImportOutputRelPaths);

      for (const dependency of importCss) {
        if (css.indexOf(dependency) === -1) {
          css.push(dependency);
        }
      }

      // imports are preloaded not js files
      for (const dependency of importJs) {
        if (preload.indexOf(dependency) === -1) {
          preload.push(dependency);
        }
      }
      for (const dependency of importPreload) {
        if (preload.indexOf(dependency) === -1) {
          preload.push(dependency);
        }
      }
      for (const dependency of importDynamic) {
        if (dynamic.indexOf(dependency) === -1) {
          dynamic.push(dependency);
        }
      }
    }

    fileInfos.js.forEach((dependency) => {
      if (js.indexOf(dependency) === -1) {
        js.push(`${config.base}${dependency}`);
      }
    });
    fileInfos.preload.forEach((dependency) => {
      if (preload.indexOf(dependency) === -1) {
        preload.push(`${config.base}${dependency}`);
      }
    });
    fileInfos.dynamic.forEach((dependency) => {
      if (dynamic.indexOf(dependency) === -1) {
        dynamic.push(`${config.base}${dependency}`);
      }
    });
  }

  if (fileInfos.type === "js" || fileInfos.type === "css") {
    fileInfos.css.forEach((dependency) => {
      if (css.indexOf(dependency) === -1) {
        css.push(`${config.base}${dependency}`);
      }
    });
  }

  return { css, dynamic, js, legacy: legacyEntryName, preload };
};
