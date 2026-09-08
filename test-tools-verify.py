import json, urllib.request, urllib.error
import time

def test_model(model_id):
    body = json.dumps({
        "model": model_id,
        "messages": [{"role": "user", "content": "What is the weather in Paris?"}],
        "tools": [{"type": "function", "function": {"name": "get_weather", "description": "Get weather for a city", "parameters": {"type": "object", "properties": {"location": {"type": "string", "description": "City"}}, "required": ["location"]}}}],
        "tool_choice": "auto",
        "max_tokens": 100
    }).encode()
    req = urllib.request.Request("https://nextrouter-vert.vercel.app/api/v1/chat/completions", data=body, headers={"Authorization": "Bearer nr_i3NPqP8dVXtmGFvIxKs_Woy9sNF5T4Rk_fEZbQ8PGMA", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            j = json.load(r)
            msg = j['choices'][0]['message']
            has_tool = 'tool_calls' in msg and msg['tool_calls'] is not None
            finish = j['choices'][0].get('finish_reason')
            return (r.status, has_tool, finish, json.dumps(msg)[:300])
    except urllib.error.HTTPError as e:
        b = e.read().decode(errors='replace')
        return (e.code, False, "error", b[:300])
    except Exception as e:
        return (0, False, "exception", str(e)[:300])

for m in ["north-mini-code:free", "liquid/lfm-2.5-2.6b:free", "glm-5.2", "phoenix-1.0", "gpt-oss:20b", "minimax-m3"]:
    print(f"Testing {m}...")
    status, has_tool, finish, preview = test_model(m)
    print(f"  -> status={status} has_tool={has_tool} finish={finish}")
    print(f"  preview: {preview[:200]}")
    time.sleep(1)
