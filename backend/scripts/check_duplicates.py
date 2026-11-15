import json
from collections import Counter

with open('C:/Project/DMS/backend/data/catalogue_extracted.json', 'r', encoding='utf-8') as f:
    catalogue = json.load(f)

counts = Counter([e['fileName'] for e in catalogue])
duplicates = {k: v for k, v in counts.items() if v > 1}
print('Duplicate fileNames in catalogue:', duplicates)
for k in duplicates:
    for e in catalogue:
        if e['fileName'] == k:
            print(f"  Pg {e['cataloguePage']}: {e['categoryPath']} | {e['fileName']} | {e['title']} | {e['orderNumber']}")
