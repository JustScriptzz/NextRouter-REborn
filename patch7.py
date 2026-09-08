import sys

p = r'C:\Users\CIULL_~1\nextrouter-reborn\src\app\playground\PlaygroundClient.tsx'
with open(p, encoding='utf-8') as f:
    s = f.read()

# Insert Video tab panel between the image and audio panels
old = """              {!imgResult && !imgLoading && <p className="mt-6 text-center text-xs text-zinc-500">Images are generated via the gateway&apos;s image models.</p>}
            </div>
          )}

          {tab === 'audio' && ("""

new = """              {!imgResult && !imgLoading && <p className="mt-6 text-center text-xs text-zinc-500">Images are generated via the gateway&apos;s image models.</p>}
            </div>
          )}

          {tab === 'video' && (
            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <textarea value={vidPrompt} onChange={(e) => setVidPrompt(e.target.value)} placeholder="A prompt for video generation..." rows={3} className="input-dark" />
              <button onClick={generateVideo} disabled={vidLoading || !vidPrompt.trim()} className="btn-primary mt-3">
                {vidLoading ? 'Generating...' : 'Generate video'}
              </button>
              {vidError && <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{vidError}</div>}
              {vidResult && (
                <div className="mt-4 space-y-3">
                  <video controls src={vidResult} className="w-full rounded-xl border border-white/10" />
                  <a href={vidResult} target="_blank" rel="noreferrer" className="block text-center text-xs text-zinc-400 underline">
                    Open video in new tab
                  </a>
                </div>
              )}
              {!vidResult && !vidLoading && <p className="mt-6 text-center text-xs text-zinc-500">Videos are generated via the gateway&apos;s video models (wan-3.0, qwen-video).</p>}
            </div>
          )}

          {tab === 'audio' && ("""

s2 = s.replace(old, new)
with open(p, 'w', encoding='utf-8') as f:
    f.write(s2)
print('ok' if s != s2 else 'no change')
