import urllib.request
import json
import sys

req = urllib.request.Request(
    'https://gitlab.com/api/v4/projects/79765225/pipelines/2423761592/jobs',
    headers={'PRIVATE-TOKEN': 'glpat-a8ppx-0BmGmtWPXUThxx9W86MQp1Omtyd2RkCw.01.121lq636u'}
)

try:
    with urllib.request.urlopen(req) as response:
        jobs = json.loads(response.read().decode('utf-8'))
        print(f"Total jobs: {len(jobs)}")
        for j in jobs:
            print(f"Job #{j['id']} - {j['name']}: {j['status']}")
            if j['status'] == 'failed':
                print(f"Failed job ID: {j['id']}")
except Exception as e:
    print(f"Error fetching jobs: {e}")
