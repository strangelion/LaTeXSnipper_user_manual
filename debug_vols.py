import re, sys
c = open('user_manual.html', encoding='utf-8').read()
vp = re.compile(r'<span class="volume-label">([^<]+)</span>')
vdivs = list(vp.finditer(c))
print('Volume dividers found:', len(vdivs))
for v in vdivs:
    print(' ', v.group(1))
print()
hp = re.compile(r'<h([1-3])\s*(?:id="([^"]*)")?\s*>(.*?)</h\1>')
for m in hp.finditer(c):
    hid = m.group(2) or ''
    if hid:
        raw = re.sub(r'<[^>]+>', '', m.group(3))
        pos = m.start()
        vol = 0
        for vi, vd in enumerate(vdivs):
            if pos > vd.start():
                vol = vi + 1
        print(f'  pos={pos:7d} vol={vol} #{hid} {raw[:40]}')
