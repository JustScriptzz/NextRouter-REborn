import json, urllib.request, urllib.error
# find a healthy crax model
with urllib.request.urlopen(urllib.request.Request('https://nextrouter-vert.vercel.app/api/status'), timeout=40) as r:
    st=json.load(r)
crax=[] 
for m in st.get('models',[]):
    if 'crax' in m.get('providers',[]):
        avail=m.get('avail')
        if avail is not None and avail>0.5:
            crax.append((m['id'], avail))
print("crax models:", crax[:8])

def ask(model):
    body=json.dumps({"model":model,"messages":[{"role":"user","content":"Who are you? Answer in one sentence."}],"max_tokens":80}).encode()
    req=urllib.request.Request('https://nextrouter-vert.vercel.app/api/v1/chat/completions',data=body,headers={'Authorization':'Bearer nr_i3NPqP8dVXtmGFvIxKs_Woy9sNF5T4Rk_fEZbQ8PGMA','Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=60) as resp:
            j=json.load(resp)
            msg=j['choices'][0]['message']
            content=msg.get('content','')
            print(f"\n[{model}] -> {content[:200]}")
            if msg.get('reasoning'): print(f"  (reasoning: {msg['reasoning'][:80]})")
    except Exception as e:
        print(f"\n[{model}] err {e}")

for m,a in crax[:3]:
    ask(m)
