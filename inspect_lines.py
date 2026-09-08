import sys
p = r'C:\Users\CIULL_~1\nextrouter-reborn\src\app\playground\PlaygroundClient.tsx'
with open(p, encoding='utf-8') as f:
    lines = f.readlines()
# print lines 301-315 (0-indexed 300-314)
for i in range(300, 315):
    print(f"{i+1}:{lines[i].rstrip()}")
