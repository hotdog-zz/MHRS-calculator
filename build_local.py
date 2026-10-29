#!/usr/bin/env python3
"""Build an account-free standalone HTML and a portable ZIP from exact source."""
import base64,hashlib,json,re,zipfile
from pathlib import Path
R=Path(__file__).resolve().parent
OUT=R.parent/'deliverables'
OUT.mkdir(exist_ok=True)
def b64(raw):return base64.b64encode(raw).decode('ascii')
def safe_script(text):return re.sub(r'</script',r'<\/script',text,flags=re.I)
html=(R/'dist/index.html').read_text()
css=(R/'dist/style.css').read_text()
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>')
icon='data:image/svg+xml;base64,'+b64((R/'dist/mark.svg').read_bytes())
html=html.replace('./mark.svg',icon)
for name in ['engine.js','config.js','mod.js','inventory.js','file-import.js','vendor/qrcode.js','vendor/jsQR.js','vendor/lz-string.js','share.js','search-pool.js','app.js']:
    html=html.replace(f'<script src="./{name}" defer></script>','')
worker=(R/'dist/vendor/highs.js').read_text()+'\n'+(R/'dist/engine.js').read_text()+'\n'+(R/'dist/config.js').read_text()+'\n'+(R/'dist/mod.js').read_text()+'\n'+(R/'dist/inventory.js').read_text()+'\n'+(R/'dist/worker.js').read_text().split('\n',1)[1]
embedded='\n<script id="embeddedData" type="application/json">'+(R/'dist/data.json').read_text().replace('<','\\u003c')+'</script>'
embedded+='\n<script id="embeddedWasm" type="application/octet-stream">'+b64((R/'dist/vendor/highs.wasm').read_bytes())+'</script>'
embedded+='\n<script id="embeddedWorker" type="application/octet-stream">'+b64(worker.encode())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/engine.js').read_text())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/config.js').read_text())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/mod.js').read_text())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/inventory.js').read_text())+'</script>'
embedded+='\n<script id="embeddedInventoryLua" type="application/octet-stream">'+b64((R/'dist/EquipmentLoadoutsManager.lua').read_bytes())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/file-import.js').read_text())+'</script>'
for name in ['vendor/qrcode.js','vendor/jsQR.js','vendor/lz-string.js','share.js']:
    embedded+='\n<script>'+safe_script((R/'dist'/name).read_text())+'</script>'
licenses='\n\n'.join((R/'dist/vendor'/name).read_text() for name in ['qrcode-LICENSE','jsQR-LICENSE','lz-string-LICENSE'])
embedded+='\n<script id="thirdPartyShareLicenses" type="text/plain">'+safe_script(licenses)+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/search-pool.js').read_text())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/app.js').read_text())+'</script>'
html=html.replace('</body>',embedded+'\n</body>')
# Validate required runtime assets are embedded, not loaded via file/http fetch.
assert all(f'id="{key}"' in html for key in ['embeddedData','embeddedWasm','embeddedWorker'])
assert not re.search(r'(?:src|href)="\./',html)
private_host=re.compile(rb'https?://[a-z0-9-]+[.][a-z0-9-]+[.]chatgpt[.]site',re.I)
project_id=re.compile(rb'appgprj_[a-z0-9]{10,}',re.I)
assert not private_host.search(html.encode())
assert not project_id.search(html.encode())
standalone=OUT/'SunbreakForge.html';standalone.write_text(html)
readme=(R/'README.md').read_text()
(OUT/'README.md').write_text(readme)
zip_path=OUT/'sunbreak-forge-local.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.write(standalone,'SunbreakForge/SunbreakForge.html')
    z.writestr('SunbreakForge/README.md',readme)
    for name in ['start_local.py','start-windows.bat','start-macos.command','start-linux.sh','package.json','build_local.py']:
        z.write(R/name,'SunbreakForge/'+name)
    for p in sorted((R/'dist').rglob('*')):
        if p.is_file():z.write(p,'SunbreakForge/'+p.relative_to(R).as_posix())
    for p in sorted((R/'tests').glob('*')):
        if p.is_file():z.write(p,'SunbreakForge/'+p.relative_to(R).as_posix())
with zipfile.ZipFile(zip_path) as z:
    assert z.testzip() is None
    for name in z.namelist():
        assert not any(v in name for v in ['.git/','.openai/','debug.lp'])
        raw=z.read(name)
        assert not private_host.search(raw),name
        assert not project_id.search(raw),name
print(json.dumps({'standalone':str(standalone),'html_bytes':standalone.stat().st_size,'zip':str(zip_path),'zip_bytes':zip_path.stat().st_size,'sha256':hashlib.sha256(zip_path.read_bytes()).hexdigest()},ensure_ascii=False))
