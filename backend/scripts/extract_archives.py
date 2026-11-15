import os
import zipfile
import hashlib
import json
import shutil
import sys

def sha256_file(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()

def is_safe_path(base_dir, path):
    resolved_base = os.path.abspath(base_dir)
    resolved_path = os.path.abspath(path)
    return os.path.commonpath([resolved_base, resolved_path]) == resolved_base

def safe_extract_zip(zip_path, target_dir):
    extracted_files = []
    failed_entries = []
    
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for member in zf.infolist():
            # Check for path traversal attacks
            target_path = os.path.join(target_dir, member.filename)
            if not is_safe_path(target_dir, target_path):
                print(f"[SECURITY WARNING] Skipping unsafe zip member: {member.filename}")
                failed_entries.append({"name": member.filename, "reason": "Path traversal detected"})
                continue
            
            try:
                zf.extract(member, target_dir)
                if not member.is_dir():
                    extracted_files.append(target_path)
            except Exception as e:
                print(f"[EXTRACTION ERROR] Failed to extract {member.filename}: {e}")
                failed_entries.append({"name": member.filename, "reason": str(e)})
                
    return extracted_files, failed_entries

def process_repository(repo_dir, temp_dir):
    print("=" * 60)
    print("STARTING SAFE EXTRACTION & REPOSITORY SCAN")
    print(f"Source repo: {repo_dir}")
    print(f"Target temp dir: {temp_dir}")
    print("=" * 60)
    
    os.makedirs(temp_dir, exist_ok=True)
    
    # 1. Identify all zip archives in repo
    zip_archives = []
    for root, dirs, files in os.walk(repo_dir):
        if '.git' in dirs:
            dirs.remove('.git')
        for f in files:
            if f.lower().endswith('.zip'):
                zip_archives.append(os.path.join(root, f))
                
    print(f"Found {len(zip_archives)} top-level ZIP archives:")
    for z in zip_archives:
        size_mb = os.path.getsize(z) / (1024 * 1024)
        print(f" - {os.path.basename(z)} ({size_mb:.2f} MB)")
        
    all_extracted_files = []
    all_failed_entries = []
    corrupted_archives = []
    nested_zips_found = []
    
    # 2. Extract top-level archives
    for z_path in zip_archives:
        z_name = os.path.splitext(os.path.basename(z_path))[0]
        extract_sub = os.path.join(temp_dir, z_name)
        os.makedirs(extract_sub, exist_ok=True)
        print(f"\nExtracting archive: {os.path.basename(z_path)} ...")
        
        try:
            with zipfile.ZipFile(z_path, 'r') as test_z:
                bad_file = test_z.testzip()
                if bad_file:
                    print(f"[ERROR] Corrupted file inside {z_path}: {bad_file}")
                    corrupted_archives.append(z_path)
                    continue
        except Exception as e:
            print(f"[ERROR] Corrupted archive {z_path}: {e}")
            corrupted_archives.append(z_path)
            continue
            
        files, fails = safe_extract_zip(z_path, extract_sub)
        all_extracted_files.extend(files)
        all_failed_entries.extend(fails)
        print(f"Successfully extracted {len(files)} files from {os.path.basename(z_path)}")
        
    # 3. Recursively check for nested zip archives inside temp_dir
    print("\nScanning for nested ZIP archives...")
    nested_queue = []
    for f in all_extracted_files:
        if f.lower().endswith('.zip'):
            nested_queue.append(f)
            
    while nested_queue:
        nested_zip = nested_queue.pop(0)
        nested_zips_found.append(nested_zip)
        rel_dir = os.path.splitext(nested_zip)[0]
        os.makedirs(rel_dir, exist_ok=True)
        print(f"Extracting nested zip: {os.path.basename(nested_zip)} ...")
        try:
            n_files, n_fails = safe_extract_zip(nested_zip, rel_dir)
            all_extracted_files.extend(n_files)
            all_failed_entries.extend(n_fails)
            # check if any further nested zips
            for nf in n_files:
                if nf.lower().endswith('.zip'):
                    nested_queue.append(nf)
        except Exception as e:
            print(f"[ERROR] Failed extracting nested zip {nested_zip}: {e}")
            corrupted_archives.append(nested_zip)
            
    print(f"\nTotal nested ZIP archives extracted: {len(nested_zips_found)}")
    print(f"Total files in working directory: {len(all_extracted_files)}")
    
    # 4. Inventory, SHA-256 Checksums, and Duplicates Detection
    print("\nComputing SHA-256 checksums and building document inventory...")
    file_inventory = []
    seen_hashes = {}
    duplicate_files = []
    by_extension = {}
    
    for fpath in all_extracted_files:
        if not os.path.isfile(fpath):
            continue
        fname = os.path.basename(fpath)
        ext = os.path.splitext(fname)[1].lower().replace('.', '')
        fsize = os.path.getsize(fpath)
        sha = sha256_file(fpath)
        
        by_extension[ext] = by_extension.get(ext, 0) + 1
        
        if sha in seen_hashes:
            duplicate_files.append({
                "filePath": fpath,
                "fileName": fname,
                "originalFile": seen_hashes[sha],
                "sha256": sha,
                "fileSize": fsize
            })
        else:
            seen_hashes[sha] = fpath
            
        file_inventory.append({
            "filePath": fpath,
            "fileName": fname,
            "stem": os.path.splitext(fname)[0],
            "fileExtension": ext,
            "fileSize": fsize,
            "sha256": sha,
            "isDuplicate": sha in seen_hashes and seen_hashes[sha] != fpath
        })
        
    print("\n--- INVENTORY BREAKDOWN BY FORMAT ---")
    for ext, count in sorted(by_extension.items(), key=lambda x: -x[1]):
        print(f"  .{ext or 'no_ext'}: {count} files")
        
    print(f"\nTotal duplicate files identified: {len(duplicate_files)}")
    
    # Save inventory
    summary = {
        "repositoryDirectory": repo_dir,
        "temporaryWorkingDir": temp_dir,
        "archivesFound": len(zip_archives),
        "nestedArchivesFound": len(nested_zips_found),
        "corruptedArchives": len(corrupted_archives),
        "totalExtractedFiles": len(all_extracted_files),
        "uniqueChecksumCount": len(seen_hashes),
        "duplicateFileCount": len(duplicate_files),
        "formatBreakdown": by_extension,
        "extractionFailures": all_failed_entries,
        "files": file_inventory
    }
    
    out_json = 'C:/Project/DMS/backend/data/extraction_inventory.json'
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
        
    print(f"\nExtraction and inventory complete! Saved to {out_json}")
    return summary

if __name__ == '__main__':
    repo = r'C:\Project\fileforDMS'
    temp = r'C:\Project\DMS\temp_migration\extracted'
    process_repository(repo, temp)
