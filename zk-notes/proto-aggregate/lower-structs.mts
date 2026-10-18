// Prototype struct desugaring for CashScript: a source-to-source lowering of
//   struct Fp2 { int c0; int c1; }          (nested structs allowed)
// to the plain int values the compiler already handles. Structs are pure syntax over a fixed
// flattening order (declaration order, depth first), so a struct-typed value is exactly its
// leaves on the stack, contiguous and in order: the layout the block-move pass collapses.
//
// Supported (enough for the BN254 tower/Miller code):
//   - struct declarations (removed from the output)
//   - struct-typed parameters `Fp2 a` -> `int a_c0, int a_c1`; struct return types
//   - declarations `Fp2 t = f(..);` -> `(int t_c0, int t_c1) = f(..);`
//   - tuple declarations/assignments mixing ints and structs: `(int x, Fp2 t) = ..`, `(t, u) = ..`
//   - reassignment `t = f(..);` -> `(t_c0, t_c1) = f(..);`
//   - uses: `t` -> `t_c0, t_c1` (argument lists, return lists), `t.c0` -> `t_c0`, `f.c1.c0` -> ...
//   - literals `Fp2(x, y)` -> `x, y`
// usage: npx tsx lower-structs.mts <in-dir> <out-dir>   (lowers every .cash file, keeps imports)
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

