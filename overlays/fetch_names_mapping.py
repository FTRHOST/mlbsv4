#!/usr/bin/env python3
import os
import json
import subprocess
import requests
from html.parser import HTMLParser

# Base URL for Fandom
BASE_URL = "https://mobile-legends.fandom.com"
LIST_URL = f"{BASE_URL}/wiki/List_of_heroes"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_JSON_PATH = os.path.join(SCRIPT_DIR, "assets", "heroes.json")

class ListParser(HTMLParser):
    """Parses the List of Heroes page to extract name, order, detail link, and default icon."""
    def __init__(self):
        super().__init__()
        self.heroes = []
        self.current_row = []
        self.in_row = False
        self.in_cell = False
        self.cell_data = []
        self.current_link = None
        self.current_list_icon = None
        self.in_table = False
        self.table_depth = 0
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        
        if tag == 'table':
            self.in_table = True
            self.table_depth += 1
            
        if not self.in_table:
            return
            
        if tag == 'tr':
            self.in_row = True
            self.current_row = []
            
        if tag == 'td' and self.in_row:
            self.in_cell = True
            self.cell_data = []
            self.current_link = None
            self.current_list_icon = None
            
        if tag == 'a' and self.in_cell:
            self.current_link = attrs_dict.get('href')
            
        if tag == 'img' and self.in_cell and len(self.current_row) == 1:
            self.current_list_icon = attrs_dict.get('data-src') or attrs_dict.get('src')

    def handle_data(self, data):
        if self.in_cell:
            self.cell_data.append(data)

    def handle_endtag(self, tag):
        if tag == 'table':
            self.table_depth -= 1
            if self.table_depth == 0:
                self.in_table = False
                
        if not self.in_table:
            return
            
        if tag == 'td' and self.in_row:
            self.in_cell = False
            cell_text = "".join(self.cell_data).strip()
            self.current_row.append({
                'text': cell_text,
                'link': self.current_link,
                'list_icon': self.current_list_icon
            })
            
        if tag == 'tr' and self.in_row:
            self.in_row = False
            # Ensure row has at least 4 columns (Checkbox, Icon, Hero Name, Hero Order)
            if len(self.current_row) >= 4:
                col_icon = self.current_row[1]
                col_name = self.current_row[2]
                col_order = self.current_row[3]
                
                hero_link = col_icon.get('link')
                hero_name_full = col_name.get('text', '')
                hero_name = hero_name_full.split(',')[0].strip()
                hero_order = col_order.get('text', '').strip()
                
                if hero_link and hero_link.startswith('/wiki/') and hero_order.isdigit():
                    self.heroes.append({
                        'name': hero_name,
                        'order': int(hero_order)
                    })

def download_page(url):
    """Downloads HTML page using requests, with curl as a fallback to bypass Cloudflare."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
    }
    
    # 1. Try python requests
    try:
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code == 200:
            return r.text
    except Exception:
        pass
        
    # 2. Fallback to curl
    try:
        cmd = [
            "curl", "-sL",
            "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "-H", "Accept-Language: en-US,en;q=0.5",
            url
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if result.returncode == 0:
            return result.stdout
    except Exception:
        pass
        
    return None

def main():
    print(f"Fetching List of Heroes page: {LIST_URL}")
    list_html = download_page(LIST_URL)
    if not list_html:
        print("[Error] Failed to load list page.")
        return
        
    parser = ListParser()
    parser.feed(list_html)
    
    if not parser.heroes:
        print("[Error] No heroes parsed from the HTML. The table structure may have changed.")
        return
        
    # Sort heroes by order index
    sorted_heroes = sorted(parser.heroes, key=lambda x: x['order'])
    
    # Create simple mapping format: {"1": "Miya", "2": "Balmond", ...}
    mapping = {str(h['order']): h['name'] for h in sorted_heroes}
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(OUTPUT_JSON_PATH), exist_ok=True)
    
    # Save as JSON file
    with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully saved {len(mapping)} heroes mapping to: {OUTPUT_JSON_PATH}")
    
    # Print formatted list
    print("\n=== HERO NAMES BY ORDER ===")
    for h in sorted_heroes:
        print(f"#{h['order']}: {h['name']}")

if __name__ == "__main__":
    main()
