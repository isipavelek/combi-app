importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBvRzi4aDOgzdTHtnQmJh_fRh3kqurBXeA",
  authDomain: "combiapp-e585a.firebaseapp.com",
  projectId: "combiapp-e585a",
  storageBucket: "combiapp-e585a.firebasestorage.app",
  messagingSenderId: "884793176289",
  appId: "1:884793176289:web:7402bda2ef660077c607a0",
  measurementId: "G-QNHCT5VXK8"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
