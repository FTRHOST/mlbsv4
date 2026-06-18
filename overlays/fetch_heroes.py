#!/usr/bin/env python3
import os
import io
import time
import argparse
import subprocess
import requests
from html.parser import HTMLParser
from PIL import Image

# Setup directories relative to the script location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HEROES_DIR = os.path.join(SCRIPT_DIR, "assets", "heroes")
HEROES_SA_DIR = os.path.join(SCRIPT_DIR, "assets", "heroes-sa")
HEROES_ICON_DIR = os.path.join(SCRIPT_DIR, "assets", "heroes-icon")

# Base URL for Fandom
BASE_URL = "https://mobile-legends.fandom.com"
LIST_URL = f"{BASE_URL}/wiki/List_of_heroes"

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
            # Column index 1 is the Icon column
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
                list_icon = col_icon.get('list_icon')
                
                if hero_link and hero_link.startswith('/wiki/') and hero_order.isdigit():
                    self.heroes.append({
                        'name': hero_name,
                        'order': int(hero_order),
                        'link': BASE_URL + hero_link,
                        'list_icon': list_icon
                    })

class DetailParser(HTMLParser):
    """Parses a specific hero page to extract the infobox portrait, splash art, and icons."""
    def __init__(self):
        super().__init__()
        self.portrait = None
        self.galleries = []
        self.current_gallery = None
        self.div_depth = 0
        self.gallery_depth = 0
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        
        # 1. Parse Portrait from Portable Infobox image tags
        if tag == 'img':
            classes = attrs_dict.get('class', '').split()
            if 'pi-image-thumbnail' in classes or 'pi-image' in classes:
                src = attrs_dict.get('src') or attrs_dict.get('data-src')
                if src and not self.portrait:
                    self.portrait = src
                    
        # 2. Track gallery containers (wikia-gallery class)
        if tag == 'div':
            self.div_depth += 1
            classes = attrs_dict.get('class', '').split()
            if any('wikia-gallery' in c for c in classes):
                self.current_gallery = []
                self.gallery_depth = self.div_depth
                
        if tag == 'img' and self.current_gallery is not None:
            src = attrs_dict.get('data-src') or attrs_dict.get('src')
            if src:
                self.current_gallery.append(src)
                
    def handle_endtag(self, tag):
        if tag == 'div':
            if self.div_depth == self.gallery_depth and self.current_gallery is not None:
                self.galleries.append(self.current_gallery)
                self.current_gallery = None
                self.gallery_depth = 0
            self.div_depth -= 1

def clean_url(url):
    """Removes thumbnail scaling parameters from Wikia CDN URLs to get the original high-res image."""
    if not url:
        return None
    if '/revision/latest' in url:
        return url.split('/revision/latest')[0]
    return url

