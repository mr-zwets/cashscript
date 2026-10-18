// SDK test shim, part 2 (round 4 of the convention review): make the SDK suite exercise the
// compiler under test. Most SDK tests construct a Contract from a PRECOMPILED artifact, so forcing
// compiler options alone (index.ts) only reaches the few tests that compile at run time. With
// ZK_RECOMPILE=1, every Contract recompiles its artifact's source with this worktree's cashc
// source, the artifact's own compiler options and the ZK_FORCE options, and runs on that
// bytecode and debug data instead (vitest.zkrecompile.config.ts injects the call into
// src/Contract.ts). Artifacts without source or debug data, incomplete ones and ones whose
// recompile fails or changes the ABI are used unchanged; every outcome is counted in the file
// named by ZK_RECOMPILE_LOG (one JSON line per test file).
//
// A recompiled artifact has a different bytecode, so tests that pin addresses, bytecode or
// generated templates fail even without forced options. Compare against a baseline run with
// ZK_RECOMPILE=1 ZK_FORCE='{}' (see run-recompiled.sh): a test that passes there and fails with
// forced options is a finding.
import fs from 'node:fs';
import { afterAll, expect } from 'vitest';
import { compileStringInternal } from '../../../packages/cashc/src/compiler.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const forced = (): Record<string, unknown> => JSON.parse(process.env.ZK_FORCE ?? '{}');
const cache = new Map<string, any>();
// changed: recompiled with bytecode that differs from the artifact's own options without ZK_FORCE
const counts = { changed: 0, recompiled: 0, cached: 0, noSource: 0, noDebug: 0, incomplete: 0, failed: 0, abiChanged: 0 };
const failures: string[] = [];
const changedNames = new Set<string>();

// the artifact's source under its own options without the ZK_FORCE keys (an artifact compiled at
// test run time through index.ts records the forced public options too); the reference for
// counts.changed
const plainCache = new Map<string, string | undefined>();
function plainCompile(artifact: any): string | undefined {
  const own = Object.fromEntries(Object.entries(artifact.compiler.options ?? {}).filter(([k]) => !(k in forced())));
  const key = `${JSON.stringify(own)}\n${artifact.source}`;
  if (!plainCache.has(key)) {
    try {
      plainCache.set(key, compileStringInternal(artifact.source, {
        ...own, files: artifact.debug?.sources ?? {}, warningListener: () => {},
      } as never).bytecode);
    } catch { plainCache.set(key, undefined); }
  }
  return plainCache.get(key);
}

function zkRecompile(artifact: any): any {
  if (process.env.ZK_RECOMPILE !== '1') return artifact;
  if (artifact === null || typeof artifact !== 'object' || !artifact.abi || !artifact.bytecode || !artifact.compiler) {
    counts.incomplete += 1; return artifact;
  }
  if (typeof artifact.source !== 'string' || artifact.source.length === 0) { counts.noSource += 1; return artifact; }
  if (artifact.debug === undefined) { counts.noDebug += 1; return artifact; }
  const options = { ...(artifact.compiler.options ?? {}), ...forced() };
  const key = `${JSON.stringify(options)}\n${JSON.stringify(artifact.debug.sources ?? {})}\n${artifact.source}`;
  let fresh = cache.get(key);
  if (fresh === undefined) {
    try {
      fresh = compileStringInternal(artifact.source, {
        ...options, files: artifact.debug.sources ?? {}, warningListener: () => {},
      } as never);
    } catch (e) {
      fresh = null;
      failures.push(`${artifact.contractName}: ${(e as Error).message.split('\n')[0]}`);
    }
    cache.set(key, fresh);
  } else {
    counts.cached += 1;
  }
  if (fresh === null) {
    counts.failed += 1;
    // ZK_RECOMPILE_STRICT=1: a failed recompile fails the test (for checking what the shim reaches)
    if (process.env.ZK_RECOMPILE_STRICT === '1') throw new Error(`zk-recompile failed: ${failures[failures.length - 1]}`);
    return artifact;
  }
  if (JSON.stringify(fresh.abi) !== JSON.stringify(artifact.abi)
    || JSON.stringify(fresh.constructorInputs) !== JSON.stringify(artifact.constructorInputs)) {
    counts.abiChanged += 1; return artifact;
  }
  counts.recompiled += 1;
  if (fresh.bytecode !== plainCompile(artifact)) { counts.changed += 1; changedNames.add(artifact.contractName); }
  // keep everything the tests may inspect about the artifact itself (name, compiler version,
  // ABI); swap in what the VM and the debugger use
  return { ...artifact, bytecode: fresh.bytecode, debug: fresh.debug };
}

(globalThis as any).__zkRecompile = zkRecompile;

const logFile = process.env.ZK_RECOMPILE_LOG;
if (logFile !== undefined) {
  afterAll(() => {
    const line = { file: expect.getState().testPath, force: forced(), counts, failures, changed: [...changedNames] };
    fs.appendFileSync(logFile, `${JSON.stringify(line)}\n`);
  });
}
