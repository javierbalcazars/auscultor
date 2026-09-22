<p align="center"><img src="assets/auscultor.svg" width="112" alt="Icono de Auscultor"></p>

# Auscultor

**Asistente inteligente para alojamientos y turismo.**
Versión actual: **1.9.1**.

Auscultor atiende consultas por WhatsApp para alojamientos, campings, hostales,
cabañas, parques y otros negocios turísticos. Responde usando exclusivamente la
información confirmada que el administrador mantiene desde el Panel de Control y
deriva a una persona cuando falta información o se necesita una acción manual.

Está pensado para funcionar en un PC Linux que permanezca encendido y conectado
a Internet. Puede ser un equipo dedicado o un computador de uso cotidiano.

## Funciones principales

- Panel local para configurar todo el asistente sin editar archivos.
- Inicio y detención del bot desde una ventana de escritorio.
- Vinculación de WhatsApp mediante QR y estados visibles.
- Edición, creación y eliminación segura de FAQs desde el panel.
- Plantillas para horarios, ubicación, tarifas, reservas, servicios y políticas.
- Derivación a uno o más encargados humanos.
- Reenvío de audios largos y límites de uso configurables.
- Respaldos locales de configuración y FAQs.
- Diagnóstico, métricas, respaldos cifrados y restauración desde el panel.

> Auscultor utiliza Baileys y no la API oficial de WhatsApp Business. WhatsApp
> puede cambiar su funcionamiento interno y requerir futuras actualizaciones.


## Descargar y ejecutar

Auscultor se distribuye como una única aplicación de escritorio para Linux x86_64. La AppImage incluye Electron, Chromium, Node.js, Baileys y las demás dependencias: el usuario no necesita instalar Node, npm, Python, Git ni compiladores.

1. Abre **Releases** en GitHub.
2. Descarga `Auscultor-v1.9.1-x86_64.AppImage`.
3. Dale permiso de ejecución:

```bash
chmod +x Auscultor-v1.9.1-x86_64.AppImage
```

4. Ábrela con doble clic o ejecuta:

```bash
./Auscultor-v1.9.1-x86_64.AppImage
```

Auscultor abre una ventana propia, elige automáticamente un puerto local libre y permanece en la bandeja cuando se cierra la ventana. Desde el icono de la bandeja puedes volver a mostrarla o elegir **Salir**, lo que detiene el bot de forma segura.

Los únicos requisitos externos son Linux x86_64, conexión a Internet, una cuenta de WhatsApp y una API key de OpenAI activa. Los datos se conservan en `~/.local/share/Auscultor`, incluso al reemplazar la AppImage por una actualización.

A partir de la versión 1.7.1, la AppImage incorpora información de actualización compatible con Gear Lever. Después de importar esta versión manualmente, Gear Lever puede detectar las releases posteriores desde GitHub y aplicar actualizaciones diferenciales mediante `.zsync`.

Quienes desarrollen Auscultor desde el código fuente necesitan Node.js 24 a 26, npm, Git, Python 3 y herramientas de compilación. La guía técnica de construcción está en [packaging/electron/README.md](packaging/electron/README.md).

## Primer uso

La primera vez, el panel muestra una bienvenida y guía la configuración:

1. Escribe el nombre del negocio.
2. Ingresa la API key y selecciona el modelo de OpenAI.
3. Agrega los números de los encargados humanos.
4. Ajusta tiempos y límites o conserva los valores recomendados.
5. Abre **Información del negocio** y completa las FAQs.
6. Guarda la configuración.
7. Presiona **Iniciar bot**.
8. Escanea el QR desde WhatsApp → **Dispositivos vinculados**.

La configuración avanzada tiene valores seguros predeterminados. No necesitas
crear ni editar `.env` manualmente.

## Panel de Control

Abre la AppImage para mostrar el Panel de Control en su propia ventana. El servidor interno escucha exclusivamente en `127.0.0.1` y selecciona un puerto libre automáticamente; no queda expuesto a otros equipos de la red.

El selector de la barra superior permite usar todo el panel en **español o inglés**. La preferencia queda guardada para las próximas aperturas.