def download_page(url):
    """Downloads HTML page using requests, with curl as a fallback to bypass Cloudflare.
    Includes verification to reject Cloudflare challenge pages."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
    }
    
    def is_valid_html(text):
        if not text:
            return False
        # Reject Cloudflare challenge pages
        if "Just a moment..." in text or "challenges.cloudflare.com" in text:
            return False
        # Reject pages that do not look like Fandom Wiki pages
        if "wiki" in url.lower() and not ("mw-parser-output" in text or "portable-infobox" in text or "wikia-gallery" in text or "List_of_heroes" in url):
            return False
        return True

    # 1. Try python requests
    try:
        r = requests.get(url, headers=headers, timeout=15)
        if r.status_code == 200 and is_valid_html(r.text):
            return r.text
    except Exception:
        pass
        
    # 2. Fallback to curl subprocess (highly effective at bypassing Cloudflare blocks on datacenters)
    try:
        cmd = [
            "curl", "-sL",
            "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "-H", "Accept-Language: en-US,en;q=0.5",
            url
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if result.returncode == 0 and is_valid_html(result.stdout):
            return result.stdout
    except Exception:
        pass
        
    return None

def download_and_save_as_webp(img_url, save_path, max_retries=3):
    """Downloads binary image data and uses Pillow to convert and save it as WebP format.
    Includes retry backoff for network stability."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    
    for attempt in range(1, max_retries + 1):
        img_data = None
        
        # 1. Try python requests
        try:
            r = requests.get(img_url, headers=headers, timeout=20)
            if r.status_code == 200:
                img_data = r.content
        except Exception:
            pass
            
        # 2. Fallback to curl subprocess
        if not img_data:
            try:
                cmd = [
                    "curl", "-sL",
                    "-H", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
                    img_url
                ]
                result = subprocess.run(cmd, capture_output=True, timeout=20)
                if result.returncode == 0:
                    img_data = result.stdout
            except Exception:
                pass
                
        if img_data:
            try:
                # Ensure target folder exists
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                # Load bytes into PIL and save in WebP format
                img = Image.open(io.BytesIO(img_data))
                img.save(save_path, "WEBP")
                return True
            except Exception as e:
                print(f"    [Error] Failed to convert image to WebP on attempt {attempt}: {e}")
        
        if attempt < max_retries:
            time.sleep(attempt * 2)
            
    print(f"    [Error] Failed to download image after {max_retries} attempts: {img_url}")
    return False

def process_hero(hero, idx, total_heroes, force_overwrite):
    """Processes a single hero, downloads assets, and returns True if fully successful."""
    name = hero['name']
    order = hero['order']
    link = hero['link']
    list_icon = hero['list_icon']
    
    # Build targets
    portrait_path = os.path.join(HEROES_DIR, f"{order}.webp")
    sa_path = os.path.join(HEROES_SA_DIR, f"{order}.webp")
    icon_path = os.path.join(HEROES_ICON_DIR, f"{order}.webp")
    
    # Check if all files exist to possibly skip
    if not force_overwrite and os.path.exists(portrait_path) and os.path.exists(sa_path) and os.path.exists(icon_path):
        print(f"[{idx}/{total_heroes}] Skipping {name} (#{order}) - All assets already exist.")
        return True
        
    print(f"[{idx}/{total_heroes}] Processing {name} (#{order})...")
    
    # Fetch individual hero page with retries and verification
    hero_html = None
    detail_parser = None
    for attempt in range(1, 4):
        hero_html = download_page(link)
        if hero_html:
            detail_parser = DetailParser()
            detail_parser.feed(hero_html)
            # Verify that it is a valid hero page containing infobox or galleries
            if detail_parser.portrait or any(g for g in detail_parser.galleries):
                break
        
        if attempt < 3:
            print(f"  [Info] Attempt {attempt} failed or returned incomplete page. Retrying in {attempt * 3}s...")
            time.sleep(attempt * 3)
            
    if not hero_html or not detail_parser:
        print(f"  [Warning] Failed to download valid page for {name} ({link})")
        return False
        
    # Determine image source URLs
    portrait_url = clean_url(detail_parser.portrait)
    
    # Find first gallery (skins gallery)
    splash_url = None
    for g in detail_parser.galleries:
        if g:
            splash_url = clean_url(g[0])
            break
            
    # Find icon gallery
    icon_url = None
    for g in detail_parser.galleries:
        if g:
            first_img = clean_url(g[0]).lower()
            if 'icon' in first_img and '-portrait' not in first_img:
                icon_url = clean_url(g[0])
                break
                
    # Fallbacks
    if not portrait_url:
        portrait_url = splash_url
        print("  [Info] Portrait not found in infobox. Using splash art as fallback.")
        
    if not splash_url:
        splash_url = portrait_url
        print("  [Info] Splash art not found in galleries. Using portrait as fallback.")
        
    if not icon_url:
        icon_url = clean_url(list_icon)
        print("  [Info] Icon not found in galleries. Using list page icon as fallback.")
        
    # Download and Save
    downloads = []
    
    # 1. Download Portrait
    if portrait_url:
        res = download_and_save_as_webp(portrait_url, portrait_path)
        downloads.append(res)
        if res:
            print(f"  ✔ Portrait saved to assets/heroes/{order}.webp")
    else:
        print("  ✘ Portrait URL not available.")
        downloads.append(False)
        
    # 2. Download Splash Art
    if splash_url:
        res = download_and_save_as_webp(splash_url, sa_path)
        downloads.append(res)
        if res:
            print(f"  ✔ Splash Art saved to assets/heroes-sa/{order}.webp")
    else:
        print("  ✘ Splash Art URL not available.")
        downloads.append(False)
        
    # 3. Download Icon
    if icon_url:
        res = download_and_save_as_webp(icon_url, icon_path)
        downloads.append(res)
        if res:
            print(f"  ✔ Icon saved to assets/heroes-icon/{order}.webp")
    else:
        print("  ✘ Icon URL not available.")
        downloads.append(False)
        
    return all(downloads)

