#!/usr/bin/env python3
"""Read-only dependency report for Y-Hub's TypeScript source.

This intentionally measures only statically resolvable imports; it does not
attempt to resolve TS path maps outside @/, bundler plugins, or dynamic specifiers.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "artifacts/y-hub/src"
EXTS = (".ts", ".tsx", ".js", ".jsx")
PATTERN = re.compile(
    r"\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['\"]([^'\"]+)['\"]"
)


def is_test(path: Path) -> bool:
    return "__tests__" in path.parts or ".test." in path.name or ".spec." in path.name


def area(path: Path) -> str:
    parts = path.relative_to(APP).parts
    if parts[0] == "features" and len(parts) > 1:
        return "/".join(parts[:2])
    if parts[:2] == ("services", "math") and len(parts) > 2:
        return "/".join(parts[:3])
    return parts[0]


def resolve(source: Path, spec: str, known: set[Path]) -> Path | None:
    if spec.startswith("@/"):
        base = APP / spec[2:]
    elif spec.startswith(("./", "../")):
        base = source.parent / spec
    else:
        return None
    base = base.resolve()
    candidates = [base] + [Path(str(base) + e) for e in EXTS]
    candidates += [base / ("index" + e) for e in EXTS]
    return next((c for c in candidates if c in known), None)


def cycle_groups(graph: dict[Path, set[Path]], nodes: set[Path]):
    idx = 0
    indices = {}
    low = {}
    stack = []
    active = set()
    cycles = []

    def visit(node):
        nonlocal idx
        indices[node] = low[node] = idx
        idx += 1
        stack.append(node)
        active.add(node)
        for target in sorted(graph[node]):
            if target not in indices:
                visit(target)
                low[node] = min(low[node], low[target])
            elif target in active:
                low[node] = min(low[node], indices[target])
        if low[node] == indices[node]:
            component = []
            while True:
                member = stack.pop()
                active.remove(member)
                component.append(member)
                if member == node:
                    break
            if len(component) > 1 or node in graph[node]:
                cycles.append(component)

    sys.setrecursionlimit(max(2000, len(nodes) * 4))
    for node in sorted(nodes):
        if node not in indices:
            visit(node)
    return cycles


def main():
    files = {p.resolve() for p in APP.rglob("*") if p.suffix in EXTS and p.is_file()}
    production = {p for p in files if not is_test(p)}
    graph = defaultdict(set)
    unresolved = []
    for source in production:
        text = source.read_text(encoding="utf-8", errors="replace")
        # Exclude standalone comments; multiline/template examples may still
        # require review because this is a lightweight static approximation.
        text = "\n".join(line for line in text.splitlines()
                         if not line.lstrip().startswith(("//", "*")))
        for spec in set(PATTERN.findall(text)):
            target = resolve(source, spec, files)
            if target is not None and target in production:
                graph[source].add(target)
            elif spec.startswith(("./", "../", "@/")):
                unresolved.append((source, spec))

    all_cycles = cycle_groups(graph, production)
    directions = Counter()
    cross_features = []
    for source, targets in graph.items():
        for target in targets:
            a, b = area(source), area(target)
            if a != b:
                directions[(a, b)] += 1
            if a.startswith("features/") and b.startswith("features/") and a != b:
                cross_features.append((source, target))

    print("Y-Hub Static Architecture Report (read only)")
    print("Production TS/JS files:", len(production))
    print("Resolved production edges:", sum(map(len, graph.values())))
    print("Circular dependency components:", len(all_cycles))
    print("Direct cross-feature imports:", len(cross_features))
    print("Unresolved local specifiers (may be fixtures/assets):", len(unresolved))
    for comp in sorted(all_cycles, key=len, reverse=True)[:10]:
        print("CYCLE:", ", ".join(str(p.relative_to(APP)) for p in comp))
    for source, target in cross_features[:20]:
        print("CROSS_FEATURE:", source.relative_to(APP), "->", target.relative_to(APP))
    print("Top cross-area imports:")
    for (a, b), n in directions.most_common(20):
        print(f"  {n:3} {a} -> {b}")
    print("Note: This is not a compiler-authoritative or runtime dependency graph.")
    if "--strict" in sys.argv and (all_cycles or cross_features):
        print("FAIL: architecture boundaries violated")
        sys.exit(1)
    if "--strict" in sys.argv:
        print("PASS: no static cycles or direct cross-feature dependencies")


if __name__ == "__main__":
    main()
