import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { otworzPptx } from '../src/moduly/narzedzia/poprawiacz_prezentacji/pptx/otworzPptx'
import { korygujUklad } from '../src/moduly/narzedzia/poprawiacz_prezentacji/operacje/korygujUklad'
import { dopasujGrafiki } from '../src/moduly/narzedzia/poprawiacz_prezentacji/operacje/dopasujGrafiki'
import { zastosujMapowanie, zaproponujMapowanie, pusteDaneOkladki } from '../src/moduly/narzedzia/poprawiacz_prezentacji/operacje/mapowanieDanych'
import { wypelnijSzablonOkladki } from '../src/moduly/narzedzia/poprawiacz_prezentacji/operacje/okladkiSemper'
import { przygotujPlanDruku, domyslneUstawieniaDruku, dopasujProporcjonalnie, obszaryNaStronie, odczytajZakresSlajdow } from '../src/moduly/narzedzia/poprawiacz_prezentacji/eksport/planDruku'
import { wygenerujKompletZip } from '../src/moduly/narzedzia/poprawiacz_prezentacji/eksport/eksportMaterialow'
import { potomkowieXml } from '../src/moduly/narzedzia/poprawiacz_prezentacji/pptx/xmlPptx'
import { analizujPrezentacje } from '../src/moduly/narzedzia/poprawiacz_prezentacji/analiza/analizujPrezentacje'
import { bezpiecznyObszar } from '../src/moduly/narzedzia/poprawiacz_prezentacji/analiza/analizujUklad'
import { ksztaltTestowy, utworzFixturePptx, xmlSlajdu, przestrzenRelacji, przestrzenPrezentacji } from './fixturePptx'

Object.defineProperty(globalThis, 'DOMParser', { value: DOMParser, configurable: true })
Object.defineProperty(globalThis, 'XMLSerializer', { value: XMLSerializer, configurable: true })

