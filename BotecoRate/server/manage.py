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
    parser.add_argument("command", choices=["promote-admin", "import-demo", "prepare-direct", "sync-user-directory", "prepare-ownership", "prepare-profile-names"])
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
        from server.ownership import promote_admin
        occurred_at = now()
        operation_id = str(uuid4())
        root.transaction(lambda current: promote_admin(current, args.uid, args.actor_uid or "bootstrap", occurred_at, operation_id))
        print("Permissão administrativa registrada para o UID informado.")
    elif args.command == "prepare-profile-names":
        from server.profile_names import prepare_profile_names
        cards = {user.uid: {"name": user.display_name or user.email.split("@")[0],
                            "email": user.email, "email_verified": user.email_verified}
                 for user in auth.list_users().iterate_all() if user.email}
        occurred_at = now()
        root.transaction(lambda current: prepare_profile_names(current, cards, args.actor_uid, occurred_at))
        print("Índice de nomes preparado. Identidades, papéis e conteúdo preservados.")
    elif args.command == "prepare-ownership":
        from server.ownership import prepare_ownership
        cards = {user.uid: {"name": user.display_name or user.email.split("@")[0], "email_verified": user.email_verified}
                 for user in auth.list_users().iterate_all() if user.email}
        occurred_at = now()
        root.transaction(lambda current: prepare_ownership(current, cards, args.actor_uid, occurred_at))
        print("Índice de propriedade e perfis de convite preparados. Donos e conteúdo preservados.")
    elif args.command == "sync-user-directory":
        from server.profile_names import sync_user_directory
        cards = {user.uid: {"name": user.display_name or user.email.split("@")[0],
                            "email": user.email, "email_verified": user.email_verified}
                 for user in auth.list_users().iterate_all() if user.email}
        occurred_at = now()
        root.transaction(lambda current: sync_user_directory(current, cards, args.actor_uid, occurred_at))
        print(f"Diretório atualizado: {len(cards)} contas. Nomes canônicos e permissões preservados.")
    elif args.command == "prepare-direct":
        from server.direct import prepare_direct
        occurred_at = now()
        root.transaction(lambda current: prepare_direct(current, args.actor_uid, occurred_at))
        print("Estrutura direta preparada. Origem e permissões preservadas.")
    else:
        seed = json.loads((Path(__file__).parent / "seeds/bares-demonstracao.json").read_text(encoding="utf-8"))
        # Executar como módulo: python -m server.manage (a partir da raiz).
        from server.demo import import_demo
        occurred_at = now()
        root.transaction(lambda current: import_demo(current, seed, args.actor_uid, occurred_at))
        print("Carga de demonstração conferida/importada uma única vez. Avaliações não contam para o ranking.")


if __name__ == "__main__":
    main()
