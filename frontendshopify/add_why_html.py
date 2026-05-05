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

html_block = """
            {%- when 'why_astrojap_list' -%}
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
                   </div>"""

for filepath in files:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Insert before {%- endfor -%} which marks the end of the blocks loop
    if html_block not in content:
        content = content.replace('{%- endfor -%}', html_block + '\n        {%- endfor -%}', 1)
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Correctly added block to {filepath}")
