import os
import re

files = [
    'sections/main-product.liquid',
    'sections/main-product-bracelet.liquid',
    'sections/main-product-combos.liquid',
    'sections/main-product-dometree.liquid',
    'sections/main-product-gemstones.liquid',
    'sections/main-product-idols.liquid',
    'sections/main-product-karungali.liquid',
    'sections/main-product-malas.liquid',
    'sections/main-product-pyrite.liquid',
    'sections/main-product-rudraksha.liquid',
    'sections/main-product-yantras.liquid'
]

# The new compact and responsive CSS
compact_css = """  /* STICKY BAR REDESIGN - COMPACT & RESPONSIVE */
  .ai-sticky-bar {
    position: fixed; bottom: 0; left: 0; right: 0; background: #fff;
    z-index: 1000; transform: translateY(100%); transition: transform 0.3s ease;
    border-top-left-radius: 15px; border-top-right-radius: 15px;
    box-shadow: 0 -5px 20px rgba(0,0,0,0.08); overflow: hidden;
    display: block; padding: 0;
  }
  .ai-sticky-bar.visible { transform: translateY(0); }
  
  .ai-sticky-banner {
    background: #34a853; color: #fff; text-align: center; padding: 4px 8px;
    font-size: 11px; font-weight: 800; letter-spacing: 0.3px;
  }
  .ai-sticky-content { 
    padding: 10px 15px; 
    display: flex; flex-direction: column; gap: 10px;
  }
  .ai-sticky-top-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .ai-sticky-img { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; background: #f9f9f9; border: 1px solid #eee; }
  .ai-sticky-info { display: flex; flex-direction: column; min-width: 0; }
  .ai-sticky-title { font-size: 13px; font-weight: 700; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
  
  .ai-sticky-price-row { display: flex; align-items: baseline; gap: 8px; }
  .ai-sticky-price { font-size: 16px; font-weight: 900; color: #000; }
  .ai-sticky-old { font-size: 12px; color: #999; text-decoration: line-through; font-weight: 600; }
  .ai-sticky-discount { font-size: 11px; color: #34a853; font-weight: 800; }
  
  .ai-sticky-btns { display: flex; gap: 8px; width: 100%; }
  .ai-btn-atc, .ai-btn-buy {
    flex: 1; border: none; padding: 12px; font-weight: 900; font-size: 12px;
    border-radius: 8px; cursor: pointer; text-transform: uppercase; white-space: nowrap;
    display: flex; align-items: center; justify-content: center;
  }
  .ai-btn-atc { background: #f3e05c; color: #000; }
  .ai-btn-buy { background: #000; color: #fff; }

  @media (min-width: 769px) {
    .ai-sticky-content { 
      flex-direction: row; 
      align-items: center; 
      justify-content: space-between; 
      max-width: 1200px; 
      margin: 0 auto; 
      padding: 12px 40px;
      gap: 30px;
    }
    .ai-sticky-top-info { gap: 15px; }
    .ai-sticky-img { width: 50px; height: 50px; }
    .ai-sticky-title { font-size: 16px; }
    .ai-sticky-price { font-size: 20px; }
    .ai-sticky-btns { width: auto; min-width: 450px; gap: 15px; }
    .ai-btn-atc, .ai-btn-buy { padding: 14px 30px; font-size: 14px; }
    .ai-sticky-banner { font-size: 13px; padding: 6px 10px; }
  }"""

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace the existing sticky bar CSS block
    # Match from STICKY BAR REDESIGN to the next block or end of style
    pattern = re.compile(r'/\* STICKY BAR REDESIGN.*?(?=\s*/\* NEW: CUSTOMER REVIEWS|\s*/\* TAGS|\s*\{%- endstyle -%})', re.DOTALL)
    
    if pattern.search(content):
        new_content = pattern.sub(compact_css + "\n", content)
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath} to compact design")
    else:
        print(f"Pattern not found in {filepath}")
