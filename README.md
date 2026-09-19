# Auscultor

Asistente inteligente para alojamientos y turismo.

Versión actual: **1.6.0**.

Atiende consultas simples por WhatsApp para alojamientos, campings, hostales,
cabañas, arriendos turísticos, parques y otros negocios de turismo o atención a
visitantes. Usa las notas Markdown de `Vault/FAQs` como fuente de información y,
cuando no existe una respuesta confirmada o se requiere una acción manual, deriva
la conversación a un encargado.

El programa está pensado principalmente para instalarse en un PC dedicado que
funcione como bot de atención de WhatsApp las 24 horas, todos los días. También
puede utilizarse en un computador de uso cotidiano, siempre que permanezca
encendido, conectado a Internet y sin suspender ni cerrar el proceso durante el
horario en que se espera atención automática. Para una operación continua se
recomienda un equipo exclusivo y ejecutar el programa como servicio de `systemd`.

La versión 1.6.0 incluye un panel local pensado para usar el bot como una
aplicación de escritorio. Desde una sola pantalla se configura el negocio, se
inicia o detiene el bot, se escanea el QR y se comprueba WhatsApp y OpenAI.

## Cómo funciona

1. El bot se conecta a WhatsApp como un dispositivo vinculado.
2. Agrupa los mensajes consecutivos de cada contacto para responder una sola vez.
3. Consulta la información confirmada guardada en `Vault/FAQs` y el historial
   reciente de esa conversación.
4. OpenAI redacta una respuesta usando únicamente esa información.
5. El bot responde y guarda el registro privado en `Vault/Chats`.
6. Si faltan datos, hay un reclamo o se necesita una acción manual, avisa a los
   encargados y pausa la respuesta automática para ese contacto.

Admite textos y descripciones incluidas en imágenes, videos o documentos. Los
audios de 10 segundos o más se reenvían a los encargados; los más cortos deben
enviarse por escrito. Ignora grupos, estados, canales, difusiones, reacciones y
mensajes duplicados.

> La conexión utiliza Baileys y no la API oficial de WhatsApp Business. Es
> apropiada para proyectos pequeños, pero puede requerir ajustes si WhatsApp
> cambia su funcionamiento interno.

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

Clona el repositorio e instala las dependencias:

```bash
git clone https://github.com/javierbalcazars/auscultor.git auscultor
cd auscultor
npm ci
./scripts/install-desktop-launcher.sh
```

El último comando crea `Abrir panel.desktop` en la carpeta del proyecto. Ábrelo
con doble clic para configurar el bot. No necesitas crear ni editar `.env`
manualmente: el panel lo genera al guardar por primera vez.

El repositorio incluye `.env.example` como referencia técnica y una FAQ genérica
dentro de `Vault/FAQs`. Conserva siempre tu `.env`, Vault y sesión de WhatsApp
cuando actualices una instalación existente.

## Panel de control local

El panel permite utilizar las funciones principales sin abrir `.env`, ejecutar
comandos repetidamente ni buscar el QR en una terminal. El navegador presenta la
interfaz, mientras un pequeño servidor local realiza de forma segura las lecturas
y escrituras necesarias dentro del proyecto.

### Abrir el panel

Abre `Abrir panel.desktop` con doble clic. El lanzador inicia el servidor local y
abre el navegador automáticamente. Si mueves o renombras la carpeta del proyecto,
ejecuta nuevamente `./scripts/install-desktop-launcher.sh` para actualizar la ruta.

<details>
<summary>Abrir el panel desde una terminal</summary>

```bash
npm run admin
```

Luego visita `http://127.0.0.1:3210` en el mismo equipo.

</details>

### Qué se puede administrar

El panel se organiza en cuatro pestañas:

- **General:** nombre del negocio, ruta del Vault, API key y modelo de OpenAI.
  Incluye nueve modelos predefinidos y una opción manual.
- **Personas:** uno o más asistentes humanos y números que el bot debe ignorar.
- **Tiempos y límites:** demora de respuesta, umbral de audios, pausa por atención
  humana, retención de chats y límites de frecuencia.
- **Avanzado:** historial, tamaño de entrada, tokens, tiempos técnicos y la acción
  confirmada para desvincular WhatsApp y generar un QR nuevo.

El botón de la parte superior inicia y detiene el proceso. Mientras el bot está
encendido, los campos quedan bloqueados y en color gris para impedir que se
guarde una configuración que el proceso todavía no puede aplicar.

### Estados visibles

