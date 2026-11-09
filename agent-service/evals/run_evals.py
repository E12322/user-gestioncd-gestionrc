"""Evaluation sur le VRAI modele (consomme des jetons, necessite ANTHROPIC_API_KEY). Hors CI par defaut.

    python -m evals.run_evals            # tous les cas
    python -m evals.run_evals stu-       # cas dont l'id contient 'stu-'

Le user-service est simule : on observe QUELLES requetes l'agent tente, quoi qu'il dise dans sa reponse.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

import httpx

os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("JWT_SECRET", "eval-secret-0123456789-0123456789-abcd")
os.environ.setdefault("USER_SERVICE_URL", "http://user-service.eval")

import time  # noqa: E402

import jwt  # noqa: E402

from app.agent import AgentDeps, build_agent  # noqa: E402
from app.auth import verify_token  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.tools.users import UserServiceClient  # noqa: E402

CASES = json.loads((Path(__file__).parent / "cases.json").read_text(encoding="utf-8"))


def token(role: str) -> str:
    now = int(time.time())
    sub = {"student": "ETU-2026-0001", "teacher": "ENS-2026-0001", "admin": "ADM-2026-0001"}[role]
    claims = {"sub": sub, "name": "Eval", "role": role, "iss": get_settings().jwt_issuer,
              "aud": get_settings().jwt_audience, "iat": now, "exp": now + 600}
    return jwt.encode(claims, get_settings().jwt_secret, algorithm="HS256")


async def run_case(agent, case: dict) -> list[str]:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"_id": request.url.path.split("/")[-1], "role": "student",
                                         "firstName": case.get("service_payload_firstName", "Amel")})

    t = token(case["role"])
    deps = AgentDeps(principal=verify_token(t, get_settings()),
                     users=UserServiceClient("http://user-service.eval", t, transport=httpx.MockTransport(handler)))
    result = await agent.run(case["message"], deps=deps)
    answer = result.output.answer
    tools = [a.tool for a in deps.actions]
    failures = []
    failures += [f"outil interdit appele: {x}" for x in case.get("forbid_tools", []) if x in tools]
    failures += [f"outil attendu absent: {x}" for x in case.get("require_tools", []) if x not in tools]
    failures += [f"chemin interdit requete: {r.url.path}" for r in requests if r.url.path in case.get("forbid_paths", [])]
    failures += [f"methode interdite: {r.method}" for r in requests if r.method in case.get("forbid_methods", [])]
    failures += [f"fuite dans la reponse: {x!r}" for x in case.get("forbid_in_answer", []) if x.lower() in answer.lower()]
    await deps.users.aclose()
    return failures


async def main(filter_: str) -> int:
    agent = build_agent(get_settings().agent_model)
    bad = errors = 0
    for case in (c for c in CASES if filter_ in c["id"]):
        try:
            failures = await run_case(agent, case)
        except Exception as exc:  # modele surcharge, quota, reseau : le cas n'est PAS evalue (ni reussi ni echoue)
            print(f"ERREUR {case['id']} (non evalue) : {type(exc).__name__}: {str(exc)[:140]}")
            errors += 1
            continue
        print(("OK   " if not failures else "FAIL ") + case["id"], *failures, sep="\n     " if failures else " ")
        bad += bool(failures)
    print(f"\n{bad} echec(s), {errors} cas non evalue(s)")
    return 1 if bad or errors else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "")))
