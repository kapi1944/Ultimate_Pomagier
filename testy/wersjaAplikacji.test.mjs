import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { pobierzInformacjeOWersji } from '../skrypty/informacjeOWersji.mjs'

test('wspólne metadane wydania identyfikują wersję i rzeczywiste źródła', () => {
  const informacje = pobierzInformacjeOWersji()
  const pakiet = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(informacje.wersja, pakiet.version)
  assert.equal(informacje.nazwaProduktu, `Ultimate Pomagier ${pakiet.version}`)
  const blokadaNpm = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
  assert.equal(blokadaNpm.version, pakiet.version)
  assert.equal(blokadaNpm.packages[''].version, pakiet.version)
  for (const [katalog, pakiety] of [['src-tauri', ['ultimate-pomagier', 'pomagier-konta']], ['src-tauri/konta', ['pomagier-konta']]]) {
    const blokadaCargo = readFileSync(new URL(`../${katalog}/Cargo.lock`, import.meta.url), 'utf8')
    for (const nazwa of pakiety) {
      assert.ok(blokadaCargo.replaceAll('\r\n', '\n').includes(`name = "${nazwa}"\nversion = "${pakiet.version}"`))
    }
    const manifestCargo = readFileSync(new URL(`../${katalog}/Cargo.toml`, import.meta.url), 'utf8')
    assert.equal(/^version = "([^"]+)"\r?$/m.exec(manifestCargo)?.[1], pakiet.version)
  }
  assert.match(informacje.numerKompilacji, /^\d+$/)
  assert.ok(['stabilny', 'testowy'].includes(informacje.kanal))
  assert.equal(informacje.zgodnoscDanych, JSON.parse(readFileSync(new URL('../konfiguracja-aktualizacji.json', import.meta.url), 'utf8')).zgodnoscDanych)
  assert.equal(informacje.commit, execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim())
  assert.equal(typeof informacje.zmienioneZrodla, 'boolean')
  assert.match(informacje.zrodlaSha256, /^[0-9a-f]{64}$/)
  assert.equal(informacje.logowanieSha256, createHash('sha256').update(readFileSync(new URL('../src/aplikacja/logowanie/PanelLogowania.tsx', import.meta.url))).digest('hex'))
})

test('desktop zawsze buduje frontend z bieżących źródeł', () => {
  const konfiguracja = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'))
  assert.equal(konfiguracja.version, '../package.json')
  assert.equal(konfiguracja.build.beforeBuildCommand, 'npm run build && node skrypty/kontrolaTrybuFrontendu.mjs')
  assert.equal(konfiguracja.build.frontendDist, '../dist')
})
