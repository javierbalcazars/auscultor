# Inicio automático opcional con systemd

Esta carpeta no interviene en la instalación ni en el uso normal de Auscultor.
Úsala solamente si el equipo debe iniciar el bot automáticamente al encenderse.

## Antes de instalar

1. Configura y prueba Auscultor desde el Panel de Control.
2. Detén el bot desde el panel.
3. No vuelvas a iniciarlo desde el panel mientras el servicio esté activo.

## Instalar

Desde la raíz del proyecto:

```bash
bash opcional/systemd/instalar-servicio.sh
```

El instalador detecta automáticamente el usuario, la carpeta del proyecto y el
ejecutable de Node.js. Pedirá la contraseña de `sudo` para copiar y activar el
servicio.

## Estado y registros

```bash
sudo systemctl status auscultor.service
sudo journalctl -u auscultor.service -f
```

## Detener temporalmente

```bash
sudo systemctl stop auscultor.service
```

## Desinstalar

```bash
bash opcional/systemd/desinstalar-servicio.sh
```

Después de desinstalarlo puedes volver a iniciar el bot normalmente desde el
Panel de Control.
