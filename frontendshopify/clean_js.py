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

# Pattern to find the old timer JS function
# Usually it looks like: function updateTimer() { ... document.getElementById('timer-display-...') ... }
# Or it's part of a setInterval

js_pattern = re.compile(r'function updateTimer\(sid\).*?setInterval\(.*?\);\s+\}', re.DOTALL)
# Another possible pattern for a simpler one
js_pattern_2 = re.compile(r'function updateTimer\(.*?\).*?timer-display-.*?\}', re.DOTALL)

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Remove the JS logic for the old timer
    if 'timer-display-' in content:
        # Match from the start of the function containing 'timer-display' to its end
        # We need to be careful not to remove the NEW timer logic (pack-timer)
        # The new logic uses 'pack-timer'
        
        # Search for a block of code that contains 'timer-display' but NOT 'pack-timer'
        # Actually, the old logic is usually a standalone function or block.
        
        lines = content.split('\n')
        new_lines = []
        skip = False
        for line in lines:
            if 'timer-display-' in line:
                # If it's a simple line, skip it
                continue
            new_lines.append(line)
        
        content = '\n'.join(new_lines)
        
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Cleaned JS from {filepath}")
