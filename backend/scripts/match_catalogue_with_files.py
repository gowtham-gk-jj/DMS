import json
import os
import re

def normalize(s):
    if not s:
        return ""
    return re.sub(r'[^a-zA-Z0-9]', '', s).lower()

def match_catalogue():
    with open('C:/Project/DMS/backend/data/catalogue_extracted.json', 'r', encoding='utf-8') as f:
        catalogue = json.load(f)
        
    with open('C:/Project/DMS/backend/data/extraction_inventory.json', 'r', encoding='utf-8') as f:
        inventory = json.load(f)
        
    # Get all PDF files from inventory
    # Priority given to English/pdf/ manuals
    manual_pdfs = []
    other_files = []
    for f in inventory['files']:
        norm_path = f['filePath'].replace('\\', '/')
        if '/English/pdf/' in norm_path and f['fileExtension'] == 'pdf':
            manual_pdfs.append(f)
        else:
            other_files.append(f)
            
    print(f"Total catalogue entries: {len(catalogue)}")
    print(f"Manual PDFs in English/pdf/: {len(manual_pdfs)}")
    
    # Build indexes for matching
    # 1. Exact filename / stem map in manual_pdfs
    pdf_by_stem_exact = {f['stem']: f for f in manual_pdfs}
    pdf_by_stem_lower = {f['stem'].lower(): f for f in manual_pdfs}
    pdf_by_stem_norm = {normalize(f['stem']): f for f in manual_pdfs}
    
    matched_results = []
    available_count = 0
    missing_count = 0
    pending_review_count = 0
    
    # We also keep track of which files have been matched
    matched_file_paths = set()
    
    for idx, doc in enumerate(catalogue, 1):
        fn = doc['fileName']
        title = doc['title']
        order = doc['orderNumber']
        doc_code = doc.get('documentCode') or fn
        
        matched_file = None
        match_rule = None
        match_confidence = 0.0
        
        # Priority 1: Exact file name / stem (case-sensitive or exact match with .pdf)
        if fn in pdf_by_stem_exact:
            matched_file = pdf_by_stem_exact[fn]
            match_rule = "PRIORITY_1_EXACT_FILENAME"
            match_confidence = 1.0
        elif fn.lower() in pdf_by_stem_lower:
            matched_file = pdf_by_stem_lower[fn.lower()]
            match_rule = "PRIORITY_1_FILENAME_CASE_INSENSITIVE"
            match_confidence = 0.99
            
        # Priority 2: Exact document code
        elif doc_code and doc_code.lower() in pdf_by_stem_lower:
            matched_file = pdf_by_stem_lower[doc_code.lower()]
            match_rule = "PRIORITY_2_DOCUMENT_CODE"
            match_confidence = 0.95
            
        # Priority 3: Exact order number match (or normalized order number)
        if not matched_file and order:
            norm_order = normalize(order)
            # Check if any manual PDF contains this order number in filename or inspect content
            for f in manual_pdfs:
                if norm_order and norm_order in normalize(f['fileName']):
                    matched_file = f
                    match_rule = "PRIORITY_3_ORDER_NUMBER_IN_FILENAME"
                    match_confidence = 0.95
                    break
                    
        # Special verified Siemens DOConCD known mappings
        # E.g. 1FE1VPM120_BE -> 1FE1_VPM120_BE.pdf (underscore variation)
        if not matched_file:
            norm_fn = normalize(fn)
            if norm_fn in pdf_by_stem_norm:
                matched_file = pdf_by_stem_norm[norm_fn]
                match_rule = "PRIORITY_1_NORMALIZED_FILENAME"
                match_confidence = 0.95
                
        # Known Siemens naming variations verified by order number:
        if not matched_file:
            if fn == 'BBDNCO' and 'BDNCO' in pdf_by_stem_exact:
                matched_file = pdf_by_stem_exact['BDNCO']
                match_rule = "PRIORITY_3_ORDER_NUMBER_VERIFIED (6FC5398-7DP20-0BA0)"
                match_confidence = 0.95
            elif fn == 'S7OP' and 'S7OP2' in pdf_by_stem_exact:
                matched_file = pdf_by_stem_exact['S7OP2']
                match_rule = "PRIORITY_3_ORDER_NUMBER_VERIFIED (A5E02354744-04)"
                match_confidence = 0.95
            elif fn == 'FBICsl' and 'FBIC' in pdf_by_stem_exact:
                matched_file = pdf_by_stem_exact['FBIC']
                match_rule = "PRIORITY_5_VERIFIED_TITLE_MATCH"
                match_confidence = 0.90

        if matched_file:
            status = "AVAILABLE"
            available_count += 1
            matched_file_paths.add(matched_file['filePath'])
            file_meta = {
                "originalFileName": matched_file['fileName'],
                "filePath": matched_file['filePath'],
                "fileSize": matched_file['fileSize'],
                "fileExtension": matched_file['fileExtension'],
                "sha256": matched_file['sha256'],
            }
        else:
            status = "FILE_NOT_FOUND"
            missing_count += 1
            file_meta = {
                "originalFileName": f"{fn}.pdf",
                "filePath": "",
                "fileSize": 0,
                "fileExtension": "pdf",
                "sha256": "",
            }
            
        matched_results.append({
            "displayOrder": idx,
            "cataloguePage": doc['cataloguePage'],
            "system": doc['system'],
            "title": doc['title'],
            "softwareVersion": doc['softwareVersion'],
            "edition": doc['edition'],
            "orderNumber": doc['orderNumber'],
            "fileName": fn,
            "category": doc['category'],
            "subcategory": doc['subcategory'],
            "categoryPath": doc['categoryPath'],
            "availabilityStatus": status,
            "matchRule": match_rule,
            "matchConfidence": match_confidence,
            **file_meta
        })

    print("\n--- MATCHING SUMMARY ---")
    print(f"Total catalogue entries: {len(matched_results)}")
    print(f"Matched & AVAILABLE: {available_count}")
    print(f"Missing (FILE_NOT_FOUND): {missing_count}")
    print(f"Pending manual review: {pending_review_count}")
    print(f"Distinct files matched: {len(matched_file_paths)}")
    
    out_path = 'C:/Project/DMS/backend/data/catalogue_matched.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(matched_results, f, indent=2, ensure_ascii=False)
        
    print(f"Saved matched catalogue to: {out_path}")
    return matched_results

if __name__ == '__main__':
    match_catalogue()
