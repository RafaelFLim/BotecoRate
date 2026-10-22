"""API Flask; executar com waitress, sem debug e com ADC fora do repositório."""
import hashlib
import io
import os
from datetime import datetime, timezone
from functools import wraps

from flask import Flask, g, jsonify, request, send_file
from werkzeug.exceptions import HTTPException

from server.domain import DomainError, active, apply_command, authorize, can_manage, key, require, normalize_root


def create_app(root=None, verify_token=None, bucket=None):
    # Injeção explícita para testes. Produção sempre usa verificação de revogação.
    if root is None:
        import firebase_admin
        from firebase_admin import auth, db, storage
        project, url = os.environ.get("FIREBASE_PROJECT_ID"), os.environ.get("FIREBASE_DATABASE_URL")
        if not project or not url:
            raise RuntimeError("Defina FIREBASE_PROJECT_ID e FIREBASE_DATABASE_URL.")
        firebase_app = firebase_admin.initialize_app(options={"projectId": project, "databaseURL": url,
                                                             "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET")})
        root = db.reference("v1", app=firebase_app)
        verify_token = lambda token: auth.verify_id_token(token, app=firebase_app, check_revoked=True)
        bucket = storage.bucket(app=firebase_app) if os.environ.get("FIREBASE_STORAGE_BUCKET") else None
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 6 * 1024 * 1024
    public_url = os.environ.get("PUBLIC_API_URL", "").rstrip("/")

    def read_root():
        return normalize_root(root.get())

    @app.errorhandler(DomainError)
    def domain_error(error):
        return jsonify(error.body), error.status

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(code="http_error", message=error.description), error.code

    def authenticated(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            require(header.startswith("Bearer "), "Autenticação obrigatória.", "unauthorized", 401)
            try:
                claims = verify_token(header[7:])
            except (ValueError, KeyError):
                raise DomainError("unauthorized", "Sessão inválida ou revogada.", 401) from None
            except Exception as error:
                # Falhas de rede/Admin SDK não devem rejeitar definitivamente a fila.
                if getattr(error, "code", "") in ("INVALID_ARGUMENT", "ID_TOKEN_REVOKED", "USER_DISABLED", "ID_TOKEN_EXPIRED", "CERTIFICATE_FETCH_FAILED"):
                    raise DomainError("unauthorized", "Renove a sessão para continuar.", 401) from None
                raise DomainError("auth_unavailable", "Não foi possível verificar a sessão. Tente novamente.", 503) from None
            require(claims.get("email_verified") is True, "Verifique seu e-mail.", "forbidden", 403)
            g.uid = claims["uid"]
            g.name = claims.get("name") or "Usuário"
            authorize(read_root(), g.uid)
            return fn(*args, **kwargs)
        return wrapped

    @app.get("/health")
    def health():
        return jsonify(status="ok", protocol=1)

    @app.post("/v1/sync/commands")
    @authenticated
    def command():
        body = request.get_json()
        now = datetime.now(timezone.utc).isoformat()
        committed = root.transaction(lambda current: apply_command(current, g.uid, g.name, body, now, public_url))
        return jsonify(committed["sync"]["receipts"][g.uid][body["operation_id"]])

    @app.get("/v1/sync/snapshot")
    @authenticated
    def snapshot():
        current = read_root()
        authorize(current, g.uid)
        state = current.get("sync", {})
        # Uma única leitura fornece catálogo e fronteira consistentes.
        return jsonify(protocol=1, sequence=state.get("sequence", 0), entities=state.get("entities", {}),
                       history=[change for event in state.get("events", {}).values() for change in event.get("changes", []) if change.get("before")],
                       access=current.get("access_control", {}).get(g.uid, {"role": "comum", "status": "ativo"}))

    @app.get("/v1/sync/events")
    @authenticated
    def events():
        try:
            cursor = int(request.args.get("after", "0"))
        except ValueError:
            raise DomainError("invalid", "Cursor inválido.") from None
        current = read_root()
        authorize(current, g.uid)
        state = current.get("sync", {})
        head = state.get("sequence", 0)
        require(0 <= cursor <= head, "Refaça o snapshot do catálogo.", "cursor_expired", 409)
        page = sorted((e for e in state.get("events", {}).values() if e["sequence"] > cursor), key=lambda e: e["sequence"])[:100]
        return jsonify(protocol=1, events=page, sequence=page[-1]["sequence"] if page else cursor, has_more=bool(page and page[-1]["sequence"] < head))

    def upload_permission(current, uid, bar_id):
        role = authorize(current, uid)
        if bar_id:
            bar = active(current.get("sync", {}).get("entities", {}), "bares", bar_id)
            require(can_manage(current, uid, bar), "Sem permissão para enviar fotos deste bar.", "forbidden", 403)
        else:
            require(role in ("dono", "admin"), "Sem permissão para cadastrar fotos de bares.", "forbidden", 403)

    @app.post("/v1/media")
    @authenticated
    def upload():
        require(bucket is not None and public_url.startswith("https://"), "Configure bucket e PUBLIC_API_URL HTTPS no servidor.", "media_unavailable", 503)
        bar_id = request.form.get("bar_id") or None
        if bar_id:
            key(bar_id)
        upload_permission(read_root(), g.uid, bar_id)
        photo = request.files.get("file")
        require(photo is not None, "Envie uma imagem no campo file.")
        raw = photo.read(5 * 1024 * 1024 + 1)
        require(0 < len(raw) <= 5 * 1024 * 1024, "Foto deve ter no máximo 5 MB.")
        from PIL import Image, ImageOps, UnidentifiedImageError
        try:
            with Image.open(io.BytesIO(raw)) as source:
                require(source.format in ("JPEG", "PNG", "WEBP") and source.width * source.height <= 20000000, "Formato ou dimensões inválidas.")
                image = ImageOps.exif_transpose(source).convert("RGB")
                image.thumbnail((2048, 2048))
                output = io.BytesIO()
                image.save(output, "JPEG", quality=85)
                data = output.getvalue()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise DomainError("invalid", "Imagem inválida.") from None
        media_id = hashlib.sha256(g.uid.encode() + (bar_id or "").encode() + data).hexdigest()
        path = f"catalog/{media_id}.jpg"
        bucket.blob(path).upload_from_string(data, content_type="image/jpeg")

        def register(current):
            current = normalize_root(current)
            upload_permission(current, g.uid, bar_id)
            current.setdefault("media", {})[media_id] = {"uid": g.uid, "bar_id": bar_id, "path": path, "size": len(data)}
            return current
        root.transaction(register)
        return jsonify(url=public_url + "/v1/media/" + media_id)

    @app.get("/v1/media/<media_id>")
    def media(media_id):
        key(media_id)
        require(bucket is not None, "Fotos indisponíveis.", "media_unavailable", 503)
        current = read_root()
        url = public_url + "/v1/media/" + media_id
        entities = current.get("sync", {}).get("entities", {})
        visible = any(not r.get("deleted_at") and r.get("foto") == url and
                      (table == "bares" or not entities.get("bares", {}).get(r["bar_id"], {}).get("deleted_at"))
                      for table in ("bares", "itens_cardapio") for r in entities.get(table, {}).values())
        record = current.get("media", {}).get(media_id)
        require(visible and record, "Foto não publicada.", "not_found", 404)
        return send_file(io.BytesIO(bucket.blob(record["path"]).download_as_bytes()), mimetype="image/jpeg", max_age=300)

    return app
