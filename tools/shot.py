#!/usr/bin/env python3
"""렌더링 검증 + 스크린샷. Playwright(headless chromium) 사용."""
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = ROOT / "screenshots"
SHOTS.mkdir(exist_ok=True)
URL = (ROOT / "index.html").as_uri()

VIEWPORTS = {
    "desktop": {"width": 1440, "height": 900},
    "mobile": {"width": 375, "height": 812},
}


def main() -> int:
    problems = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name, viewport in VIEWPORTS.items():
            page = browser.new_page(viewport=viewport, device_scale_factor=2)
            console = []
            page.on("console", lambda msg: console.append(f"{msg.type}: {msg.text}"))
            page.on("pageerror", lambda err: console.append(f"pageerror: {err}"))
            page.goto(URL, wait_until="load")
            page.wait_for_function("document.documentElement.classList.contains('is-ready')")
            page.wait_for_timeout(650)

            metrics = page.evaluate(
                """() => ({
                    scrollWidth: document.documentElement.scrollWidth,
                    innerWidth: window.innerWidth,
                    bodyScrollWidth: document.body.scrollWidth,
                    brands: document.querySelectorAll('.brand').length,
                    trials: document.querySelectorAll('.trial').length,
                    incidents: document.querySelectorAll('.incident').length,
                    episodes: document.querySelectorAll('.episode').length,
                    activeTab: document.querySelector('.tab[aria-selected="true"]')?.dataset.tab,
                    panelVisible: [...document.querySelectorAll('.panel')].filter(p => !p.hidden).map(p => p.id),
                })"""
            )
            print(f"[{name}] {metrics}")
            if metrics["scrollWidth"] > metrics["innerWidth"]:
                problems.append(f"{name}: horizontal overflow {metrics['scrollWidth']} > {metrics['innerWidth']}")
            if metrics["brands"] != 30:
                problems.append(f"{name}: expected 30 brands, got {metrics['brands']}")
            if metrics["episodes"] != 12:
                problems.append(f"{name}: expected 12 episodes, got {metrics['episodes']}")
            errors = [line for line in console if line.startswith(("error", "pageerror"))]
            if errors:
                problems.append(f"{name}: console errors -> {errors}")

            # desktop shots
            if name == "desktop":
                page.screenshot(path=str(SHOTS / "desktop-01-hero.png"))
                grid = page.query_selector("#panel-brands .gov")
                page.query_selector("#brand-grid").scroll_into_view_if_needed()
                page.wait_for_timeout(350)
                page.screenshot(path=str(SHOTS / "desktop-02-brands.png"))
                grid.scroll_into_view_if_needed()
                page.wait_for_timeout(350)
                page.screenshot(path=str(SHOTS / "desktop-03-governance.png"))

                page.click('[data-tab="trials"]')
                page.wait_for_timeout(500)
                page.screenshot(path=str(SHOTS / "desktop-04-trials.png"))

                page.click('[data-tab="incidents"]')
                page.wait_for_timeout(500)
                page.screenshot(path=str(SHOTS / "desktop-05-incidents.png"))
                page.query_selector("#pledge").scroll_into_view_if_needed()
                page.wait_for_timeout(350)
                page.screenshot(path=str(SHOTS / "desktop-06-pledge.png"))

                page.click('[data-tab="podcasts"]')
                page.wait_for_timeout(500)
                page.screenshot(path=str(SHOTS / "desktop-07-podcasts.png"))

                # interaction check: 초성 검색
                page.click('[data-tab="brands"]')
                page.wait_for_timeout(300)
                page.fill("#brand-search", "ㅅㅇㅋㅅ")
                page.wait_for_timeout(300)
                found = page.eval_on_selector_all(".brand h3", "els => els.map(e => e.textContent)")
                print("choseong search ㅅㅇㅋㅅ ->", found)
                if found != ["쉐이크쉑"]:
                    problems.append(f"choseong search mismatch: {found}")
                page.fill("#brand-search", "")
                page.wait_for_timeout(250)

                # interaction check: 관련 팟캐스트 칩 -> 탭 이동
                page.click('[data-tab="trials"]')
                page.wait_for_timeout(300)
                chip = page.query_selector('[data-ep-target="421a"]')
                if chip:
                    chip.click()
                    page.wait_for_timeout(900)
                    tab = page.get_attribute('.tab[aria-selected="true"]', "data-tab")
                    print("pod cast chip jump ->", tab)
                    if tab != "podcasts":
                        problems.append("podcast chip did not switch tab")
                    page.screenshot(path=str(SHOTS / "desktop-08-podcast-jump.png"))
                else:
                    problems.append("no 421a podcast chip on trial card")

                # interaction check: 사건 필터
                page.click('[data-tab="incidents"]')
                page.wait_for_timeout(300)
                page.click('[data-year="2026"]')
                page.wait_for_timeout(300)
                n = page.eval_on_selector_all(".incident", "els => els.length")
                print("2026 filter ->", n)
                if n != 3:
                    problems.append(f"year filter expected 3, got {n}")
                page.click('[data-year="all"]')
                page.wait_for_timeout(250)

            else:
                page.screenshot(path=str(SHOTS / "mobile-01-hero.png"))
                page.query_selector("#brand-grid").scroll_into_view_if_needed()
                page.wait_for_timeout(350)
                page.screenshot(path=str(SHOTS / "mobile-02-brands.png"))
                page.click('[data-tab="incidents"]')
                page.wait_for_timeout(450)
                page.screenshot(path=str(SHOTS / "mobile-03-incidents.png"))
                page.click('[data-tab="podcasts"]')
                page.wait_for_timeout(450)
                page.screenshot(path=str(SHOTS / "mobile-04-podcasts.png"))
                # 모바일 탭 바가 화면을 가로로 늘리지 않는지
                tabs = page.evaluate(
                    "() => { const el = document.querySelector('.tabs__inner'); "
                    "return {scrollWidth: el.scrollWidth, clientWidth: el.clientWidth}; }"
                )
                print("[mobile] tabs", tabs)

            page.close()
        browser.close()

    if problems:
        print("\nPROBLEMS:")
        for problem in problems:
            print(" -", problem)
        return 1
    print("\nALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
