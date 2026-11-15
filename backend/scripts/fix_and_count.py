import json
from collections import defaultdict

with open('C:/Project/DMS/backend/data/catalogue_extracted.json', 'r', encoding='utf-8') as f:
    catalogue = json.load(f)

# Fix 'Functions' if needed
for e in catalogue:
    if e['subcategory'] == 'Functions':
        e['category'] = 'Functions'
        e['subcategory'] = ''
        e['categoryPath'] = 'Functions'

with open('C:/Project/DMS/backend/data/catalogue_extracted.json', 'w', encoding='utf-8') as f:
    json.dump(catalogue, f, indent=2, ensure_ascii=False)

cat_counts = defaultdict(int)
for e in catalogue:
    cat_counts[e['categoryPath']] += 1

print("--- Category-wise document counts (186 total) ---")
for cat, count in cat_counts.items():
    print(f"{cat}: {count}")
