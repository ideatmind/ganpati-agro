"""Import the supplied bilingual workbook without modifying it.

Usage: python scripts/import-village-directory.py workbook.xlsx [new_cli_migration.sql]
Village packs have content-addressed URLs; they are never bundled into client JS.
"""
import collections
import hashlib
import json
from pathlib import Path
import re
import sys
import openpyxl

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
book = openpyxl.load_workbook(source, read_only=True, data_only=True)
rows = [tuple(str(v).strip() if v is not None else '' for v in row[:9])
        for row in list(book['All Villages'].values)[4:] if row and row[0]]
assert rows and all(len(row) == 9 and all(row) for row in rows), 'Missing directory fields'
assert all(all(row[i].isdigit() for i in (0, 3, 6)) for row in rows), 'Invalid LGD code'
assert len({row[6] for row in rows}) == len(rows), 'Duplicate village codes'
aliases = {'4217': 'shirur_kasar', '4224': 'parli_vaijnath', '4225': 'ambajogai',
           '4243': 'umarga', '4247': 'solapur_north', '4253': 'solapur_south',
           '4251': 'sangola', '4252': 'mangalwedha'}
slug = lambda value: re.sub(r'[^a-z0-9]+', '_', value.lower()).strip('_')
compact = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':'))
districts, talukas, packs = {}, {}, {}
groups = collections.defaultdict(list)
for dcode, den, dmr, tcode, ten, tmr, vcode, ven, vmr in rows:
    district = slug(den)
    taluka = aliases.get(tcode, slug(ten))
    district_info = {'value': district, 'en': den, 'mr': dmr}
    taluka_info = [taluka, district, ten, tmr]
    assert district not in districts or districts[district] == district_info
    assert taluka not in talukas or talukas[taluka] == taluka_info
    districts[district], talukas[taluka] = district_info, taluka_info
    groups[taluka].append([vcode, ven, vmr])
    packs[taluka] = {'lgd': tcode}
for district in districts.values():
    sheet_codes = {str(row[6]).strip() for row in list(book[district['en']].values)[4:] if row and row[0]}
    assert sheet_codes == {row[6] for row in rows if row[1] == district['en']}, 'District sheet mismatch'
out = root / 'public/data/villages'
out.mkdir(parents=True, exist_ok=True)
sizes = []
for taluka, villages in groups.items():
    villages.sort(key=lambda row: (row[1].lower(), row[0]))
    payload = compact(villages).encode('utf-8')
    name = packs[taluka]['lgd'] + '-' + hashlib.sha256(payload).hexdigest()[:16] + '.json'
    (out / name).write_bytes(payload)
    packs[taluka].update(count=len(villages), path='/data/villages/' + name)
    sizes.append(len(payload))
order = ['dharashiv', 'solapur', 'beed', 'sangli', 'latur']
district_list = [districts[key] for key in order if key in districts]
assert len(district_list) == len(districts), 'Unexpected district: review coverage before importing'
taluka_list = sorted(talukas.values(), key=lambda row: (order.index(row[1]), row[2]))
counts = [{'district': key, 'talukas': sum(t[1] == key for t in taluka_list),
           'villages': sum(len(groups[t[0]]) for t in taluka_list if t[1] == key)} for key in order]
generated = '// Generated from the supplied bilingual village workbook. Run scripts/import-village-directory.py to update.\n'
for name, value in [('DISTRICTS', district_list), ('TALUKAS', taluka_list), ('VILLAGE_PACKS', packs), ('DIRECTORY_COUNTS', counts)]:
    generated += 'export const ' + name + ' = ' + json.dumps(value, ensure_ascii=False, indent=2) + ' as const;\n'
directory = root / 'src/features/geography'
directory.mkdir(parents=True, exist_ok=True)
(directory / 'directory.ts').write_text(generated, encoding='utf-8')
quote = lambda value: "'" + value.replace("'", "''") + "'"
sql = '-- Generated geography data; existing codes are preserved for saved records.\n'
sql += 'insert into public.districts(code,name_en,name_mr) values\n'
sql += ',\n'.join('(' + ','.join(quote(d[k]) for k in ('value', 'en', 'mr')) + ')' for d in district_list)
sql += '\non conflict(code) do update set name_en=excluded.name_en,name_mr=excluded.name_mr;\n\n'
sql += 'insert into public.talukas(code,district_code,name_en,name_mr) values\n'
sql += ',\n'.join('(' + ','.join(map(quote, row)) + ')' for row in taluka_list)
sql += '\non conflict(code) do update set district_code=excluded.district_code,name_en=excluded.name_en,name_mr=excluded.name_mr;\n'
(root / 'supabase/seeds/geography.sql').write_text(sql, encoding='utf-8')
if len(sys.argv) > 2:
    migration = Path(sys.argv[2]).resolve()
    assert migration.parent == (root / 'supabase/migrations').resolve() and migration.exists(), 'Generate the migration with the CLI first'
    assert not migration.read_text(encoding='utf-8').strip(), 'Do not overwrite an existing migration'
    migration.write_text('begin;\n' + sql + 'commit;\n', encoding='utf-8')
print(json.dumps({'villages': len(rows), 'talukas': len(talukas), 'districts': len(districts),
                  'largestPackBytes': max(sizes), 'totalPackBytes': sum(sizes), 'counts': counts}))
