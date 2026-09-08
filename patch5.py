import sys

p = r'C:\Users\CIULL_~1\nextrouter-reborn\src\app\playground\PlaygroundClient.tsx'
with open(p, encoding='utf-8') as f:
    s = f.read()

# 1) Add generateVideo() after generateImage() end (after the finally closing brace of generateImage)
# generateImage's finally block ends with `    } finally {\n      setImgLoading(false);\n    }\n  }`
old = """      setImgResult(url);
    } catch (e: unknown) {
      setImgError(e instanceof Error ? e.message : String(e));
    } finally {
      setImgLoading(false);
    }
  }

  async function synthesize() {"""

new = """      setImgResult(url);
    } catch (e: unknown) {
      setImgError(e instanceof Error ? e.message : String(e));
    } finally {
      setImgLoading(false);
    }
  }

  async function generateVideo() {
    if (!vidPrompt.trim() || !vidModel || !apiKey) return;
    setVidLoading(true);
    setVidError('');
    setVidResult(null);
    try {
      const res = await fetch('/api/v1/videos/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: vidModel, prompt: vidPrompt }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Failed');
      const url: string | undefined = j.data?.[0]?.url;
      const b64: string | undefined = j.data?.[0]?.b64_json;
      if (url) setVidResult(url);
      else if (b64) setVidResult(`data:video/mp4;base64,${b64}`);
      else setVidResult(null);
    } catch (e: unknown) {
      setVidError(e instanceof Error ? e.message : String(e));
    } finally {
      setVidLoading(false);
    }
  }

  async function synthesize() {"""

s2 = s.replace(old, new)
with open(p, 'w', encoding='utf-8') as f:
    f.write(s2)
print('ok' if s != s2 else 'no change')
