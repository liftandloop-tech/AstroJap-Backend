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

pattern = re.compile(r'<div class="ai-timer-box">.*?</div>', re.DOTALL)
replacement = '{%- comment -%} Upper timer removed as requested {%- endcomment -%}'

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    if '<div class="ai-timer-box">' in content:
        content = pattern.sub(replacement, content)
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Removed upper timer from {filepath}")
    else:
        print(f"Upper timer not found in {filepath}")
