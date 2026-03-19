#!/bin/bash
# Block Claude from running git commit unless the user explicitly typed "commit" in their message
echo "BLOCKED: Do not commit without explicit user permission. Ask the user first."
exit 2
