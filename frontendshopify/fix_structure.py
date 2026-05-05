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
    
    # 1. Correct the endfor / endcase order
    # The misplaced endcase is at line 869 in main-product.liquid (after loop)
    # I'll just find {%- endfor -%} followed by {%- endcase -%} later and fix it.
    
    # Better: Identify the loop correctly.
    # We want: {%- endcase -%}\s*{%- endfor -%}
    
    # If we find {%- endfor -%}.*?{%- endcase -%}, it's wrong.
    
    # Actually, I'll just replace the whole block loop with a clean version.
    
    # First, let's remove the misplaced endcase
    content = content.replace('{%- endfor -%}\n\n      </div>\n    </div>\n  </div>\n          {%- endcase -%}', '{%- endcase -%}\n        {%- endfor -%}\n\n      </div>\n    </div>\n  </div>')
    
    # Also handle variations in whitespace
    content = re.sub(r'\{%- endfor -%\}.*?\{%- endcase -%}', '{%- endcase -%}\n        {%- endfor -%}', content, flags=re.DOTALL)
    
    # Wait, line 866 and 867 are closing divs for info-col and product-layout.
    # They should be AFTER the loop.
    
    # Let's check main-product.liquid lines 817-870 again.
    # 817:                 </div>
    # 818:              </div>
    # 819:           {%- when 'why_astrojap_list' -%}
    # ...
    # 863:                </div>
    # 864:      {%- endfor -%}
    # 865:
    # 866:    </div>
    # 867:  </div>
    # 868:</div>
    # 869:        {%- endcase -%}
    
    # Correct structure should be:
    # ...
    # 863:                </div>
    # 864:           {%- endcase -%}
    # 865:         {%- endfor -%}
    # 866:       </div>
    # 867:     </div>
    # 868:   </div>
    # 869: </section>
    
    # I'll use a very specific replacement to fix this structure.
    
    wrong_end = re.compile(r'\{%- endfor -%\}\s*</div>\s*</div>\s*</div>\s*\{%- endcase -%}', re.DOTALL)
    correct_end = '{%- endcase -%}\n        {%- endfor -%}\n      </div>\n    </div>\n  </div>'
    
    if wrong_end.search(content):
        content = wrong_end.sub(correct_end, content)
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Corrected loop structure in {filepath}")
    else:
        print(f"Pattern not found in {filepath}")
