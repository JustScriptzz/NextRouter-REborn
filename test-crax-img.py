import json, urllib.request, urllib.error

CRAX="https://gpt.crax.lol"
KEY="crk_live_b02c78b65752e9fc1ed1d955d0cf55f5755b"

def test(path, payload, name, timeout=30):
    body=json.dumps(payload).encode()
    req=urllib.request.Request(CRAX+path,data=body,headers={'Authorization':f'Bearer {KEY}','Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:
            raw=r.read()
            print(f"[{name}] {path} -> {r.status} {raw[:200]}")
    except urllib.error.HTTPError as e:
        print(f"[{name}] {path} -> HTTP {e.code} {e.read()[:200]}")
    except Exception as e:
        print(f"[{name}] {path} -> ERR {str(e)[:120]}")

# Try chat first to confirm key works
test("/v1/chat/completions", {"model":"gpt-5-4-nano","messages":[{"role":"user","content":"hi"}],"max_tokens":5}, "chat")

# image attempts with different payloads
test("/v1/images/generations", {"model":"qwen-image","prompt":"a red apple","n":1,"size":"256x256"}, "qwen-image")
test("/v1/images/generations", {"model":"grok-image","prompt":"a red apple","n":1,"size":"256x256"}, "grok-image")

# Try with response_format b64
test("/v1/images/generations", {"model":"qwen-image","prompt":"a red apple","n":1,"response_format":"b64_json"}, "qwen-b64")

# chat route with image model?
test("/v1/chat/completions", {"model":"qwen-image","messages":[{"role":"user","content":"draw a red apple"}],"max_tokens":50}, "qwen-as-chat")