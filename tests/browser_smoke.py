"""Optional UI smoke test. Requires Python Playwright and Chromium."""
from pathlib import Path
import os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root)))
Thread(target=server.serve_forever, daemon=True).start()

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1100})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
    page.get_by_role('button', name='进入持续世界').click()
    page.get_by_role('button', name='先观察家老与同辈的反应').click()
    assert page.get_by_text('古月学堂', exact=True).count() >= 1
    page.get_by_role('button', name='去古月山寨').click()
    page.get_by_role('button', name='去竹林').click()
    page.get_by_role('button', name='探索 / 采集').click()
    assert page.get_by_text('事件流', exact=True).is_visible()
    page.get_by_role('button', name='保存').click()
    before = page.locator('.topbar p').inner_text()
    page.reload()
    assert page.locator('.topbar p').inner_text() == before
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors, errors
    print('PASS: simulation-first launch, event resolution, travel, action, save/reload, mobile width, no page errors.')
    browser.close()
server.shutdown()
