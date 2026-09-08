import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\status-jank.json') as f:
    d=json.load(f)
models=d.get('models',[])
# how many models have jankrouter as provider now
jank_models=[m for m in models if 'jankrouter' in m.get('providers',[])]
print("models with jankrouter pipe:", len(jank_models))
for m in d.get('models',[]):
    if m['id']=='glm-5.2':
        print("glm-5.2:", json.dumps(m)[:400])
# check a previously-jank image model
for m in d.get('models',[]):
    if m['id'] in ('flux-1-schnell','nanobanana'):
        print(m['id'], "providers=", m.get('providers'))
