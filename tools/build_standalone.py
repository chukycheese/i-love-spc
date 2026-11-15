#!/usr/bin/env python3
"""index.html + css + js + data 를 하나의 HTML 파일로 인라인한다.

- standalone.html: 파일 하나만 열어도 동작하는 오프라인 배포본
- public/index.html: Cloudflare Workers(Assets)가 실제로 서비스하는 배포본
- public/{css,js,data}: 원본과 어긋나지 않도록 함께 동기화
"""
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
ASSETS = ("css/style.css", "js/app.js", "data/spc-data.js", "data/spc-data.json")

html = (ROOT / "index.html").read_text(encoding="utf-8")
css = (ROOT / "css" / "style.css").read_text(encoding="utf-8")
data_js = (ROOT / "data" / "spc-data.js").read_text(encoding="utf-8")
app_js = (ROOT / "js" / "app.js").read_text(encoding="utf-8")

html = html.replace('<link rel="stylesheet" href="css/style.css">', "<style>\n" + css + "\n</style>")
html = html.replace(
    '<script src="data/spc-data.js"></script>\n<script src="js/app.js"></script>',
    "<script>\n" + data_js + "\n</script>\n<script>\n" + app_js + "\n</script>",
)
# 인라인 파일에서는 상대 경로 fetch가 필요 없다.
assert "spc-data.js" not in html.split("<body>")[0], "inline failed"

OUTS = (ROOT / "standalone.html", PUBLIC / "index.html")
for out in OUTS:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print("wrote", out.relative_to(ROOT), out.stat().st_size, "bytes")

for rel in ASSETS:
    src, dst = ROOT / rel, PUBLIC / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    print("synced", rel)
