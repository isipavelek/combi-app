// CombiApp con resumen, notificaciones, estado de viaje y geolocalización con mapa
import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  Timestamp,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getToken, onMessage } from 'firebase/messaging';
import { app, db, auth, provider, messaging } from './firebaseConfig';
import ResumenViajes from './components/ResumenViajes';
import ResumenUsuario from './components/ResumenUsuario';
import Configuracion from './components/Configuracion';
import Chat from './components/Chat';
import AdminPanel from './components/AdminPanel';
import { getOrderedWeekDays } from './utils/dateUtils';
import { ADMIN_EMAILS } from './constants';
import VerRecorrido from './components/VerRecorrido';

function App() {
  const [user, setUser] = useState(null);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [mostrarAdmin, setMostrarAdmin] = useState(false);
  const [mostrarRecorrido, setMostrarRecorrido] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      console.log("Auth state changed:", u);
      if (u) {
        const emailLower = u.email.toLowerCase();
        
        // Check hardcoded list OR Firestore
        let adminStatus = ADMIN_EMAILS.includes(emailLower);
        
        if (!adminStatus) {
          try {
            const userDoc = await getDoc(doc(db, 'users', emailLower));
            if (userDoc.exists() && userDoc.data().isAdmin) {
              adminStatus = true;
            }
          } catch (e) {
            console.error("Error checking admin status:", e);
          }
        }
        
        setIsUserAdmin(adminStatus);
        setUser(u);

        // FCM Logic
        if (u) {
          try {
            if (Notification.permission === 'granted') {
              // Explicitly register service worker with cache busting
              const swUrl = `/firebase-messaging-sw.js?v=${new Date().getTime()}`;
              const registration = await navigator.serviceWorker.register(swUrl);
              console.log("Service Worker registered:", registration);

              // Wait for the service worker to be active/ready
              const readyRegistration = await navigator.serviceWorker.ready;

              const token = await getToken(messaging, { 
                vapidKey: "BCWyO6hYQZmjF7UoYLUpMrCmbrmIKvDyynVCmUTj_AHu9NZoiSsn1wUyKNrFiMN-MXiF5ZPbooqcrpuktNDc5Lc",
                serviceWorkerRegistration: readyRegistration
              });
              console.log("FCM Token:", token);
              // Save token to user doc
              await setDoc(doc(db, 'users', emailLower), { fcmToken: token }, { merge: true });
            } else if (Notification.permission === 'default') {
              // Do not request automatically to avoid violation
              console.log("Notification permission is default. Waiting for user interaction.");
            }
          } catch (err) {
            console.error("FCM Error:", err);
          }
        }

      } else {
        setUser(null);
        setIsUserAdmin(false);
      }
    });

    // Foreground Message Listener
    onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
      // Use ServiceWorkerRegistration to show notification (required on mobile)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(payload.notification.title, {
            body: payload.notification.body,
            icon: '/logo192.png'
          });
        });
      } else {
        // Fallback for non-SW environments (unlikely in this app)
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: '/logo192.png'
        });
      }
    });

    return () => unsubscribe();
  }, []);
  const [mostrarChat, setMostrarChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [geoActivo, setGeoActivo] = useState(false);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [usuarioUbicacion, setUsuarioUbicacion] = useState(null);
  const [geoInterval, setGeoInterval] = useState(null);

  // Email Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  const [showNotificationButton, setShowNotificationButton] = useState(false);

  useEffect(() => {
    if (Notification.permission === 'default') {
      setShowNotificationButton(true);
    }
  }, []);

  const enableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowNotificationButton(false);
        // Trigger FCM setup manually
        const swUrl = `/firebase-messaging-sw.js?v=${new Date().getTime()}`;
        const registration = await navigator.serviceWorker.register(swUrl);
        const readyRegistration = await navigator.serviceWorker.ready;
        
        const token = await getToken(messaging, { 
          vapidKey: "BCWyO6hYQZmjF7UoYLUpMrCmbrmIKvDyynVCmUTj_AHu9NZoiSsn1wUyKNrFiMN-MXiF5ZPbooqcrpuktNDc5Lc",
          serviceWorkerRegistration: readyRegistration
        });
        
        if (user) {
           await setDoc(doc(db, 'users', user.email.toLowerCase()), { fcmToken: token }, { merge: true });
        }
        alert("✅ Notificaciones activadas correctamente.");
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
      alert("Error al activar notificaciones.");
    }
  };

  // Helper to check if within allowed time (06:30 - 09:00)
  const isTimeAllowed = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const time = hours * 60 + minutes;
    
    const start = 6 * 60 + 30; // 06:30
    const end = 9 * 60;        // 09:00
    
    return time >= start && time < end;
  };

  const iniciarSeguimientoUbicacion = () => {
    if (!isTimeAllowed()) {
      alert("⚠️ Solo se puede compartir ubicación durante el viaje de IDA (06:30 - 09:00).");
      return;
    }

    if ('geolocation' in navigator && user) {
      navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          await setDoc(doc(db, 'ubicaciones', user.email), {
            nombre: user.displayName,
            latitud: lat,
            longitud: lng,
            timestamp: Timestamp.now(),
          });

          await setDoc(doc(db, 'ubicaciones_activa', 'estado'), {
            usuario: user.email,
            timestamp: Timestamp.now(),
          });

          setGeoActivo(true);
          setUsuarioUbicacion(user.email);
        },
        (error) => {
          console.error("❌ Error al obtener ubicación", error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000,
        }
      );
    } else {
      alert("Tu navegador no soporta geolocalización.");
    }
  };

  const detenerSeguimientoUbicacion = async () => {
    if (user) {
      await deleteDoc(doc(db, 'ubicaciones', user.email));
      await deleteDoc(doc(db, 'ubicaciones_activa', 'estado'));
      setGeoActivo(false);
      setUsuarioUbicacion(null);
      if (geoInterval) clearInterval(geoInterval);
    }
  };

  // Auto-stop if outside allowed hours
  useEffect(() => {
    const checkTime = () => {
      if (geoActivo && !isTimeAllowed()) {
        console.log("🛑 Deteniendo ubicación por fuera de horario.");
        detenerSeguimientoUbicacion();
        alert("🕒 Se ha detenido la ubicación compartida porque finalizó el horario de IDA (09:00).");
      }
    };

    const interval = setInterval(checkTime, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [geoActivo]);

  // Real-time listeners for location data
  useEffect(() => {
    // Listener for active location sharing state
    const unsubscribeEstado = onSnapshot(doc(db, 'ubicaciones_activa', 'estado'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUsuarioUbicacion(data.usuario);
        if (user && data.usuario === user.email) setGeoActivo(true);
      } else {
        setUsuarioUbicacion(null);
        setGeoActivo(false);
        setUbicaciones([]);
      }
    });

    // Listener for actual locations
    const unsubscribeUbicaciones = onSnapshot(collection(db, 'ubicaciones'), (snapshot) => {
      const ubicacionesData = [];
      snapshot.forEach((doc) => ubicacionesData.push(doc.data()));
      setUbicaciones(ubicacionesData);
    });

    return () => {
      unsubscribeEstado();
      unsubscribeUbicaciones();
    };
  }, [user]);

  const handleLogin = () => {
    console.log("Attempting login...");
    signInWithPopup(auth, provider)
      .then(async (result) => {
        const userEmail = result.user.email.toLowerCase(); // Force lowercase
        console.log("Login success:", userEmail);

        // Check Whitelist
        if (ADMIN_EMAILS.includes(userEmail)) {
          // Admin always allowed
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', userEmail));
        if (!userDoc.exists()) {
          await signOut(auth);
          alert("🚫 Acceso Denegado: Tu usuario no está habilitado para usar esta aplicación. Contacta al administrador.");
          setUser(null);
        }
      })
      .catch((error) => {
        console.error("Login error:", error);
        alert(`Error al iniciar sesión: ${error.message}`);
      });
  };

  const handleLogout = () => {
    signOut(auth).then(() => {
      console.log("Logged out");
      setUser(null);
      setEmail('');
      setPassword('');
      setNombre('');
      setAuthError('');
    });
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userEmail = userCredential.user.email.toLowerCase();
      
      // Check Whitelist
      if (!ADMIN_EMAILS.includes(userEmail)) {
        const userDoc = await getDoc(doc(db, 'users', userEmail));
        if (!userDoc.exists()) {
          await signOut(auth);
          setAuthError("🚫 Acceso Denegado: Tu usuario no está habilitado.");
          setUser(null);
          return;
        }
      }
      console.log("Email login success:", userEmail);
    } catch (error) {
      console.error("Login error:", error);
      setAuthError("❌ Error al iniciar sesión. Verifica tus credenciales.");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    const emailLower = email.toLowerCase();

    try {
      // 1. Check Whitelist BEFORE creating account
      if (!ADMIN_EMAILS.includes(emailLower)) {
        const userDoc = await getDoc(doc(db, 'users', emailLower));
        if (!userDoc.exists()) {
          setAuthError("🚫 No puedes registrarte. Tu email no está autorizado por el administrador.");
          return;
        }
      }

      // 2. Create User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // 3. Update Profile Name
      await updateProfile(userCredential.user, {
        displayName: nombre
      });

      // 4. Force update local state to show name immediately
      setUser({ ...userCredential.user, displayName: nombre });
      
      console.log("Registration success:", emailLower);
    } catch (error) {
      console.error("Registration error:", error);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError("⚠️ Este email ya está registrado.");
      } else if (error.code === 'auth/weak-password') {
        setAuthError("⚠️ La contraseña debe tener al menos 6 caracteres.");
      } else {
        setAuthError("❌ Error al registrarse: " + error.message);
      }
    }
  };

  // ... (useEffects)

  // ... (Notification Logic)

  // ... (Location Logic)

  // ... (Auth Handlers)

  if (!user) {
    // ... (Login Screen)
    return (
      <div className="bg-light min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center p-5 bg-white shadow rounded-4" style={{ maxWidth: '400px', width: '100%' }}>
          <h1 className="mb-4 text-primary fw-bold">🚐 CombiApp</h1>
          <p className="mb-4 text-muted">Inicia sesión para gestionar tus viajes</p>
          
          <button className="btn btn-outline-dark btn-lg rounded-pill px-4 shadow-sm w-100 mb-4" onClick={handleLogin}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="me-2" style={{ width: '20px' }} />
            Continuar con Google
          </button>

          <div className="d-flex align-items-center mb-4">
            <hr className="flex-grow-1" />
            <span className="mx-2 text-muted small">O usa tu email</span>
            <hr className="flex-grow-1" />
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleEmailLogin}>
            {isRegistering && (
              <div className="mb-3">
                <input 
                  type="text" 
                  className="form-control rounded-pill px-3" 
                  placeholder="Nombre completo"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="mb-3">
              <input 
                type="email" 
                className="form-control rounded-pill px-3" 
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <input 
                type="password" 
                className="form-control rounded-pill px-3" 
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {authError && <div className="alert alert-danger small py-2">{authError}</div>}

            <button type="submit" className="btn btn-primary w-100 rounded-pill fw-bold mb-3">
              {isRegistering ? 'Registrarse' : 'Ingresar'}
            </button>
          </form>

          <button 
            className="btn btn-link text-decoration-none btn-sm"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setAuthError('');
            }}
          >
            {isRegistering ? '¿Ya tienes cuenta? Ingresa aquí' : '¿No tienes cuenta? Regístrate'}
          </button>

        </div>
      </div>
    );
  }



  return (
    <div className="container-fluid bg-light min-vh-100 pb-5">
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm mb-4 rounded-bottom-4">
        <div className="container">
          <a className="navbar-brand fw-bold" href="#">🚐 CombiApp</a>
          <div className="d-flex align-items-center">
            <span className="text-white me-3 d-none d-sm-block">Hola, {user.displayName}</span>
            

            
            {isUserAdmin && (
              <button 
                className="btn btn-warning btn-sm rounded-pill me-2 fw-bold" 
                onClick={() => setMostrarAdmin(true)}
                title="Panel de Admin"
              >
                🛠️ Admin
              </button>
            )}

            <button 
              className="btn btn-info btn-sm rounded-pill me-2 text-white fw-bold" 
              onClick={() => setMostrarRecorrido(true)}
              title="Ver Recorrido"
            >
              📍 Recorrido
            </button>

            <button 
              className="btn btn-light btn-sm rounded-circle me-2" 
              onClick={() => setMostrarConfig(true)}
              title="Configuración"
            >
              ⚙️
            </button>
            <button className="btn btn-outline-light btn-sm rounded-pill" onClick={handleLogout}>Salir</button>
          </div>
        </div>
      </nav>

      {showNotificationButton && (
        <div className="container mb-3">
          <button 
            className="btn btn-success w-100 shadow-sm fw-bold"
            onClick={enableNotifications}
          >
            🔔 Activar Notificaciones
          </button>
        </div>
      )}

      <div className="container">
        {/* Toggle View */}
        <div className="d-flex justify-content-center mb-4">
          <div className="btn-group shadow-sm" role="group">
            <button 
              type="button" 
              className={`btn ${!mostrarResumen ? 'btn-primary' : 'btn-outline-primary'} px-4 py-2 fw-bold`}
              onClick={() => setMostrarResumen(false)}
            >
              📝 Mis Viajes
            </button>
            <button 
              type="button" 
              className={`btn ${mostrarResumen ? 'btn-primary' : 'btn-outline-primary'} px-4 py-2 fw-bold`}
              onClick={() => setMostrarResumen(true)}
            >
              📊 Resumen del Día
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="fade-in">
          {mostrarResumen ? (
            <ResumenViajes ubicaciones={ubicaciones} />
          ) : (
            <ResumenUsuario user={user} />
          )}
        </div>

              {/* Location Sharing Controls */}
        {mostrarResumen && (
          <div className="fixed-bottom p-3 d-flex justify-content-center" style={{ zIndex: 1000 }}>
            {!geoActivo ? (
              <button className="btn btn-success shadow-lg rounded-pill px-4 py-2 fw-bold" onClick={iniciarSeguimientoUbicacion}>
                📍 Compartir ubicación en tiempo real
              </button>
            ) : (
              <div className="bg-white p-2 rounded-pill shadow-lg d-flex align-items-center">
                <span className="text-success fw-bold me-3 ms-2">📍 Compartiendo...</span>
                {usuarioUbicacion === user.email && (
                  <button className="btn btn-danger btn-sm rounded-pill px-3" onClick={detenerSeguimientoUbicacion}>
                    Detener
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Button */}
      <button 
        className="btn btn-primary rounded-circle shadow-lg d-flex justify-content-center align-items-center position-fixed"
        style={{ bottom: '20px', right: '20px', width: '60px', height: '60px', zIndex: 2000 }}
        onClick={() => setMostrarChat(!mostrarChat)}
      >
        <span style={{ fontSize: '1.5rem' }}>💬</span>
        {unreadCount > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat Component */}
      {mostrarChat && <Chat user={user} onClose={() => setMostrarChat(false)} />}

      {/* Config Modal */}
      {mostrarConfig && <Configuracion user={user} onClose={() => setMostrarConfig(false)} />}

      {/* Admin Panel */}
      {mostrarAdmin && <AdminPanel user={user} onClose={() => setMostrarAdmin(false)} />}

      {/* Ver Recorrido Modal */}
      {mostrarRecorrido && <VerRecorrido onClose={() => setMostrarRecorrido(false)} />}
    </div>
  );
}

export default App;
