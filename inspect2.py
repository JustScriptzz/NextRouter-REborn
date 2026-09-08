import sys

p = r'C:\Users\CIULL_~1\nextrouter-reborn\src\app\playground\PlaygroundClient.tsx'
with open(p, encoding='utf-8') as f:
    s = f.read()

# Look for the actual list-rendering pattern - might have a different indentation
import re
matches = re.findall(r'\(tab === .chat. \? models\.filter.*?\)', s, re.DOTALL)
for m in matches:
    print('---')
    print(m[:500])
