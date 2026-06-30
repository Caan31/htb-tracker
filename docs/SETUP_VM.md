# Guía de instalación: VM Ubuntu + Docker para HTB Tracker

Objetivo: tener una máquina virtual con Ubuntu Server donde corra Docker, para
levantar el proyecto con `docker compose up`. Tú accederás desde el navegador de
tu Windows (host) a `http://localhost:8080` (Adminer) y, más adelante, a
`http://localhost:3000` (la app).

---

## 0. ¿VM o alternativa más rápida?

El proyecto está pensado para una **VM con Ubuntu Server**, y esta guía sigue ese
camino. Si algún día quieres algo más ligero, dos alternativas (no necesitas
hacerlas ahora):

- **WSL2** en Windows: Ubuntu integrado sin VM completa. Más rápido, menos aislado.
- **Docker Desktop** en Windows: sin Ubuntu, Docker directo. El más simple, pero
  te saltas el aprendizaje de administrar un servidor Linux.

Seguimos con la VM porque es lo más parecido a un servidor real.

---

## 1. Hipervisor (en Windows)

Un *hipervisor* es el programa que crea y ejecuta máquinas virtuales.
Esta guía asume **VMware Workstation** (gratis para uso personal). Si usaras
VirtualBox los conceptos son iguales, solo cambian los menús.

---

## 2. Descargar la imagen de Ubuntu Server

1. Ve a https://ubuntu.com/download/server
2. Descarga **Ubuntu Server 24.04 LTS** (LTS = soporte largo, muy estable).
   - También existe la 26.04 LTS (abril 2026); para Docker ambas valen. Si quieres
     máxima madurez probada, quédate en la 24.04.
3. Guardas un archivo `.iso` (es el "disco de instalación").

---

## 3. Crear la máquina virtual en VMware

1. VMware → **Create a New Virtual Machine**.
2. Selecciona la ISO de Ubuntu Server descargada.
3. Nombre: `htb-server`.
4. Recursos recomendados:
   - **CPU**: 2 núcleos
   - **RAM**: 4 GB (4096 MB); 8 GB si tu PC lo permite
   - **Disco**: 30 GB
5. **Red**: deja **NAT** (es la opción por defecto y la recomendada). En VMware,
   tu Windows puede llegar directamente a la IP de la VM por la red NAT (VMnet8),
   así que NO necesitas reenvío de puertos para acceder desde tu propio PC.
   - El reenvío de puertos solo hace falta si quieres usar `localhost` o exponer
     la VM a otros equipos de tu red. Se configura en Workstation Pro:
     Editar → **Editor de red virtual** → VMnet8 → NAT Settings → Port Forwarding.

---

## 4. Instalar Ubuntu dentro de la VM

1. Arranca la VM; carga el instalador de Ubuntu Server.
2. Sigue el asistente: idioma, teclado, red (deja DHCP), almacenamiento (usar todo
   el disco).
3. En "Profile setup" crea tu usuario (recuerda el nombre y la contraseña).
4. **Marca "Install OpenSSH server"** (te permitirá conectarte cómodamente desde
   Windows con SSH y copiar archivos).
5. Termina, reinicia y entra con tu usuario.

---

## 5. Actualizar el sistema

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 6. Instalar Docker Engine + Docker Compose (método oficial)

Copia y pega estos bloques en la terminal de la VM, en orden.

**a) Requisitos y clave GPG de Docker:**
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

**b) Añadir el repositorio de Docker:**
```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
```

**c) Instalar Docker, la CLI y el plugin de Compose:**
```bash
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

**d) Comprobar que funciona:**
```bash
sudo docker run hello-world
```
Si ves un mensaje "Hello from Docker!", está instalado.

---

## 7. Usar Docker sin `sudo` (recomendado)

```bash
sudo usermod -aG docker $USER
newgrp docker        # o cierra sesión y vuelve a entrar
docker compose version
```

---

## 8. Llevar el proyecto a la VM

Tres formas; elige una:

- **Git (recomendada cuando subas el repo):**
  ```bash
  git clone <url-de-tu-repo> htb-tracker
  cd htb-tracker
  ```
- **SCP desde Windows** (PowerShell), si tienes la carpeta en tu PC:
  ```powershell
  scp -r "C:\Users\Usuario\Documents\Claude\Projects\HTB MAQUINAS" usuario@IP_DE_LA_VM:~/htb-tracker
  ```
- **Carpeta compartida** de VirtualBox (Dispositivos → Carpetas compartidas).

---

## 9. Levantar la base de datos

Dentro de la carpeta del proyecto en la VM:
```bash
cp .env.example .env      # y edita la contraseña si quieres
docker compose up -d db adminer
docker compose ps         # db y adminer deben salir como "running"/"healthy"
```

---

## 10. (Recomendado en VMware) Fijar IP estática

En VMware NAT accedes a la VM por su IP directa, así que conviene fijarla para que
el DHCP no te la cambie. Primero descubre tu subred dentro de la VM:

```bash
ip a        # interfaz (suele ser ens33) e IP actual, p.ej. 192.168.x.128
ip route    # puerta de enlace, normalmente 192.168.x.2
```

Edita netplan:
```bash
sudo nano /etc/netplan/50-cloud-init.yaml
```
```yaml
network:
  version: 2
  ethernets:
    ens33:
      dhcp4: no
      addresses: [192.168.x.10/24]      # tu subred, IP baja fuera del pool DHCP
      routes:
        - to: default
          via: 192.168.x.2              # tu puerta de enlace (acaba en .2)
      nameservers:
        addresses: [192.168.x.2, 8.8.8.8]
```
```bash
sudo netplan apply
```

> El pool DHCP de VMware NAT suele empezar en `.128`; por eso una IP baja como
> `.10` es segura. Mantén la subred (los tres primeros octetos) igual que la que
> viste con `ip a`.

---

## 11. Comprobar la conexión

Desde el navegador de tu **Windows**: `http://IP_DE_LA_VM:8080`
(la IP que fijaste, p.ej. `http://192.168.x.10:8080`).

En Adminer: Motor = PostgreSQL, Servidor = `db`, Usuario/Contraseña/Base de datos
= los de tu `.env`. Si entras y ves la base `htb_tracker` vacía, ¡conexión OK!

---

## Resumen de puertos

| Servicio  | Puerto | Para qué |
|-----------|--------|----------|
| PostgreSQL| 5432   | Base de datos |
| Adminer   | 8080   | Visor web de la BD |
| Backend   | 3001   | API (Fase 2) |
| Frontend  | 3000   | La app (Fase 3) |
