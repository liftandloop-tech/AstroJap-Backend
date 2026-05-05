import os

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

# Exact string to find and replace
bad_block = """                   </div>
         {%- endfor -%}

      </div>
    </div>
  </div>
           {%- endcase -%}"""

good_block = """                   </div>
          {%- endcase -%}
        {%- endfor -%}

      </div>
    </div>
  </div>"""

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    if bad_block in content:
        content = content.replace(bad_block, good_block)
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed structural error in {filepath}")
    else:
        # Try without the leading spaces in case they vary
        import re
        content = re.sub(r'</div>\s*\{%- endfor -%\}\s*</div>\s*</div>\s*</div>\s*\{%- endcase -%}', '</div>\n          {%- endcase -%}\n        {%- endfor -%}\n      </div>\n    </div>\n  </div>', content, flags=re.DOTALL)
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Fixed (regex) structural error in {filepath}")
