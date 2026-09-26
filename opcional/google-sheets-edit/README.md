# Edición opcional de Google Sheets

El CSV publicado solo permite leer disponibilidad. Para guardar cambios desde Auscultor necesitas este puente de Google Apps Script.

1. Abre la hoja y entra en **Extensiones → Apps Script**.
2. Reemplaza el contenido del editor por `Code.gs` y guarda.
3. En **Implementar → Nueva implementación**, selecciona **Aplicación web**.
4. Ejecuta como tú y permite acceso a quienes tengan el enlace (la URL no debe publicarse).
5. Copia la URL terminada en `/exec` y pégala en Auscultor como **URL de edición (Google Apps Script)**.

La primera fila de cada pestaña debe contener `Fecha`, `Estado`, `Nombre del Visitante` o `Cliente`, `Estado de Pago` y, opcionalmente, `Notas` y `Unidad`. El script actualiza la fila existente del día; no crea filas nuevas ni elimina información.
