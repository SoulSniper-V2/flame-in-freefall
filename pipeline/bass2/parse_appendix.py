"""Parse BASS-II Appendix A test matrices (NASA/TM-20210011385, pdftotext -layout) into row blocks.
Each block keeps its raw text so every extracted value can be traced back to the report."""
import re, json, os
R = os.path.join(os.path.dirname(__file__), '..', '..')
T = open(os.path.join(R, 'data/literature/txt/20210011385.txt'), errors='ignore').read().split('\n')
start = next(i for i, l in enumerate(T) if 'TABLE A.1.' in l and 'TEST MATRIX' in l)
end = len(T)
ID = re.compile(r'(?<![\w-])([BFPMOT]\d{1,2}[a-z]?)(?![\w-])')
rows = []; cur = None; table = None
for i in range(start, end):
    l = T[i]
    m = re.search(r'TABLE A\.(\d)', l)
    if m: table = 'A.' + m.group(1)
    if 'NASA/TM-20210011385' in l: continue
    # a row starts when a test id appears in the test-number column region (chars 60-140) together with a sample number
    head = l[30:220]
    mm = re.search(r'\s(\d{1,3})\s+([BFPMOT]\d{1,2}[a-z]?)\s+(\d{1,3}[mM]?|NA|---+|N/A)\s', ' ' + head + ' ')
    if mm:
        if cur: rows.append(cur)
        cur = {'table': table, 'as_run': mm.group(1), 'test': mm.group(2), 'sample': mm.group(3), 'line': i + 1, 'lines': [l]}
    elif cur is not None:
        if re.search(r'TABLE A\.', l): rows.append(cur); cur = None; continue
        cur['lines'].append(l)
if cur: rows.append(cur)
print(len(rows), 'rows'); print(sorted(set(r['test'][0] for r in rows)))
json.dump(rows, open(os.path.join(os.path.dirname(__file__), 'rows_raw.json'), 'w'), indent=0)
