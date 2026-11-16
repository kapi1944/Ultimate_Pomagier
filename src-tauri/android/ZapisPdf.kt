package pl.ultimatepomagier.desktop

import android.app.Activity
import android.content.Intent
import android.provider.DocumentsContract
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

@TauriPlugin
class ZapisPdf(private val ekran: Activity) : Plugin(ekran) {
    private val trwaWybor = AtomicBoolean(false)

    @Command
    fun zapisz(wywolanie: Invoke) {
        if (!trwaWybor.compareAndSet(false, true)) {
            wywolanie.reject("Zakończ otwarty wybór miejsca zapisu PDF.")
            return
        }
        val wybor = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/pdf"
            putExtra(Intent.EXTRA_TITLE, wywolanie.getArgs().getString("nazwa"))
            putExtra(DocumentsContract.EXTRA_INITIAL_URI,
                DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:Download"))
        }
        try {
            startActivityForResult(wywolanie, wybor, "zapiszPoWyborze")
        } catch (blad: Exception) {
            trwaWybor.set(false)
            wywolanie.reject("Nie można otworzyć wyboru pliku PDF: ${blad.message}")
        }
    }

    @ActivityCallback
    fun zapiszPoWyborze(wywolanie: Invoke, wynik: ActivityResult) {
        trwaWybor.set(false)
        val adres = wynik.data?.data
        if (wynik.resultCode == Activity.RESULT_CANCELED) {
            wywolanie.resolveObject("Anulowano wybór miejsca zapisu.")
            return
        }
        if (wynik.resultCode != Activity.RESULT_OK || adres == null) {
            wywolanie.reject("Nie otrzymano miejsca zapisu PDF.")
            return
        }

        thread {
            val dostawca = ekran.contentResolver
            try {
                val katalog = File(ekran.cacheDir, "eksport-pdf").canonicalFile
                val plik = File(wywolanie.getArgs().getString("sciezka")).canonicalFile
                check(plik.parentFile == katalog)
                plik.inputStream().use { zrodlo ->
                    val cel = dostawca.openOutputStream(adres)
                        ?: error("Nie można otworzyć pliku do zapisu.")
                    cel.use { zrodlo.copyTo(it) }
                }
            } catch (blad: Exception) {
                val usunieto = runCatching { DocumentsContract.deleteDocument(dostawca, adres) }.getOrDefault(false)
                val komunikat = if (usunieto) "" else " Sprawdź, czy w wybranym miejscu nie został niepełny plik."
                wywolanie.reject("Nie udało się zapisać PDF: ${blad.message}.$komunikat")
                return@thread
            }
            wywolanie.resolveObject("Zapisano PDF w wybranej lokalizacji.")
        }
    }
}
