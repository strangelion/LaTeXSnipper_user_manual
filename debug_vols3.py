c = open('user_manual.html', encoding='utf-8').read()
idx = c.find('sec-mathcraft-intro')
if idx >= 0:
    print(c[max(0,idx-200):idx+300])
else:
    print('not found')
