// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBvRzi4aDOgzdTHtnQmJh_fRh3kqurBXeA",
  authDomain: "combiapp-e585a.firebaseapp.com",
  projectId: "combiapp-e585a",
  messagingSenderId: "884793176289",
  appId: "1:884793176289:web:7402bda2ef660077c607a0"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png', // opcional
  });
});
