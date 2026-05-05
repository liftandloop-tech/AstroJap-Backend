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

# 1. Update font import
# 2. Update H1 style

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Update @import to include Noto Sans
    old_import = "family=Inter:wght@400;600;800&display=swap"
    new_import = "family=Inter:wght@400;600;800&family=Noto+Sans:wght@400;700&display=swap"
    content = content.replace(old_import, new_import)
    
    # Update H1 style
    # Target: <h1 style="margin:0; font-family: 'Inter', sans-serif !important; font-weight: 400; font-size: 32px; color: #111;">
    # Replacement: <h1 style="margin:0; font-family: 'Noto Sans', sans-serif !important; font-weight: 400; font-size: 24px; color: #111;">
    
    h1_pattern = re.compile(r'<h1 style="margin:0; font-family: \'Inter\', sans-serif !important; font-weight: 400; font-size: 32px; color: #111;">')
    new_h1 = '<h1 style="margin:0; font-family: \'Noto Sans\', sans-serif !important; font-weight: 400; font-size: 24px; color: #111;">'
    
    if h1_pattern.search(content):
        content = h1_pattern.sub(new_h1, content)
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated font and size for {filepath}")
    else:
        # Try a more flexible pattern in case I changed it slightly in some files
        flexible_pattern = re.compile(r'<h1 style="margin:0; font-family: \'Inter\'.*?font-size: \d+px; color: #111;">')
        if flexible_pattern.search(content):
            content = flexible_pattern.sub(new_h1, content)
            with open(filepath, 'w') as f:
                f.write(content)
            print(f"Updated (flexible) font and size for {filepath}")
        else:
            print(f"Could not find H1 pattern in {filepath}")
