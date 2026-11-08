"""AIRS-Lab / AEGIS AI LAB — Command-Line CI/CD Gate & Offline Bundle Verifier.

Examples:
  python -m airs_cli packs
  python -m airs_cli gate --pack quant_finance_10k --model mock-atlas-guarded --fail-under 85 --security-gate
  python -m airs_cli gate --pack family_office_exec --model mock-atlas-baseline --fail-under 85 --security-gate
  python -m airs_cli verify-bundle ./evidence.airsbundle.zip
"""
import argparse
import hashlib
import json
import os
import sys
import tempfile
import uuid
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def cmd_packs(_args: argparse.Namespace) -> int:
    from app.services.domain_packs import DOMAIN_PACKS

    print("AEGIS AI LAB — High-Stakes Domain Vertical Packs")
    print("=" * 76)
    for pack in DOMAIN_PACKS.values():
        print(f"  {pack['id']:22s} | {len(pack['cases']):2d} cases | {pack['name']}")
        print(f"  {'':22s} | Audience: {pack['audience']}")
    print("=" * 76)
    return 0


def cmd_verify_bundle(args: argparse.Namespace) -> int:
    bundle_path = Path(args.bundle)
    if not bundle_path.is_file():
        print(f"[ERROR] Bundle file not found: {bundle_path}", file=sys.stderr)
        return 1

    try:
        with zipfile.ZipFile(bundle_path, "r") as zf:
            if "manifest.json" not in zf.namelist():
                print("[TAMPERED] manifest.json missing from bundle.", file=sys.stderr)
                return 1
            manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
            files_map: dict[str, str] = manifest.get("files") or {}
            if not files_map:
                print("[TAMPERED] Empty file checksum map in manifest.json.", file=sys.stderr)
                return 1
            for fname, expected_sha in files_map.items():
                if fname not in zf.namelist():
                    print(f"[TAMPERED] Referenced artifact '{fname}' missing from zip.", file=sys.stderr)
                    return 1
                actual_sha = hashlib.sha256(zf.read(fname)).hexdigest()
                if actual_sha != expected_sha:
                    print(
                        f"[TAMPERED] Checksum mismatch for '{fname}': expected {expected_sha[:16]}…, got {actual_sha[:16]}…",
                        file=sys.stderr,
                    )
                    return 1
            expected_sig = hashlib.sha256(json.dumps(files_map, sort_keys=True).encode("utf-8")).hexdigest()
            if manifest.get("bundle_signature_sha256") != expected_sig:
                print("[TAMPERED] Manifest bundle_signature_sha256 mismatch.", file=sys.stderr)
                return 1
    except zipfile.BadZipFile:
        print("[ERROR] Invalid zip archive.", file=sys.stderr)
        return 1

    print(f"[VERIFIED] Bundle {bundle_path.name} is cryptographically intact.")
    print(f"  Run ID          : {manifest.get('run_id')}")
    print(f"  Dataset SHA-256 : {manifest.get('dataset_hash')}")
    print(f"  Evaluator Ver.  : {manifest.get('evaluator_version')}")
    print(f"  Signature       : {manifest.get('bundle_signature_sha256')}")
    return 0


