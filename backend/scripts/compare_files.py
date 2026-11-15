import os
import json

pdf_dir = r'C:\Users\lmspr\Desktop\Mani\manual\07_DocOnCD_2011_09\DOConCD_SINUMERIK_SINAMICS\English\pdf'
actual_files = os.listdir(pdf_dir)
actual_stems = {os.path.splitext(f)[0].lower(): f for f in actual_files if f.lower().endswith('.pdf')}

with open('C:/Project/DMS/backend/data/catalogue_extracted.json', 'r', encoding='utf-8') as f:
    catalogue = json.load(f)

cat_file_names = {e['fileName'].lower(): e for e in catalogue}

print(f"Actual PDF files on disk: {len(actual_stems)}")
print(f"Catalogue entries: {len(cat_file_names)}")

# Files on disk not in catalogue
unmatched_on_disk = []
for stem, fname in actual_stems.items():
    if stem not in cat_file_names:
        unmatched_on_disk.append(fname)

print(f"\nFiles on disk NOT in catalogue ({len(unmatched_on_disk)}):")
for f in unmatched_on_disk:
    print(f" - {f}")

# Catalogue entries not on disk
missing_from_disk = []
for fn, e in cat_file_names.items():
    if fn not in actual_stems:
        missing_from_disk.append(e)

print(f"\nCatalogue entries NOT on disk ({len(missing_from_disk)}):")
for e in missing_from_disk:
    print(f" - Pg {e['cataloguePage']}: {e['fileName']} | {e['title']}")
