use serde_json::json;
use tauri::{plugin, AppHandle, Manager, Wry};

pub(crate) fn wtyczka() -> plugin::TauriPlugin<Wry> {
    plugin::Builder::new("zapis-pdf-android")
        .setup(|aplikacja, api| {
            let uchwyt = api.register_android_plugin("pl.ultimatepomagier.desktop", "ZapisPdf")?;
            aplikacja.manage(uchwyt);
            Ok(())
        })
        .build()
}

pub(crate) async fn zapisz(
    aplikacja: &AppHandle,
    nazwa: String,
    bajty: Vec<u8>,
) -> Result<String, String> {
    let katalog = aplikacja
        .path()
        .app_cache_dir()
        .map_err(|blad| blad.to_string())?
        .join("eksport-pdf");
    let nazwa_tymczasowa = nazwa.clone();
    let sciezka = tauri::async_runtime::spawn_blocking(move || {
        crate::zapis_pdf::sprawdz_pdf(&nazwa_tymczasowa, &bajty)?;
        std::fs::create_dir_all(&katalog).map_err(|blad| blad.to_string())?;
        crate::zapis_pdf::zapisz_w_katalogu(&katalog, &nazwa_tymczasowa, &bajty)
    })
    .await
    .map_err(|blad| blad.to_string())??;

    let wynik = aplikacja
        .state::<plugin::PluginHandle<Wry>>()
        .run_mobile_plugin_async::<String>("zapisz", json!({ "nazwa": nazwa, "sciezka": &sciezka }))
        .await;
    if let Err(blad) = std::fs::remove_file(&sciezka) {
        return Err(format!(
            "Nie udało się usunąć tymczasowego pliku PDF: {blad}. Wynik eksportu: {wynik:?}"
        ));
    }
    wynik.map_err(|blad| blad.to_string())
}
