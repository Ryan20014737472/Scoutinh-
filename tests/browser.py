"""End-to-end checks against a running app: python tests/browser.py."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('SCOUT_TEST_URL', 'http://127.0.0.1:4173')
ARTIFACTS = Path('outputs')
ARTIFACTS.mkdir(exist_ok=True)

def action(page, name):
    page.locator(f'[data-action="{name}"]').first.click()

def view(page, name):
    page.locator(f'[data-view="{name}"]:visible').first.click()
    page.wait_for_url(f'**#{name}')

def read_state(page):
    return page.evaluate("async () => (await import('./src/services/storage.js')).loadState()")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE)
    expect(page.locator('.dashboard-hero')).to_be_visible()
    page.screenshot(path=str(ARTIFACTS / 'dashboard-desktop.png'), full_page=True)
    action(page, 'open-setup')
    page.get_by_label('Nome do evento', exact=True).fill('Regional de Robótica')
    page.get_by_label('Seu nome', exact=True).fill('Ana Silva')
    page.get_by_role('button', name='Continuar', exact=True).click()
    expect(page.get_by_role('heading', name='Adicione as equipes', exact=True)).to_be_visible()
    page.get_by_label('Uma equipe por linha').fill('12345; Horizonte\n23456; Circuito Verde\n34567; Nova Geração\n45678; Robótica Brasil')
    page.get_by_role('button', name='Salvar equipes e continuar', exact=True).click()
    expect(page.get_by_role('heading', name='Monte a primeira partida')).to_be_visible()
    for key, number in [('red1', '12345'), ('red2', '23456'), ('blue1', '34567'), ('blue2', '45678')]:
        page.locator(f'select[name="{key}"]').select_option('team-' + number)
    assert page.locator('select[name="blue2"] option[value="team-12345"]').is_disabled()
    page.get_by_role('button', name='Concluir e abrir partidas').click()
    expect(page.locator('.match-card')).to_have_count(1)
    assert page.url.endswith('#matches')
    assert len(read_state(page)['teams']) == 4
    page.screenshot(path=str(ARTIFACTS / 'matches-desktop.png'), full_page=True)

    # Live search updates while keeping keyboard focus and cursor position.
    view(page, 'teams')
    search = page.get_by_role('textbox', name='Buscar equipe')
    search.press_sequentially('Horizonte', delay=25)
    expect(page.locator('button.team-row')).to_have_count(1)
    assert search.input_value() == 'Horizonte'
    expect(search).to_be_focused()
    search.fill('')
    expect(page.locator('button.team-row')).to_have_count(4)
    page.locator('button.team-row').first.click()
    profile_url = page.url
    page.reload()
    expect(page.get_by_role('heading', name='Horizonte', exact=True)).to_be_visible()
    assert page.url == profile_url
    page.go_back()
    expect(page.get_by_role('heading', name='Equipes', exact=True)).to_be_visible()

    # Rapid taps are serialized, so no count is overwritten by a previous save.
    view(page, 'matches')
    page.get_by_role('button', name='Observar equipe 12345', exact=True).click()
    page.locator('[data-action="change-counter"][data-delta="1"]').first.evaluate('(button) => { for (let i=0; i<20; i++) button.click(); }')
    expect(page.locator('.counter-value').first).to_have_text('20')
    page.locator('[data-action="set-action-status"][data-status="success"]').first.click()
    action(page, 'next-scout-phase')
    expect(page.locator('.phase-intro h2')).to_have_text('TeleOp')
    page.locator('[data-action="change-counter"][data-delta="1"]').first.evaluate('(button) => { for (let i=0; i<7; i++) button.click(); }')
    expect(page.locator('.counter-value').first).to_have_text('7')
    action(page, 'leave-scout')
    expect(page.get_by_role('button', name='Retomar observação da equipe 12345', exact=True)).to_be_visible()
    action(page, 'match-status')
    page.get_by_role('button', name='Em andamento', exact=True).click()
    expect(page.locator('.match-card')).to_have_count(1)
    page.get_by_role('button', name='Retomar observação da equipe 12345', exact=True).click()
    expect(page.locator('.phase-intro h2')).to_have_text('TeleOp')
    expect(page.locator('.counter-value').first).to_have_text('7')
    page.reload()
    expect(page.locator('.phase-intro h2')).to_have_text('TeleOp')
    expect(page.locator('.counter-value').first).to_have_text('7')
    action(page, 'next-scout-phase')
    page.get_by_role('button', name='Concluiu', exact=True).click()
    action(page, 'next-scout-phase')
    notes = page.get_by_label('Observações do scout (opcional)')
    notes.press_sequentially('Ciclo rápido e boa defesa. ', delay=10)
    notes.press('End')
    page.locator('[data-action="set-defense"][data-value="strong"]').click()
    expect(notes).to_have_value('Ciclo rápido e boa defesa. ')
    page.screenshot(path=str(ARTIFACTS / 'scouting-desktop.png'), full_page=True)
    action(page, 'review-scout')
    expect(page.get_by_role('dialog')).to_be_visible()
    page.get_by_role('button', name='Confirmar e salvar').click()
    expect(page.get_by_role('heading', name='Horizonte', exact=True)).to_be_visible()
    state = read_state(page)
    assert len(state['scoutingRecords']) == 1
    assert not state.get('drafts')
    assert state['scoutingRecords'][0]['notes'] == 'Ciclo rápido e boa defesa. '
    page.locator('[data-action="open-record"]').click()
    expect(page.get_by_role('dialog')).to_contain_text('Ciclo rápido e boa defesa.')
    page.get_by_role('button', name='Corrigir observação').click()
    expect(page.locator('.counter-value').first).to_have_text('20')
    page.locator('[data-action="change-counter"][data-delta="1"]').first.click()
    expect(page.locator('.counter-value').first).to_have_text('21')
    page.get_by_role('button', name='Revisar', exact=True).click()
    page.get_by_role('button', name='Confirmar e salvar').click()
    expect(page.get_by_role('heading', name='Horizonte', exact=True)).to_be_visible()
    state = read_state(page)
    assert len(state['scoutingRecords']) == 1
    saved_value = state['scoutingRecords'][0]['actions']['pre_auto_actions']
    assert (saved_value.get('value') if isinstance(saved_value, dict) else saved_value) == 21
    action(page, 'toggle-favorite')
    view(page, 'favorites')
    expect(page.locator('.favorite-card')).to_have_count(1)
    view(page, 'dashboard')
    expect(page.locator('.coverage-ring strong')).to_have_text('25%')
    page.screenshot(path=str(ARTIFACTS / 'dashboard-populated.png'), full_page=True)

    # Export and restoration preserve completed records.
    view(page, 'settings')
    with page.expect_download() as export:
        action(page, 'export-state-json')
    backup_path = ARTIFACTS / 'test-backup.json'
    export.value.save_as(backup_path)
    backup = json.loads(backup_path.read_text())
    assert len(backup['scoutingRecords']) == 1
    page.locator('#backup-file').set_input_files(str(backup_path))
    expect(page.get_by_role('heading', name='Restaurar este backup?')).to_be_visible()
    action(page, 'confirm-restore')
    expect(page.locator('.dashboard-hero')).to_be_visible()
    assert len(read_state(page)['scoutingRecords']) == 1

    # Service worker, all routes, and the app survive a network outage.
    page.evaluate('async () => { await navigator.serviceWorker.ready; }')
    page.reload()
    page.wait_for_function('navigator.serviceWorker.controller !== null')
    context.set_offline(True)
    page.reload()
    expect(page.locator('.dashboard-hero')).to_be_visible()
    view(page, 'matches')
    page.get_by_role('button', name='Observar equipe 23456', exact=True).click()
    page.locator('[data-action="change-counter"][data-delta="1"]').first.click()
    expect(page.locator('.counter-value').first).to_have_text('1')
    page.reload()
    expect(page.locator('.counter-value').first).to_have_text('1')
    context.set_offline(False)
    view(page, 'dashboard')
    for route in ['teams', 'ranking', 'compare', 'favorites', 'stats', 'season', 'admin', 'settings']:
        view(page, route)
        expect(page.locator('.page')).to_be_visible()
        assert '${icon' not in page.locator('.page').inner_text()
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), route

    # Metric edits persist, keep their phase open, and protect historical data.
    view(page, 'season')
    page.locator('[data-action="season-tab"][data-phase="teleop"]').click()
    cycle_label = page.locator('[data-action-row="pre_teleop_cycles"] input.inline-label')
    cycle_label.fill('Ciclos completos')
    cycle_label.press('Tab')
    expect(cycle_label).to_have_value('Ciclos completos')
    expect(page.locator('[data-season-panel="teleop"]')).to_be_visible()
    page.wait_for_function("async () => (await (await import('./src/services/storage.js')).loadState()).seasonConfigs[0].actions.teleop[0].label === 'Ciclos completos'")
    custom = page.locator('form[data-form="add-season-action"]')
    custom.locator('[name="label"]').fill('Objetos observados')
    custom.get_by_role('button', name='Adicionar ação', exact=True).click()
    expect(page.locator('[data-action-row="objetos_observados"]')).to_be_visible()
    assert next(item for item in read_state(page)['seasonConfigs'][0]['actions']['teleop'] if item['id'] == 'objetos_observados')['points'] == 0
    page.locator('[data-action="request-delete-season-action"][data-action-id="objetos_observados"]').click()
    action(page, 'confirm-delete-season-action')
    expect(page.locator('[data-action-row="objetos_observados"]')).to_have_count(0)
    page.locator('[data-action="request-delete-season-action"][data-action-id="pre_teleop_cycles"]').click()
    expect(page.locator('.toast.error').last).to_contain_text('preservar o histórico')

    # Modal keyboard focus stays inside the dialog and Escape closes it.
    view(page, 'teams')
    action(page, 'open-add-team')
    modal = page.get_by_role('dialog')
    for _ in range(12):
        page.keyboard.press('Tab')
        assert page.evaluate('document.activeElement.closest(".modal") !== null')
    page.keyboard.press('Escape')
    expect(modal).to_have_count(0)

    # Mobile navigation exposes all pages and every layout fits the viewport.
    for width in [390, 320, 768]:
        page.set_viewport_size({'width': width, 'height': 844})
        for route in ['dashboard', 'matches', 'teams', 'stats', 'more']:
            view(page, route)
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), f'{route} {width}'
        page.locator('.tool-card[data-view="compare"]').click()
        expect(page.get_by_role('heading', name='Comparar equipes', exact=True)).to_be_visible()
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    page.set_viewport_size({'width': 390, 'height': 844})
    view(page, 'dashboard')
    page.screenshot(path=str(ARTIFACTS / 'dashboard-mobile.png'), full_page=True)
    view(page, 'matches')
    page.screenshot(path=str(ARTIFACTS / 'matches-mobile.png'), full_page=True)
    action(page, 'open-add-match')
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    page.screenshot(path=str(ARTIFACTS / 'match-form-mobile.png'))
    page.keyboard.press('Escape')
    # Discarding is explicit; it frees a slot without deleting saved records.
    view(page, 'matches')
    page.get_by_role('button', name='Retomar observação da equipe 23456', exact=True).click()
    action(page, 'request-discard-scout')
    expect(page.get_by_role('heading', name='Descartar este rascunho?')).to_be_visible()
    action(page, 'confirm-discard-scout')
    expect(page.get_by_role('button', name='Observar equipe 23456', exact=True)).to_be_visible()
    assert len(read_state(page)['scoutingRecords']) == 1
    assert not read_state(page).get('drafts')
    for number in ['23456', '34567', '45678']:
        page.get_by_role('button', name='Observar equipe ' + number, exact=True).click()
        page.get_by_role('button', name='Revisar', exact=True).click()
        page.get_by_role('button', name='Confirmar e salvar').click()
        expect(page.locator('.team-profile-title h1')).to_be_visible()
        view(page, 'matches')
    page.get_by_role('button', name='Completa', exact=True).click()
    expect(page.locator('.match-card')).to_have_count(1)
    assert read_state(page)['matches'][0]['status'] == 'complete'
    view(page, 'dashboard')
    expect(page.locator('.coverage-ring strong')).to_have_text('100%')

    # Switching a new event to DECODE preserves another event's season/history.
    page.set_viewport_size({'width': 1440, 'height': 1000})
    view(page, 'admin')
    page.locator('details.admin-create').first.locator('summary').click()
    event_form = page.locator('form[data-form="add-event"]')
    event_form.locator('input[name="name"]').fill('Treino histórico')
    event_form.get_by_role('button', name='Criar e ativar', exact=True).click()
    page.wait_for_function("async () => (await (await import('./src/services/storage.js')).loadState()).events.length === 2")
    view(page, 'season')
    page.locator('[data-action="apply-season-preset"][data-preset="decode"]').click()
    expect(page.get_by_label('Nome do jogo', exact=True)).to_have_value('DECODE™ presented by RTX')
    state = read_state(page)
    assert len(state['seasonConfigs']) == 2
    assert len(state['scoutingRecords']) == 4
    assert state['events'][0]['seasonId'] == 'season-2026-biobuzz'
    assert state['events'][1]['seasonId'] == 'season-2025-decode'
    page.evaluate("async () => { const storage = await import('./src/services/storage.js'); const parser = await import('./src/services/import.js'); parser.parseBackup(JSON.stringify(await storage.loadState())); }")

    # Invalid files never replace existing data; reset and restore are confirmed.
    view(page, 'settings')
    page.locator('#backup-file').set_input_files({'name': 'invalid.json', 'mimeType': 'application/json', 'buffer': b'{"teams": []}'})
    expect(page.locator('.toast.error').last).to_contain_text('backup completo')
    assert len(read_state(page)['scoutingRecords']) == 4
    action(page, 'request-reset')
    page.get_by_role('button', name='Manter meus dados', exact=True).click()
    assert len(read_state(page)['scoutingRecords']) == 4
    action(page, 'request-reset')
    action(page, 'confirm-reset')
    expect(page.locator('.dashboard-hero')).to_be_visible()
    assert not read_state(page)['teams']
    view(page, 'settings')
    page.locator('#backup-file').set_input_files(str(backup_path))
    action(page, 'confirm-restore')
    expect(page.locator('.dashboard-hero')).to_be_visible()
    assert len(read_state(page)['scoutingRecords']) == 1

    # Web Locks serialize writes from independent tabs of the same workspace.
    other = context.new_page()
    other.goto(BASE)
    other.wait_for_selector('.page')
    other.evaluate("""async () => {
      const storage = await import('./src/services/storage.js');
      window.writeBatch = Promise.all(Array.from({length:20}, () => storage.updateState(next => {
        next.metadata = {clicks:(next.metadata?.clicks || 0) + 1};
      })));
    }""")
    page.evaluate("""async () => {
      const storage = await import('./src/services/storage.js');
      await Promise.all(Array.from({length:20}, () => storage.updateState(next => {
        next.metadata = {clicks:(next.metadata?.clicks || 0) + 1};
      })));
    }""")
    other.evaluate('async () => await window.writeBatch')
    assert read_state(page)['metadata']['clicks'] == 40
    other.close()
    assert not errors, errors
    print('PASS: preparation, live search, history, rapid counters, draft recovery, saved-record editing, favorites, metrics, backup validation, explicit discard, cross-tab writes, offline, keyboard, desktop and mobile routes.')
    browser.close()
