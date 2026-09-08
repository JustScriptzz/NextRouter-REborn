import json, urllib.request, urllib.error

KEY="nr_i3NPqP8dVXtmGFvIxKs_Woy9sNF5T4Rk_fEZbQ8PGMA"
BASE="https://nextrouter-vert.vercel.app/api/v1"

def test_image(model, prompt="a red apple"):
    body=json.dumps({"model":model,"prompt":prompt,"n":1,"size":"256x256"}).encode()
    req=urllib.request.Request(BASE+"/images/generations",data=body,headers={'Authorization':f'Bearer {KEY}','Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=40) as r:
            j=json.load(r)
            data=j.get('data',[])
            print(f"[{model}] OK len={len(data)}")
    except urllib.error.HTTPError as e:
        print(f"[{model}] HTTP {e.code} {e.read().decode()[:160]}")
    except Exception as e:
        print(f"[{model}] ERR {str(e)[:120]}")

for m in ["qwen-image","grok-image","flux-1-schnell","wan-3.0","sdxl-lightning"]:
    test_image(m)
