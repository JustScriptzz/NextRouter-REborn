import sys
p = r'C:\Users\CIULL_~1\nextrouter-reborn\src\app\playground\PlaygroundClient.tsx'
with open(p, encoding='utf-8') as f:
    s = f.read()
# Find the two list-rendering spots around 'tab ===' with 'models.filter'
for i, line in enumerate(s.split('\n'), 1):
    if 'models.filter((m) => m.type' in line:
        print(f"{i}: {line}")