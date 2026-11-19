#!/usr/bin/env python3
"""spc-data.json 보조 스크립트.

1) 브랜드 이름에서 초성 검색 키(choseong)와 2글자 영문 이니셜(initials)을 만들어 JSON에 채워 넣는다.
2) file:// 로 index.html을 열어도 데이터가 보이도록 data/spc-data.js 래퍼를 만든다.
   (원본은 언제나 data/spc-data.json 이다.)
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_JSON = ROOT / "data" / "spc-data.json"
DATA_JS = ROOT / "data" / "spc-data.js"

CHOSEONG = list("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")

# 이니셜 생성 시 건너뛰는 기능어. 단어 경계를 살리되 관사·전치사는 제외한다.
INITIAL_STOPWORDS = {"the", "in", "of", "and"}
INITIAL_SPLIT = re.compile(r"[\s@&/+.\-]+")


def choseong(text: str) -> str:
    out = []
    for ch in text:
        code = ord(ch)
        if 0xAC00 <= code <= 0xD7A3:
            out.append(CHOSEONG[(code - 0xAC00) // 588])
        elif ch.isalnum():
            out.append(ch.lower())
    return "".join(out)


def initials(text: str) -> str:
    """브랜드 영문명에서 두 글자 이니셜을 만든다.

    Paris Baguette -> PB, Passion 5 -> P5, Pig in the Garden -> PG.
    단어가 하나뿐이면 앞 두 글자를 쓴다 (Vera -> VE).
    """
    cleaned = text.replace("'", "").replace("\u2019", "")
    tokens = [t for t in INITIAL_SPLIT.split(cleaned) if t]
    words = [t for t in tokens if t.lower() not in INITIAL_STOPWORDS] or tokens

    if not words:
        return "?"
    if len(words) > 1:
        return (words[0][0] + words[1][0]).upper()

    alnum = "".join(ch for ch in words[0] if ch.isalnum())
    return (alnum[:2] or words[0][0]).upper()


def main() -> None:
    data = json.loads(DATA_JSON.read_text(encoding="utf-8"))

    for brand in data["brands"]:
        brand["choseong"] = choseong(brand["name"])
        brand["initials"] = initials(brand["en"])
        brand["search"] = " ".join(
            [
                brand["name"],
                brand["en"],
                brand["company"],
                brand["product"],
                brand["choseong"],
                brand["initials"],
            ]
        ).lower()

    for trial in data["trials"]:
        trial["choseong"] = choseong(trial["short"])

    for item in data["incidents"]:
        item["choseong"] = choseong(item["title"])

    # 초성 키는 검색 편의를 위해 저장하되, 검색 로직은 런타임에서도 계산한다.
    DATA_JSON.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    DATA_JS.write_text(
        "/* 자동 생성 파일 — 원본은 data/spc-data.json 입니다. 직접 수정하지 마세요. */\n"
        "window.__SPC_DATA__ = " + payload + ";\n",
        encoding="utf-8",
    )

    counts = {
        "trials": len(data["trials"]),
        "incidents": len(data["incidents"]),
        "brands": len(data["brands"]),
        "subsidiaries": len(data["subsidiaries"]),
        "podcasts": len(data["podcasts"]["episodes"]),
    }
    print("OK", counts)
    print("json bytes:", DATA_JSON.stat().st_size, "js bytes:", DATA_JS.stat().st_size)
    print("brands:", ", ".join(f'{b["name"]}({b["choseong"]}/{b["initials"]})' for b in data["brands"]))


if __name__ == "__main__":
    main()
