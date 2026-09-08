import json, urllib.request, urllib.error

KEY="nr_i3NPqP8dVXtmGFvIxKs_Woy9sNF5T4Rk_fEZbQ8PGMA"
BASE="https://nextrouter-vert.vercel.app/api/v1"

def test_video(model="wan-3.0", prompt="a rocket launching", timeout=60):
    body=json.dumps({"model":model,"prompt":prompt}).encode()
    req=urllib.request.Request(BASE+"/videos/generations",data=body,headers={'Authorization':f'Bearer {KEY}','Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r:
            j=json.load(r)
            print(f"[{model}] status={r.status} -> {json.dumps(j)[:300]}")
    except urllib.error.HTTPError as e:
        print(f"[{model}] HTTP {e.code} {e.read().decode()[:200]}")
    except Exception as e:
        print(f"[{model}] ERR {str(e)[:150]}")

# test the new videos route with the video model
test_video("wan-3.0")
test_video("qwen-video")
