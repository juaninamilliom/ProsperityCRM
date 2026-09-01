---
name: env-verify
description: >
  Read and verify the __ENV_NAME__ environment - its logs, its database, its
  endpoints. Use for ANY request to check, read, tail, search, query,
  inspect, debug, verify or prove something on __ENV_NAME__, however short.
  <If you have several environments, copy this skill per environment and
  make the DEFAULT (no environment named) the safest one.>
---

# Verify __ENV_NAME__

Rename this directory (drop `_` and `.template`) and fill in the three
access paths. Delete paths that don't exist rather than inventing them.

## Access paths (exhaustive - there is no other way in)
1. **Logs**: <command or script, e.g. gcloud/kubectl/ssh tail with filters>
2. **Database**: <read-only connection command; state the read-only-ness>
3. **Endpoints**: <curl base URL + auth; omit entirely for prod>

## Rules
- READ-ONLY unless this section explicitly lists a write path.
- Every command states which environment it targets before running.
- Findings report: what was checked, the exact command, what came back.
