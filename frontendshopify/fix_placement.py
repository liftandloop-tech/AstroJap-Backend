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

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Identify the misplaced block
    misplaced_pattern = re.compile(r'\{%- endcase -%\}\s*\{%- when \'why_astrojap_list\' -%\}.*?</div>\s*</div>\s*</div>', re.DOTALL)
    
    match = misplaced_pattern.search(content)
    if match:
        block_content = match.group(0).replace('{%- endcase -%}', '').strip()
        # Remove the misplaced block
        content = misplaced_pattern.sub('{%- endcase -%}', content)
        # Now insert it BEFORE the endcase
        content = content.replace('{%- endcase -%}', block_content + '\n          {%- endcase -%}', 1)
        
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed placement in {filepath}")
    else:
        # Try finding just the when block after endcase
        alt_pattern = re.compile(r'\{%- endcase -%\}\s*\{%- when \'why_astrojap_list\' -%}', re.DOTALL)
        if alt_pattern.search(content):
            # This is more complex, I'll just use a more direct approach
            print(f"Found partial match in {filepath}, manual fix needed or better regex")
