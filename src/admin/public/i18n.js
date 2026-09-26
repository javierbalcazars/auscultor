(() => {
  const english = new Map([
    ["Configuración · Auscultor", "Settings · Auscultor"],
    ["Idioma", "Language"],
    ["Panel local de configuración", "Local configuration panel"],
    ["● Solo este equipo", "● This device only"],
    ["🤖 Iniciar bot", "🤖 Start bot"], ["🤖 Detener bot", "🤖 Stop bot"],
    ["Bienvenido a Auscultor", "Welcome to Auscultor"],
    ["Completa la configuración, revisa la información del negocio y vincula WhatsApp. El panel te guiará durante el primer inicio.", "Complete the settings, review the business information, and link WhatsApp. The panel will guide you through the first setup."],
    ["CONFIGURACIÓN DEL ASISTENTE", "ASSISTANT SETTINGS"], ["Panel de Control", "Control Panel"],
    ["Configura el asistente, la información del negocio y sus conexiones desde un solo lugar.", "Configure the assistant, business information, and connections in one place."],
    ["Comprobando proceso…", "Checking process…"], ["Comprobando sesión…", "Checking session…"], ["Comprobando clave…", "Checking key…"],
    ["Vincular WhatsApp", "Link WhatsApp"], ["Cancelar vinculación", "Cancel linking"],
    ["En el teléfono abre WhatsApp → Dispositivos vinculados → Vincular un dispositivo y escanea este código.", "On your phone, open WhatsApp → Linked devices → Link a device, then scan this code."],
    ["Secciones", "Sections"], ["Configuración", "Settings"], ["Configuración general", "General settings"], ["Personas", "People"], ["Tiempos y límites", "Timing and limits"],
    ["Configura la identidad, OpenAI, los datos principales y la vinculación de WhatsApp.", "Configure identity, OpenAI, core details, and WhatsApp linking."],
    ["Información del negocio", "Business information"], ["Contenido", "Content"], ["Disponibilidad", "Availability"], ["Herramientas", "Tools"], ["Avanzado", "Advanced"], ["Información", "Information"],
    ["URL CSV de disponibilidad (Google Sheets)", "Availability CSV URL (Google Sheets)"], ["Opcional. Solo lectura: publica la hoja como CSV para mostrar reservas y bloqueos en el calendario.", "Optional. Read-only: publish the sheet as CSV to show reservations and blocked dates in the calendar."],
    ["Completa los datos principales y vincula WhatsApp sin iniciar el bot manualmente.", "Enter the main details and link WhatsApp without starting the bot manually."],
    ["API key de OpenAI", "OpenAI API key"], ["Pega aquí tu API key", "Paste your API key here"],
    ["Pega la clave privada de tu cuenta de OpenAI.", "Paste the private key from your OpenAI account."], ["Mostrar", "Show"], ["Ocultar", "Hide"],
    ["Número del encargado principal", "Primary manager number"],
    ["Incluye el código de país. Puedes agregar más encargados en la pestaña Personas.", "Include the country code. You can add more managers in the People tab."],
    ["Vinculación de WhatsApp", "WhatsApp linking"], ["Guarda la configuración, inicia WhatsApp y muestra el QR.", "Save the settings, start WhatsApp, and display the QR code."], ["Generar QR", "Generate QR"],
    ["Identidad, datos y conexión con OpenAI.", "Identity, data, and OpenAI connection."], ["Nombre del negocio", "Business name"],
    ["Se utiliza en mensajes y registros.", "Used in messages and records."], ["Ruta de datos", "Data path"], ["Carpeta que contiene FAQs y Chats.", "Folder containing FAQs and Chats."],
    ["Modelo de OpenAI", "OpenAI model"], ["Otro modelo (manual)", "Other model (manual)"], ["Ejemplo: gpt-4o-mini", "Example: gpt-4o-mini"],
    ["GPT-4o mini (muy rápido)", "GPT-4o mini (very fast)"], ["GPT-4o (equilibrado)", "GPT-4o (balanced)"],
    ["GPT-4.1 mini (rápido)", "GPT-4.1 mini (fast)"], ["GPT-4.1 (potente)", "GPT-4.1 (powerful)"],
    ["GPT-5 nano (muy rápido)", "GPT-5 nano (very fast)"], ["GPT-5 mini (rápido)", "GPT-5 mini (fast)"],
    ["GPT-5 (más potente, más lento)", "GPT-5 (most powerful, slower)"], ["GPT-5.4 nano (muy rápido)", "GPT-5.4 nano (very fast)"],
    ["GPT-5.4 mini (rápido y potente)", "GPT-5.4 mini (fast and powerful)"],
    ["Modelo muy rápido y económico para consultas frecuentes.", "A very fast and affordable model for frequent requests."],
    ["Modelo GPT-5 muy rápido para tareas simples y de gran volumen.", "A very fast GPT-5 model for simple, high-volume tasks."],
    ["Modelo GPT-5.4 rápido y económico para tareas sencillas.", "A fast and affordable GPT-5.4 model for simple tasks."],
    ["Buena velocidad con mayor capacidad que los modelos pequeños.", "Good speed with more capability than smaller models."],
    ["Modelo rápido para tareas bien definidas y de alto volumen.", "A fast model for well-defined, high-volume tasks."],
    ["Modelo moderno que combina velocidad y mayor capacidad.", "A modern model combining speed and greater capability."],
    ["Equilibrio entre velocidad y capacidad.", "A balance of speed and capability."],
    ["Modelo potente para seguir instrucciones complejas.", "A powerful model for following complex instructions."],
    ["Mayor capacidad para tareas complejas; puede responder más lento.", "Greater capability for complex tasks; responses may be slower."],
    ["Escribe un identificador compatible con Chat Completions.", "Enter an identifier compatible with Chat Completions."],
    ["Personas y números", "People and numbers"], ["Un número por línea, con signo + y código del país.", "One number per line, including + and country code."],
    ["Encargados adicionales", "Additional managers"], ["Se suman al encargado principal y recibirán las derivaciones y alertas.", "They are added to the primary manager and receive handoffs and alerts."],
    ["Números ignorados o bloqueados", "Ignored or blocked numbers"], ["El bot no responderá mensajes de estos números.", "The bot will not reply to messages from these numbers."],
    ["Ajusta el ritmo de respuesta y la intervención humana.", "Adjust response timing and human intervention."],
    ["Espera antes de responder (segundos)", "Wait before replying (seconds)"], ["Ingresa un tiempo de respuesta válido en segundos.", "Enter a valid response delay in seconds."],
    ["Reenviar audios desde (segundos)", "Forward audio from (seconds)"], ["Pausa por atención humana (horas)", "Human support pause (hours)"],
    ["seg", "sec"], ["horas", "hours"], ["días", "days"],
    ["Intervalo entre alertas (minutos)", "Interval between alerts (minutes)"], ["Expiración de conversación (horas)", "Conversation expiration (hours)"],
    ["Retención de chats (días)", "Chat retention (days)"], ["Solicitudes por hora", "Requests per hour"], ["Mensajes por lote", "Messages per batch"],
    ["Agrega la información confirmada que Auscultor puede utilizar para responder a tus clientes.", "Add confirmed information that Auscultor can use to reply to your customers."],
    ["Contenido disponible", "Available content"], ["Cargando temas…", "Loading topics…"], ["Crear desde una plantilla…", "Create from a template…"], ["+ Crear nueva FAQ", "+ Create new FAQ"],
    ["+ Agregar información", "+ Add information"], ["Ocultar lista", "Hide list"], ["Mostrar lista", "Show list"],
    ["Temas", "Topics"], ["Selecciona uno para editarlo", "Select one to edit"], ["Título", "Title"],
    ["Buscar temas…", "Search topics…"], ["No se encontraron temas.", "No topics found."], ["Aún no hay temas.", "There are no topics yet."],
    ["Ejemplo: Horarios y ubicación", "Example: Hours and location"], ["Información que Auscultor puede usar", "Information Auscultor can use"],
    ["Cambios sin guardar.", "Unsaved changes."], ["Hay cambios sin guardar. ¿Quieres descartarlos?", "There are unsaved changes. Do you want to discard them?"],
    ["Escribe un título para esta información.", "Enter a title for this information."],
    ["Completa o elimina todos los campos pendientes de la plantilla", "Complete or remove every pending template field"],
    ["# Título\n\nEscribe aquí información confirmada del negocio.", "# Title\n\nEnter confirmed business information here."],
    ["Eliminar", "Delete"], ["Guardar cambios", "Save changes"], ["Diagnóstico y métricas sin utilizar la terminal.", "Diagnostics and metrics without using the terminal."],
    ["Última actualización:", "Last update:"], ["Herramientas y avanzado", "Tools and advanced"], ["Herramientas y opciones avanzadas", "Tools and advanced options"],
    ["Diagnóstico, métricas, límites técnicos, respaldos y administración de la sesión.", "Diagnostics, metrics, technical limits, backups, and session management."], ["Ajustes técnicos", "Technical settings"],
    ["Diagnóstico local", "Local diagnostics"], ["Comprueba configuración, Vault, FAQs y sesión.", "Checks settings, Vault, FAQs, and session."], ["Actualizar", "Refresh"],
    ["Consulta días disponibles, reservados y bloqueados desde tu hoja pública de Google Sheets.", "View available, reserved, and blocked days from your public Google Sheet."], ["Cargando…", "Loading…"], ["Consultando disponibilidad…", "Loading availability…"], ["Datos actualizados.", "Data updated."], ["Disponible", "Available"], ["Reservado", "Reserved"], ["Bloqueado", "Blocked"], ["Hoy", "Today"], ["Sin conexión, datos de", "Offline, data from"], ["Configura una URL pública de Google Sheets para consultar disponibilidad.", "Configure a public Google Sheets URL to view availability."], ["No se pudo consultar Google Sheets:", "Could not query Google Sheets:"],
    ["Métricas", "Metrics"], ["Contadores técnicos sin números ni contenido de conversaciones.", "Technical counters without phone numbers or conversation content."],
    ["Opciones avanzadas", "Advanced options"], ["Límites técnicos, respaldos y administración de la sesión.", "Technical limits, backups, and session management."],
    ["Historial enviado", "History sent"], ["Historial almacenado", "History stored"], ["Máximo de caracteres", "Maximum characters"], ["Tokens de salida", "Output tokens"],
    ["Espera máxima de OpenAI (milisegundos)", "OpenAI timeout (milliseconds)"], ["30000 ms equivalen a 30 segundos.", "30000 ms equals 30 seconds."],
    ["Validación al iniciar (milisegundos)", "Startup validation (milliseconds)"], ["3000 ms equivalen a 3 segundos.", "3000 ms equals 3 seconds."],
    ["Respaldo cifrado", "Encrypted backup"], ["Guarda configuración, sesión, Vault y datos en .local/encrypted-backups. Detén el bot antes de crearlo.", "Saves settings, session, Vault, and data in .local/encrypted-backups. Stop the bot before creating it."],
    ["Guarda configuración, sesión, Vault y datos en", "Saves settings, session, Vault, and data in"], [". Detén el bot antes de crearlo.", ". Stop the bot before creating it."],
    ["Contraseña del respaldo", "Backup password"], ["Mínimo 6 caracteres", "At least 6 characters"], ["Crear respaldo cifrado", "Create encrypted backup"],
    ["Respaldos disponibles…", "Available backups…"], ["Restaurar seleccionado", "Restore selected"],
    ["Desconecta este equipo y elimina su sesión local. El bot se reiniciará y mostrará un QR nuevo.", "Disconnects this device and removes its local session. The bot will restart and display a new QR code."],
    ["Desvincular y generar QR nuevo", "Unlink and generate a new QR"], ["Datos oficiales de Auscultor y su creador.", "Official information about Auscultor and its creator."],
    ["Edición:", "Edition:"], ["Experimental", "Experimental"], ["Estable", "Stable"], ["Perfil:", "Profile:"], ["Soporte:", "Support:"],
    ["Perfil de GitHub", "GitHub profile"], ["Reportar un problema", "Report an issue"],
    ["Software de código abierto publicado bajo licencia AGPL-3.0.", "Open-source software released under the AGPL-3.0 license."],
    ["Guardar configuración", "Save settings"], ["Bot apagado", "Bot off"], ["Bot encendido", "Bot on"],
    ["Sesión conectada", "Session connected"], ["Sesión no conectada", "Session not connected"], ["Esperando escaneo de QR", "Waiting for QR scan"],
    ["Iniciando sesión", "Starting session"], ["Proceso iniciado", "Process started"], ["No se pudo comprobar", "Could not check"],
    ["Clave aceptada y modelo accesible", "Key accepted and model available"], ["Revisa la clave o el modelo", "Check the key or model"],
    ["Detén el bot para modificar la configuración.", "Stop the bot to change the settings."], ["Deteniendo…", "Stopping…"], ["Iniciando…", "Starting…"],
    ["Deteniendo el bot…", "Stopping the bot…"], ["Iniciando el bot…", "Starting the bot…"], ["Guardando…", "Saving…"],
    ["Guardando configuración e iniciando WhatsApp…", "Saving settings and starting WhatsApp…"], ["Cancelando la vinculación de WhatsApp…", "Canceling WhatsApp linking…"],
    ["Vinculación cancelada.", "Linking canceled."], ["No se pudo cargar la información del negocio. Intenta nuevamente.", "Could not load the business information. Try again."],
    ["Nueva información.md", "New information.md"], ["# Nueva información\n\n", "# New information\n\n"], ["Revisar", "Check"],
    ["Desde", "Since"], ["Mensajes vistos", "Messages seen"], ["Respuestas enviadas", "Replies sent"], ["Derivaciones", "Handoffs"], ["Solicitudes a OpenAI", "OpenAI requests"],
    ["Creando respaldo…", "Creating backup…"], ["Selecciona un respaldo.", "Select a backup."], ["Verificando y restaurando…", "Verifying and restoring…"],
    ["Se cerrará la sesión de WhatsApp en este equipo y tendrás que escanear un QR nuevo. ¿Continuar?", "The WhatsApp session on this device will be closed and you will need to scan a new QR code. Continue?"],
    ["La configuración, sesión, Vault y datos actuales serán reemplazados. Se creará un respaldo previo. ¿Continuar?", "The current settings, session, Vault, and data will be replaced. A backup will be created first. Continue?"],
    ["Configuración guardada.", "Settings saved."], ["Solicitud rechazada", "Request rejected"], ["No encontrado", "Not found"],
    ["Se solicitó detener el bot.", "The bot was asked to stop."], ["El bot ya estaba detenido.", "The bot was already stopped."],
    ["El bot se está iniciando.", "The bot is starting."], ["El bot ya está activo.", "The bot is already running."],
    ["WhatsApp se está preparando para mostrar el QR.", "WhatsApp is preparing to display the QR code."],
    ["La configuración de WhatsApp ya está activa.", "WhatsApp setup is already active."],
    ["Sesión de WhatsApp eliminada. Esperando un QR nuevo.", "WhatsApp session removed. Waiting for a new QR code."],
    ["Hay una clave guardada. Déjala vacía para conservarla.", "A key is already saved. Leave this blank to keep it."],
    ["Aún no hay una clave válida guardada.", "No valid key has been saved yet."],
    ["Inicia sesión para abrir el panel de Auscultor.", "Sign in to open the Auscultor panel."],
    ["Español", "Spanish"], ["Inglés", "English"], ["Secciones", "Sections"], ["Mes anterior", "Previous month"], ["Mes siguiente", "Next month"],
    ["Calendario de disponibilidad", "Availability calendar"], ["Vista previa del chat", "Chat preview"], ["Buscar temas…", "Search topics…"],
    ["Pega aquí tu link de Sheets", "Paste your Sheets link here"], ["Pega aquí tu link de Apps Script", "Paste your Apps Script link here"],
    ["Ya hay un link válido. Pega un link nuevo para editar.", "A valid link is already saved. Paste a new link to edit it."],
    ["Pega aquí tu API key privada de OpenAI.", "Paste your private OpenAI API key here."], ["Pega aquí tu API key", "Paste your API key here"],
    ["Ya hay una clave válida. Pega una API key nueva para editar.", "A valid key is already saved. Paste a new API key to edit it."],
    ["Se guarda de forma privada en .env.", "Saved privately in .env."], ["+56 9 1234 5678", "+56 9 1234 5678"],
    ["Contraseña del administrador", "Administrator password"], ["Mínimo 6 caracteres", "At least 6 characters"],
    ["URL de edición (Google Apps Script)", "Edit URL (Google Apps Script)"], ["min", "min"], ["ms", "ms"],
    ["Lun", "Mon"], ["Mar", "Tue"], ["Mié", "Wed"], ["Jue", "Thu"], ["Vie", "Fri"], ["Sáb", "Sat"], ["Dom", "Sun"],
    ["Resumen de actividad y estado del asistente.", "Activity summary and assistant status."],
    ["Funciones protegidas para modificar el comportamiento del asistente y administrar la sesión de WhatsApp.", "Protected functions for changing assistant behavior and managing the WhatsApp session."], ["Avanzados", "Advanced"],
    ["Consulta las conversaciones guardadas localmente en tu Vault.", "View conversations saved locally in your Vault."],
    ["Consulta y edita la disponibilidad de cada día.", "View and edit each day's availability."], ["Disponibilidad:", "Availability:"],
    ["¿Cómo quieres que te llamemos?", "What should we call you?"], ["Contraseña", "Password"], ["Entrar", "Sign in"],
    ["Usuario", "Username"], ["Nombre de usuario", "Username"], ["Configura una clave de administrador para proteger Auscultor.", "Set an administrator password to protect Auscultor."],
    ["Ingresa tu contraseña para abrir el panel.", "Enter your password to open the panel."], ["Bienvenido nuevamente", "Welcome back"],
    ["Inicio", "Home"], ["Reservas", "Bookings"], ["Chats", "Chats"], ["Secciones", "Sections"],
    ["Días ocupados del mes", "Occupied days this month"], ["Editar día seleccionado", "Edit selected day"], ["Selecciona un día del calendario para editarlo.", "Select a calendar day to edit it."],
    ["Estado", "Status"], ["Nombre del visitante", "Visitor name"], ["Estado del pago", "Payment status"], ["Notas", "Notes"], ["Guardar día", "Save day"],
    ["Pagado", "Paid"], ["Pendiente", "Pending"], ["No hay reservas ni bloqueos en este mes.", "There are no bookings or blocked days this month."],
    ["Información sensible o privada", "Sensitive or private information"], ["Ingresa la clave de administrador para ver los chats.", "Enter the administrator password to view chats."],
    ["Clave de administrador", "Administrator password"], ["Desbloquear chats", "Unlock chats"], ["Conversaciones", "Conversations"], ["Cargando temas…", "Loading topics…"],
    ["Selecciona una conversación para verla.", "Select a conversation to view it."], ["Primer mensaje", "First message"], ["Último mensaje", "Last message"],
    ["Información", "Information"], ["Nombre del visitante", "Visitor name"], ["Revisa", "Check"], ["No disponible", "Unavailable"],
    ["Prompt del asistente", "Assistant prompt"], ["El prompt está protegido. Desbloquéalo para revisarlo o editarlo.", "The prompt is protected. Unlock it to review or edit it."],
    ["Contraseña del administrador", "Administrator password"], ["Mostrar prompt", "Show prompt"], ["Prompt completo", "Full prompt"],
    ["Confirma tu contraseña para guardar", "Confirm your password to save"], ["Guardar prompt", "Save prompt"], ["Ocultar prompt", "Hide prompt"],
    ["Vinculación de WhatsApp", "WhatsApp linking"], ["Desconecta este equipo y elimina su sesión local. El bot se reiniciará y mostrará un QR nuevo.", "Disconnect this device and remove its local session. The bot will restart and show a new QR code."],
    ["Desvincular y generar QR nuevo", "Unlink and generate a new QR code"], ["¿Confirmar cambio de prompt?", "Confirm prompt change?"], ["El cambio afectará las próximas respuestas del asistente.", "This change will affect the assistant's future replies."],
    ["Cancelar", "Cancel"], ["Confirmar 3 s", "Confirm for 3 s"], ["Confirmando…", "Confirming…"],
    ["Datos oficiales de Auscultor y su creador.", "Official information about Auscultor and its creator."], ["Dev:", "Developer:"], ["Edición:", "Edition:"], ["Perfil:", "Profile:"], ["Soporte:", "Support:"],
    ["Avatar de Javier Balcazar", "Javier Balcazar's avatar"], ["Agrega la información confirmada que Auscultor puede utilizar para responder a tus clientes.", "Add confirmed information that Auscultor can use to reply to your customers."],
    ["No se pudo cargar la información del negocio. Intenta nuevamente.", "Could not load business information. Try again."],
    ["Editando", "Editing"], ["Sin observaciones.", "No notes."], ["Observación:", "Note:"], ["Pago:", "Payment:"],
    ["Guardando día…", "Saving day…"], ["Día actualizado en Google Sheets.", "Day updated in Google Sheets."], ["No se pudo consultar Google Sheets:", "Could not query Google Sheets:"],
    ["Horas registradas", "Hours recorded"], ["Mensajes recibidos", "Messages received"], ["Mensajes respondidos", "Messages answered"],
    ["Solicitudes a OpenAI", "OpenAI requests"], ["No hay conversaciones guardadas.", "There are no saved conversations."], ["No se pudo cargar los chats.", "Could not load chats."],
    ["Ingresa la contraseña del administrador.", "Enter the administrator password."], ["Contraseña incorrecta", "Incorrect password"],
    ["Ingresa la contraseña del administrador para guardar.", "Enter the administrator password to save."], ["Verificando contraseña…", "Verifying password…"],
    ["Cambios guardados correctamente.", "Changes saved successfully."], ["Guardando prompt…", "Saving prompt…"], ["Prompt guardado.", "Prompt saved."],
    ["La sesión se eliminará y tendrás que escanear un QR nuevo.", "The session will be removed and you will need to scan a new QR code."],
    ["¿Confirmar desvinculación de WhatsApp?", "Confirm WhatsApp unlinking?"], ["Desvinculando WhatsApp y preparando un QR nuevo…", "Unlinking WhatsApp and preparing a new QR code…"],
    ["Inactivo", "Inactive"], ["Atención humana", "Human support"], ["Respondiendo el bot", "Bot responding"], ["Sin automatización", "No automation"],
    ["No disponible", "Unavailable"], ["No hay conversaciones guardadas.", "There are no saved conversations."],
  ]);

  const trackedTexts = new Set();
  const originalText = new WeakMap();
  const trackedAttributes = new Set();
  const originalAttributes = new WeakMap();
  function storedLanguage() {
    const cookie = globalThis.document.cookie.match(/(?:^|;\s*)auscultor-language=([^;]+)/)?.[1];
    if (cookie === "en" || cookie === "es") return cookie;
    return globalThis.localStorage.getItem("auscultor-language") === "en" ? "en" : "es";
  }

  let language = storedLanguage();

  function translate(value) {
    if (language === "es") return value;
    if (english.has(value)) return english.get(value);
    return value
      .replace(/^Revisa el campo “(.+)”\.$/, "Check the “$1” field.")
      .replace(/^¿Eliminar “(.+)”\? Se conservará un respaldo local\.$/, "Delete “$1”? A local backup will be kept.")
      .replace(/^(\d+) encargado\(s\)$/, "$1 manager(s)")
      .replace(/^permisos (.+)$/, "permissions $1")
      .replace(/^(\d+) documento\(s\)$/, "$1 document(s)")
      .replace(/^(\d+) conversaciones?$/, (_, count) => `${count} conversation${count === "1" ? "" : "s"}`)
      .replace(/^(\d+) días?$/, (_, count) => `${count} day${count === "1" ? "" : "s"}`)
      .replace(/^Editando (.+)$/, "Editing $1")
      .replace(/^Observación: (.+)$/, "Note: $1")
      .replace(/^Pago: (.+)$/, "Payment: $1");
  }

  function applyText(node) {
    const current = node.data;
    const trimmed = current.trim();
    if (!trimmed) return;
    if (!originalText.has(node)) {
      const knownSpanish = english.has(trimmed) || translate(trimmed) !== trimmed;
      if (!knownSpanish) return;
      originalText.set(node, { value: trimmed, prefix: current.slice(0, current.indexOf(trimmed)), suffix: current.slice(current.indexOf(trimmed) + trimmed.length) });
      trackedTexts.add(node);
    }
    const original = originalText.get(node);
    const next = `${original.prefix}${language === "en" ? translate(original.value) : original.value}${original.suffix}`;
    if (node.data !== next) node.data = next;
  }

  function applyAttributes(element) {
    for (const attribute of ["placeholder", "aria-label", "title"]) {
      const value = element.getAttribute?.(attribute);
      if (!value) continue;
      let originals = originalAttributes.get(element);
      if (!originals) { originals = {}; originalAttributes.set(element, originals); }
      if (!originals[attribute] && (english.has(value) || translate(value) !== value)) originals[attribute] = value;
      if (originals[attribute]) element.setAttribute(attribute, language === "en" ? translate(originals[attribute]) : originals[attribute]);
    }
    if (originalAttributes.has(element)) trackedAttributes.add(element);
  }

  function scan(root = document) {
    const walker = document.createTreeWalker(root, globalThis.NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) applyText(walker.currentNode);
    if (root.nodeType === 1) applyAttributes(root);
    root.querySelectorAll?.("[placeholder], [aria-label], [title]").forEach(applyAttributes);
  }

  function refresh() {
    document.documentElement.lang = language;
    document.title = language === "en" ? "Settings · Auscultor" : "Configuración · Auscultor";
    trackedTexts.forEach((node) => node.isConnected && applyText(node));
    trackedAttributes.forEach((element) => element.isConnected && applyAttributes(element));
    scan();
    const selector = document.querySelector("#language-select");
    if (selector) selector.value = language;
  }

  function setLanguage(next) {
    language = next === "en" ? "en" : "es";
    globalThis.localStorage.setItem("auscultor-language", language);
    globalThis.document.cookie = `auscultor-language=${language}; Max-Age=31536000; Path=/; SameSite=Lax`;
    refresh();
  }

  new globalThis.MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") applyText(mutation.target);
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 3) applyText(node);
        else if (node.nodeType === 1) scan(node);
      });
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  globalThis.AuscultorI18n = { get language() { return language; }, setLanguage, t: translate, refresh };
  refresh();
})();
