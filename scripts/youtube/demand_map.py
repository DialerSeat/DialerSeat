# Demand map, step 1 of 3. See docs/YOUTUBE.md. Writes yt.json in the working directory.
"""Demand map for the dialer / cold-calling niche on YouTube.
Step 1: search ~50 buyer phrases, keep every video result.
Step 2: open each channel that produced a result, read its recent uploads,
        and score every video against that channel's own median (outlier score).
Writes yt.json."""
import requests, re, json, time, statistics, concurrent.futures as cf

H = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9'}
C = {'CONSENT': 'YES+1'}
SEEDS = [
 'cold calling', 'cold calling tips', 'cold calling script', 'cold call opener', 'cold calling for beginners', 'cold calling objections',
 'how to cold call', 'live cold calls', 'cold calling real estate', 'cold calling insurance', 'final expense cold calling', 'life insurance phone sales',
 'cold calling expired listings', 'fsbo cold calling', 'wholesaling cold calling', 'solar appointment setting', 'mortgage loan officer cold calling',
 'debt collection calls', 'sdr cold calling', 'b2b cold calling', 'appointment setting', 'remote appointment setter', 'cold calling job',
 'power dialer', 'predictive dialer', 'auto dialer', 'parallel dialer', 'best dialer for cold calling', 'dialer for real estate',
 'mojo dialer', 'readymode dialer', 'phoneburner', 'batchdialer', 'vicidial', 'orum dialer', 'kixie', 'call center software',
 'spam likely', 'phone number flagged as spam', 'local presence dialing', 'do not call list', 'tcpa', 'telemarketing laws',
 'how many cold calls a day', 'cold calling numbers', 'sales call recording', 'phone sales training', 'insurance agent dialing leads',
 'virtual assistant cold calling', 'call center agent tips',
]

def initial_data(html):
    m = re.search(r'var ytInitialData = (\{.*?\});</script>', html)
    return json.loads(m.group(1)) if m else {}

def walk(o, key):
    if isinstance(o, dict):
        if key in o: yield o[key]
        for v in o.values(): yield from walk(v, key)
    elif isinstance(o, list):
        for v in o: yield from walk(v, key)

def num(s):
    if not s: return None
    s = s.replace(',', '').lower()
    m = re.search(r'([\d.]+)\s*(thousand|million|billion|k|m|b)?', s)
    if not m: return None
    mult = {'k': 1e3, 'thousand': 1e3, 'm': 1e6, 'million': 1e6, 'b': 1e9, 'billion': 1e9}.get(m.group(2) or '', 1)
    return int(float(m.group(1)) * mult)

def search(q):
    r = requests.get('https://www.youtube.com/results', params={'search_query': q, 'hl': 'en', 'gl': 'US'}, headers=H, cookies=C, timeout=40)
    out = []
    for v in walk(initial_data(r.text), 'videoRenderer'):
        try:
            out.append({'id': v['videoId'], 'title': ''.join(x['text'] for x in v['title']['runs']),
                        'views': num(v.get('viewCountText', {}).get('simpleText')), 'age': v.get('publishedTimeText', {}).get('simpleText'),
                        'len': v.get('lengthText', {}).get('simpleText'), 'channel': v['ownerText']['runs'][0]['text'],
                        'cid': v['ownerText']['runs'][0]['navigationEndpoint']['browseEndpoint']['browseId'], 'q': q})
        except Exception:
            pass
    return out

def channel(cid):
    r = requests.get(f'https://www.youtube.com/channel/{cid}/videos', params={'hl': 'en', 'gl': 'US'}, headers=H, cookies=C, timeout=40)
    d = initial_data(r.text)
    subs = None
    for t in re.findall(r'"([\d.,]+[KM]?) subscribers"', r.text)[:1]:
        subs = num(t)
    vids = []
    for v in walk(d, 'videoRenderer'):
        try:
            vids.append({'id': v['videoId'], 'title': ''.join(x['text'] for x in v['title']['runs']),
                         'views': num(v.get('viewCountText', {}).get('simpleText')), 'age': v.get('publishedTimeText', {}).get('simpleText')})
        except Exception:
            pass
    return cid, {'subs': subs, 'videos': vids}

if __name__ == "__main__":
    res = []
    for q in SEEDS:
        try:
            res += search(q)
        except Exception as e:
            print('search fail', q, e)
        time.sleep(0.6)
    print(len(res), 'search results')
    cids = sorted({r['cid'] for r in res})
    chans = {}
    with cf.ThreadPoolExecutor(6) as ex:
        for cid, info in ex.map(channel, cids):
            chans[cid] = info
    print(len(chans), 'channels read')
    for cid, info in chans.items():
        vs = [v['views'] for v in info['videos'] if v['views']]
        info['median'] = statistics.median(vs) if len(vs) >= 5 else None
    json.dump({'search': res, 'channels': chans}, open('yt.json', 'w'))
