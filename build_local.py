#!/usr/bin/env python3
"""Build matching full and HTML-only portable ZIPs from the same standalone page."""
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
for name in ['engine.js','config.js','mod.js','inventory.js','file-import.js','vendor/qrcode.js','vendor/jsQR.js','vendor/lz-string.js','share.js','search-pool.js','resource-templates.js','extensions.js','extension-ui.js','augment-sim.js','augment-ui.js','handcraft.js','handcraft-ui.js','app.js']:
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
for name in ['resource-templates.js','extensions.js','extension-ui.js']:
    embedded+='\n<script>'+safe_script((R/'dist'/name).read_text())+'</script>'
ext_worker=worker.rsplit((R/'dist/worker.js').read_text().split('\n',1)[1],1)[0]+(R/'dist/resource-templates.js').read_text()+'\n'+(R/'dist/extensions.js').read_text()+'\n'+(R/'dist/extension-worker.js').read_text().split('\n',1)[1]
embedded+='\n<script id="embeddedExtensionWorker" type="application/octet-stream">'+b64(ext_worker.encode())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/augment-sim.js').read_text())+'</script>'
embedded+='\n<script>'+safe_script((R/'dist/augment-ui.js').read_text())+'</script>'
sim_worker=(R/'dist/augment-sim.js').read_text()+'\n'+(R/'dist/augment-worker.js').read_text().split('\n',1)[1]
embedded+='\n<script id="embeddedAugmentWorker" type="application/octet-stream">'+b64(sim_worker.encode())+'</script>'
for name in ['handcraft.js','handcraft-ui.js']:
    embedded+='\n<script>'+safe_script((R/'dist'/name).read_text())+'</script>'
guide_worker=worker.rsplit((R/'dist/worker.js').read_text().split('\n',1)[1],1)[0]+(R/'dist/probability.js').read_text()+'\n'+(R/'dist/handcraft.js').read_text()+'\n'+(R/'dist/stargazing.js').read_text()+'\n'+(R/'dist/handcraft-worker.js').read_text().split('\n',1)[1]
embedded+='\n<script id="embeddedHandcraftWorker" type="application/octet-stream">'+b64(guide_worker.encode())+'</script>'
embedded+='\n<script id="embeddedProbabilityIndex" type="application/json">'+(R/'dist/probability/index.json').read_text()+'</script>'
embedded+='\n<script id="embeddedProbabilityBook" type="application/octet-stream">'+b64((R/'dist/probability/codebook.json.gz').read_bytes())+'</script>'
for p in sorted((R/'dist/probability').glob('*.pbc.gz')):
    embedded+='\n<script id="probability-'+p.name.split('.')[0]+'" type="application/octet-stream">'+b64(p.read_bytes())+'</script>'
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
version=json.loads((R/'package.json').read_text())['version']
release=version.split('-',1)[0]
assert re.fullmatch(r'\d+\.\d+\.\d+',release),'Expected a semantic release version'
zip_path=OUT/('MHRScalculator-'+release.replace('.','')+'.zip')
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.write(standalone,'MHRScalculator/SunbreakForge.html')
    z.writestr('MHRScalculator/README.md',readme)
    for name in ['start_local.py','start-windows.bat','start-macos.command','start-linux.sh','package.json','build_local.py','LICENSE.txt']:
        z.write(R/name,'MHRScalculator/'+name)
    for p in sorted((R/'dist').rglob('*')):
        if p.is_file():z.write(p,'MHRScalculator/'+p.relative_to(R).as_posix())
    for p in sorted((R/'tests').glob('*')):
        if p.is_file():z.write(p,'MHRScalculator/'+p.relative_to(R).as_posix())
    for p in sorted((R/'docs').rglob('*')):
        if p.is_file():z.write(p,'MHRScalculator/'+p.relative_to(R).as_posix())
# The lightweight package embeds exactly the same page and probability tables.
# Its README does not point at directories or launchers absent from this package.
html_zip_path=OUT/('MHRScalculator-'+release.replace('.','')+'-html.zip')
html_readme=readme
fallback_start=html_readme.index('如果浏览器无法直接打开HTML')
fallback_end=html_readme.index('## 配装工房',fallback_start)
html_readme=html_readme[:fallback_start]+'若浏览器限制直接打开HTML，请下载完整备份包，并按其中的说明使用本地启动脚本。计算、模拟及手炼概率均可离线使用；说明中的外部参考链接需要联网。\n\n'+html_readme[fallback_end:]
html_readme=html_readme.replace('dist/EquipmentLoadoutsManager.lua','EquipmentLoadoutsManager.lua')
html_readme=re.sub(r'\]\((docs/[^)]+)\)',lambda m:'](https://github.com/hotdog-zz/MHRS-calculator/blob/main/'+m.group(1)+')',html_readme)
html_readme=html_readme.replace('第三方依赖与许可证见 `dist/vendor/`。','第三方组件许可证见 `THIRD_PARTY_LICENSES.txt`。').replace('见 `dist/vendor/`；HTML轻量包中汇总为 `THIRD_PARTY_LICENSES.txt`。','见 `THIRD_PARTY_LICENSES.txt`。')
third_party_licenses='\n\n'.join(name+'\n'+'='*len(name)+'\n'+(R/'dist/vendor'/name).read_text() for name in ['LICENSE','qrcode-LICENSE','jsQR-LICENSE','lz-string-LICENSE'])
with zipfile.ZipFile(html_zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.write(standalone,'MHRScalculator/SunbreakForge.html')
    z.writestr('MHRScalculator/README.md',html_readme)
    z.write(R/'LICENSE.txt','MHRScalculator/LICENSE.txt')
    z.write(R/'dist/EquipmentLoadoutsManager.lua','MHRScalculator/EquipmentLoadoutsManager.lua')
    z.writestr('MHRScalculator/THIRD_PARTY_LICENSES.txt',third_party_licenses)
for archive in [zip_path,html_zip_path]:
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        for name in z.namelist():
            assert not any(v in name for v in ['.git/','.openai/','debug.lp','benchmarks/'])
            raw=z.read(name)
            assert not private_host.search(raw),name
            assert not project_id.search(raw),name
with zipfile.ZipFile(zip_path) as full,zipfile.ZipFile(html_zip_path) as light:
    assert full.read('MHRScalculator/SunbreakForge.html')==light.read('MHRScalculator/SunbreakForge.html')
    assert full.read('MHRScalculator/dist/EquipmentLoadoutsManager.lua')==light.read('MHRScalculator/EquipmentLoadoutsManager.lua')
    assert full.read('MHRScalculator/LICENSE.txt')==light.read('MHRScalculator/LICENSE.txt')==(R/'LICENSE.txt').read_bytes()
    assert len(light.namelist())==5
    assert not re.search(r'\]\(docs/',html_readme)
print(json.dumps({'standalone':str(standalone),'html_bytes':standalone.stat().st_size,'zip':str(zip_path),'zip_bytes':zip_path.stat().st_size,'sha256':hashlib.sha256(zip_path.read_bytes()).hexdigest(),'html_zip':str(html_zip_path),'html_zip_bytes':html_zip_path.stat().st_size,'html_zip_sha256':hashlib.sha256(html_zip_path.read_bytes()).hexdigest()},ensure_ascii=False))
