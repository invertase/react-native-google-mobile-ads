import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export type PublicApiKind =
  | 'class'
  | 'function'
  | 'hook'
  | 'component'
  | 'const/preset'
  | 'type-only'
  | 'namespace/object';

export type PublicApiMember = {
  name: string;
  kind: PublicApiKind;
  runtime: true;
};

export type PublicApiExport = {
  name: string;
  kind: PublicApiKind;
  runtime: boolean;
  members: readonly PublicApiMember[];
};

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(sourceDirectory, '../../..');
const coreTsconfigPath = path.join(repositoryRoot, 'packages/core/tsconfig.json');
const coreIndexPath = path.join(repositoryRoot, 'packages/core/src/index.ts');

function readCoreCompilerOptions(): ts.CompilerOptions {
  const config = ts.readConfigFile(coreTsconfigPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  }
  return ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(coreTsconfigPath)).options;
}

function aliasIsExplicitlyTypeOnly(symbol: ts.Symbol): boolean {
  return (symbol.declarations ?? []).some(declaration => {
    if (!ts.isExportSpecifier(declaration)) {
      return false;
    }
    return declaration.isTypeOnly || declaration.parent.parent.isTypeOnly;
  });
}

function resolvedSymbol(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function hasRuntimeValue(checker: ts.TypeChecker, symbol: ts.Symbol): boolean {
  return (
    !aliasIsExplicitlyTypeOnly(symbol) &&
    Boolean(resolvedSymbol(checker, symbol).flags & ts.SymbolFlags.Value)
  );
}

function isComponent(checker: ts.TypeChecker, symbol: ts.Symbol): boolean {
  const resolved = resolvedSymbol(checker, symbol);
  const declaredType = checker.getDeclaredTypeOfSymbol(resolved);
  if (declaredType.getProperty('render')) {
    return true;
  }
  const valueDeclaration = resolved.valueDeclaration ?? resolved.declarations?.[0];
  if (!valueDeclaration) {
    return false;
  }
  const valueType = checker.getTypeOfSymbolAtLocation(resolved, valueDeclaration);
  return valueType.getCallSignatures().some(signature => {
    const returnType = checker.typeToString(signature.getReturnType());
    return /(?:Element|ReactNode)/.test(returnType);
  });
}

function classifySymbol(
  checker: ts.TypeChecker,
  exportedName: string,
  symbol: ts.Symbol,
  runtime: boolean,
): PublicApiKind {
  if (!runtime) {
    return 'type-only';
  }
  if (exportedName.startsWith('use')) {
    return 'hook';
  }
  const resolved = resolvedSymbol(checker, symbol);
  if (isComponent(checker, symbol)) {
    return 'component';
  }
  const declaration = resolved.valueDeclaration ?? resolved.declarations?.[0];
  if (
    declaration &&
    checker.getTypeOfSymbolAtLocation(resolved, declaration).getCallSignatures().length > 0
  ) {
    return 'function';
  }
  if (resolved.flags & ts.SymbolFlags.Class) {
    return 'class';
  }
  if (resolved.flags & ts.SymbolFlags.Function) {
    return 'function';
  }
  if (declaration) {
    const valueType = checker.getTypeOfSymbolAtLocation(resolved, declaration);
    const members = checker.getPropertiesOfType(valueType);
    if (
      valueType.flags & ts.TypeFlags.Object &&
      members.some(member => {
        const memberDeclaration = member.valueDeclaration ?? member.declarations?.[0];
        return (
          memberDeclaration &&
          checker.getTypeOfSymbolAtLocation(member, memberDeclaration).getCallSignatures().length > 0
        );
      })
    ) {
      return 'namespace/object';
    }
  }
  return 'const/preset';
}

function enumerateObjectMembers(
  checker: ts.TypeChecker,
  exportedName: string,
  symbol: ts.Symbol,
  kind: PublicApiKind,
): PublicApiMember[] {
  if (kind !== 'namespace/object') {
    return [];
  }
  const resolved = resolvedSymbol(checker, symbol);
  const declaration = resolved.valueDeclaration ?? resolved.declarations?.[0];
  if (!declaration) {
    return [];
  }
  const valueType = checker.getTypeOfSymbolAtLocation(resolved, declaration);
  return checker
    .getPropertiesOfType(valueType)
    .filter(member => member.flags & ts.SymbolFlags.Value)
    .map(member => {
      const memberName = `${exportedName}.${member.getName()}`;
      return {
        name: memberName,
        kind: classifySymbol(checker, memberName, member, true),
        runtime: true as const,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function derivePublicApiMatrix(): readonly PublicApiExport[] {
  const program = ts.createProgram([coreIndexPath], readCoreCompilerOptions());
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: fileName => fileName,
        getCurrentDirectory: () => repositoryRoot,
        getNewLine: () => '\n',
      }),
    );
  }
  const checker = program.getTypeChecker();
  const indexSource = program.getSourceFile(coreIndexPath);
  if (!indexSource) {
    throw new Error(`TypeScript program did not include ${coreIndexPath}`);
  }
  const indexSymbol = checker.getSymbolAtLocation(indexSource);
  if (!indexSymbol) {
    throw new Error(`TypeScript checker did not resolve ${coreIndexPath}`);
  }
  return checker
    .getExportsOfModule(indexSymbol)
    .map(symbol => {
      const runtime = hasRuntimeValue(checker, symbol);
      const kind = classifySymbol(checker, symbol.getName(), symbol, runtime);
      return {
        name: symbol.getName(),
        kind,
        runtime,
        members: enumerateObjectMembers(checker, symbol.getName(), symbol, kind),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
