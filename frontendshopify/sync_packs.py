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

# Source content from main-product.liquid
with open('sections/main-product.liquid', 'r') as f:
    source_content = f.read()

# Extract pieces to sync
# 1. CSS
css_pattern = re.compile(r'/\* QUANTITY PACKS \*/.*?@media \(max-width: 768px\) \{.*?\}', re.DOTALL)
css_match = css_pattern.search(source_content)
new_css = css_match.group(0) if css_match else ""

# 2. Liquid Block (Case statement)
liquid_pattern = re.compile(r'\{%- when \'quantity_packs\' -%\}.*?\{%- when \'special_offer\' -%}', re.DOTALL)
liquid_match = liquid_pattern.search(source_content)
new_liquid = liquid_match.group(0) if liquid_match else ""

# 3. JS Logic
js_pattern = re.compile(r'// QUANTITY PACK SELECTOR LOGIC.*?initPackTimer\(\);\s+\}\);', re.DOTALL)
js_match = js_pattern.search(source_content)
new_js = js_match.group(0) if js_match else ""

# 4. Schema Block
schema_pattern = re.compile(r'\{ "type": "quantity_packs", "name": "Quantity Pack Selector".*?\}\s+\]\s+\}', re.DOTALL)
schema_match = schema_pattern.search(source_content)
new_schema = schema_match.group(0) if schema_match else ""

for filepath in files[1:]: # Skip main-product.liquid
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Sync CSS
    if '/* QUANTITY PACKS */' not in content:
        content = content.replace('{%- endstyle -%}', new_css + '\n\n{%- endstyle -%}')
    
    # Sync Liquid Block
    if 'quantity_packs' not in content:
        content = content.replace('{%- when \'special_offer\' -%}', new_liquid)
    
    # Sync JS
    if 'QUANTITY PACK SELECTOR LOGIC' not in content:
        content = content.replace('</script>', new_js + '\n</script>')
    
    # Sync Schema
    if '"quantity_packs"' not in content:
        # Find the end of the blocks array
        content = re.sub(r'(\s*)\{\s*"type": "customer_reviews_app".*?\}\s*\]', r'\g<0>,\n    ' + new_schema.replace('] }', '').strip(), content, flags=re.DOTALL)
        # Fix the trailing ] if needed
        if 'quantity_packs' in content and ']' not in content.split('quantity_packs')[-1]:
             content = content.replace(new_schema.replace('] }', '').strip(), new_schema.replace('] }', '').strip() + '\n  ]')

    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Synced {filepath}")
