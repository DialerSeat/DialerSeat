# Step 2 of 3: reads each channel's recent uploads and sets its median. See docs/YOUTUBE.md.
import json, re, statistics, requests, concurrent.futures as cf
from demand_map import H, C, initial_data, walk, num
D = json.load(open('yt.json'))
def channel(cid):
    try:
        r = requests.get(f'https://www.youtube.com/channel/{cid}/videos', params={'hl': 'en', 'gl': 'US'}, headers=H, cookies=C, timeout=40)
    except Exception:
        return cid, None
    d = initial_data(r.text); vids = []
    for x in walk(d, 'lockupViewModel'):
        try:
            md = x['metadata']['lockupMetadataViewModel']
            parts = md['metadata']['contentMetadataViewModel']['metadataRows'][-1]['metadataParts']
            views = num(parts[0].get('accessibilityLabel') or parts[0]['text']['content'])
            vids.append({'id': x.get('contentId'), 'title': md['title']['content'], 'views': views, 'age': parts[1]['text']['content'] if len(parts) > 1 else None})
        except Exception:
            pass
    return cid, vids
with cf.ThreadPoolExecutor(6) as ex:
    for cid, vids in ex.map(channel, list(D['channels'])):
        ch = D['channels'][cid]
        if vids is not None: ch['videos'] = vids
        vs = [v['views'] for v in ch['videos'] if v['views'] is not None]
        ch['median'] = statistics.median(vs) if len(vs) >= 8 else None
json.dump(D, open('yt.json', 'w'))
print(sum(1 for c in D['channels'].values() if c['median']), 'channels with a baseline')
