# 🚌 CombiApp – Escuela Técnica Roberto Rocca (ETRR) Campana

**CombiApp** es una aplicación web desarrollada para gestionar y coordinar de manera eficiente el uso diario de una combi institucional utilizada docentes y personal de la **Escuela Técnica Roberto Rocca**. 

Permite a cada usuario registrar si utilizará el servicio, en qué parada subirá y con qué frecuencia, al tiempo que brinda un resumen visual y dinámico del uso del día, incluyendo un mapa de ubicación en tiempo real para optimizar la logística del viaje.

---

## 🚀 Funcionalidades principales

- ✅ Registro semanal del uso de la combi.
- 📍 Selección personalizada de parada por día.
- 🔁 Marcado de viajes como **recurrentes** o únicos.
- 📊 Resumen del día:
  - Lista de pasajeros por parada.
  - Usuarios que **no viajan**.
  - Usuarios que **no respondieron**.
- 📡 Compartir ubicación en tiempo real (**un usuario a la vez**).
- 🗺️ Visualización del recorrido en un **mapa en vivo** actualizado cada 30 segundos.
- 🔔 Notificaciones automáticas para todos los usuarios si hay cambios entre las **05:00 y las 08:30 hs**.

---

## 🧠 Flujo de uso

1. El usuario inicia sesión con su cuenta Google institucional.
2. Completa su plan semanal de viaje indicando:
   - Si utilizará o no la combi.
   - En qué parada se subirá.
   - Si es un viaje **recurrente**.
3. Desde el botón *Resumen del día* accede a:
   - La lista de todos los pasajeros, organizada por parada.
   - Información sobre quién **no viaja** o aún **no respondió**.
4. Si nadie está compartiendo ubicación, se ofrece la opción para hacerlo.
5. Si alguien está compartiendo ubicación, todos podrán ver su posición actual en un mapa.

---

## 💻 Tecnologías utilizadas

- React + Bootstrap
- Firebase:
  - Firestore
  - Authentication
  - Cloud Messaging
- Leaflet + React Leaflet (para mapas en tiempo real)
- Notificaciones Web Push (FCM)

---

## 📦 Instalación y uso local

1. Clonar el repositorio:

   ```bash
   git clone https://github.com/tu-usuario/combiapp.git
   cd combiapp

2. Instalar dependencias
    
    npm install

3. Ejecutar la aplicación 
    
    npm start

🔧 Recordá configurar tu proyecto de Firebase y colocar tus credenciales en el bloque firebaseConfig.

🔐 Seguridad y control
Solo usuarios autenticados pueden acceder a la app.

Cada usuario visualiza su propio plan de viaje.

La ubicación solo se comparte si es autorizada explícitamente.

El sistema impide que haya más de un usuario compartiendo ubicación al mismo tiempo.

📍 Sobre el proyecto
Este desarrollo forma parte de una iniciativa educativa y organizacional de la Escuela Técnica Roberto Rocca (ETRR) – Campana, para mejorar la logística del transporte institucional, promoviendo el uso de tecnologías modernas, el cuidado del tiempo y la colaboración.

🙌 Créditos
Desarrollado por: Israel Pavelek
Dirección: Escuela Técnica Roberto Rocca – Campana
Contacto: [📧 ipavelek@etrr.edu.ar]