### Secciones

- **Configuración:** negocio, Vault, API key, modelo, encargado principal y vinculación de WhatsApp.
- **Personas:** encargados y números ignorados.
- **Tiempos y límites:** demora, audios, pausas, retención y frecuencia.
- **Contenido:** información confirmada que Auscultor puede usar al responder.
- **Herramientas:** diagnóstico, métricas, límites técnicos, respaldos cifrados, restauración y desvinculación de WhatsApp.
- **Info:** versión, edición instalada, licencia y enlaces oficiales del proyecto.

La tarjeta **Info** obtiene el avatar del creador desde GitHub y conserva la última copia válida para poder mostrarla sin conexión a Internet.

La configuración, los respaldos y la restauración se bloquean mientras el bot está encendido. El contenido del negocio puede
editarse en cualquier momento y los cambios se aplican en la siguiente consulta.

### Contenido del negocio

La pestaña **Contenido** permite:

- Agregar temas o comenzar desde plantillas guiadas para información principal, ubicación, horarios, tarifas, reservas, servicios y normas.
- Buscar, editar, renombrar y eliminar temas sin administrar archivos manualmente.
- Ocultar la lista de temas para utilizar todo el ancho del editor.
- Detectar cambios sin guardar y evitar que una plantilla incompleta llegue al bot.
- Mantener sincronizados el título visible y el encabezado interno del contenido.

Antes de modificar o eliminar un tema se guarda una copia privada en
`.local/faq-backups`. El panel solo puede acceder a `Vault/FAQs`; nunca permite
abrir conversaciones, sesiones o archivos arbitrarios.

No incluyas claves, datos de pago ni información privada de clientes en las
respuestas. Escribe únicamente información que el bot esté autorizado a comunicar.

## Uso cotidiano

El botón superior inicia y detiene el bot. Los indicadores muestran:

- **Bot verde:** proceso encendido.
- **WhatsApp amarillo:** iniciando o esperando el QR.
- **WhatsApp verde:** sesión vinculada.
- **OpenAI verde:** clave y modelo accesibles.

Para cambiar la cuenta vinculada usa **Herramientas → Desvincular y generar QR
nuevo**. Esta acción requiere confirmación.

## Inicio automático opcional

El uso normal no necesita `systemd`. Si quieres que un PC dedicado inicie el bot
automáticamente, consulta [opcional/systemd/README.md](opcional/systemd/README.md).
Todo lo relacionado con el servicio permanente está aislado en esa carpeta y no
se instala automáticamente.

## Seguridad y datos

- `.env`, `auth_session`, `Vault/Chats`, `data` y `.local` quedan fuera de Git.
- La API key no vuelve al navegador ni aparece en los logs.
- La configuración, las sesiones y las conversaciones usan permisos privados.
- Un candado impide abrir dos procesos sobre la misma sesión.
- Las conversaciones nunca se usan como fuente de respuestas.
- Ningún chat se elimina automáticamente.

## Herramientas avanzadas

Estas funciones son opcionales y no se necesitan para el uso diario:

```bash
npm run diagnostics
npm run metrics
npm run chats -- list
npm run evals
npm run backup -- --help
```

Para desarrollo:

```bash
npm run check
npm run lint
npm test
npm audit --omit=dev
```

## Problemas frecuentes

- **No aparece el QR:** inicia el bot; si ya existe una sesión, WhatsApp se
  conectará sin mostrarlo.
- **OpenAI aparece en rojo:** revisa clave, modelo, conexión y facturación.
- **El bot no conoce un dato:** agrégalo en **Contenido**.
- **Moviste la carpeta:** vuelve a ejecutar `scripts/install-desktop-launcher.sh`.
- **El panel no abre:** revisa `.local/admin-panel.log`.

## Licencia

Copyright (C) 2026 Javier Balcazar

Auscultor se distribuye bajo la **GNU Affero General Public License v3.0 o
posterior** (`AGPL-3.0-or-later`). Consulta [LICENSE](LICENSE) para leer el texto
completo.
