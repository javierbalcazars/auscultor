<p align="center"><img src="assets/auscultor.svg" width="112" alt="Icono de Auscultor"></p>

# Auscultor

**Asistente inteligente para alojamientos y turismo.**
Versión actual: **1.9.2**.

Auscultor atiende consultas por WhatsApp para alojamientos, campings, hostales,
cabañas, parques y otros negocios turísticos. Responde únicamente con la
información confirmada que el administrador mantiene en sus FAQs y deriva a una
persona cuando falta información o se necesita una acción manual.

Está pensado para un PC Linux que permanezca encendido y conectado a Internet,
ya sea un equipo dedicado o un computador de uso cotidiano.

## Descargar y ejecutar

La distribución recomendada es una única AppImage para Linux x86_64. Incluye
Electron, Chromium, Node.js, Baileys y sus dependencias; no necesitas instalar
Node, npm, Python, Git ni compiladores para usarla.

1. Abre **Releases** en GitHub.
2. Descarga `Auscultor-v1.9.2-x86_64.AppImage`.
3. Dale permiso de ejecución y ábrela:

```bash
chmod +x Auscultor-v1.9.2-x86_64.AppImage
./Auscultor-v1.9.2-x86_64.AppImage
```

Los requisitos externos son Linux x86_64, conexión a Internet, una cuenta de
WhatsApp y una API key activa de OpenAI. La configuración, la sesión y los
chats se conservan en `~/.local/share/Auscultor` al reemplazar la AppImage por
una actualización.

La AppImage contiene metadatos de actualización compatibles con Gear Lever.
Después de importar manualmente la primera versión compatible, Gear Lever puede
detectar releases posteriores y usar archivos `.zsync` cuando estén publicados.

## Primer uso

Al abrir Auscultor por primera vez, crea el nombre del administrador y una clave
de administrador. En las aperturas siguientes solo se solicita esa clave.

Desde el panel:

1. Completa el nombre del negocio, la API key y el modelo de OpenAI.
2. Agrega uno o más números de encargados con código de país.
3. Ajusta los tiempos y límites si lo necesitas.
4. Completa, crea o elimina documentos de FAQ en **Contenido**.
5. Guarda la configuración.
6. En **Configuración**, pulsa **Generar QR** dentro de Vinculación de WhatsApp.
7. Escanea el QR desde WhatsApp → **Dispositivos vinculados** y espera a que la
   sesión aparezca como conectada.
8. Pulsa **Iniciar bot** para comenzar a responder mensajes.

Si ya existe una sesión vinculada, no necesitas generar ni escanear otro QR:
Auscultor la recupera al iniciar WhatsApp. El botón superior inicia y detiene el bot. Mientras está encendido, los campos
de configuración quedan protegidos y el botón de detención permanece disponible.

## Panel de control

El panel funciona dentro de una ventana de escritorio y el servidor local solo
escucha en `127.0.0.1`. La barra lateral incluye:

- **Inicio:** métricas básicas y resumen de disponibilidad.
- **Reservas:** calendario mensual, lista de días ocupados y editor de cada día.
- **Chats:** conversaciones guardadas localmente, protegidas por la clave de
  administrador.
- **Configuración:** negocio, Vault, API key y modelo.
- **Personas:** encargados y números que el bot debe ignorar.
- **Tiempos y límites:** demora de respuesta, audios, pausas y límites de uso.
- **Contenido:** documentos Markdown de FAQs que el bot puede consultar.
- **Herramientas:** diagnóstico y métricas detalladas.
- **Avanzados:** historial, tokens, tiempos técnicos, edición protegida del
  prompt, respaldos y desvinculación de WhatsApp.
- **Info:** versión, edición, licencia y enlaces oficiales.

El selector de idioma está en la barra lateral y cambia la interfaz entre
español e inglés. No modifica el idioma de las respuestas del asistente.

## FAQs

En **Contenido** puedes editar, crear, renombrar y eliminar documentos Markdown.
El bot carga todos los documentos de `Vault/FAQs` como contexto autorizado y no
usa las conversaciones como fuente de respuestas. Escribe solo información que
tu negocio permita comunicar; no guardes claves ni datos privados de clientes en
las FAQs.

## Disponibilidad y reservas

La pestaña **Reservas** puede leer una hoja pública de Google Sheets. Se admiten
pestañas mensuales llamadas `enero` hasta `diciembre`; cada una debe comenzar
con columnas como `Fecha`, `Estado`, `Nombre del Visitante`, `Estado de Pago` y,
opcionalmente, `Notas` y `Unidad`. Los estados válidos son `Disponible`,
`Reservado` y `Bloqueado`; un día sin fila se considera disponible.

Para lectura:

1. Publica la hoja en **Archivo → Compartir → Publicar en la web**.
2. Selecciona el formato CSV y copia la URL generada.
3. Pégala en **Configuración → URL CSV de disponibilidad (Google Sheets)** y
   guarda.

Para editar desde el panel, implementa el puente opcional de
[`opcional/google-sheets-edit/Code.gs`](opcional/google-sheets-edit/Code.gs) y
sigue su [guía](opcional/google-sheets-edit/README.md). Luego pega la URL `/exec`
en **URL de edición (Google Apps Script)**. El puente actualiza o crea la fila
del día elegido; no publica esas URLs ni las incluye en Git.

Si Google Sheets no responde, se muestra la última copia cacheada con su fecha de
actualización. Las filas inválidas se ignoran sin interrumpir las demás.

## WhatsApp y operación diaria

Los indicadores muestran el estado del bot, de WhatsApp y de OpenAI. Para
vincular otra cuenta usa **Avanzados → Desvincular y generar QR nuevo**; la
acción exige la clave de administrador y confirmación.

Auscultor usa Baileys, no la API oficial de WhatsApp Business. WhatsApp puede
cambiar su funcionamiento interno y requerir futuras actualizaciones.

El uso normal no necesita `systemd`. Para un PC dedicado, la instalación
opcional está documentada en [opcional/systemd/README.md](opcional/systemd/README.md).

## Desarrollo desde código fuente

Se necesita Node.js 24–26, npm, Git, Python 3 y herramientas de compilación.

```bash
npm ci
npm run check
npm run lint
npm test
npm audit --omit=dev
```

La guía para generar la AppImage está en
[packaging/electron/README.md](packaging/electron/README.md).

## Seguridad y datos

`.env`, `auth_session`, `Vault/Chats`, `data` y `.local` permanecen fuera de
Git. La API key no vuelve al navegador ni aparece en los logs. El panel impide
abrir dos procesos sobre la misma sesión y cerrar la ventana desde la bandeja
detiene los procesos hijos correctamente.

## Licencia

Copyright (C) 2026 Javier Balcazar

Auscultor se distribuye bajo la **GNU Affero General Public License v3.0 o
posterior** (`AGPL-3.0-or-later`). Consulta [LICENSE](LICENSE) para el texto
completo.
