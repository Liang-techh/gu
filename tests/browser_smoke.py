"""Optional UI smoke test. Requires Python Playwright and a Chromium executable."""
from pathlib import Path
import os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1100})
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/index.html')
    page.get_by_role('button',name='进入青茅山').click()
    page.get_by_role('button',name='先向学堂请教',exact=False).click()
    assert page.get_by_text('现在做什么',exact=True).is_visible()
    page.get_by_role('button',name='蛊虫',exact=True).click()
    for _ in range(8):
        button=page.get_by_role('button',name='炼化 · 二小时',exact=True)
        if button.count() and button.is_enabled(): button.click()
        else: break
    assert page.get_by_text('本命蛊',exact=True).is_visible()
    for tab in ['青茅山','人物','买卖','往事','原文','行止']:
        page.get_by_role('button',name=tab,exact=True).click()
    page.screenshot(path=str(root.parent/'desktop.png'),full_page=True)
    before=page.locator('.date').inner_text()
    page.reload()
    assert not page.locator('dialog[open]').count()
    assert page.locator('.date').inner_text()==before
    page.get_by_role('button',name='存读档',exact=True).click()
    page.get_by_role('button',name='保存',exact=True).first.click()
    assert '尚无存档' not in page.locator('.save-row').nth(1).inner_text()
    page.get_by_role('button',name='关闭',exact=True).click()
    page.set_viewport_size({'width':390,'height':844})
    for tab in ['行止','青茅山','蛊虫','人物','买卖','往事','原文']:
        page.get_by_role('button',name=tab,exact=True).click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),tab
    page.get_by_role('button',name='行止',exact=True).click()
    page.screenshot(path=str(root.parent/'mobile.png'),full_page=True)
    # A hostile name is shown as text, never interpreted as a tag.
    page.on('dialog',lambda d:d.accept())
    page.get_by_role('button',name='重新开局',exact=True).click()
    page.locator('#player-name').fill('<svg onload=alert(1)>')
    page.get_by_role('button',name='进入青茅山').click()
    assert page.locator('.character svg').count()==0
    assert not errors,errors
    print('PASS: HTTP launch, refinement, 7 tabs, reload, manual save, mobile overflow, escaped input; no page errors.')
    browser.close()
server.shutdown()
