import concurrent.futures, json, urllib.request

MODELS = [
    "glm-5.2", "deepseek-v4-flash:preview", "minimax-m2.7", "glm-5.1",
    "deepseek-v4-pro:0813", "qwen3.5:397b", "kimi-k3", "deepseek-v4-flash:0731",
    "nemotron-3-super", "mistral-large-3:675b", "kimi-k2.7-code",
    "nemotron-3-nano:30b", "gpt-oss:20b", "minimax-m3", "deepseek-v4-pro:preview",
    "gpt-oss:120b", "kimi-k2.6", "gemma4:31b", "nemotron-3-ultra",
]

KEY = "31bbbf0511764aa8a6fcb8b171405cdc.TmhrPEiFEvrqFRldYR1wqsJ3"

def probe(model):
    body = json.dumps({"model": model, "messages": [{"role": "user", "content": "hi"}], "max_tokens": 1}).encode()
    req = urllib.request.Request(
        "https://ollama.com/v1/chat/completions",
        data=body,
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"},
    )
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return model, r.status, ""
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:90]
        return model, e.code, detail
    except Exception as e:
        return model, 0, str(e)[:60]

with concurrent.futures.ThreadPoolExecutor(10) as ex:
    for model, status, detail in ex.map(probe, MODELS):
        tag = "OK  " if status == 200 else ("GATED" if status == 403 else str(status))
        print(tag, model, detail)
