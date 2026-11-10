#!/usr/bin/env python3
"""index.html + css + js + data 를 하나의 HTML 파일로 인라인한다.
빌드 도구 없이 파일 하나만 열어도 동작하는 배포용 결과물."""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "standalone.html"

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
OUT.write_text(html, encoding="utf-8")
print("wrote", OUT, OUT.stat().st_size, "bytes")
