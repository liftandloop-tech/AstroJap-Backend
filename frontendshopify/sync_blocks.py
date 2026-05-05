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

with open('sections/main-product.liquid', 'r') as f:
    source = f.read()

# Extract the entire case statement for blocks
case_pattern = re.compile(r'{%- for block in section.blocks -%}.*?{%- endfor -%}', re.DOTALL)
case_match = case_pattern.search(source)
new_case = case_match.group(0) if case_match else ""

# Extract the JS helpers
js_pattern = re.compile(r'// GLOBAL REVIEW HELPERS.*?alert\(.*?\);\s+\};', re.DOTALL)
js_match = js_pattern.search(source)
new_js = js_match.group(0) if js_match else ""

for filepath in files[1:]:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Sync blocks
    content = case_pattern.sub(new_case, content)
    
    # Sync JS
    if 'GLOBAL REVIEW HELPERS' not in content:
        content = content.replace('</script>', new_js + '\n</script>')
    else:
        # Update existing
        content = re.sub(r'// GLOBAL REVIEW HELPERS.*?alert\(.*?\);\s+\};', new_js, content, flags=re.DOTALL)

    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Synced blocks and JS to {filepath}")
