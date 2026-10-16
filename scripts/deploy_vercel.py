"""Deploy Jishoo through Vercel's HTTPS API using the environment's secure token binding."""

import base64
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
API = "https://api.vercel.com"
PROJECT_NAME = "jishoo"


class ApiError(Exception):
    def __init__(self, status, code, message):
        super().__init__(f"Vercel API {status}: {code}: {message}")
        self.status = status


def request(path, method="GET", body=None):
    token = os.environ.get("VERCEL_TOKEN")
    if not token:
        raise SystemExit("VERCEL_TOKEN is not available. Add it securely in environment settings.")
    headers = {"Authorization": "Bearer " + token}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            content = response.read()
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as error:
        try:
            detail = json.loads(error.read()).get("error", {})
        except (ValueError, AttributeError):
            detail = {}
        message = str(detail.get("message", "Request failed")).replace(token, "[redacted]")
        raise ApiError(error.code, detail.get("code", "unknown"), message) from None


def main():
    user = request("/v2/user")["user"]
    team = os.environ.get("VERCEL_TEAM_ID") or user.get("defaultTeamId")
    query = urllib.parse.urlencode({"teamId": team}) if team else ""
    suffix = "?" + query if query else ""
    settings = {
        "framework": "vite",
        "buildCommand": "npm run build",
        "installCommand": "npm ci --no-audit --no-fund",
        "outputDirectory": "dist",
    }
    try:
        project = request(f"/v9/projects/{PROJECT_NAME}{suffix}")
    except ApiError as error:
        if error.status != 404:
            raise
        project = request("/v11/projects" + suffix, "POST", {"name": PROJECT_NAME, **settings})
        print("Created Vercel project:", project["name"], flush=True)

    linked_repo = project.get("link") or {}
    if linked_repo.get("repo") not in (None, "jishoo"):
        raise SystemExit("The existing jishoo project points to another repository; no deployment was made.")

    local = ROOT / ".vercel"
    local.mkdir(exist_ok=True)
    (local / "project.json").write_text(json.dumps({
        "projectId": project["id"],
        "orgId": project["accountId"],
        "projectName": project["name"],
    }, indent=2) + "\n")

    paths = [ROOT / name for name in [
        "package.json", "package-lock.json", "index.html", "vite.config.js", "vercel.json"
    ]]
    for directory in ("src", "public", "api", "lib"):
        if not (ROOT / directory).is_dir():
            continue
        paths.extend(path for path in sorted((ROOT / directory).rglob("*")) if path.is_file())
    files = [{
        "file": path.relative_to(ROOT).as_posix(),
        "data": base64.b64encode(path.read_bytes()).decode("ascii"),
        "encoding": "base64",
    } for path in paths]
    print(f"Uploading {len(files)} application files to Vercel", flush=True)
    deployment_body = {
        "name": PROJECT_NAME,
        "project": project["id"],
        "projectSettings": {**settings, "nodeVersion": "24.x"},
        "files": files,
    }
    target = os.environ.get("VERCEL_TARGET", "production")
    if target != "preview":
        deployment_body["target"] = target
    deployment = request("/v13/deployments" + suffix, "POST", deployment_body)
    deployment_id = deployment["id"]
    print("Deployment:", deployment_id, flush=True)
    last_state = None
    for _ in range(225):
        deployment = request(f"/v13/deployments/{deployment_id}{suffix}")
        state = deployment.get("readyState") or deployment.get("status")
        if state != last_state:
            print("Build state:", state, flush=True)
            last_state = state
        summary = {
            "id": deployment_id,
            "projectId": project["id"],
            "teamId": team,
            "url": deployment.get("url"),
            "aliases": deployment.get("alias", []),
            "readyState": state,
        }
        (local / "deployment.json").write_text(json.dumps(summary, indent=2) + "\n")
        if state == "READY":
            print(json.dumps(summary, indent=2), flush=True)
            return
        if state in ("ERROR", "CANCELED"):
            raise SystemExit("Deployment failed: " + str(deployment.get("errorMessage") or deployment.get("errorCode") or state))
        time.sleep(4)
    raise SystemExit("Build is still running; inspect the saved deployment ID before attempting another deployment.")


if __name__ == "__main__":
    main()
