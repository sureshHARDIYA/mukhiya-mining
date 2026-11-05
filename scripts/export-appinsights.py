#!/usr/bin/env python3
"""Export 90 days of Application Insights page views + custom events into apps/demo/public/data.

Needs `az login` with reader access on the shared prod Log Analytics workspace. Session and user ids
are hashed; GUID/numeric path segments collapse to ":id" so paths become activities.
Usage: scripts/export-appinsights.py
"""
import hashlib
import json
import re
import subprocess
from pathlib import Path

SUBSCRIPTION = "c86d94ab-fc8c-4752-b430-63216ebb2c7a"
WORKSPACE = "5eadaafc-0496-400a-9c8d-75994a09bd24"  # lsg-126-kompis-log-prod, shared by all prod apps
APPS = {"lsg-126-documents-appi-prod": "dbank-prod", "lsg-126-kompis-appi-prod": "kompis-prod"}
OUT = Path(__file__).resolve().parent.parent / "apps/demo/public/data"
GUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)
NUM = re.compile(r"/\d+(?=/|$)")

KQL = """union AppPageViews, AppEvents
| where TimeGenerated > ago(90d) and _ResourceId endswith "{app}" and isnotempty(SessionId)
| project TimeGenerated, Type, Name, Path=tostring(parse_url(Url).Path), SessionId, UserId, ClientBrowser, ClientOS
| order by SessionId asc, TimeGenerated asc"""


def anon(s: str) -> str:
    return hashlib.sha1(s.encode()).hexdigest()[:10]


def norm(path: str) -> str:
    path = NUM.sub("/:id", GUID.sub(":id", path or "/"))
    return path.rstrip("/") or "/"


def query(app: str) -> list[dict]:
    cmd = ["az", "monitor", "log-analytics", "query", "--subscription", SUBSCRIPTION, "-w", WORKSPACE,
           "--analytics-query", KQL.format(app=app), "-o", "json"]
    return json.loads(subprocess.run(cmd, check=True, capture_output=True, text=True).stdout)


def convert(rows: list[dict]) -> list[dict]:
    out = []
    for r in rows:
        page = r["Type"] == "AppPageViews"
        out.append({
            "caseId": anon(r["SessionId"]),
            "activity": norm(r["Path"]) if page else r["Name"],
            "timestamp": r["TimeGenerated"],
            "resource": anon(r["UserId"]) if r.get("UserId") else None,
            "kind": "page" if page else "event",
            "browser": r.get("ClientBrowser") or "",
            "os": r.get("ClientOS") or "",
        })
    return out


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for app, name in APPS.items():
        events = convert(query(app))
        (OUT / f"{name}.json").write_text(json.dumps(events, separators=(",", ":")))
        print(name, len(events), "events", len({e["caseId"] for e in events}), "sessions")
