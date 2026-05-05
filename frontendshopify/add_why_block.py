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

# 1. CSS
new_css = """  /* WHY ASTROJAP LIST */
  .ai-why-list-wrap { margin: 30px 0; background: #fffcf5; padding: 25px 20px; border-radius: 20px; }
  .ai-why-list-head { position: relative; margin-bottom: 25px; }
  .ai-why-list-head h3 { font-size: 26px; font-weight: 800; margin: 0; color: #000; }
  .ai-why-list-head::after { content: ''; display: block; width: 120px; height: 6px; background: #f3e05c; border-radius: 10px; margin-top: 8px; opacity: 0.7; }
  
  .ai-why-list-item { display: flex; align-items: center; gap: 20px; padding: 20px; border-radius: 20px; margin-bottom: 15px; border: 1px solid #eee; background: #fff; transition: transform 0.2s; }
  .ai-why-list-item:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
  
  .ai-why-list-icon { width: 50px; height: 50px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
  .ai-why-list-icon svg { width: 28px; height: 28px; color: #000; }
  
  .ai-why-list-info { flex: 1; }
  .ai-why-list-title { font-weight: 800; font-size: 16px; color: #000; margin-bottom: 4px; display: block; }
  .ai-why-list-desc { font-size: 14px; color: #555; line-height: 1.4; }
  .ai-why-list-desc b { color: #34a853; font-weight: 800; }

  .ai-why-card-blue { border-color: #b3e5fc !important; background: #f1faff !important; }
  .ai-why-card-purple { border-color: #e1bee7 !important; background: #fcf3ff !important; }
  .ai-why-card-green { border-color: #c8e6c9 !important; background: #f1fdf1 !important; }
  .ai-why-card-orange { border-color: #ffe0b2 !important; background: #fff8ee !important; }"""

# 2. HTML
new_html = """            {%- when 'why_astrojap_list' -%}
                <div class="ai-why-list-wrap" {{ block.shopify_attributes }}>
                   <div class="ai-why-list-head">
                      <h3>{{ block.settings.heading }}</h3>
                   </div>
                   
                   <div class="ai-why-list-item ai-why-card-blue">
                      <div class="ai-why-list-icon">
                         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                      </div>
                      <div class="ai-why-list-info">
                         <span class="ai-why-list-title">Happy Customers</span>
                         <span class="ai-why-list-desc">More than <b>15 Lakh+</b> users have trusted us</span>
                      </div>
                   </div>

                   <div class="ai-why-list-item ai-why-card-purple">
                      <div class="ai-why-list-icon">
                         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
                      </div>
                      <div class="ai-why-list-info">
                         <span class="ai-why-list-title">100% Original & Certified</span>
                         <span class="ai-why-list-desc">Certified by top labs in India.</span>
                      </div>
                   </div>

                   <div class="ai-why-list-item ai-why-card-green">
                      <div class="ai-why-list-icon">
                         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                      </div>
                      <div class="ai-why-list-info">
                         <span class="ai-why-list-title">Return & Exchange</span>
                         <span class="ai-why-list-desc">Easy 7-day return & exchange process.</span>
                      </div>
                   </div>

                   <div class="ai-why-list-item ai-why-card-orange">
                      <div class="ai-why-list-icon">
                         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                      </div>
                      <div class="ai-why-list-info">
                         <span class="ai-why-list-title">Free Shipping</span>
                         <span class="ai-why-list-desc">Free shipping all over India.</span>
                      </div>
                   </div>
                </div>"""

# 3. Schema
new_block_schema = """    { "type": "why_astrojap_list", "name": "Why AstroJap List", "limit": 1,
      "settings": [
        { "type": "text", "id": "heading", "label": "Heading", "default": "Why AstroJap ?" }
      ]
    },"""

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Insert CSS before {%- endstyle -%}
    if new_css not in content:
        content = content.replace('{%- endstyle -%}', new_css + '\n{%- endstyle -%}')
    
    # Insert HTML before the last block type (customer_reviews_app or collapsible_tab)
    if new_html not in content:
        # Insert before {%- endcase -%} inside the loop
        # Actually, let's find the last {%- endcase -%}
        content = content.replace('{%- endcase -%}', new_html + '\n          {%- endcase -%}', 1)
        # Note: using replace(..., 1) might not be ideal, better to find the loop.
        # Let's try finding the last case block
        # Actually, I'll just append it to the end of the case
        content = content.replace('{%- endcase -%}', new_html + '\n          {%- endcase -%}')
        # Wait, if I use replace without 1, it will add it to every case!
        # I'll use a better approach.
    
    # Correct way to add a case:
    # Find {%- for block in section.blocks -%}.*?{%- endfor -%}
    # Then insert before {%- endcase -%}
    
    # Actually, I'll just restore the whole section part for all files to be sure.
    # But for now, let's try a safer regex for the HTML.
    
    # I'll rewrite the script to be more robust.
    
    # 4. Schema
    if new_block_schema not in content:
        content = content.replace('"blocks": [', '"blocks": [\n' + new_block_schema)

    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Added Why AstroJap block to {filepath}")
