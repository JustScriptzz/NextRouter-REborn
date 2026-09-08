import json
with open(r'C:\Users\CIULL_~1\AppData\Local\Temp\opencode\dpl-t.json', encoding='utf-8') as f:
    d = json.load(f)
for dep in d.get('deployments', []):
    print(dep['uid'], dep['state'], dep.get('readySubstate'), str(dep.get('meta', {}).get('githubCommitSha', ''))[:7])
