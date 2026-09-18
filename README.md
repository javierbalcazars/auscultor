# Asistente de WhatsApp para glampings

Versión actual: **1.5.2**.

Atiende consultas simples del público por WhatsApp usando las notas Markdown de
`Vault/FAQs` como fuente de información. Cuando no existe una respuesta confirmada
o se requiere una acción manual, deriva la conversación a un encargado.

El programa está pensado principalmente para instalarse en un PC dedicado que
funcione como bot de atención de WhatsApp las 24 horas, todos los días. También
puede utilizarse en un computador de uso cotidiano, siempre que permanezca
encendido, conectado a Internet y sin suspender ni cerrar el proceso durante el
horario en que se espera atención automática. Para una operación continua se
recomienda un equipo exclusivo y ejecutar el programa como servicio de `systemd`.

## Cómo funciona

1. Se conecta a WhatsApp mediante un código QR, como WhatsApp Web.
2. Valida durante 3 segundos las sesiones cifradas antes de activar la atención.
   Si encuentra una sesión dañada, aparta solamente sus archivos en una
   cuarentena privada y reconecta con claves nuevas.
   Los mensajes históricos que WhatsApp sincronice durante esta validación no
   se procesan; un mensaje realmente enviado mientras inicia queda en espera.
3. Espera 4 segundos sin mensajes nuevos y agrupa los textos consecutivos del
   mismo contacto.
4. Carga la FAQ completa de `Vault/FAQs` y la entrega a OpenAI junto con el
   historial reciente del mismo chat. OpenAI interpreta directamente la frase,
   sus errores ortográficos y el contexto de la conversación; no existe un
   buscador ni un filtro previo por palabras.
5. OpenAI responde utilizando solamente la información confirmada de la FAQ.
6. Responde al cliente y registra la conversación en `Vault/Chats`.
7. Si falta información, existe un reclamo o se necesita una acción manual,
   avisa al encargado y pausa la automatización para ese contacto.

Cada contacto tiene una cola independiente. Los mensajes de una misma persona se
procesan en orden, mientras contactos distintos pueden atenderse en paralelo.
OpenAI recibe como máximo 10 mensajes del mismo chat, incluida la consulta
actual, para comprender preguntas de seguimiento. El prompt con la FAQ completa
se envía por separado y no cuenta como uno de esos 10 mensajes.

El bot admite texto simple, respuestas citadas, textos de imágenes, videos y
documentos, además de respuestas de botones o listas. No transcribe audios: si
duran menos de 10 segundos o WhatsApp no informa su duración, solicita que la
consulta sea escrita; si duran 10 segundos o más, los reenvía al encargado y
deriva el chat. Para evitar referencias cifradas inválidas, el audio se descarga
a memoria RAM y se envía como una nota de voz nueva, sin guardarlo en el disco.
Las ubicaciones, contactos y archivos sin descripción se derivan a atención
humana. Los audios largos se reenvían incluso si la consulta supera un límite
de texto o de frecuencia. Se ignoran grupos, estados, canales, difusiones, reacciones y mensajes
duplicados.

> Este proyecto usa Baileys, una conexión no oficial con WhatsApp. Es adecuada
> para pruebas y volúmenes pequeños, pero para un servicio crítico conviene
> evaluar la API oficial de WhatsApp Business.

## Instalación

### Requisitos

Para funcionar, el bot necesita:

- Linux de 64 bits con conexión estable a Internet.
- Node.js 24 LTS y npm. También admite Node 25 y 26.
- Git, porque una dependencia de Baileys se descarga desde un repositorio Git.
- Python 3, un compilador de C/C++ y `make`, necesarios si alguna dependencia
  nativa debe compilarse en el equipo.
- Una cuenta de OpenAI con una API key habilitada y saldo o facturación disponible.
- Una cuenta de WhatsApp que pueda vincular el equipo mediante código QR.
- `systemd` solamente si se desea ejecutar el bot como servicio permanente.

Instala primero las herramientas correspondientes a tu distribución:

