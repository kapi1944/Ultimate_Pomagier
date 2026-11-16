#[cfg(desktop)]
use tauri::Manager;
#[tauri::command]
pub async fn zapisz_pakiet_pdf(
    okno: tauri::WebviewWindow,
    aplikacja: tauri::AppHandle,
    nazwa: String,
    bajty: Vec<u8>,
    wybierz_miejsce: Option<bool>,
) -> Result<String, String> {
    if okno.label() != "obszar" && okno.label() != "main" {
        return Err("Niedozwolone okno aplikacji.".into());
    }
    #[cfg(target_os = "android")]
    {
        let _ = wybierz_miejsce;
        crate::zapis_pdf_android::zapisz(&aplikacja, nazwa, bajty).await
    }
    #[cfg(all(mobile, not(target_os = "android")))]
    {
        let _ = (aplikacja, nazwa, bajty, wybierz_miejsce);
        Err("Natywny zapis PDF jest niedostępny na tej platformie.".into())
    }
    #[cfg(desktop)]
    {
        #[cfg(windows)]
        let wlasciciel = if wybierz_miejsce == Some(true) {
            Some(okno.hwnd().map_err(|blad| blad.to_string())?.0 as usize)
        } else {
            None
        };
        tauri::async_runtime::spawn_blocking(move || {
            crate::zapis_pdf::sprawdz_pdf(&nazwa, &bajty)?;
            #[cfg(windows)]
            if let Some(wlasciciel) = wlasciciel {
                let Some(sciezka) = crate::zapis_pdf::wybierz_sciezke(&nazwa, wlasciciel)? else {
                    return Ok("Anulowano wybór miejsca zapisu.".into());
                };
                let katalog = sciezka.parent().ok_or("Brak katalogu docelowego PDF.")?;
                let nazwa = sciezka
                    .file_name()
                    .and_then(|nazwa| nazwa.to_str())
                    .ok_or("Nieprawidłowa nazwa PDF.")?;
                return crate::zapis_pdf::zapisz_w_katalogu(katalog, nazwa, &bajty);
            }
            #[cfg(not(windows))]
            if wybierz_miejsce == Some(true) {
                return Err(
                    "Wybór lokalizacji w aplikacji jest dostępny na Windows i Androidzie.".into(),
                );
            }
            let katalog = aplikacja
                .path()
                .download_dir()
                .map_err(|_| "Nie znaleziono folderu Pobrane.")?;
            crate::zapis_pdf::zapisz_w_katalogu(&katalog, &nazwa, &bajty)
        })
        .await
        .map_err(|blad| blad.to_string())?
    }
}
