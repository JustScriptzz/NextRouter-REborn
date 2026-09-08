import json, urllib.request, urllib.error

def direct(provider, url, key, model="glm-5.2", timeout=25):
    body=json.dumps({"model":model,"messages":[{"role":"user","content":"Reply OK"}],"max_tokens":5}).encode()
    headers={'Content-Type':'application/json'}
    if key: headers['Authorization']=f'Bearer {key}'
    req=urllib.request.Request(url,data=body,headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:
            j=json.load(r)
            return f"{provider}: {r.status} content={j['choices'][0]['message'].get('content','')[:40]}"
    except urllib.error.HTTPError as e:
        return f"{provider}: HTTP {e.code} {e.read().decode()[:80]}"
    except Exception as e:
        return f"{provider}: {str(e)[:80]}"

print(direct("logfare","https://logfare.ai/v1/chat/completions","lfu_oHiVtyH5xwE4OIwyt14x0bLryL0ICzes"))
print(direct("ollama","https://ollama.com/v1/chat/completions","31bbbf0511764aa8a6fcb8b171405cdc.TmhrPEiFEvrqFRldYR1wqsJ3"))
print(direct("jankrouter","https://jankrouter.waifly.com/v1/chat/completions",""))
print(direct("aquadevs","https://api.aquadevs.com/v1/chat/completions",""))
