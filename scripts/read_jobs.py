import json, sys

try:
    with open('scripts/jobs.json', 'r') as f:
        jobs = json.load(f)
    print(f"Total jobs: {len(jobs)}")
    for j in jobs:
        print(f"Job #{j['id']} - {j['name']}: {j['status']}")
except Exception as e:
    print(f"Error parsing jobs.json: {e}")