def main():
    parser = argparse.ArgumentParser(description="Auto-fetch hero portrait, splash art, and icons from Mobile Legends Wiki.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files even if they already exist.")
    parser.add_argument("--delay", type=float, default=1.5, help="Delay (in seconds) between requests to prevent rate limits.")
    args = parser.parse_args()

    print("====================================================")
    print("      MOBILE LEGENDS HERO MEDIA SCRAPER & WEBP CONVERTER")
    print("====================================================")
    print(f"Target directories:")
    print(f"  - Portraits:   {HEROES_DIR}")
    print(f"  - Splash Arts: {HEROES_SA_DIR}")
    print(f"  - Icons:       {HEROES_ICON_DIR}")
    print("====================================================")

    # 1. Fetching list page with retries
    print(f"Fetching List of Heroes page from: {LIST_URL}")
    list_html = None
    for attempt in range(1, 4):
        list_html = download_page(LIST_URL)
        if list_html:
            break
        print(f"  [Info] Failed to load list page. Retrying in {attempt * 3}s...")
        time.sleep(attempt * 3)

    if not list_html:
        print("[Fatal Error] Could not retrieve the list of heroes. Check your internet connection.")
        return
        
    list_parser = ListParser()
    list_parser.feed(list_html)
    
    total_heroes = len(list_parser.heroes)
    print(f"Successfully loaded list of heroes. Found {total_heroes} heroes to process.")
    print("====================================================")

    # First Pass
    failed_heroes = []
    for idx, hero in enumerate(list_parser.heroes, 1):
        success = process_hero(hero, idx, total_heroes, args.force)
        if not success:
            failed_heroes.append(hero)
        if idx < total_heroes and args.delay > 0:
            time.sleep(args.delay)
            
    # Auto-Retry Pass for Failed Heroes (Pass 2 & 3)
    pass_num = 2
    while failed_heroes and pass_num <= 3:
        num_failed = len(failed_heroes)
        print("\n====================================================")
        print(f"   PASS {pass_num}: AUTOMATICALLY RETRYING {num_failed} FAILED HEROES")
        print("====================================================")
        print("Waiting 15 seconds to let rate limits cool down...")
        time.sleep(15)
        
        still_failed = []
        for idx, hero in enumerate(failed_heroes, 1):
            success = process_hero(hero, idx, num_failed, args.force)
            if not success:
                still_failed.append(hero)
            if idx < num_failed and args.delay > 0:
                time.sleep(args.delay)
                
        failed_heroes = still_failed
        pass_num += 1

    print("====================================================")
    if failed_heroes:
        print(f"Scrape completed with warnings! Failed to download assets for {len(failed_heroes)} heroes:")
        for fh in failed_heroes:
            print(f"  - {fh['name']} (#{fh['order']})")
        print("You can run the script again later to retry them.")
    else:
        print(f"Scrape completed successfully! All assets for {total_heroes} heroes have been saved.")
    print("====================================================")

if __name__ == "__main__":
    main()
