import json

with open('C:/Project/DMS/backend/data/catalogue_extracted.json', 'r', encoding='utf-8') as f:
    entries = json.load(f)

print(f'Total entries: {len(entries)}')
for idx, e in enumerate(entries):
    missing = []
    if not e['fileName']: missing.append('fileName')
    if not e['title']: missing.append('title')
    if not e['system']: missing.append('system')
    if missing:
        print(f"Row {idx+1} [Pg {e['cataloguePage']}] Missing {missing}: sys='{e['system']}', title='{e['title']}', fn='{e['fileName']}', raw='{e['rawText']}'")
