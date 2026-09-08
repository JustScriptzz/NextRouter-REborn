import json, urllib.request, urllib.error
def test(model_id):
    body = json.dumps({
        "model": model_id,
        "messages": [{"role": "user", "content": "What is the weather in Paris? Call get_weather."}],
        "tools": [{"type": "function", "function": {"name": "get_weather", "description": "Get weather", "parameters": {"type": "object", "properties": {"location": {"type": "string"}}, "required": ["location"]}}}],
        "tool_choice": "auto",
        "max_tokens": 50
    }).encode()
    req = urllib.request.Request("https://nextrouter-vert.vercel.app/api/v1/chat/completions", data=body, headers={"Authorization": "Bearer nr_i3NPqP8dVXtmGFvIxKs_Woy9sNF5T4Rk_fEZbQ8PGMA", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            j=json.load(r)
            msg=j['choices'][0]['message']
            print(f"{model_id}: status={r.status} tool_calls={'tool_calls' in msg and msg['tool_calls'] is not None} finish={j['choices'][0].get('finish_reason')} msg={json.dumps(msg)[:250]}")
    except Exception as e:
        if hasattr(e,'code'):
            try: b=e.read().decode()[:200]
            except: b=str(e)[:200]
            print(f"{model_id}: HTTP {e.code} {b}")
        else:
            print(f"{model_id}: {e}")

for m in ["gpt-oss:20b","liquid/lfm-2.5-2.6b:free","cohere/north-mini-code:free","minimax-m3"]:
    test(m)
