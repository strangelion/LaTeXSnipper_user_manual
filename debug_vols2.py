import re, sys
c = open('user_manual.html', encoding='utf-8').read()
# Find volume dividers
for m in re.finditer(r'<span class="volume-label">([^<]+)</span>', c):
    print(f'DIVIDER at {m.start()}: {m.group(1)}')
    # Show next 1000 chars after divider
    print(c[m.end():m.end()+800])
    print('---')