def cmd_gate(args: argparse.Namespace) -> int:
    prev_db_env = os.environ.get("AEGIS_DATABASE_URL")
    prev_rep_env = os.environ.get("AEGIS_REPORT_DIR")
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "cli_gate.db"
        os.environ["AEGIS_DATABASE_URL"] = f"sqlite:///{db_file.as_posix()}"
        os.environ["AEGIS_REPORT_DIR"] = str(Path(tmpdir) / "reports")

        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        from app.db import Base
        from app.models import ModelConfig, Project, ReleaseGate
        from app.routers.gates import evaluate_gate_for_model
        from app.routers.reports import ReportRequest, create_report
        from app.routers.suites import InstallPackIn, install_template
        from app.services.runner import execute_reliability_run, execute_security_run

        eng = create_engine(f"sqlite:///{db_file.as_posix()}", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=eng)
        Session = sessionmaker(bind=eng, autoflush=False, autocommit=False)
        db = Session()
        try:
            proj = Project(id=str(uuid.uuid4()), name="CLI CI Gate", description="Ephemeral CI gate workspace")
            db.add(proj)
            db.flush()

            model = ModelConfig(
                id=str(uuid.uuid4()),
                project_id=proj.id,
                name=f"{args.provider}:{args.model}",
                provider=args.provider,
                model_id=args.model,
                base_url=args.base_url or "",
                api_key_env=args.api_key_env or "",
                temperature=args.temperature,
                enabled=True,
                last_status="ok",
            )
            db.add(model)
            db.commit()

            suite_out = install_template(InstallPackIn(project_id=proj.id, pack_id=args.pack), db=db)
            rel_run = execute_reliability_run(
                db,
                project_id=proj.id,
                suite_id=suite_out.id,
                model_id=model.id,
                repeats=args.repeats,
                concurrency=args.concurrency,
            )
            rel_summary = json.loads(rel_run.summary or "{}")

            max_crit = 0 if args.security_gate else 9999
            max_high = 0 if args.security_gate else 9999
            if args.security_gate:
                execute_security_run(db, project_id=proj.id, model_id=model.id)

            gate = ReleaseGate(
                id=str(uuid.uuid4()),
                project_id=proj.id,
                name=f"CI Gate ({args.pack})",
                suite_id=suite_out.id,
                min_pass_rate=args.fail_under,
                max_critical_findings=max_crit,
                max_high_findings=max_high,
                require_audit_integrity=True,
            )
            db.add(gate)
            db.commit()

            if not args.security_gate:
                # Create a baseline passing security placeholder check by only gating reliability when --security-gate omitted
                execute_security_run(db, project_id=proj.id, model_id=model.id)

            verdict_out = evaluate_gate_for_model(db, gate, model, execute_fresh=False)
            cert = verdict_out["last_certificate"]

            print("AEGIS AI LAB — CI/CD Release Gate Scorecard")
            print("=" * 76)
            print(f"  Model           : {model.name}")
            print(f"  Domain Pack     : {suite_out.name} ({suite_out.case_count} cases)")
            print(f"  Dataset SHA-256 : {rel_run.dataset_hash}")
            print(f"  Pass Rate       : {rel_summary.get('pass_rate')}% (Wilson 95% CI: {rel_summary.get('wilson_95_ci')})")
            print(f"  Latency Avg/P95 : {rel_summary.get('avg_latency_ms')} ms / {rel_summary.get('p95_latency_ms')} ms")
            print(f"  Est. Run Cost   : ${rel_summary.get('est_cost_usd', 0):.8f}")
            print(f"  Gate Verdict    : {verdict_out['last_verdict'].upper()}")
            print(f"  Cert Signature  : {cert.get('certificate_sha256')}")
            if cert.get("blocking_reasons"):
                print("  Blocking Reasons:")
                for reason in cert["blocking_reasons"]:
                    print(f"    - {reason}")
            print("=" * 76)

            if args.json_out:
                Path(args.json_out).write_text(json.dumps(cert, indent=2), encoding="utf-8")
            if args.bundle_out:
                rep = create_report(
                    ReportRequest(project_id=proj.id, run_id=rel_run.id, format="bundle", title=f"CI Gate — {args.pack}"),
                    db=db,
                )
                src = Path(os.environ["AEGIS_REPORT_DIR"]) / rep["file"]
                Path(args.bundle_out).write_bytes(src.read_bytes())
                print(f"  Evidence Bundle : {args.bundle_out} (sha256={rep['sha256_hash'][:16]}…)")

            return 0 if verdict_out["last_verdict"] == "approved" else 1
        finally:
            db.close()
            eng.dispose()
            if prev_db_env is None:
                os.environ.pop("AEGIS_DATABASE_URL", None)
            else:
                os.environ["AEGIS_DATABASE_URL"] = prev_db_env
            if prev_rep_env is None:
                os.environ.pop("AEGIS_REPORT_DIR", None)
            else:
                os.environ["AEGIS_REPORT_DIR"] = prev_rep_env


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="airs", description="AEGIS AI LAB — CLI & CI/CD Release Gate")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_packs = sub.add_parser("packs", help="List built-in high-stakes domain vertical suites")
    p_packs.set_defaults(func=cmd_packs)

    p_gate = sub.add_parser("gate", help="Execute a reliability + security CI release gate")
    p_gate.add_argument("--pack", default="quant_finance_10k", help="Domain pack ID (see `airs packs`)")
    p_gate.add_argument("--provider", default="mock", choices=["mock", "openai_compat", "anthropic", "ollama", "custom_webhook"])
    p_gate.add_argument("--model", default="mock-atlas-guarded", help="Model identifier")
    p_gate.add_argument("--base-url", default="", help="Optional endpoint base URL")
    p_gate.add_argument("--api-key-env", default="", help="Server env var name holding provider API key")
    p_gate.add_argument("--temperature", type=float, default=0.0)
    p_gate.add_argument("--repeats", type=int, default=3)
    p_gate.add_argument("--concurrency", type=int, default=4)
    p_gate.add_argument("--fail-under", type=float, default=85.0, help="Minimum pass rate percentage")
    p_gate.add_argument("--security-gate", action="store_true", help="Fail gate on any Critical/High security finding")
    p_gate.add_argument("--json-out", default="", help="Write signed gate certificate JSON to path")
    p_gate.add_argument("--bundle-out", default="", help="Write signed .airsbundle.zip evidence archive to path")
    p_gate.set_defaults(func=cmd_gate)

    p_ver = sub.add_parser("verify-bundle", help="Cryptographically verify an exported .airsbundle.zip offline")
    p_ver.add_argument("bundle", help="Path to .airsbundle.zip")
    p_ver.set_defaults(func=cmd_verify_bundle)
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
