import json, urllib.request

req = urllib.request.Request('https://nextrouter-vert.vercel.app/api/v1/models')
req.add_header('Authorization', 'Bearer nr_i3NPqP8dVXtmGFvIxKs_Woy9sNF5T4Rk_fEZbQ8PGMA')
with urllib.request.urlopen(req, timeout=30) as r:
    d = json.load(r)
models = d.get('data', [])
free = sorted(m['id'] for m in models if ':free' in m['id'] or m['id'] == 'kilo-auto/free')
print('catalog total:', len(models))
print('catalog kilo-free:', len(free))
for x in free:
    print(' ', x)

expected = set("""cohere/north-mini-code:free
dots-studio/dots-3-note-preview:free
kilo-auto/free
liquid/lfm-2.5-2.6b:free
nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
nvidia/nemotron-3-super-120b-a12b:free
nvidia/nemotron-3-ultra-550b-a55b:free
nvidia/nemotron-3.5-content-safety:free
nvidia/nemotron-3.5-lightning:free
poolside/laguna-s-2.1:free
poolside/laguna-xs-2.1:free
stepfun/step-3.7-flash:free
tencent/hy3:free
thinkingmachines/inkling-small:free
thinkingmachines/inkling:free""".splitlines())
print('missing from catalog:', sorted(expected - set(free)))
