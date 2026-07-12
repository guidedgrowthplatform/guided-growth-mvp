const generatedDirectories = new Set(["dist", "dist-flow"]);
const prettierExtension = /\.(?:ts|tsx|json|md|css|html|yml|yaml)$/;
const typescriptExtension = /\.(?:ts|tsx)$/;

function isGeneratedArtifact(file) {
  return file.split(/[\\/]/).some((segment) => generatedDirectories.has(segment));
}

function commandWithFiles(command, files) {
  return files.length === 0
    ? []
    : `${command} ${files.map((file) => JSON.stringify(file)).join(" ")}`;
}

export default {
  "*": (files) => {
    const sourceFiles = files.filter((file) => !isGeneratedArtifact(file));
    const typescriptFiles = sourceFiles.filter((file) => typescriptExtension.test(file));
    const prettierFiles = sourceFiles.filter((file) => prettierExtension.test(file));

    return [
      commandWithFiles("eslint --fix --no-warn-ignored", typescriptFiles),
      commandWithFiles("prettier --write", prettierFiles),
    ].flat();
  },
};
