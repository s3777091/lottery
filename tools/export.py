import json, sys, numpy as np
def export(src, dst, off, meta, extra=None):
    d = json.load(open(src))
    if extra:
        for e in extra:
            for c in json.load(open(e))['columns']:
                c['kind'] = 'card'; d['columns'].append(c)
    cols = []
    for c in d['columns']:
        fr = c['frames']
        B = np.array([x['b'] for x in fr], float); I = np.array([x['i'] for x in fr], float); BOT = np.array([x['bot'] for x in fr])
        k = np.array([1, 2, 3, 2, 1], float); k /= k.sum()
        pad = lambda a: np.concatenate([a[:1].repeat(2, 0), a, a[-1:].repeat(2, 0)])
        Bs = np.stack([np.convolve(pad(B[:, j]), k, 'valid') for j in range(8)], 1)
        Is = np.convolve(pad(I), k, 'valid')
        if c['kind'] == 'card' or c['id'].startswith('P'):
            # panels / touch card: fully visible for the whole shot, short fade-in
            Is = np.clip(np.arange(len(fr)) / 6.0, 0, 1)
            BOT = np.ones(len(fr))
        # a block that sits on the big panel dissolves as soon as the panel appears
        if meta.get('yield') and c['id'] in meta['yield']:
            pstart = next((cc['frames'][0]['f'] for cc in d['columns'] if cc['id'] == meta['yield'][c['id']]), None)
            if pstart is not None:
                ff = np.array([x['f'] for x in fr])
                Is = Is * np.clip(1 - (ff - pstart) / 8.0, 0, 1)
        peak = int(np.argmax(Is >= Is.max() - 1e-6))
        rev = np.clip(np.maximum.accumulate(np.where(Is > 0.12, BOT, 0)), 0, 1); rev[peak:] = 1
        frames = [[int(fr[i]['f'] - off)] + [round(v, 1) for v in Bs[i]] + [round(float(Is[i]), 3), round(float(rev[i]), 3)] for i in range(len(fr))]
        cols.append({'id': c['id'], 'kind': c['kind'], 'peak': int(fr[peak]['f'] - off), 'frames': frames})
    json.dump(dict(meta, fps=30, width=1920, height=1080, columns=cols), open(dst, 'w'), separators=(',', ':'))
    print(dst, len(cols))
P = 'D:/workspace/lottery/public/effects/'
if 'f' in sys.argv[1:]:
    export('f1/cols_f.json', P + 'effect1-female.json', 0, {'id': 'effect1-female', 'video': '/videos/effect1-female.mp4', 'vortex': 13.4, 'moon': 14.3, 'duration': 16.73})
if 'm' in sys.argv[1:]:
    export('f1/cols_m.json', P + 'effect1-male.json', 503, {'id': 'effect1-male', 'video': '/videos/effect1-male.mp4', 'vortex': 12.4, 'moon': 13.5, 'duration': 17.76})
if 'f2' in sys.argv[1:]:
    export('f2/cols_f.json', P + 'effect2-female.json', 1037, {'touch': 46.7 - 34.567, 'yield': {'B1': 'P1'}, 'id': 'effect2-female', 'video': '/videos/effect2-female.mp4', 'vortex': 17.0, 'moon': 18.0, 'duration': 21.86, 'card': {'x': 1240, 'y': 600, 's': 0.82}}, ['f2/cols_tf.json'])
if 'm2' in sys.argv[1:]:
    export('f2/cols_m.json', P + 'effect2-male.json', 1693, {'touch': 68.5 - 56.433, 'yield': {'B1': 'P1'}, 'id': 'effect2-male', 'video': '/videos/effect2-male.mp4', 'vortex': 16.9, 'moon': 17.95, 'duration': 23.96, 'card': {'x': 1240, 'y': 600, 's': 0.82}}, ['f2/cols_tm.json'])
