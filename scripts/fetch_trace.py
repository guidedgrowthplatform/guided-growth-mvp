import urllib.request
import sys

req = urllib.request.Request(
    'https://gitlab.com/api/v4/projects/79765225/jobs/13745734411/trace',
    headers={'PRIVATE-TOKEN': 'glpat-a8ppx-0BmGmtWPXUThxx9W86MQp1Omtyd2RkCw.01.121lq636u'}
)

try:
    with urllib.request.urlopen(req) as response:
        with open('scripts/trace.log', 'w', encoding='utf-8') as f:
            f.write(response.read().decode('utf-8'))
        print("Trace saved to scripts/trace.log")
except Exception as e:
    print(f"Error fetching job trace: {e}")
