# Imagen base de Node (ligera, alpine)
FROM node:20-alpine

# Carpeta de trabajo dentro del contenedor
WORKDIR /app

# Copiamos primero los manifiestos e instalamos dependencias.
# (Se hace antes de copiar el código para aprovechar la caché de Docker.)
COPY package*.json ./
RUN npm install

# Copiamos el resto del código
COPY . .

# Puerto en el que escucha Express
EXPOSE 3001

# Arranque en modo desarrollo (nodemon recarga al guardar cambios)
CMD ["npm", "run", "dev"]
