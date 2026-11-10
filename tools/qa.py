#!/usr/bin/env python3
"""동작·레이아웃 QA. python3 tools/qa.py (LD_LIBRARY_PATH 필요할 수 있음)"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / "index.html").as_uri()
WIDTHS = [320, 360, 375, 390, 414, 768, 1024, 1440]


def main() -> int:
    problems = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.goto(URL, wait_until="load")
        page.wait_for_function("document.documentElement.classList.contains('is-ready')")

        if page.inner_text("#as-of-label") != "2026. 11. 9 기준":
            problems.append("as-of label duplicated or wrong: " + page.inner_text("#as-of-label"))

        # 검색
        cases = {"ㅂㅅㅋ": ["배스킨라빈스"], "ㅅㅇㅋㅅ": ["쉐이크쉑"], "던킨": ["던킨"], "파리": None}
        for query, expected in cases.items():
            page.fill("#brand-search", query)
            page.wait_for_timeout(200)
            names = page.eval_on_selector_all(".brand h3", "els => els.map(e => e.textContent)")
            print(f"search {query!r} -> {names}")
            if expected is not None and names != expected:
                problems.append(f"search {query}: {names} != {expected}")
            if not names:
                problems.append(f"search {query}: no result")

        page.fill("#brand-search", "없는브랜드")
        page.wait_for_timeout(200)
        if page.is_hidden("#brand-empty"):
            problems.append("empty state not shown")
        page.click("#empty-reset")
        page.wait_for_timeout(200)
        if page.eval_on_selector_all(".brand", "e => e.length") != 30:
            problems.append("reset did not restore 30 brands")

        # 탭 + 아코디언
        page.click('[data-tab="incidents"]')
        page.wait_for_timeout(200)
        page.click("#incident-spl-2022 .incident__more")
        page.wait_for_timeout(200)
        if page.is_hidden("#incident-body-spl-2022"):
            problems.append("incident detail did not open")
        text = page.inner_text("#incident-body-spl-2022")
        if "벌금 20억" not in text:
            problems.append("incident detail missing ruling")
        if "480a" not in text:
            problems.append("incident detail missing related podcast 480a")

        # 팟캐스트 관련 기록 점프
        page.click('[data-tab="podcasts"]')
        page.wait_for_timeout(200)
        page.click('#ep-603a [data-record="samlip-2025"]')
        page.wait_for_timeout(700)
        active = page.get_attribute('.tab[aria-selected="true"]', "data-tab")
        if active != "incidents":
            problems.append("episode related chip did not switch to incidents")
        if page.is_hidden("#incident-body-samlip-2025"):
            problems.append("episode related chip did not open incident detail")

        # 재판 모두 접기/펼치기
        page.click('[data-tab="trials"]')
        page.wait_for_timeout(200)
        page.click("#trial-toggle-all")
        page.wait_for_timeout(200)
        if page.eval_on_selector_all(".trial__body:not([hidden])", "e => e.length") != 3:
            problems.append("expand all failed")
        page.click("#trial-toggle-all")
        page.wait_for_timeout(200)
        if page.eval_on_selector_all(".trial__body:not([hidden])", "e => e.length") != 0:
            problems.append("collapse all failed")

        page.close()

        # 반응형 폭 점검
        for width in WIDTHS:
            ctx = browser.new_page(viewport={"width": width, "height": 800})
            ctx.goto(URL, wait_until="load")
            ctx.wait_for_function("document.documentElement.classList.contains('is-ready')")
            ctx.wait_for_timeout(150)
            sw, iw = ctx.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
            if sw > iw:
                problems.append(f"{width}px: horizontal overflow {sw}>{iw}")
            # 탭 바가 페이지를 밀지 않는지
            tab_sw, tab_cw = ctx.evaluate(
                "() => { const el = document.querySelector('.tabs__inner'); return [el.scrollWidth, el.clientWidth]; }"
            )
            if tab_cw > iw:
                problems.append(f"{width}px: tab bar wider than viewport")
            print(f"{width}px ok (tabs {tab_sw}/{tab_cw})")
            ctx.close()

        if errors:
            problems.append(f"console errors: {errors}")
        browser.close()

    if problems:
        print("\nPROBLEMS:")
        for problem in problems:
            print(" -", problem)
        return 1
    print("\nQA PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