**Arch Linux y derivados:**

```bash
sudo pacman -Syu --needed nodejs-lts-krypton npm git base-devel python
```

**Debian, Ubuntu y derivados:**

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates git build-essential python3
```

**Fedora y derivados:**

```bash
sudo dnf install -y curl ca-certificates git gcc-c++ make python3
```

En Debian/Ubuntu y Fedora, instala Node.js 24 con `nvm` después de instalar los
paquetes anteriores. Este método evita depender de la versión de Node incluida
por cada distribución:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.7/install.sh | bash
. "$HOME/.nvm/nvm.sh"
nvm install 24
nvm use 24
```

Node.js publica estas instrucciones en su [página oficial de descargas](https://nodejs.org/en/download).
Antes de continuar, comprueba las herramientas:

```bash
node --version
npm --version
git --version
python3 --version
```

`node --version` debe comenzar con `v24`, `v25` o `v26`. En producción se
recomienda `v24`; el archivo `.nvmrc` selecciona esa versión al ejecutar
`nvm install` y `nvm use` desde el proyecto.

### Instalación del proyecto

Descarga o clona el repositorio, entra en su carpeta e instala las dependencias:

```bash
cd whatsapp-bot
npm ci
cp .env.example .env
```

El repositorio incluye `.env.example` y un Vault genérico para instalaciones
nuevas. La copia de `.env.example` es solo para la primera instalación: conserva
el `.env` existente al actualizar. El repositorio incluye `Vault/FAQs`
con contenido genérico para completar; no reemplaces un Vault configurado al
actualizar. `npm ci` utiliza las versiones exactas del lockfile.

Edita `.env` y configura:

- `OPENAI_API_KEY`: clave privada de OpenAI.
- `BUSINESS_NAME`: nombre comercial que aparecerá en los mensajes y logs.
- `OPENAI_MODEL`: modelo utilizado para generar las respuestas.
- `VAULT_PATH`: ruta del Vault; el valor predeterminado es `./Vault`.
- `CONVERSATIONS_FOLDER`: carpeta de registros; el valor predeterminado es `Chats`.
- `CONVERSATION_EXPIRY_HOURS`: horas de inactividad antes de iniciar un contexto
  nuevo, sin borrar el registro histórico.
- `CONVERSATION_RETENTION_DAYS`: antigüedad para considerar un chat eliminable;
  el valor predeterminado es `180` días. La eliminación requiere confirmación.
- `MAX_HISTORY_MESSAGES`: cantidad máxima de turnos recientes enviados al modelo;
  el valor predeterminado es `10`.
- `MAX_STORED_MESSAGES`: cantidad máxima total de turnos conservados por chat,
  contando mensajes recibidos y enviados; el valor predeterminado es `10`.
- `RESPONSE_DELAY_MS`: espera sin mensajes nuevos; `4000` equivale a 4 segundos.
- `SIGNAL_STARTUP_VALIDATION_MS`: tiempo de diagnóstico previo a activar el bot;
  el valor predeterminado es `3000` milisegundos.
- `AUDIO_FORWARD_MIN_SECONDS`: duración mínima para reenviar un audio al encargado;
  el valor predeterminado es `10` segundos.
- `OPENAI_TIMEOUT_MS`: espera máxima por una respuesta de OpenAI.
- `OPENAI_MAX_OUTPUT_TOKENS`: máximo de tokens de salida, incluyendo el JSON
  estructurado. Predeterminado: `600`; valores permitidos: `128` a `2048`.
- `HUMAN_SUPPORT_NUMBERS`: uno o más números de encargados, con código de país
  y separados por comas. Para instalaciones anteriores también se acepta
  `HUMAN_SUPPORT_NUMBER` cuando no se define la lista nueva.
- `HUMAN_ALERT_COOLDOWN_MINUTES`: tiempo mínimo entre alertas repetidas.
- `HUMAN_TAKEOVER_HOURS`: horas de pausa automática desde una derivación; el
  valor predeterminado es `2`.
- `MAX_INPUT_CHARS`: largo máximo de una consulta enviada al modelo.
- `MAX_BATCH_MESSAGES`: cantidad máxima de mensajes agrupados.
- `MAX_REQUESTS_PER_HOUR`: máximo de consultas automáticas por contacto y hora.
- `IGNORE_NUMBERS`: números que el bot debe ignorar, separados por comas.

Después de configurar `.env`, abre
`Vault/FAQs/Información del Glamping.md` y reemplaza la información de ejemplo
por datos confirmados de tu negocio. Puedes crear otros archivos `.md` dentro de
`Vault/FAQs`; el bot carga todos los documentos de esa carpeta antes de responder.

Al iniciar, el programa valida la configuración. Si falta una clave, el número
del encargado, el Vault, la carpeta `Vault/FAQs`, un documento Markdown de FAQ
o existe un valor inseguro, se cierra mostrando el motivo. Si la FAQ deja de
estar disponible mientras el bot funciona, la consulta se deriva de forma
segura en vez de quedar sin respuesta.

También se validan el formato de `OPENAI_MODEL`, el límite de salida y el tiempo
de espera (entero de 1 a 120000 milisegundos). La validación local no comprueba
si la cuenta tiene acceso al modelo: eso se confirma al hacer una consulta.
Si OpenAI agota el límite de salida, no se envía el texto incompleto y se deriva
la consulta. Los errores de la API muestran el código HTTP sin copiar cuerpos
de respuesta que puedan contener datos privados.

## Panel de control local

El proyecto incluye un panel para configurar, iniciar y detener el bot sin
editar `.env` manualmente:

```bash
npm run admin
```

Luego abre `http://127.0.0.1:3210` en el mismo equipo. El panel escucha
exclusivamente en la interfaz local, no devuelve la API key guardada y bloquea
los campos mientras el bot está funcionando.

Los indicadores muestran por separado si el bot está encendido, si WhatsApp
está vinculado y si la clave y el modelo de OpenAI son accesibles. Cuando no
existe una sesión, el QR aparece dentro del panel. En la pestaña **Avanzado** se
puede desvincular este equipo y generar un QR nuevo mediante una acción con
confirmación.

Cada guardado conserva hasta diez respaldos privados de `.env` dentro de
`.local/config-backups`. En escritorios Linux se puede generar un lanzador local:

```bash
./scripts/install-desktop-launcher.sh
```

Si el proyecto cambia de carpeta, ejecuta nuevamente ese comando para actualizar
la ruta del lanzador.

## Primer inicio y vinculación

Antes de conectar WhatsApp, valida el código y la configuración:

```bash
npm run check
npm run lint
npm test
```

Después inicia el bot desde la raíz del proyecto:

```bash
npm start
# o
node src/index.js
```

Desde `src`:

```bash
node index.js
```

Las tres formas usan el `.env`, el Vault y `auth_session` ubicados en la raíz.
Si no existe una sesión, abre WhatsApp en el teléfono, entra a Dispositivos
vinculados y escanea el código QR mostrado en la consola.

Cuando aparezca el mensaje de conexión, detén el proceso con `Ctrl+C` y ejecuta:

```bash
npm run diagnostics
```

El diagnóstico debe mostrar la configuración, el Vault, las FAQs y la sesión de
WhatsApp como correctos. Antes de vincular el QR es normal que informe que la
sesión todavía no existe.

Las modificaciones posteriores en `Vault/FAQs` se leen al procesar cada consulta;
no es necesario reinstalar dependencias ni reconstruir el proyecto.

## Atención humana

Cuando una consulta requiere intervención, el cliente recibe un mensaje de
derivación y el encargado recibe el nombre disponible, identificador del chat,
consulta, motivo y hora. El bot no intenta recuperar ni compartir el número
telefónico del cliente. El archivo queda con
`awaiting_human: true`, por lo que la IA no vuelve a responder durante esa
conversación activa.

Cada alerta se guarda antes de enviarse en `data/pending-human-alerts.json`, con
permisos privados y escritura atómica. Si el envío falla, se reintenta cada minuto
y al reconectar WhatsApp. Si el programa o el equipo se reinician, los avisos
pendientes se recuperan y envían al conectar, sin esperar otro mensaje del cliente.
La hora del aviso corresponde a la consulta original y la pausa se guarda antes
de intentar notificar. Solo se mantiene el aviso pendiente más reciente por chat.

La cola evita envíos simultáneos de una misma alerta. Una interrupción justo
después de que WhatsApp la acepte y antes de guardar la confirmación todavía
puede producir un aviso repetido al reiniciar. Si el archivo de pendientes está
dañado, el arranque se detiene con un error visible y lo conserva para diagnóstico.
Los audios siguen procesándose solo en RAM: su reenvío no se recupera tras un
reinicio; esta persistencia corresponde al aviso de texto para el encargado.

Los mensajes normales también tienen entrega de al menos una vez: si WhatsApp
acepta un envío y la conexión se corta antes de devolver la confirmación, el
reintento puede producir excepcionalmente un mensaje duplicado. Mantener el
reintento evita perder respuestas durante fallos breves de conexión.

Si el encargado responde manualmente desde el WhatsApp del glamping antes que el
bot, el lote pendiente o la respuesta que OpenAI esté preparando se cancela y el
mensaje se registra como `Encargado`.
La automatización se habilita nuevamente dos horas después de la derivación. Los
mensajes posteriores del cliente o del encargado no reinician ese plazo. El bot
no puede observar la conversación que el encargado mantenga desde su número
personal. Los mensajes enviados desde el WhatsApp del glamping a contactos que
no tengan una conversación administrada por el bot se ignoran y no generan
archivos en `Vault/Chats`. También se ignoran mensajes manuales antiguos recibidos
durante la sincronización inicial: solo se registra una respuesta posterior al
inicio actual cuando existe una derivación activa o un mensaje pendiente. Este
registro no genera una línea adicional en la consola.

## Organización del Vault

Las respuestas autorizadas de cada instalación viven en los documentos Markdown
de `Vault/FAQs`. El repositorio incluye
`Vault/FAQs/Información del Glamping.md`, una plantilla genérica sin datos reales
para completar con la información confirmada de cada negocio.
`Vault/Chats` contiene datos privados de clientes y nunca se utiliza como fuente
de respuestas.

### Retención y eliminación de chats

La política predeterminada considera eliminables los chats con más de 180 días
desde su último mensaje. Ningún chat se borra automáticamente. Para revisar el
estado sin modificar archivos:

```bash
npm run chats -- list
npm run chats -- prune
```

El segundo comando muestra qué archivos se eliminarían. Para confirmar la
limpieza o eliminar una conversación específica:

```bash
npm run chats -- prune --apply
npm run chats -- delete 569XXXXXXXX@s.whatsapp.net --apply
```

Sin `--apply`, cualquier operación de eliminación es solo una simulación.

No escribas en las FAQs claves, credenciales, datos de pago ni información
privada de huéspedes. Toda información marcada como pendiente provoca una
derivación humana y nunca debe ser inventada por el bot.

Los documentos internos con información pendiente deben mantenerse localmente,
por ejemplo en `docs/private/` o en un archivo ignorado por Git. Deben permanecer
fuera de `Vault/FAQs` para que el bot no los utilice como respuestas confirmadas.

## Seguridad y datos privados

- `.env`, otros archivos `.env.*` (excepto `.env.example`), `auth_session`, todo
  el `Vault` real, `data` y la documentación privada están excluidos de Git. La
  copia pública sí incluye un `Vault/FAQs` genérico y rellenable.
- `.env`, las credenciales y los chats usan permisos privados en el equipo.
- Un candado local impide que dos procesos utilicen simultáneamente la misma
  carpeta `auth_session`; un candado obsoleto se limpia en el siguiente inicio.
- Los mensajes internos de `libsignal` que contienen claves temporales no se
  imprimen porque pueden exponer material sensible. Durante el arranque, el bot
  identifica el dispositivo exacto que produjo un `MessageCounterError` o
  `BadMACError`, mueve solamente sus archivos de sesión a
  `auth_session/.session-repair-quarantine` y reconecta antes de atender. La
  reparación admite dos intentos por dispositivo para evitar ciclos infinitos;
  si el problema continúa, informa el error de manera segura y visible. Se
  conservan como máximo las cuatro cuarentenas más recientes; cuando se crea una
  quinta, se elimina automáticamente la más antigua.
- Los cambios se realizan directamente en la carpeta local del proyecto.
- Nunca copies `.env`, `auth_session`, `data` ni `Vault/Chats` dentro de otro
  proyecto o repositorio, aunque sea privado.
- Si una clave pudiera haber salido del equipo, revócala y genera una nueva.
- Cualquier respaldo de datos privados debe guardarse cifrado y por separado.

## Verificación

```bash
npm run check
npm run lint
npm test
npm audit --omit=dev
npm run diagnostics
```

`npm run check` valida la sintaxis, `npm run lint` detecta errores estáticos y
`npm run diagnostics` comprueba localmente configuración, permisos, sesión,
Vault, FAQs, retención y umbral de audios sin llamar a OpenAI ni WhatsApp.
`npm test` comprueba configuración,
persistencia, seguridad del historial, contexto completo de las FAQs, tipos de
mensajes, reintentos de alertas, deduplicación y límites de uso. Incluye procesos
aislados que ejecutan `src/index.js` con WhatsApp y OpenAI simulados: agrupación,
seguimiento, máximo de historial, intervención manual, audios y recuperación de
avisos después de una terminación abrupta. Las pruebas no envían mensajes reales
ni consumen tokens de OpenAI.

El workflow `.github/workflows/ci.yml` ejecuta sintaxis, lint, pruebas y auditoría
de dependencias con Node 24 y 26 cuando el proyecto público recibe un push o pull
request. Una vulnerabilidad detectada hace fallar su comprobación correspondiente.

Los logs incluyen identificadores de contacto parcialmente ocultos y la duración
de cada solicitud a OpenAI, lo que permite detectar lentitud sin imprimir la
consulta del cliente ni el contenido de las FAQs.

## Funcionamiento continuo con systemd

`deploy/whatsapp-bot.service` utiliza `[USER]` como marcador. Antes de instalarlo,
reemplaza todas sus apariciones por el usuario Linux que ejecutará el bot. Comprueba
también `node --version` y `command -v node`: `ExecStart` debe usar la ruta absoluta
del Node 24 LTS instalado (con nvm no suele ser `/usr/bin/node`).

Vincular WhatsApp primero con `npm start` y detenerlo con Ctrl+C. Luego:

```bash
sudo install -m 644 deploy/whatsapp-bot.service /etc/systemd/system/whatsapp-bot.service
sudo systemctl daemon-reload
sudo systemctl enable --now whatsapp-bot.service
sudo systemctl status whatsapp-bot.service
sudo journalctl -u whatsapp-bot.service -n 100 --no-pager
```

El servicio se inicia al encender el equipo y reinicia el proceso tras un fallo,
con una espera de 15 segundos. Se limita a cinco arranques en cinco minutos para
evitar ciclos por una configuración inválida o una sesión que requiere intervención.
Después de corregir un fallo repetido, ejecutar `sudo systemctl reset-failed
whatsapp-bot.service` y `sudo systemctl start whatsapp-bot.service`.

Mientras el servicio esté activo, no iniciar otra copia con `npm start`. Para
actualizar: detenerlo con `sudo systemctl stop whatsapp-bot.service`, aplicar los
cambios directamente en este proyecto, actualizar dependencias con `npm ci`,
ejecutar las verificaciones y arrancarlo otra vez. Los logs quedan en journald,
cuya retención administra el sistema. Este repositorio incluye el servicio
permanente listo para adaptar, pero no lo instala ni lo activa automáticamente.
El archivo usa el marcador `[USER]` para evitar publicar rutas de un equipo
particular. Su estructura fue validada con `systemd-analyze verify`; cada usuario
debe reemplazar el marcador y comprobar el inicio automático en su propio sistema.

## Uso diario

Los comandos principales cuando se utiliza `systemd` son:

```bash
sudo systemctl status whatsapp-bot.service
sudo systemctl restart whatsapp-bot.service
sudo systemctl stop whatsapp-bot.service
sudo systemctl start whatsapp-bot.service
sudo journalctl -u whatsapp-bot.service -f
```

No ejecutes `npm start` mientras el servicio esté activo: el candado del proyecto
impide que dos procesos utilicen simultáneamente la misma sesión de WhatsApp.

Para actualizar una instalación existente:

```bash
sudo systemctl stop whatsapp-bot.service
npm ci
npm run check
npm run lint
npm test
npm run diagnostics
sudo systemctl start whatsapp-bot.service
```

Conserva el `.env`, `Vault`, `auth_session` y `data` existentes. No vuelvas a
copiar `.env.example` ni la FAQ genérica sobre una instalación configurada.

## Problemas frecuentes

- **No aparece el QR:** elimina la sesión solamente si deseas desvincular el
  dispositivo y volver a enlazarlo. Antes revisa los logs, porque borrar
  `auth_session` obliga a escanear un QR nuevo.
- **OpenAI rechaza una consulta:** comprueba la API key, el modelo, la facturación
  y los límites de la cuenta. `npm run diagnostics` valida el formato local, pero
  no realiza una consulta pagada.
- **WhatsApp está desconectado:** revisa Internet y los logs. El bot intenta
  reconectarse automáticamente.
- **El servicio falla repetidamente:** corrige primero el error mostrado y ejecuta
  `sudo systemctl reset-failed whatsapp-bot.service` antes de iniciarlo nuevamente.
- **Las respuestas no contienen información nueva:** confirma que el dato esté
  guardado como información válida dentro de `Vault/FAQs` y no en `Vault/Chats`.
- **El diagnóstico informa que falta la sesión:** inicia el bot manualmente y
  vincula WhatsApp mediante el código QR.
- **Se necesita eliminar chats antiguos:** usa primero `npm run chats -- prune`.
  El borrado solo ocurre cuando se repite el comando con `--apply`.

## Características de la versión 1.5.2

- Servicio permanente de `systemd` incluido para funcionamiento 24/7, con
  instalación opcional y manual.
- Panel local para configurar, iniciar, detener y revincular el bot.
- Estados separados para el proceso, la sesión de WhatsApp y OpenAI.
- Compatibilidad con varios encargados y reintentos sin duplicar avisos ya entregados.
- Reenvío de audios de 10 segundos o más al encargado.
- Gestión segura y confirmada de retención de conversaciones.
- Diagnóstico local, ESLint y verificación continua para Node 24 y 26.
- Cola independiente por contacto, seguridad de carpetas y registros operativos.
- Configuración genérica mediante `VAULT_PATH`.
- Instrucciones para Arch Linux, Debian/Ubuntu y Fedora.
- Persistencia de alertas humanas y recuperación después de reinicios.
- Protección frente a sesiones cifradas dañadas y procesos duplicados.
- Compatibilidad con modelos GPT-5 que no admiten el parámetro `temperature`.

## Licencia

Copyright (C) 2026 Javier Balcazar

Este proyecto se distribuye bajo la **GNU Affero General Public License v3.0 o
posterior** (`AGPL-3.0-or-later`). Puedes usar, estudiar, modificar y redistribuir
el programa bajo sus condiciones. Si ofreces una versión modificada para que
otras personas interactúen con ella mediante una red, debes ofrecerles también
el código fuente correspondiente conforme a la licencia.

Consulta el texto completo en [LICENSE](LICENSE) y la
[información oficial de GNU](https://www.gnu.org/licenses/agpl-3.0.html).