| Indicador | Estado | Significado |
| --- | --- | --- |
| Bot | Verde | Bot encendido. |
| Bot | Rojo | Bot apagado. |
| WhatsApp | Verde | El equipo conserva una sesión vinculada. Permanece verde aunque el bot esté apagado. |
| WhatsApp | Amarillo | Iniciando sesión o esperando que se escanee el QR. |
| WhatsApp | Rojo | No existe una sesión vinculada o WhatsApp cerró la sesión. |
| OpenAI API | Verde | La clave fue aceptada y el modelo configurado es accesible. |
| OpenAI API | Rojo | Debes revisar la clave, el modelo o la conexión. |

El QR se muestra solamente cuando hace falta vincular una cuenta. Desaparece al
completarse la conexión. La opción **Desvincular y generar QR nuevo** detiene el
bot, elimina la sesión local después de una confirmación y vuelve a iniciarlo
para presentar otro código.

### Seguridad y respaldos

El panel escucha exclusivamente en `127.0.0.1`, valida el origen de las acciones,
utiliza un token CSRF y nunca devuelve al navegador la API key guardada. La
comprobación de OpenAI consulta el acceso al modelo, pero no envía conversaciones
ni garantiza el saldo disponible para solicitudes posteriores.

> **No expongas el puerto 3210 a Internet ni configures redirección de puertos
> hacia el panel.** Está diseñado exclusivamente para abrirse desde el mismo PC.

Cada guardado valida todos los campos, escribe `.env` con permisos privados y
conserva hasta diez respaldos en `.local/config-backups`. Los estados y registros
del panel también se guardan dentro de `.local`, que queda fuera de Git.

## Primer uso

1. Abre `Abrir panel.desktop`.
2. Completa las pestañas **General**, **Personas**, **Tiempos y límites** y
   **Avanzado**, y guarda la configuración.
3. Edita los documentos de `Vault/FAQs` con información confirmada de tu negocio.
   Puedes agregar, cambiar o quitar archivos `.md` dentro de esa carpeta.
4. Presiona **Iniciar bot** en la parte superior del panel.
5. Si aparece un QR, escanéalo desde WhatsApp en **Dispositivos vinculados**.

El indicador del bot cambia a verde cuando el proceso está encendido. WhatsApp
queda amarillo mientras espera el QR y verde después de vincularse. Las FAQs se
leen nuevamente con cada consulta, por lo que sus cambios no requieren reinstalar
ni reiniciar el programa.

## Atención humana

Cuando una consulta necesita intervención, el cliente recibe un aviso y los
encargados configurados reciben el nombre disponible, identificador del chat,
consulta, motivo y hora. La respuesta automática queda pausada para ese contacto
durante el tiempo configurado.

Los avisos pendientes se guardan antes de enviarse y se recuperan después de una
desconexión o reinicio. Si existen varios encargados, el bot recuerda cuáles ya
recibieron el aviso para no notificarlos nuevamente durante un reintento.

Si alguien responde manualmente desde el WhatsApp del negocio, el bot cancela la
respuesta automática que estuviera preparando y registra la intervención.

## Información del negocio y conversaciones

`Vault/FAQs` contiene la información autorizada que el bot puede usar al
responder. La plantilla incluida debe reemplazarse con datos confirmados del
negocio. No guardes allí claves, datos de pago ni información privada de clientes.

`Vault/Chats` contiene las conversaciones privadas y nunca se utiliza como fuente
de respuestas. Ningún chat se elimina automáticamente.

<details>
<summary>Revisar o eliminar conversaciones antiguas</summary>

```bash
npm run chats -- list
npm run chats -- prune
npm run chats -- prune --apply
```

Los dos primeros comandos no eliminan archivos. La eliminación exige `--apply`.

</details>

## Seguridad y datos privados

- `.env`, `auth_session`, `Vault/Chats`, `data`, `.local` y los documentos
  privados están excluidos de Git.
- La configuración, sesión y conversaciones se guardan con permisos privados.
- Un candado impide que dos procesos utilicen simultáneamente la misma sesión.
- La API key nunca se devuelve al navegador ni se imprime en los logs.
- Los errores criptográficos se registran sin mostrar claves temporales.

Conserva respaldos cifrados de tus datos privados. Si una API key pudiera haber
salido del equipo, revócala y genera otra.

## Verificación técnica

El repositorio se valida automáticamente en GitHub con Node 24 y 26. Para revisar
manualmente una instalación local:

<details>
<summary>Comandos de diagnóstico y pruebas</summary>

```bash
npm run check
npm run lint
npm test
npm audit --omit=dev
npm run diagnostics
```

