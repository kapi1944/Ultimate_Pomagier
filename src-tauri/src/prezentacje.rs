use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::ipc::{InvokeBody, Request, Response};

const LIMIT_PPTX: usize = 120 * 1024 * 1024;
static BLOKADA_RENDERERA: Mutex<()> = Mutex::new(());

struct KatalogTymczasowy(std::path::PathBuf);
impl Drop for KatalogTymczasowy {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn uruchom_z_limitem(mut polecenie: Command, katalog: &Path) -> Result<(), String> {
    let bledy = fs::File::create(katalog.join("bledy.txt")).map_err(|blad| blad.to_string())?;
    let wyjscie = fs::File::create(katalog.join("wyjscie.txt")).map_err(|blad| blad.to_string())?;
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        polecenie.creation_flags(0x08000000);
    }
    let mut proces = polecenie
        .stdin(Stdio::null())
        .stdout(wyjscie)
        .stderr(bledy)
        .spawn()
        .map_err(|_| {
            "Nie można uruchomić lokalnego programu do renderowania prezentacji.".to_string()
        })?;
    let poczatek = Instant::now();
    loop {
        if let Some(status) = proces.try_wait().map_err(|blad| blad.to_string())? {
            return if status.success() {
                Ok(())
            } else {
                let diagnoza = ["bledy.txt", "wyjscie.txt"]
                    .into_iter()
                    .filter_map(|plik| fs::read(katalog.join(plik)).ok())
                    .map(|dane| String::from_utf8_lossy(&dane).trim().to_owned())
                    .find(|opis| !opis.is_empty())
                    .unwrap_or_else(|| format!("Renderer zakończył pracę z wynikiem {status}."));
                Err(diagnoza.chars().take(1500).collect())
            };
        }
        if poczatek.elapsed() > Duration::from_secs(240) {
            let _ = proces.kill();
            let _ = proces.wait();
            return Err("Przekroczono 4 minuty renderowania. Możesz wczytać PDF wyeksportowany z poprawionego PPTX.".into());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

fn odczytaj_pdf(sciezka: &Path) -> Result<Vec<u8>, String> {
    let pdf = fs::read(sciezka).map_err(|blad| format!("Nie utworzono PDF ({blad})."))?;
    if !pdf.starts_with(b"%PDF-") {
        return Err("Program nie wygenerował poprawnego PDF.".into());
    }
    Ok(pdf)
}

fn renderuj_libreoffice(program: PathBuf, katalog: &Path) -> Result<Vec<u8>, String> {
    let mut polecenie = Command::new(program);
    let profil = tauri::Url::from_directory_path(katalog.join("profil"))
        .map_err(|_| "Niepoprawny katalog profilu LibreOffice.")?;
    polecenie.arg(format!("-env:UserInstallation={profil}"))
        .args(["--headless", "--convert-to", "pdf:impress_pdf_Export:{\"ExportHiddenSlides\":{\"type\":\"boolean\",\"value\":\"true\"}}", "--outdir"])
        .arg(katalog).arg(katalog.join("zrodlo.pptx"));
    uruchom_z_limitem(polecenie, katalog)?;
    odczytaj_pdf(&katalog.join("zrodlo.pdf"))
}

#[cfg(target_os = "windows")]
fn renderuj_powerpoint(katalog: &Path) -> Result<Vec<u8>, String> {
    fs::write(
        katalog.join("renderuj.ps1"),
        include_str!("renderuj_prezentacje.ps1"),
    )
    .map_err(|blad| blad.to_string())?;
    let system = std::env::var_os("SystemRoot").ok_or("Brak katalogu systemu Windows.")?;
    let mut polecenie =
        Command::new(Path::new(&system).join("System32/WindowsPowerShell/v1.0/powershell.exe"));
    polecenie
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(katalog.join("renderuj.ps1"))
        .arg("-Katalog")
        .arg(katalog);
    uruchom_z_limitem(polecenie, katalog)?;
    odczytaj_pdf(&katalog.join("wynik.pdf"))
}

fn renderuj(dane: Vec<u8>) -> Result<Response, String> {
    let _blokada = BLOKADA_RENDERERA
        .lock()
        .map_err(|_| "Lokalny renderer jest niedostępny.")?;
    let znacznik = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|blad| blad.to_string())?
        .as_nanos();
    let katalog = KatalogTymczasowy(
        std::env::temp_dir().join(format!("pomagier-pptx-{}-{znacznik}", std::process::id())),
    );
    fs::create_dir(&katalog.0).map_err(|blad| blad.to_string())?;
    fs::write(katalog.0.join("zrodlo.pptx"), dane).map_err(|blad| blad.to_string())?;
    #[cfg(target_os = "windows")]
    let (pdf, silnik) = match renderuj_powerpoint(&katalog.0) {
        Ok(pdf) => (pdf, "PowerPoint"),
        Err(blad_powerpointa) => {
            let libreoffice = ["ProgramW6432", "ProgramFiles", "ProgramFiles(x86)"]
                .into_iter()
                .filter_map(std::env::var_os)
                .map(|katalog| PathBuf::from(katalog).join("LibreOffice/program/soffice.com"))
                .find(|program| program.is_file())
                .ok_or_else(|| format!("{blad_powerpointa} Nie znaleziono LibreOffice. Możesz wczytać PDF wyeksportowany z aktualnego PPTX."))?;
            let pdf = renderuj_libreoffice(libreoffice, &katalog.0)
                .map_err(|blad| format!("{blad_powerpointa} LibreOffice: {blad}"))?;
            (pdf, "LibreOffice")
        }
    };
    #[cfg(not(target_os = "windows"))]
    let (pdf, silnik) = (
        renderuj_libreoffice("libreoffice".into(), &katalog.0)?,
        "LibreOffice",
    );
    let uwagi: Value = if silnik == "PowerPoint" {
        fs::read_to_string(katalog.0.join("uwagi.json"))
            .ok()
            .and_then(|tekst| serde_json::from_str(&tekst).ok())
            .unwrap_or(json!([]))
    } else {
        json!(["LibreOffice może inaczej odwzorować czcionki i efekty PowerPoint."])
    };
    let opis = serde_json::to_vec(&json!({ "silnik": silnik, "uwagi": uwagi }))
        .map_err(|blad| blad.to_string())?;
    // Cztery bajty długości opisu JSON, opis i bajty PDF.
    let mut wynik = Vec::with_capacity(4 + opis.len() + pdf.len());
    wynik.extend_from_slice(&(opis.len() as u32).to_le_bytes());
    wynik.extend(opis);
    wynik.extend(pdf);
    Ok(Response::new(wynik))
}

#[tauri::command]
pub async fn renderuj_prezentacje(
    okno: tauri::WebviewWindow,
    stan: tauri::State<'_, crate::konta_desktop::StanKont>,
    zadanie: Request<'_>,
) -> Result<Response, String> {
    crate::konta_desktop::sprawdz_sesje_prezentacji(&okno, &stan)?;
    let dane = match zadanie.body() {
        InvokeBody::Raw(dane) if dane.len() <= LIMIT_PPTX => dane.clone(),
        // WebView może przełączyć transport IPC na postMessage.
        InvokeBody::Json(Value::Array(dane)) if dane.len() <= LIMIT_PPTX => dane
            .iter()
            .map(|bajt| {
                bajt.as_u64()
                    .and_then(|bajt| u8::try_from(bajt).ok())
                    .ok_or("Oczekiwano bajtów pliku PPTX.")
            })
            .collect::<Result<Vec<u8>, _>>()?,
        _ => return Err("Nieprawidłowy PPTX lub plik większy niż 120 MB.".into()),
    };
    if !dane.starts_with(b"PK\x03\x04") {
        return Err("Nieprawidłowy plik PPTX.".into());
    }
    tauri::async_runtime::spawn_blocking(move || renderuj(dane))
        .await
        .map_err(|blad| blad.to_string())?
}
