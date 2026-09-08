import json, urllib.request, urllib.error

def jank(model, timeout=25):
    body=json.dumps({"model":model,"messages":[{"role":"user","content":"Reply OK"}],"max_tokens":5}).encode()
    req=urllib.request.Request("https://jankrouter.waifly.com/v1/chat/completions",data=body,headers={'Authorization':'Bearer sk-bljr-ee7a3a3da573e7ca42ef7f9d538073ee20ee','Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:
            j=json.load(r)
            return f"{model}: {r.status} content={j['choices'][0]['message'].get('content','')[:40]}"
    except urllib.error.HTTPError as e:
        return f"{model}: HTTP {e.code} {e.read().decode()[:100]}"
    except Exception as e:
        return f"{model}: {str(e)[:80]}"

print(jank("glm-5.2"))
print(jank("flux-1-schnell"))
print(jank("minimax-m3"))
