import pdfplumber
import json
import re

pdf_path = r'C:\Users\lmspr\Desktop\Mani\manual\07_DocOnCD_2011_09\DOConCD_SINUMERIK_SINAMICS\English\TOC_SINUMERIK_SINAMICS_0911_en.pdf'

def parse_pdf():
    entries = []
    current_category = ""
    current_subcategory = ""
    
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            chars = page.chars
            # Group into lines by top coordinate
            lines = {}
            for c in chars:
                top_key = round(c['top'], 1)
                found = False
                for k in lines:
                    if abs(k - top_key) < 2.5:
                        lines[k].append(c)
                        found = True
                        break
                if not found:
                    lines[top_key] = [c]
            
            sorted_tops = sorted(lines.keys())
            for top in sorted_tops:
                line_chars = lines[top]
                line_chars.sort(key=lambda x: x['x0'])
                text = ''.join(c['text'] for c in line_chars).strip()
                
                # Filter headers and footers
                if not text or 'DOConCD SINUMERIK' in text or 'Seite ' in text or 'SystemTitleSWEdition' in text:
                    continue
                if 'updated edition' in text or 'for the first time on DOConCD' in text:
                    continue
                
                first_char = line_chars[0]
                size = round(first_char.get('size', 0), 1)
                font = first_char.get('fontname', '')
                is_bold = 'Bold' in font
                x0 = round(first_char.get('x0', 0), 1)
                
                # Check for major categories (sz ~ 8.9 and bold and x0 < 60)
                if size >= 8.5 and is_bold and x0 < 60:
                    current_category = text
                    current_subcategory = ""
                    print(f"[CATEGORY] {current_category} (Page {page_num})")
                    continue
                
                # Check for subcategories (sz ~ 7.4 and bold and x0 < 60 and no order number or file name on right)
                # Let's see if line has right-aligned tokens
                has_right = any(c['x0'] > 550 for c in line_chars)
                if not has_right and is_bold and x0 < 60:
                    current_subcategory = text
                    print(f"  [SUBCATEGORY] {current_subcategory}")
                    continue
                
                # It's a document row!
                # Split characters into columns by x0:
                # System: x < 165
                # Title: 165 <= x < 505
                # SW: 505 <= x < 540
                # Edition: 540 <= x < 594
                # Order No.: 594 <= x < 679
                # File name: x >= 679
                sys_chars = [c['text'] for c in line_chars if c['x0'] < 165]
                title_chars = [c['text'] for c in line_chars if 165 <= c['x0'] < 505]
                sw_chars = [c['text'] for c in line_chars if 505 <= c['x0'] < 540]
                ed_chars = [c['text'] for c in line_chars if 540 <= c['x0'] < 594]
                order_chars = [c['text'] for c in line_chars if 594 <= c['x0'] < 679]
                file_chars = [c['text'] for c in line_chars if c['x0'] >= 679]
                
                system = ''.join(sys_chars).strip()
                title = ''.join(title_chars).strip()
                sw = ''.join(sw_chars).strip()
                edition = ''.join(ed_chars).strip()
                order = ''.join(order_chars).strip()
                file_name = ''.join(file_chars).strip()
                
                # If order is '-' or empty, keep it clean
                if order == '-':
                    order = ''
                
                cat_path = current_category
                if current_subcategory:
                    cat_path = f"{current_category} / {current_subcategory}"
                
                entries.append({
                    "cataloguePage": page_num,
                    "category": current_category,
                    "subcategory": current_subcategory,
                    "categoryPath": cat_path,
                    "system": system,
                    "title": title,
                    "softwareVersion": sw,
                    "edition": edition,
                    "orderNumber": order,
                    "fileName": file_name,
                    "rawText": text
                })

    print(f"\nTotal extracted entries: {len(entries)}")
    with open('C:/Project/DMS/backend/data/catalogue_extracted.json', 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    return entries

if __name__ == '__main__':
    parse_pdf()
