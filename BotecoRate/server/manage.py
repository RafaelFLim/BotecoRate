"""Ferramenta administrativa explícita. Nunca importada/executada pelo celular."""
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def now():
    return datetime.now(timezone.utc).isoformat()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["promote-admin", "import-demo"])
    parser.add_argument("--uid", help="UID real do Firebase Authentication")
    parser.add_argument("--actor-uid", help="UID do admin que executa; omitir somente no bootstrap")
    parser.add_argument("--bootstrap", action="store_true")
    parser.add_argument("--confirm-project", required=True)
    args = parser.parse_args()
    project = os.environ.get("FIREBASE_PROJECT_ID")
    url = os.environ.get("FIREBASE_DATABASE_URL")
    if not project or args.confirm_project != project or not url:
        parser.error("Defina FIREBASE_PROJECT_ID e FIREBASE_DATABASE_URL e confirme o projeto correto.")
    # Credenciais por Application Default Credentials/GOOGLE_APPLICATION_CREDENTIALS.
    # Nunca incluir JSON de conta de serviço no repositório.
    import firebase_admin
    from firebase_admin import auth, db
    firebase_admin.initialize_app(options={"projectId": project, "databaseURL": url})
    root = db.reference("v1")
    if args.actor_uid:
        access = root.child("access_control").child(args.actor_uid).get() or {}
        actor = auth.get_user(args.actor_uid)
        if access.get("role") != "admin" or access.get("status") != "ativo" or actor.disabled or not actor.email_verified:
            parser.error("O responsável deve ser admin ativo com e-mail verificado.")
    elif not args.bootstrap or args.command != "promote-admin":
        parser.error("Informe --actor-uid; --bootstrap só permite promover os primeiros admins.")
    if args.command == "promote-admin":
        if not args.uid:
            parser.error("Informe --uid.")
        user = auth.get_user(args.uid)
        if user.disabled or not user.email_verified:
            parser.error("A conta precisa estar ativa com e-mail verificado.")
        if args.bootstrap and any(v.get("role") == "admin" for v in (root.child("access_control").get() or {}).values()):
            parser.error("Já existe admin. Execute com --actor-uid para promover os demais.")
        record = {"role": "admin", "status": "ativo", "updated_at": now()}
        root.update({f"access_control/{args.uid}": record,
                     f"admin_events/{uuid4()}": {"action": "grant_admin", "target_uid": args.uid,
                                               "actor_uid": args.actor_uid or "bootstrap", "created_at": now()}})
        print("Permissão administrativa registrada para o UID informado.")
    else:
        seed = json.loads((Path(__file__).parent / "seeds/bares-demonstracao.json").read_text(encoding="utf-8"))
        def publish(current):
            current = current or {}
            if current.get("migrations", {}).get("demo_v1"):
                return current
            if current.get("catalog") or current.get("demo_data"):
                raise ValueError("Destino já contém catálogo. Importação interrompida sem sobrescrever.")
            for bar in seed:
                bar["proprietarios"] = [args.actor_uid]
                bar["demonstracao"] = True
                for review in bar.get("avaliacoes", []) + [r for item in bar.get("cardapio", []) for r in item.get("avaliacoes", [])]:
                    review["elegivelRanking"] = False
                    review["autorId"] = None
            current["demo_data"] = {bar["id"]: bar for bar in seed}
            current["catalog"] = {"version": 1, "bares": [
                {key: bar[key] for key in ("id", "nome", "endereco", "foto", "latitude", "longitude")} for bar in seed]}
            current.setdefault("migrations", {})["demo_v1"] = {"created_at": now(), "actor_uid": args.actor_uid}
            return current
        root.transaction(publish)
        print("Carga de demonstração conferida/importada uma única vez. Avaliações não contam para o ranking.")


if __name__ == "__main__":
    main()
