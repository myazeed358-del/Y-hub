#!/usr/bin/env python3
"""Lightweight, dependency-free architecture smoke check; compiler is authoritative."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1] / 'artifacts' / 'y-hub' / 'src' / 'services' / 'math'
IMPORT_RE = re.compile(r'''\b(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]''')
FORBIDDEN = ('@/pages/', '@/components/', '@/features/', '@/hooks/', '@/utils/supabaseClient', '@/utils/cloudStorage')
violations = []
count = 0
for file in ROOT.rglob('*.ts'):
    if file.name.endswith('.test.ts') or '__tests__' in file.parts:
        continue
    count += 1
    raw = file.read_bytes()
    data = raw.decode('utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')
    for imp in IMPORT_RE.findall(data):
        if imp.startswith(FORBIDDEN):
            violations.append(f'{file.relative_to(ROOT)} imports UI/platform implementation {imp}')
        if 'ports' not in file.parts and (imp.startswith('../ports') or imp.startswith('@/services/math/ports')):
            violations.append(f'{file.relative_to(ROOT)} imports composition root {imp}')
    if file.parts[-2:] and 'ports' not in file.parts and re.search(r'\b(?:window|document|indexedDB|localStorage)\s*\.', data):
        violations.append(f'{file.relative_to(ROOT)} accesses browser-only storage/UI')

print(f'Math boundary check: {count} production TypeScript modules')
if violations:
    print('\n'.join('ERROR: '+v for v in violations), file=sys.stderr)
    sys.exit(1)
print('PASS: math core does not import UI/features/platform storage or its composition root')
