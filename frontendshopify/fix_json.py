import os

files = [
    'sections/main-product-bracelet.liquid',
    'sections/main-product-combos.liquid',
    'sections/main-product-dometree.liquid',
    'sections/main-product-gemstones.liquid',
    'sections/main-product-idols.liquid',
    'sections/main-product-malas.liquid',
    'sections/main-product-pyrite.liquid',
    'sections/main-product-karungali.liquid',
    'sections/main-product-yantras.liquid',
    'sections/main-product-rudraksha.liquid'
]

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Fix the broken JSON transition between blocks
    # Looking for:
    #       ],
    #     { "type": "quantity_packs"
    
    broken_transition = '      ],\n    { "type": "quantity_packs"'
    fixed_transition = '      ]\n    },\n    { "type": "quantity_packs"'
    
    if broken_transition in content:
        content = content.replace(broken_transition, fixed_transition)
    
    # Also fix the extra closing bracket at the end of the quantity_packs block
    # It looks like:
    #       ]
    #     }
    #     }
    #   ],
    
    broken_end = '      ]\n    }\n    }\n  ],'
    fixed_end = '      ]\n    }\n  ],'
    
    if broken_end in content:
        content = content.replace(broken_end, fixed_end)
        
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Fixed JSON in {filepath}")
