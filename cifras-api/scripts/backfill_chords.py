"""Completa os acordes cadastrados; preview padrão, --apply para persistir."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.chord_generator import enrich, ensure_chord


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--credentials', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--report', required=True)
    args = parser.parse_args()
    import firebase_admin
    from firebase_admin import credentials, firestore
    firebase_admin.initialize_app(credentials.Certificate(args.credentials))
    db = firestore.client()
    rows = []
    for snap in db.collection('acordes').stream(timeout=60):
        data = snap.to_dict()
        name = data.get('nome') or snap.id.replace('_', '/')
        result = ensure_chord(db, name) if args.apply else enrich(data, name)
        row = {'nome': name, 'violaoAntes': len(data.get('variacoes', [])), 'violaoDepois': len(result['variacoes']), 'cavacoAntes': len(data.get('variacoesCavaco', [])), 'cavacoDepois': len(result['variacoesCavaco']), 'status': result['geracao']['status']}
        rows.append(row)
    Path(args.report).write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    print(json.dumps({'aplicado': args.apply, 'acordes': len(rows), 'violao': sum(r['violaoDepois'] for r in rows), 'cavaco': sum(r['cavacoDepois'] for r in rows), 'revisao': [r['nome'] for r in rows if r['status'] == 'revisao']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
