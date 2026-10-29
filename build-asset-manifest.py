from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
entries={}
for path in sorted((root/'assets').rglob('*')):
    if path.is_file():
        relative=path.relative_to(root).as_posix()
        entries[relative]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'type':'audio/mpeg' if path.suffix=='.mp3' else 'image/webp'}
version=hashlib.sha256(json.dumps(entries,sort_keys=True).encode()).hexdigest()[:16]
(root/'asset-manifest.js').write_text('export const ASSET_MANIFEST = '+json.dumps({'version':version,'assets':entries},indent=2)+';\n',encoding='utf-8')
print(json.dumps({'assets':len(entries),'totalBytes':sum(x['bytes'] for x in entries.values()),'version':version}))
