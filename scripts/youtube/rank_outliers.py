# Step 3 of 3: videos at 3x+ their own channel's median, filtered to the niche. See docs/YOUTUBE.md.
import json, re
D=json.load(open('yt.json')); S=D['search']; C=D['channels']
names={r['cid']:r['channel'] for r in S}
seen={}
for r in S:
    if r['id'] in seen: seen[r['id']]['qs'].append(r['q']); continue
    r=dict(r); r['qs']=[r['q']]; seen[r['id']]=r
for cid,ch in C.items():
    for v in ch.get('videos',[]):
        if v['id'] and v['id'] not in seen and v['views']:
            seen[v['id']]={'id':v['id'],'title':v['title'],'views':v['views'],'age':v['age'],'cid':cid,'qs':['(upload)']}
REL=re.compile(r'cold call|dial|appointment|setter|sdr|bdr|phone|call cent|sales call|objection|script|telemarket|spam|do not call|tcpa|lead|prospect|insurance|real estate|expired|fsbo|wholesal|solar|mortgage|loan officer|recruit|closing|sales', re.I)
rows=[]
for r in seen.values():
    med=C.get(r['cid'],{}).get('median')
    if r['views'] and med and med>=300 and REL.search(r['title']): rows.append((r['views']/med, r))
rows.sort(key=lambda x:-x[0])
out=[(s,r) for s,r in rows if s>=3 and r['views']>=20000]
print('niche outliers (>=3x own channel median, >=20k views):', len(out))
for s,r in out[:120]:
    print(f"{s:5.1f}x {r['views']:>9,} | {(r['age'] or ''):>8} | {names.get(r['cid'],'')[:20]:20} | {r['title'][:92]}")