function obrazTestowy(y: number, cy: number, opcje = '', x = 500000, cx = 9000000) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="42" name="Zrzut ekranu"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:srcRect l="1000"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm${opcje}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`
}

async function prezentacjaDoDopasowania(obiekty: string, innyUklad?: string) {
  const archiwum = await JSZip.loadAsync(await utworzFixturePptx())
  const uklad = (typ: string, pasy: string) =>
    xmlSlajdu(pasy).replace('<p:sld ', `<p:sldLayout type="${typ}" `).replace('</p:sld>', '</p:sldLayout>')
  const ksztalty = ksztaltTestowy(8, 0, 0, 10000000, 350000) + ksztaltTestowy(9, 0, 5650000, 10000000, 350000, '1')
  archiwum.file('ppt/slideLayouts/slideLayout1.xml', uklad('obj', ksztalty))
  archiwum.file('ppt/slides/slide3.xml', xmlSlajdu(obiekty))
  archiwum.file('ppt/slides/slide1.xml', xmlSlajdu(innyUklad ?? ''))
  if (innyUklad) {
    archiwum.file('ppt/slideLayouts/slideLayout2.xml', uklad('title', ksztalty))
    const sciezka = 'ppt/slides/_rels/slide1.xml.rels'
    archiwum.file(sciezka, (await archiwum.file(sciezka)!.async('string')).replace('slideLayout1.xml', 'slideLayout2.xml'))
  }
  const relacje = 'ppt/slides/_rels/slide3.xml.rels'
  archiwum.file(relacje, (await archiwum.file(relacje)!.async('string')).replace('</Relationships>',
    `<Relationship Id="rId2" Type="${przestrzenRelacji}/image" Target="../media/image1.bin"/></Relationships>`))
  return otworzPptx(await archiwum.generateAsync({ type: 'arraybuffer' }))
}

test('dopasowanie między pasami zachowuje kadr, proporcje, media i kolejność; okładka ma własny układ', async () => {
  const metadaneDpi = '<a:extLst><a:ext uri="{28A0092B-C50C-407E-A947-70E740481C1C}"><a14:useLocalDpi xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" val="0"/></a:ext></a:extLst>'
  const obraz = obrazTestowy(0, 5900000).replace('<a:blip r:embed="rId2"/>', `<a:blip r:embed="rId2">${metadaneDpi}</a:blip>`)
  const model = await prezentacjaDoDopasowania(obraz, obrazTestowy(0, 6000000, '', 0, 10000000))
  const wynik = await dopasujGrafiki(model)
  const [korekta, okladka] = wynik.wpisy
  assert.equal(korekta.status, 'poprawione')
  assert.ok(korekta.po!.y >= 422000)
  assert.ok(korekta.po!.y + korekta.po!.cy <= 5578000)
  assert.ok(Math.abs(korekta.po!.cx / korekta.po!.cy - 9000000 / 5900000) < .000001)
  assert.equal(okladka.status, 'celowo pełnoekranowe')
  assert.deepEqual(wynik.model.slajdy.map((slajd) => slajd.czesc), model.slajdy.map((slajd) => slajd.czesc))
  const pakiet = await JSZip.loadAsync(wynik.model.buforZrodlowy, { checkCRC32: true })
  for (const plik of Object.values(model.archiwum.files).filter((plik) => !plik.dir && plik.name !== model.slajdy[0].czesc)) {
    assert.deepEqual(await pakiet.file(plik.name)!.async('uint8array'), await plik.async('uint8array'))
  }
  const xml = await pakiet.file(model.slajdy[0].czesc)!.async('string')
  assert.match(xml, /<a:srcRect l="1000"\/>/)
  assert.ok(xml.includes(metadaneDpi))
})

test('kolizja ze stopką wymaga tylko minimalnego przesunięcia; powtórzenie zachowuje identyczny plik', async () => {
  const wynik = await dopasujGrafiki(await prezentacjaDoDopasowania(obrazTestowy(4900000, 900000)))
  assert.deepEqual(wynik.wpisy[0].po, { x: 500000, y: 4678000, cx: 9000000, cy: 900000 })
  const powtorzenie = await dopasujGrafiki(wynik.model)
  assert.equal(powtorzenie.wpisy[0].status, 'już poprawne')
  assert.equal(powtorzenie.model, wynik.model)
})

test('brak miejsca przy tytule, obrócony kadr i ryzyko nieczytelności wymagają oceny', async () => {
  const tytul = ksztaltTestowy(32, 0, 0, 10000000, 4200000, 'Tytuł')
    .replace('<p:nvPr/>', '<p:nvPr><p:ph type="title"/></p:nvPr>')
  const stopka = ksztaltTestowy(33, 0, 4700000, 10000000, 1300000, 'Stopka')
    .replace('<p:nvPr/>', '<p:nvPr><p:ph type="ftr"/></p:nvPr>')
  for (const obiekty of [
    tytul + obrazTestowy(200000, 4000000),
    obrazTestowy(200000, 4000000, ' rot="1800000"'),
    stopka + obrazTestowy(0, 5900000),
  ]) {
    const model = await prezentacjaDoDopasowania(obiekty)
    const wynik = await dopasujGrafiki(model)
    assert.equal(wynik.wpisy[0].status, 'wymaga oceny')
    assert.equal(wynik.model, model)
  }
})

test('korekta grupy zachowuje położenie i proporcje elementów wewnętrznych', async () => {
  const dzieci = ksztaltTestowy(32, 200000, 100000, 300000, 300000) + ksztaltTestowy(33, 700000, 100000, 400000, 500000)
  const grupa = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="31" name="Schemat"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="500000" y="0"/><a:ext cx="9000000" cy="5900000"/><a:chOff x="0" y="0"/><a:chExt cx="9000000" cy="5900000"/></a:xfrm></p:grpSpPr>${dzieci}</p:grpSp>`
  const model = await prezentacjaDoDopasowania(grupa)
  const wynik = await dopasujGrafiki(model)
  assert.equal(wynik.wpisy[0].status, 'poprawione')
  const serializer = new XMLSerializer()
  const elementy = (prezentacja: typeof model) => prezentacja.slajdy[0].obiekty.slice(1).map((obiekt) => serializer.serializeToString(obiekt.element))
  assert.deepEqual(elementy(wynik.model), elementy(model))
})

