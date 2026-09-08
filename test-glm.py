import json, urllib.request, urllib.error, concurrent.futures

BASE="https://nextrouter-vert.vercel.app"
KEY="nr_i3NPqP8dVXtmGFvIxKs_Woy9sNF5T4Rk_fEZbQ8PGMA"

def _ask(model_id, timeout=45):
    body=json.dumps({"model":model_id,"messages":[{"role":"user","content":"Reply OK"}],"max_tokens":5}).encode()
    req=urllib.request.Request(BASE+"/api/v1/chat/completions",data=body,headers={'Authorization':f'Bearer {KEY}','Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:
            j=json.load(r)
            c=j['choices'][0]['message'].get('content')
            return (r.status, c, '')
    except urllib.error.HTTPError as e:
        return (e.code, '', e.read().decode()[:100])
    except Exception as e:
        return (0, '', str(e)[:80])

print("glm-5.2 via gateway (should failover all providers):")
print(_ask("glm-5.2"))
print()
print("direct providers that carry glm-5.2:")
