# Aplicación de escritorio Electron

Esta variante muestra el panel de Auscultor en una ventana propia. No abre ni requiere usar un navegador externo.

## Uso

1. Descarga `Auscultor-Desktop-…-x86_64.AppImage`.
2. Ejecuta `chmod +x Auscultor-Desktop-*.AppImage`.
3. Abre la AppImage.

Cerrar la ventana oculta Auscultor en la bandeja para que el bot pueda continuar activo. Desde el icono de la bandeja puedes volver a mostrar la ventana o elegir **Salir**. Al salir, Auscultor detiene el proceso del bot de forma segura.

Todos los datos se guardan bajo `~/.local/share/Auscultor`, incluida la información interna de Electron en `.desktop`.

## Construcción

```bash
npm run desktop:build
```

La compilación local deja el resultado en la carpeta hermana `Auscultor-AppImages`. Electron y electron-builder son dependencias de desarrollo y no deben instalarse en el equipo del usuario final.
