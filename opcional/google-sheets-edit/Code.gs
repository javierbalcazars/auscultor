// Puente opcional para editar la hoja desde Auscultor.
// Pega este archivo en una implementación de Google Apps Script vinculada a tu hoja.

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Permite comprobar la implementación abriendo la URL en el navegador.
function doGet(e) {
  if (e?.parameter?.action === "update") return updateAvailability(e.parameter);
  return respond({ ok: true, message: "Puente de Google Sheets activo." });
}

function doPost(e) {
  let input;
  try {
    input = JSON.parse(e?.postData?.contents || "{}");
  } catch (error) {
    return respond({ ok: false, error: `JSON inválido: ${error.message}` });
  }
  return updateAvailability(input);
}

function updateAvailability(input) {
  try {
    const date = normalizeDate(input.date);
    const state = normalize(input.state);
    if (!date || !["disponible", "reservado", "bloqueado"].includes(state)) throw new Error("Fecha o estado inválido");

    const book = SpreadsheetApp.getActiveSpreadsheet();
    const wantedMonth = MONTHS[Number(date.slice(5, 7)) - 1];
    const sheets = book.getSheets().filter((sheet) => normalize(sheet.getName()) === wantedMonth);
    const candidates = sheets.length ? sheets : book.getSheets();
    let updated = false;
    let targetSheet = null;
    let targetColumns = null;
    for (const sheet of candidates) {
      const values = sheet.getDataRange().getValues();
      if (!values.length) continue;
      const headers = values[0].map(normalize);
      const columns = {
        date: find(headers, ["fecha", "date"]),
        state: find(headers, ["estado", "status"]),
        client: find(headers, ["nombre visitante", "nombre del visitante", "cliente", "nombre", "guest"]),
        payment: find(headers, ["estado de pago", "estado del pago", "pago", "payment", "payment status"]),
        notes: find(headers, ["notas", "notes", "comentarios"]),
        unit: find(headers, ["unidad", "cabaña", "cabana", "alojamiento", "unit"]),
      };
      if (columns.date < 0 || columns.state < 0) continue;
      targetSheet = sheet;
      targetColumns = columns;
      for (let row = 1; row < values.length; row += 1) {
        if (normalizeDate(values[row][columns.date]) !== date) continue;
        if (columns.unit >= 0 && input.unit && normalize(values[row][columns.unit]) !== normalize(input.unit)) continue;
        ensureNotesColumn(sheet, columns);
        sheet.getRange(row + 1, columns.state + 1).setValue(state);
        if (columns.client >= 0) sheet.getRange(row + 1, columns.client + 1).setValue(state === "reservado" ? String(input.client || "").trim() : "");
        if (columns.payment >= 0) sheet.getRange(row + 1, columns.payment + 1).setValue(state === "reservado" ? String(input.payment || "").trim() : "");
        if (columns.notes >= 0) sheet.getRange(row + 1, columns.notes + 1).setValue(state === "disponible" ? "" : String(input.notes || "").trim());
        updated = true;
        break;
      }
      if (updated) break;
    }
    // Un día disponible normalmente no tiene fila en la hoja. Al reservarlo
    // o bloquearlo se crea una fila nueva en la pestaña correspondiente.
    if (!updated && state !== "disponible" && targetSheet && targetColumns) {
      ensureNotesColumn(targetSheet, targetColumns);
      const width = targetSheet.getLastColumn();
      const row = Array(width).fill("");
      row[targetColumns.date] = date;
      row[targetColumns.state] = state;
      if (targetColumns.client >= 0) row[targetColumns.client] = state === "reservado" ? String(input.client || "").trim() : "";
      if (targetColumns.payment >= 0) row[targetColumns.payment] = state === "reservado" ? String(input.payment || "").trim() : "";
      if (targetColumns.notes >= 0) row[targetColumns.notes] = String(input.notes || "").trim();
      if (targetColumns.unit >= 0) row[targetColumns.unit] = String(input.unit || "").trim();
      targetSheet.appendRow(row);
      updated = true;
    }
    if (!updated) throw new Error("No se encontró una fila para esa fecha y unidad");
    return respond({ ok: true, message: "Día actualizado en Google Sheets." });
  } catch (error) {
    return respond({ ok: false, error: error.message });
  }
}

function ensureNotesColumn(sheet, columns) {
  if (columns.notes >= 0) return;
  const column = sheet.getLastColumn() + 1;
  sheet.getRange(1, column).setValue("Notas");
  columns.notes = column - 1;
}

function normalize(value) {
  return String(value == null ? "" : value).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function find(headers, names) {
  return names.map(normalize).map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
}

function normalizeDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const text = String(value == null ? "" : value).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) { const [day, month, year] = text.split("-"); return `${year}-${month}-${day}`; }
  return text;
}

function respond(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