type Tok = { t: 'ws' | 'id' | 'num' | 'str' | 'p' | 'c'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\s+/))) { out.push({ t: 'ws', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^\/\/[^\n]*/))) { out.push({ t: 'c', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^\/\*[\s\S]*?\*\//))) { out.push({ t: 'c', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^"(?:[^"\\]|\\.)*"/))) { out.push({ t: 'str', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/))) { out.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^[0-9][0-9a-fA-Fx_]*/))) { out.push({ t: 'num', v: m[0] }); i += m[0].length; continue; }
    if ((m = rest.match(/^(==|!=|<=|>=|&&|\|\||<<|>>|\+\+|--)/))) { out.push({ t: 'p', v: m[0] }); i += m[0].length; continue; }
    out.push({ t: 'p', v: c }); i += 1;
  }
  return out;
}

// struct name -> ordered fields [name, type]
type Structs = Map<string, [string, string][]>;

// flattened leaf suffixes of a type ('' for int)
function leaves(structs: Structs, type: string): string[] {
  const fields = structs.get(type);
  if (fields === undefined) return [''];
  return fields.flatMap(([name, t]) => leaves(structs, t).map((s) => `_${name}${s}`));
}
function fieldType(structs: Structs, type: string, field: string): string {
  const f = structs.get(type)?.find(([n]) => n === field);
  if (f === undefined) throw new Error(`no field ${field} in ${type}`);
  return f[1];
}

function collectStructs(toks: Tok[], structs: Structs): Tok[] {
  const out: Tok[] = [];
  for (let i = 0; i < toks.length; i += 1) {
    if (toks[i].t === 'id' && toks[i].v === 'struct') {
      const sig = toks.slice(i).filter((t) => t.t !== 'ws' && t.t !== 'c');
      const name = sig[1].v;
      const fields: [string, string][] = [];
      let k = 3; // after `struct Name {`
      while (sig[k].v !== '}') { fields.push([sig[k + 1].v, sig[k].v]); k += 3; }
      structs.set(name, fields);
      // skip raw tokens up to the closing brace
      let depth = 0;
      for (; i < toks.length; i += 1) {
        if (toks[i].v === '{') depth += 1;
        if (toks[i].v === '}') { depth -= 1; if (depth === 0) break; }
      }
      continue;
    }
    out.push(toks[i]);
  }
  return out;
}

function lower(src: string, structs: Structs): string {
  const toks = collectStructs(tokenize(src), structs);
  let vars = new Map<string, string>(); // struct-typed variables of the current function
  const isStruct = (name: string): boolean => structs.has(name);
  // next non-whitespace token index from i
  const nx = (i: number): number => { let j = i; while (j < toks.length && (toks[j].t === 'ws' || toks[j].t === 'c')) j += 1; return j; };

  const pv = (i: number): number => { let j = i; while (j > 0 && (toks[j].t === 'ws' || toks[j].t === 'c')) j -= 1; return j; };
  // expand a use of a struct variable starting at token i (an identifier); returns [text, nextIndex]
  const expandUse = (i: number): [string, number] => {
    const base = toks[i].v;
    let type = vars.get(base)!;
    let path = base;
    let j = i + 1;
    while (toks[j]?.v === '.' && toks[j + 1]?.t === 'id' && isStruct(type)) {
      const field = toks[j + 1].v;
      type = fieldType(structs, type, field);
      path += `_${field}`;
      j += 2;
    }
    return [leaves(structs, type).map((s) => path + s).join(', '), j];
  };

  // lower a parameter list / tuple-target element list between parens (exclusive range)
  const lowerDeclList = (from: number, to: number, register: boolean): string => {
    const parts: Tok[][] = [[]];
    let depth = 0;
    for (let k = from; k < to; k += 1) {
      if (toks[k].v === '(') depth += 1;
      if (toks[k].v === ')') depth -= 1;
      if (toks[k].v === ',' && depth === 0) { parts.push([]); continue; }
      parts[parts.length - 1].push(toks[k]);
    }
    return parts.map((p) => {
      const sig = p.filter((t) => t.t !== 'ws' && t.t !== 'c');
      const lead = p.length > 0 && p[0].t === 'ws' ? p[0].v : '';
      if (sig.length === 2 && isStruct(sig[0].v)) {
        if (register) vars.set(sig[1].v, sig[0].v);
        return lead + leaves(structs, sig[0].v).map((s) => `int ${sig[1].v}${s}`).join(', ');
      }
      if (sig.length === 2) return p.map((t) => t.v).join('');
      if (sig.length === 1 && sig[0].t === 'id' && vars.has(sig[0].v)) {
        return lead + leaves(structs, vars.get(sig[0].v)!).map((s) => sig[0].v + s).join(', ');
      }
      if (sig.length === 1 && isStruct(sig[0].v)) {
        // a bare type (return list)
        return lead + leaves(structs, sig[0].v).map(() => 'int').join(', ');
      }
      if (sig.length >= 3 && sig[0].t === 'id' && vars.has(sig[0].v) && sig[1].v === '.') {
        // field path target
        let type = vars.get(sig[0].v)!; let path = sig[0].v;
        for (let q = 1; q + 1 < sig.length; q += 2) { type = fieldType(structs, type, sig[q + 1].v); path += `_${sig[q + 1].v}`; }
        return lead + leaves(structs, type).map((s) => path + s).join(', ');
      }
      return p.map((t) => t.v).join('');
    }).join(',');
  };
  const matchParen = (open: number): number => {
    let depth = 0;
    for (let k = open; k < toks.length; k += 1) {
      if (toks[k].v === '(') depth += 1;
      if (toks[k].v === ')') { depth -= 1; if (depth === 0) return k; }
    }
    throw new Error('unbalanced parens');
  };

  const dropParens = new Set<number>(); // indices of ')' to drop (struct literals)
  const topLevelSplit = (text: string): string[] => {
    const parts: string[] = [''];
    let depth = 0;
    for (const ch of text) {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) { parts.push(''); continue; }
      parts[parts.length - 1] += ch;
    }
    return parts.map((x) => x.trim());
  };
  const run = (from: number, to: number): string => {
  const out: string[] = [];
  let stmtStart = true;
  for (let i = from; i < to; i += 1) {
    const tk = toks[i];
    if (tk.t === 'ws' || tk.t === 'c') { out.push(tk.v); continue; }
    if (dropParens.has(i)) { stmtStart = false; continue; }

    if (tk.t === 'id' && tk.v === 'function') {
      vars = new Map();
      const nameI = nx(i + 1);
      const open = nx(nameI + 1);
      const close = matchParen(open);
      out.push(`function ${toks[nameI].v}(${lowerDeclList(open + 1, close, true)})`);
      let k = nx(close + 1);
      if (toks[k].v === 'returns') {
        const ro = nx(k + 1);
        const rc = matchParen(ro);
        out.push(` returns (${lowerDeclList(ro + 1, rc, false)})`);
        k = rc + 1;
      }
      i = k - 1;
      stmtStart = false;
      continue;
    }
    if (stmtStart && tk.t === 'id' && isStruct(tk.v) && toks[nx(i + 1)].t === 'id' && toks[nx(nx(i + 1) + 1)].v === '=') {
      // struct declaration with initializer: a function call initializes a tuple declaration,
      // anything else (a literal, another variable) one int declaration per leaf
      const nameI = nx(i + 1);
      const eqI = nx(nameI + 1);
      let semi = eqI;
      while (toks[semi].v !== ';') semi += 1;
      const initI = nx(eqI + 1);
      const isCall = toks[initI].t === 'id' && !isStruct(toks[initI].v) && !vars.has(toks[initI].v)
        && toks[nx(initI + 1)].v === '(' && matchParen(nx(initI + 1)) === pv(semi - 1);
      const init = run(eqI + 1, semi);
      const names = leaves(structs, tk.v).map((s) => toks[nameI].v + s);
      vars.set(toks[nameI].v, tk.v);
      if (isCall) out.push(`(${names.map((n) => `int ${n}`).join(', ')}) =${init};`);
      else {
        const exprs = topLevelSplit(init);
        if (exprs.length !== names.length) throw new Error(`initializer of ${toks[nameI].v} has ${exprs.length} values`);
        out.push(names.map((n, q) => `int ${n} = ${exprs[q]};`).join(' '));
      }
      i = semi;
      stmtStart = true;
      continue;
    }
    if (stmtStart && tk.v === '(') {
      // tuple target: lower its elements when it is followed by `=`
      const close = matchParen(i);
      if (toks[nx(close + 1)]?.v === '=' && toks[nx(nx(close + 1) + 1)]?.v !== '=') {
        out.push(`(${lowerDeclList(i + 1, close, true)})`);
        i = close;
        stmtStart = false;
        continue;
      }
    }
    if (stmtStart && tk.t === 'id' && vars.has(tk.v)) {
      // reassignment of a struct variable (or a struct-typed field path)
      const [text, j] = expandUse(i);
      const eq = nx(j);
      if (toks[eq].v === '=' && toks[nx(eq + 1)].v !== '=') {
        out.push(text.includes(',') ? `(${text})` : text);
        i = j - 1;
        stmtStart = false;
        continue;
      }
    }
    if (tk.t === 'id' && vars.has(tk.v) && toks[i - 1]?.v !== '.') {
      const [text, j] = expandUse(i);
      out.push(text);
      i = j - 1;
      stmtStart = false;
      continue;
    }
    if (tk.t === 'id' && isStruct(tk.v) && toks[nx(i + 1)].v === '(') {
      // struct literal: drop the name and its parens
      const open = nx(i + 1);
      dropParens.add(matchParen(open));
      i = open;
      stmtStart = false;
      continue;
    }
    out.push(tk.v);
    stmtStart = tk.v === ';' || tk.v === '{' || tk.v === '}';
  }
  return out.join('');
  };
  return run(0, toks.length);
}

const [inDir, outDir] = process.argv.slice(2);
const structs: Structs = new Map();
const files: string[] = [];
const walk = (dir: string, rel: string) => readdirSync(dir).forEach((f) => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) walk(p, join(rel, f));
  else if (f.endsWith('.cash')) files.push(join(rel, f));
});
walk(inDir, '');
// struct declarations first (any file), then lower every file
files.forEach((f) => collectStructs(tokenize(readFileSync(join(inDir, f), 'utf8')), structs));
files.forEach((f) => {
  const target = join(outDir, f);
  mkdirSync(join(target, '..'), { recursive: true });
  writeFileSync(target, lower(readFileSync(join(inDir, f), 'utf8'), structs));
});
console.log(`lowered ${files.length} files; structs: ${[...structs.keys()].join(', ')}`);