async function utworzLiczbeSlajdow(liczba: number) {
  const archiwum = await JSZip.loadAsync(await utworzFixturePptx())
  const sekcja = liczba === 196 ? '<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"><p14:section name="Wstęp"><p14:sldIdLst><p14:sldId id="256"/></p14:sldIdLst></p14:section></p14:sectionLst></p:ext></p:extLst>' : ''
  archiwum.file('ppt/presentation.xml', `<p:presentation xmlns:p="${przestrzenPrezentacji}" xmlns:r="${przestrzenRelacji}"><p:sldIdLst>${Array.from({ length: liczba }, (_, indeks) => `<p:sldId id="${indeks + 256}" r:id="rId${indeks + 1}"/>`).join('')}</p:sldIdLst><p:sldSz cx="10000000" cy="6000000"/>${sekcja}</p:presentation>`)
  archiwum.file('ppt/_rels/presentation.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from({ length: liczba }, (_, indeks) => `<Relationship Id="rId${indeks + 1}" Type="${przestrzenRelacji}/slide" Target="slides/slide${indeks + 1}.xml"/>`).join('')}</Relationships>`)
  for (let numer = 1; numer <= liczba; numer++) archiwum.file(`ppt/slides/slide${numer}.xml`, xmlSlajdu(ksztaltTestowy(2, 500000, 800000, 2000000, 400000, `Slajd ${numer}`, 'FFFFFF')))
  return otworzPptx(await archiwum.generateAsync({ type: 'arraybuffer' }))
}

for (const liczba of [1, 10, 99, 100, 101, 196, 292]) {
  test(`prezentacja ${liczba} slajdow: kolejnosc, wymiary, wzorce, edytowalnosc i liczba stron druku`, async () => {
    const model = await utworzLiczbeSlajdow(liczba)
    const oryginal = new Uint8Array(model.buforZrodlowy.slice(0))
    const wynik = await korygujUklad(model, { szerokoscCm: 30, wysokoscCm: 20.5, czyKorygowacUklad: true, czyUsuwacDuplikaty: true })
    assert.equal(wynik.model.slajdy.length, liczba)
    assert.deepEqual(wynik.model.slajdy.map((slajd) => slajd.czesc), model.slajdy.map((slajd) => slajd.czesc))
    assert.ok(wynik.model.slajdy.every((slajd) => slajd.szerokosc === 10800000 && slajd.wysokosc === 7380000))
    assert.deepEqual(wynik.model.slajdy.map((slajd) => slajd.obiekty[0].tekst), Array.from({ length: liczba }, (_, indeks) => `Slajd ${indeks + 1}`))
    assert.deepEqual(new Uint8Array(model.buforZrodlowy), oryginal)
    assert.equal(wynik.model.archiwum.comment, model.archiwum.comment)
    assert.ok(wynik.model.archiwum.file('ppt/slideMasters/slideMaster1.xml'))
    assert.deepEqual(await wynik.model.archiwum.file('ppt/media/image1.bin')!.async('uint8array'), await model.archiwum.file('ppt/media/image1.bin')!.async('uint8array'))
    const plan = przygotujPlanDruku(liczba, domyslneUstawieniaDruku())
    assert.deepEqual(plan.flatMap((dokument) => dokument.strony.flat()), Array.from({ length: liczba }, (_, indeks) => indeks + 1))
    assert.equal(plan.length, liczba > 100 ? 2 : 1)
    if (liczba > 100) {
      assert.deepEqual(plan[0].strony, [[1]])
      assert.equal(plan[0].ustawienia.dwustronnie, false)
      assert.equal(plan[0].ustawienia.orientacja, 'pionowa')
      assert.equal(plan[1].strony.length, Math.ceil((liczba - 1) / 2))
      assert.ok(plan[1].strony.every((strona) => strona.length <= 2))
      assert.deepEqual(plan[1].strony[0], [2, 3])
    } else assert.equal(plan[0].strony.length, liczba)
  })
}

test('zakres, marginesy, puste strony i proporcjonalne dopasowanie nie obcinaja slajdow', () => {
  assert.deepEqual(odczytajZakresSlajdow('5, 1-3, 3', 10), [1, 2, 3, 5])
  for (const zakres of ['0', '11', '5-2', '1,,2', '1-x', '-1', '1-999999999']) assert.throws(() => odczytajZakresSlajdow(zakres, 10))
  for (const liczba of [1, 2] as const) {
    const ustawienia = { ...domyslneUstawieniaDruku(), profil: 'reczny' as const, slajdowNaStronie: liczba }
    for (const obszar of obszaryNaStronie(ustawienia)) {
      const wynik = dopasujProporcjonalnie(1600, 900, obszar)
      assert.ok(Math.abs(wynik.szerokosc / wynik.wysokosc - 16 / 9) < .0001)
      assert.ok(wynik.x >= obszar.x && wynik.y >= obszar.y)
      assert.ok(wynik.szerokosc <= obszar.szerokosc && wynik.wysokosc <= obszar.wysokosc)
    }
  }
  assert.deepEqual(przygotujPlanDruku(3, { ...domyslneUstawieniaDruku(), pustaStronaNaKoncu: true })[0].strony, [[1], [2], [3], []])
  assert.throws(() => przygotujPlanDruku(3, { ...domyslneUstawieniaDruku(), marginesMm: NaN }))
})

test('separator pod wielowierszowym naglowkiem i tresc sa przesuwane bez kolizji kaskadowej', async () => {
  const archiwum = await JSZip.loadAsync(await utworzFixturePptx())
  const naglowek = ksztaltTestowy(20, 500000, 400000, 9000000, 1000000, 'Nagłówek pierwszy\nNagłówek drugi', 'FFFFFF').replace('<p:nvPr/>', '<p:nvPr><p:ph type="title"/></p:nvPr>')
  const separator = '<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="21" name="Separator"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="500000" y="950000"/><a:ext cx="9000000" cy="0"/></a:xfrm></p:spPr></p:cxnSp>'
  const tresc = ksztaltTestowy(22, 500000, 1100000, 6000000, 1000000, 'Treść', 'FFFFFF')
  archiwum.file('ppt/slides/slide3.xml', xmlSlajdu(naglowek + separator + tresc))
  const model = await otworzPptx(await archiwum.generateAsync({ type: 'arraybuffer' }))
  const wynik = await korygujUklad(model, { szerokoscCm: 10000000 / 360000, wysokoscCm: 6000000 / 360000, czyKorygowacUklad: true, czyUsuwacDuplikaty: false })
  const [tytul, linia, tekst] = wynik.model.slajdy[0].obiekty
  assert.equal(linia.typ, 'linia')
  assert.ok(linia.geometria!.y > tytul.geometria!.y + tytul.geometria!.cy)
  assert.ok(tekst.geometria!.y > linia.geometria!.y)
  assert.ok(tekst.geometria!.y + tekst.geometria!.cy <= wynik.model.slajdy[0].wysokosc)
  assert.equal(wynik.uwagi.filter((uwaga) => uwaga.numerSlajdu === 1).length, 0)
})

test('szablon SEMPER: dziedziczony wzorzec chroni paski, logo i numeracje', async () => {
  const dane = await readFile(new URL('../public/szablony/prezentacje/semper-poziom.pptx', import.meta.url))
  const model = await otworzPptx(dane.buffer.slice(dane.byteOffset, dane.byteOffset + dane.byteLength))
  const slajd = model.slajdy[1]
  assert.equal(slajd.czescWzorca, 'ppt/slideMasters/slideMaster2.xml')
  assert.ok(slajd.elementyWzorca.some((obiekt) => obiekt.tekst.includes('SEMPER')))
  assert.ok(slajd.elementyWzorca.some((obiekt) => obiekt.tekst.includes('‹#›')))
  const archiwum = await JSZip.loadAsync(model.buforZrodlowy)
  const xml = await archiwum.file(slajd.czesc)!.async('string')
  archiwum.file(slajd.czesc, xml.replace('</p:spTree>', `${ksztaltTestowy(100, 1000000, 20000, 2000000, 400000, 'Treść pod paskiem', 'FFFFFF')}${ksztaltTestowy(101, 10000000, 6500000, 400000, 250000, '2', 'FFFFFF')}</p:spTree>`))
  const zDuplikatem = await otworzPptx(await archiwum.generateAsync({ type: 'arraybuffer' }))
  const wynik = await korygujUklad(zDuplikatem, { szerokoscCm: 12192000 / 360000, wysokoscCm: 6858000 / 360000, czyKorygowacUklad: true, czyUsuwacDuplikaty: true })
  assert.equal(wynik.duplikaty, 1)
  assert.ok(!wynik.model.slajdy[1].obiekty.some((obiekt) => obiekt.id === '101'))
  assert.ok(wynik.model.slajdy[1].obiekty[0].geometria!.y > 600000)
  assert.equal(await wynik.model.archiwum.file(slajd.czescWzorca!)!.async('string'), await zDuplikatem.archiwum.file(slajd.czescWzorca!)!.async('string'))
})

test('mapowanie zmienia tylko zatwierdzone pole i zachowuje nieznane dane', async () => {
  const model = await otworzPptx(await utworzFixturePptx())
  const wynik = await zastosujMapowanie(model, { ...pusteDaneOkladki, tytul: 'Nowy tytuł < & >' }, [{ idObiektu: '5', pole: 'tytul' }])
  assert.equal(wynik.slajdy[0].obiekty.find((obiekt) => obiekt.id === '5')!.tekst, 'Nowy tytuł < & >')
  assert.equal(wynik.slajdy[0].obiekty.find((obiekt) => obiekt.id === '3')!.tekst, '3')
  assert.equal(await wynik.archiwum.file(model.slajdy[1].czesc)!.async('string'), await model.archiwum.file(model.slajdy[1].czesc)!.async('string'))
  assert.equal(zaproponujMapowanie(model.slajdy[0].obiekty[3]), '')
  await assert.rejects(() => zastosujMapowanie(model, pusteDaneOkladki, [{ idObiektu: '5', pole: 'tytul' }]), /Brak wartości/)
})

test('dolny tytul sekcji Kontakt nie jest naglowkiem calego slajdu i nie przestawia firmowej kompozycji', async () => {
  const dane = await readFile(new URL('../public/szablony/prezentacje/semper-poziom.pptx', import.meta.url))
  const model = await otworzPptx(dane.buffer.slice(dane.byteOffset, dane.byteOffset + dane.byteLength))
  const wynik = await korygujUklad(model, { szerokoscCm: 12192000 / 360000, wysokoscCm: 20.5, czyKorygowacUklad: true, czyUsuwacDuplikaty: true })
  for (const id of ['7', '11', '6', '47', '38', '18', '16']) {
    const przed = model.slajdy[2].obiekty.find((obiekt) => obiekt.id === id)!.geometria!
    const po = wynik.model.slajdy[2].obiekty.find((obiekt) => obiekt.id === id)!.geometria!
    assert.ok(Math.abs(po.y - przed.y * 7380000 / 6858000) <= 1, `Nie przestawiaj elementu kompozycji ${id}`)
  }
})

for (const orientacja of ['pionowa', 'pozioma'] as const) {
  test(`okladka ${orientacja}: jeden slajd, pola edytowalne, oryginalne media i QR`, async () => {
    const dane = await readFile(new URL(`../public/szablony/prezentacje/semper-${orientacja === 'pionowa' ? 'pion' : 'poziom'}.pptx`, import.meta.url))
    const bufor = dane.buffer.slice(dane.byteOffset, dane.byteOffset + dane.byteLength)
    const wynik = await wypelnijSzablonOkladki(bufor, orientacja, { ...pusteDaneOkladki, tytul: 'Szkolenie regresyjne', data: '30 października 2026 r.', miejscowosc: 'Warszawa', trener: 'Anna Kowalska', emailTrenera: 'anna@example.test' })
    assert.equal(wynik.slajdy.length, 1)
    assert.ok(wynik.slajdy[0].obiekty.some((obiekt) => obiekt.tekst === 'Szkolenie regresyjne'))
    assert.ok(!wynik.slajdy[0].obiekty.some((obiekt) => /Pawełek|xxx@/.test(obiekt.tekst)))
    const oryginal = await JSZip.loadAsync(bufor)
    for (const plik of Object.values(oryginal.files).filter((plik) => plik.name.startsWith('ppt/media/') && !plik.dir)) assert.deepEqual(await wynik.archiwum.file(plik.name)!.async('uint8array'), await plik.async('uint8array'))
    assert.equal(potomkowieXml(wynik.czesciXml.get('ppt/presentation.xml')!, 'sldId').length, 1)
  })
}

test('okladka z brakujaca grafika slajdu lub brakujacym wzorcem wskazuje konkretny plik', async () => {
  const archiwum = await JSZip.loadAsync(await readFile(new URL('../public/szablony/prezentacje/semper-poziom.pptx', import.meta.url)))
  const model = await otworzPptx(await archiwum.generateAsync({ type: 'arraybuffer' }))
  const slajd = model.slajdy[0]
  assert.ok(slajd.czescWzorca)
  for (const sciezka of ['ppt/media/image2.png', slajd.czescWzorca]) {
    const grafika = await archiwum.file(sciezka)!.async('uint8array')
    archiwum.remove(sciezka)
    const bufor = await archiwum.generateAsync({ type: 'arraybuffer' })
    await assert.rejects(() => wypelnijSzablonOkladki(bufor, 'pozioma', { ...pusteDaneOkladki, tytul: 'Szkolenie' }),
      (blad: Error) => blad.message.includes('Brak oryginalnych zasobów graficznych SEMPER') && blad.message.includes(sciezka))
    archiwum.file(sciezka, grafika)
  }
})

test('komplet ZIP zawiera poprawne pliki, instrukcje druku i odrzuca duplikaty nazw', async () => {
  const pliki = [{ nazwa: 'prezentacja.pptx', plik: new Blob(['PPTX']) }, { nazwa: 'druk.pdf', plik: new Blob(['PDF']) }]
  const wynik = await wygenerujKompletZip(pliki, 'A4, dwustronnie, dłuższa krawędź')
  const archiwum = await JSZip.loadAsync(await wynik.arrayBuffer())
  assert.deepEqual(Object.keys(archiwum.files), ['prezentacja.pptx', 'druk.pdf', 'USTAWIENIA_DRUKU.txt'])
  assert.equal(await archiwum.file('druk.pdf')!.async('string'), 'PDF')
  assert.match(await archiwum.file('USTAWIENIA_DRUKU.txt')!.async('string'), /dwustronnie/)
  await assert.rejects(() => wygenerujKompletZip([pliki[0], pliki[0]], ''), /Powtórzona nazwa/)
})

test('naglowek bez placeholdera i separator zapisany jako prostokat zachowuja odstep', async () => {
  const archiwum = await JSZip.loadAsync(await utworzFixturePptx())
  const naglowek = ksztaltTestowy(20, 500000, 400000, 9000000, 1000000, 'Pierwszy wiersz\nDrugi wiersz', 'FFFFFF')
    .replace('<a:r>', '<a:r><a:rPr sz="2800"/>')
  archiwum.file('ppt/slides/slide3.xml', xmlSlajdu(naglowek
    + ksztaltTestowy(21, 500000, 950000, 9000000, 10000, '', 'CCCCCC')
    + ksztaltTestowy(22, 500000, 1600000, 6000000, 1000000, 'Treść', 'FFFFFF')))
  const model = await otworzPptx(await archiwum.generateAsync({ type: 'arraybuffer' }))
  const wynik = await korygujUklad(model, { szerokoscCm: 10000000 / 360000, wysokoscCm: 6000000 / 360000, czyKorygowacUklad: true, czyUsuwacDuplikaty: false })
  const [tytul, separator] = wynik.model.slajdy[0].obiekty
  assert.ok(separator.geometria!.y >= tytul.geometria!.y + tytul.geometria!.cy + 45000)
})

async function utworzPrzypadekProfiluSemper() {
  const archiwum = await JSZip.loadAsync(await readFile(new URL('../public/szablony/prezentacje/semper-poziom.pptx', import.meta.url)))
  const naglowek = ksztaltTestowy(104, 600000, 666750, 10287000, 685800, 'Nagłówek pierwszy\nNagłówek drugi', 'FFFFFF')
    .replace('<a:r>', '<a:r><a:rPr sz="2600"/>')
  const bialyNumer = ksztaltTestowy(108, 11000000, 6500000, 500000, 200000, '12', '333333')
    .replace('<a:r>', '<a:r><a:rPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>')
  archiwum.file('ppt/slides/slide2.xml', xmlSlajdu(
    ksztaltTestowy(100, 0, 0, 12192000, 6858000, '', 'FFFFFF')
    + ksztaltTestowy(101, 0, 0, 12192000, 128016)
    + ksztaltTestowy(102, 8500000, 0, 3600000, 6858000, '', '1A2F46')
    + ksztaltTestowy(103, 600000, 323850, 8572500, 209550, 'ETYKIETA', 'FFFFFF')
    + naglowek + ksztaltTestowy(105, 600000, 1438279, 10972800, 9525, '', 'CCCCCC')
    + ksztaltTestowy(106, 600000, 6429379, 10972800, 9525, '', 'CCCCCC')
    + ksztaltTestowy(107, 11049000, 361950, 533400, 266700, '16', 'FFFFFF')
    + bialyNumer + bialyNumer.replaceAll('108', '110').replace('x="11000000" y="6500000"', 'x="1000000" y="2700000"')
    + ksztaltTestowy(109, 600000, 2500000, 6000000, 1000000, 'Treść', 'FFFFFF')))
  return otworzPptx(await archiwum.generateAsync({ type: 'arraybuffer' }))
}

test('profil SEMPER odsłania oba paski, usuwa obce numery i zachowuje biala numeracje oraz geometrie okladki', async () => {
  const model = await utworzPrzypadekProfiluSemper()
  const ustawienia = { szerokoscCm: 12192000 / 360000, wysokoscCm: 20.5, czyKorygowacUklad: true, czyUsuwacDuplikaty: true, profil: 'semper' as const }
  const wynik = await korygujUklad(model, ustawienia)
  const slajd = wynik.model.slajdy[1]
  for (const id of ['100', '101', '106', '107']) assert.ok(!slajd.obiekty.some((obiekt) => obiekt.id === id), id)
  assert.deepEqual(slajd.obiekty.find((obiekt) => obiekt.id === '108')!.geometria, model.slajdy[1].obiekty.find((obiekt) => obiekt.id === '108')!.geometria)
  assert.equal(slajd.obiekty.find((obiekt) => obiekt.id === '110')!.geometria!.y, 2880000)
  assert.ok(!analizujPrezentacje(wynik.model).problemy.some((problem) => problem.numerSlajdu === 2 && problem.typ === 'NUMERACJA'))
  const panel = slajd.obiekty.find((obiekt) => obiekt.id === '102')!.geometria!
  const obszar = bezpiecznyObszar(slajd)
  assert.ok(panel.y > obszar.gora && panel.y + panel.cy < obszar.dol)
  const naglowek = slajd.obiekty.find((obiekt) => obiekt.id === '104')!.geometria!
  assert.ok(slajd.obiekty.find((obiekt) => obiekt.id === '105')!.geometria!.y >= naglowek.y + naglowek.cy + 72000)
  for (const obiekt of model.slajdy[0].obiekty.filter((obiekt) => obiekt.typ === 'obraz')) {
    assert.deepEqual(wynik.model.slajdy[0].obiekty.find((pozycja) => pozycja.id === obiekt.id)!.geometria, obiekt.geometria)
  }
  const ponownie = await korygujUklad(wynik.model, ustawienia)
  assert.equal(await ponownie.model.archiwum.file(slajd.czesc)!.async('string'), await wynik.model.archiwum.file(slajd.czesc)!.async('string'))
})

test('profil SEMPER respektuje wylaczenie usuwania numerow', async () => {
  const model = await utworzPrzypadekProfiluSemper()
  const wynik = await korygujUklad(model, { szerokoscCm: 12192000 / 360000, wysokoscCm: 20.5, czyKorygowacUklad: true, czyUsuwacDuplikaty: false, profil: 'semper' })
  assert.ok(wynik.model.slajdy[1].obiekty.some((obiekt) => obiekt.id === '107'))
  assert.equal(wynik.duplikaty, 0)
})

test('duze pole z cytatem nie jest naglowkiem i zachowuje polozenie tekstu', async () => {
  const model = await utworzPrzypadekProfiluSemper()
  const archiwum = await JSZip.loadAsync(model.buforZrodlowy)
  const cytat = ksztaltTestowy(200, 3048856, 615417, 6097712, 5632311, 'Długi cytat z dokumentu. '.repeat(40), 'FFFFFF')
    .replace('<a:r>', '<a:r><a:rPr sz="2600"/>')
  archiwum.file('ppt/slides/slide2.xml', xmlSlajdu(cytat))
  const zCytatem = await otworzPptx(await archiwum.generateAsync({ type: 'arraybuffer' }))
  const wynik = await korygujUklad(zCytatem, { szerokoscCm: 12192000 / 360000, wysokoscCm: 20.5, czyKorygowacUklad: true, czyUsuwacDuplikaty: true, profil: 'semper' })
  assert.deepEqual(wynik.model.slajdy[1].obiekty[0].geometria, zCytatem.slajdy[1].obiekty[0].geometria)
})

test('mapowanie nie zmniejsza tekstu przez nieuzywany styl listy o wiekszej czcionce', async () => {
  const archiwum = await JSZip.loadAsync(await utworzFixturePptx())
  const tekst = ksztaltTestowy(200, 500000, 2000000, 5544615, 626120, 'Ekspert', 'FFFFFF')
    .replace('<a:r>', '<a:r><a:rPr sz="1600"/>')
    .replace('<a:lstStyle/>', '<a:lstStyle><a:lvl2pPr><a:defRPr sz="2800"/></a:lvl2pPr></a:lstStyle>')
  archiwum.file('ppt/slides/slide3.xml', xmlSlajdu(tekst))
  const model = await otworzPptx(await archiwum.generateAsync({ type: 'arraybuffer' }))
  const wynik = await zastosujMapowanie(model, pusteDaneOkladki, [{ idObiektu: '200', pole: '', wartoscReczna: 'Ekspert Merytoryczny: Radosław Pawełek\nr.pawelek@szkolenia-semper.pl' }])
  assert.equal(potomkowieXml(wynik.slajdy[0].obiekty[0].element, 'normAutofit')[0].getAttribute('fontScale'), '100000')
})
