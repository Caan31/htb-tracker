# Imagen base de Node (ligera)
FROM node:20-alpine

WORKDIR /app

# Instalamos dependencias primero (aprovecha la caché de Docker)
COPY package*.json ./
RUN npm install

# Copiamos el resto del código
COPY . .

# Puerto del servidor de desarrollo de Vite
EXPOSE 3000

# Arranque en modo desarrollo (con hot-reload)
CMD ["npm", "run", "dev"]
