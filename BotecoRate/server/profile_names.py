"""Preparação aditiva e auditada do índice de nomes. Nunca executada pelo app."""
from copy import deepcopy
import json
from pathlib import Path
import re
import unicodedata

POLICY = json.loads((Path(__file__).parents[1] / 'src/constants/usernamePolicy.json').read_text(encoding='utf-8'))
LETTERS = ''.join(pair[0] + pair[0].upper() for pair in POLICY['folds'])
ALLOWED = re.compile(r"[A-Za-z" + LETTERS + r"0-9 ._'\-]+")


def username_key(value):
    key = unicodedata.normalize('NFC', str(value or '')).lower()
    for letters, replacement in POLICY['folds']:
        for letter in letters:
            key = key.replace(letter, replacement)
    return re.sub('[^a-z0-9]', '', key)


def valid_name(value):
    return (isinstance(value, str) and len(value) <= POLICY['maxLength']
            and bool(ALLOWED.fullmatch(value))
            and len(re.findall('[a-z]', username_key(value))) >= 3)


def prepare_profile_names(current, cards, actor_uid, occurred_at):
    root = deepcopy(current or {})
    directory = root.setdefault('user_directory', {})
    profiles = root.get('public_profiles', {})
    index = root.setdefault('username_index', {})
    for uid, card in cards.items():
        if uid not in directory:
            name = ((profiles.get(uid) or {}).get('name') or card['name'])[:100]
            directory[uid] = {'uid': uid, 'name': name, 'email': card['email'],
                              'email_verified': card['email_verified'], 'updated_at': occurred_at}
    for uid, row in directory.items():
        name = (profiles.get(uid) or {}).get('name') or row.get('name')
        if not valid_name(name):
            continue  # Legados podem entrar e escolher um nome válido; não os renomear.
        key = username_key(name)
        if key in index and index[key] != uid:
            raise ValueError('Há nomes equivalentes entre contas. Nenhum dado deve ser publicado antes de resolver o conflito.')
        index[key] = uid
    root.setdefault('profile_names_preparation', {'version': 1, 'actor_uid': actor_uid,
                                                'occurred_at': occurred_at})
    return root


def sync_user_directory(current, cards, actor_uid, occurred_at):
    root = deepcopy(current or {})
    directory = root.setdefault('user_directory', {})
    for uid, card in cards.items():
        name = ((root.get('public_profiles', {}).get(uid) or {}).get('name')
                or (directory.get(uid) or {}).get('name') or card['name'])[:100]
        directory[uid] = {'uid': uid, 'name': name, 'email': card['email'],
                          'email_verified': card['email_verified'], 'updated_at': occurred_at}
    return prepare_profile_names(root, cards, actor_uid, occurred_at)
