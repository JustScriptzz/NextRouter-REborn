import json
import wave
import struct
import math

with open(r"C:\Users\CIULL_~1\AppData\Local\Temp\opencode\models-full.json", encoding="utf-8") as f:
    models = json.load(f)["data"]

counts = {}
for m in models:
    counts[m.get("type")] = counts.get(m.get("type"), 0) + 1
print("type counts:", counts)
print("total:", len(models))
print("untested types detail:")
for t in counts:
    if t not in ("text", "embedding", "tts", "image"):
        print(t, [m["id"] for m in models if m.get("type") == t])

with open(r"C:\Users\ciull_yx1zjgv\nextrouter-reborn\test-audio.wav", "wb") as w:
    wav = wave.open(w, "wb")
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(16000)
    frames = b"".join(struct.pack("<h", int(3000 * math.sin(2 * math.pi * 440 * i / 16000))) for i in range(16000))
    wav.writeframes(frames)
    wav.close()
print("wrote test-audio.wav")