Estas pruebas no envían mensajes reales ni consumen tokens de OpenAI. El
diagnóstico revisa configuración, permisos, sesión, Vault, FAQs, retención y
umbral de audios.

</details>

Los logs ocultan parcialmente los identificadores de contacto y no imprimen la
consulta del cliente ni el contenido de las FAQs.

### Evaluaciones del asistente

El repositorio incluye casos de evaluación para horarios, ubicación, mascotas,
disponibilidad, pagos y datos ausentes. La validación estructural no llama a
OpenAI ni consume tokens:

```bash
npm run evals
```

Para probar esos casos contra la API y el modelo configurado en `.env`, ejecuta
manualmente `npm run evals:live`. Esa variante sí consume tokens y puede variar
ligeramente entre ejecuciones.

### Métricas locales

El bot acumula en `data/metrics.json` contadores de mensajes, respuestas,
derivaciones, audios, reconexiones, límites y solicitudes a OpenAI. También
registra duración promedio y máxima de las consultas al modelo. No guarda en ese
archivo números, nombres ni contenido de las conversaciones.

```bash
npm run metrics
```

## Respaldo cifrado y restauración

Detén el bot desde el panel antes de respaldar o restaurar para obtener una copia
consistente de `.env`, `auth_session`, `Vault` y `data`. Define una contraseña de
al menos 12 caracteres sin escribirla directamente en el historial de comandos:

```bash
read -s BACKUP_PASSPHRASE
export BACKUP_PASSPHRASE
npm run backup -- create ../respaldo-bot.wbackup
npm run backup -- verify ../respaldo-bot.wbackup
unset BACKUP_PASSPHRASE
```

La restauración exige `--apply` y crea primero otro respaldo cifrado del estado
actual junto al archivo de origen:

```bash
read -s BACKUP_PASSPHRASE
export BACKUP_PASSPHRASE
npm run backup -- restore ../respaldo-bot.wbackup --apply
unset BACKUP_PASSPHRASE
```

Conserva el archivo cifrado y su contraseña en lugares separados. Sin la
contraseña no es posible recuperar el contenido.

## Funcionamiento continuo con systemd

El uso normal de escritorio se controla desde el panel. Para un PC dedicado que
deba iniciar el bot automáticamente al encenderse, el repositorio incluye
`deploy/auscultor.service`.

<details>
<summary>Instalación opcional del servicio permanente</summary>

Reemplaza `[USER]` en el archivo por el usuario Linux que ejecutará el bot y
confirma la ruta mostrada por `command -v node`. Después instala el servicio:

```bash
sudo install -m 644 deploy/auscultor.service /etc/systemd/system/auscultor.service
sudo systemctl daemon-reload
sudo systemctl enable --now auscultor.service
sudo systemctl status auscultor.service
```

Para consultar los logs:

```bash
sudo journalctl -u auscultor.service -f
```

No inicies el bot desde el panel mientras el servicio esté activo. El archivo se
incluye como plantilla validada, pero cada usuario debe comprobarlo en su propio
equipo.

</details>

## Problemas frecuentes

- **No aparece el QR:** el QR solo aparece cuando no existe una sesión. Para
  cambiar de cuenta, usa **Avanzado → Desvincular y generar QR nuevo**.
- **OpenAI rechaza una consulta:** comprueba la API key, el modelo, la facturación
  y los límites de la cuenta. `npm run diagnostics` valida el formato local, pero
  no realiza una consulta pagada.
- **WhatsApp está desconectado:** revisa Internet y los logs. El bot intenta
  reconectarse automáticamente.
- **Las respuestas no contienen información nueva:** confirma que el dato esté
  guardado como información válida dentro de `Vault/FAQs` y no en `Vault/Chats`.
- **WhatsApp aparece en rojo:** presiona **Iniciar bot** y escanea el QR que
  mostrará el panel.
- **Se necesita eliminar chats antiguos:** usa primero `npm run chats -- prune`.
  El borrado solo ocurre cuando se repite el comando con `--apply`.

## Licencia

Copyright (C) 2026 Javier Balcazar

Este proyecto se distribuye bajo la **GNU Affero General Public License v3.0 o
posterior** (`AGPL-3.0-or-later`). Puedes usar, estudiar, modificar y redistribuir
el programa bajo sus condiciones. Si ofreces una versión modificada para que
otras personas interactúen con ella mediante una red, debes ofrecerles también
el código fuente correspondiente conforme a la licencia.

Consulta el texto completo en [LICENSE](LICENSE) y la
[información oficial de GNU](https://www.gnu.org/licenses/agpl-3.0.html).
