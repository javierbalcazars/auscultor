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
    ["Secciones", "Sections"], ["Configuración", "Settings"], ["Personas", "People"], ["Tiempos y límites", "Timing and limits"],
    ["Información del negocio", "Business information"], ["Herramientas", "Tools"], ["Avanzado", "Advanced"], ["Información", "Information"],
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
    ["Espera antes de responder (milisegundos)", "Wait before replying (milliseconds)"], ["1000 ms equivalen a 1 segundo.", "1000 ms equals 1 second."],
    ["Reenviar audios desde (segundos)", "Forward audio from (seconds)"], ["Pausa por atención humana (horas)", "Human support pause (hours)"],
    ["seg", "sec"], ["horas", "hours"], ["días", "days"],
    ["Intervalo entre alertas (minutos)", "Interval between alerts (minutes)"], ["Expiración de conversación (horas)", "Conversation expiration (hours)"],
    ["Retención de chats (días)", "Chat retention (days)"], ["Solicitudes por hora", "Requests per hour"], ["Mensajes por lote", "Messages per batch"],
    ["Estos documentos son la única fuente que Auscultor utiliza para responder. Puedes editarlos incluso con el bot encendido.", "These documents are the only source Auscultor uses to reply. You can edit them while the bot is running."],
    ["Nueva FAQ", "New FAQ"], ["Usar plantilla…", "Use template…"], ["Nombre del documento", "Document name"],
    ["Ejemplo: Horarios y ubicación.md", "Example: Hours and location.md"], ["Contenido confirmado", "Confirmed content"],
    ["# Título\n\nEscribe aquí información confirmada del negocio.", "# Title\n\nEnter confirmed business information here."],
    ["Eliminar", "Delete"], ["Guardar FAQ", "Save FAQ"], ["Diagnóstico y métricas sin utilizar la terminal.", "Diagnostics and metrics without using the terminal."],
    ["Diagnóstico local", "Local diagnostics"], ["Comprueba configuración, Vault, FAQs y sesión.", "Checks settings, Vault, FAQs, and session."], ["Actualizar", "Refresh"],
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
  ]);

  const trackedTexts = new Set();
  const originalText = new WeakMap();
  const trackedAttributes = new Set();
  const originalAttributes = new WeakMap();
  let language = globalThis.localStorage.getItem("auscultor-language") === "en" ? "en" : "es";

  function translate(value) {
    if (language === "es") return value;
    if (english.has(value)) return english.get(value);
    return value
      .replace(/^Revisa el campo “(.+)”\.$/, "Check the “$1” field.")
      .replace(/^¿Eliminar “(.+)”\? Se conservará un respaldo local\.$/, "Delete “$1”? A local backup will be kept.")
      .replace(/^(\d+) encargado\(s\)$/, "$1 manager(s)")
      .replace(/^permisos (.+)$/, "permissions $1")
      .replace(/^(\d+) documento\(s\)$/, "$1 document(s)");
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
