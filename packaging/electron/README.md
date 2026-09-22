# Aplicación de escritorio AppImage

Auscultor se distribuye como una única AppImage x86_64. El paquete incluye Electron, Chromium, Node.js y las dependencias de ejecución.

## Uso

1. Descarga `Auscultor-v…-x86_64.AppImage` desde GitHub Releases.
2. Ejecuta `chmod +x Auscultor-v*.AppImage`.
3. Abre la AppImage o intégrala con Gear Lever.

Cerrar la ventana oculta Auscultor en la bandeja para que el bot pueda continuar activo. Desde el icono de la bandeja puedes volver a mostrar la ventana o elegir **Salir**. Al salir, Auscultor detiene el proceso del bot de forma segura.

Todos los datos se guardan bajo `~/.local/share/Auscultor`, incluida la información interna de Electron en `.desktop`. Las actualizaciones de la AppImage no reemplazan esa carpeta.

Las versiones 1.7.1 y posteriores incorporan información `gh-releases-zsync`. Gear Lever puede consultar la última release pública, descargar solamente los bloques modificados y reemplazar la AppImage. La primera versión compatible debe importarse manualmente; después Gear Lever puede detectar las siguientes versiones.

## Construcción

El equipo de construcción necesita Node.js 24 a 26, npm, Python 3, herramientas de compilación y `zsyncmake` (paquete `zsync`).

```bash
npm ci
npm run desktop:build
```

La compilación local deja en la carpeta hermana `Auscultor-AppImages` la AppImage y su archivo `.AppImage.zsync`. El script inserta y verifica esta información dentro de `.upd_info`:

```text
gh-releases-zsync|javierbalcazars|auscultor|latest|Auscultor-v*-x86_64.AppImage.zsync
```

El `.zsync` se genera después de insertar los metadatos para que sus hashes correspondan exactamente al binario publicado. Electron, electron-builder y zsync no deben instalarse en el equipo del usuario final.
