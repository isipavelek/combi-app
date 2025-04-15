// CombiApp con resumen, notificaciones, estado de viaje y geolocalización con mapa
import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  Timestamp,
} from 'firebase/firestore';
import { getAuth, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const firebaseConfig = {
 
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const STOPS = [
  "P. Goyena",
  "Puán-Fragata",
  "Juan B Justo y San Martín",
  "Santa Fe y Dresco",
  "Olazábal",
  "Congreso",
  "Vedia",
  "Pana y San Martin",
  "Pana y Marquez",
  "Pana y Cap. J de San Martin",
  "Garín-Escobar"
];

function App() {
  const [user, setUser] = useState(null);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [geoActivo, setGeoActivo] = useState(false);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [usuarioUbicacion, setUsuarioUbicacion] = useState(null);
  const [geoInterval, setGeoInterval] = useState(null);

  useEffect(() => {
    const messaging = getMessaging(app);

    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        getToken(messaging, {
          vapidKey: 'BN8PJ8ByNTKAdsCr02z-pI_BicdH_S_cougBK5EsIYECa9xZ-KlkiCQ12Y1VCfTpmWmuI5zHa6Rgqhnxx18Q3kI'
        }).then((token) => {
          console.log('✅ Token FCM:', token);
        }).catch((err) => {
          console.warn('🔒 No se pudo obtener token FCM', err);
        });
      }
    });

    onMessage(messaging, (payload) => {
      const beep = new Audio('https://notificationsounds.com/storage/sounds/file-sounds-1153-pristine.mp3');
      beep.play();

      const alerta = document.createElement('div');
      alerta.className = 'alert alert-info alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
      alerta.style.zIndex = '1055';
      alerta.role = 'alert';
      alerta.innerHTML = `
        📩 <strong>${payload.notification?.title}</strong><br />
        <span>${payload.notification?.body || ''}</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      `;
      document.body.appendChild(alerta);
      setTimeout(() => {
        alerta.classList.remove('show');
        setTimeout(() => alerta.remove(), 300);
      }, 7000);
    });

    auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        const estadoSnap = await getDoc(doc(db, 'ubicaciones_activa', 'estado'));
        if (estadoSnap.exists()) {
          const data = estadoSnap.data();
          setUsuarioUbicacion(data.usuario);
          if (data.usuario === u.email) setGeoActivo(true);
        }
        cargarUbicaciones();
      }
    });
  }, []);

  const cargarUbicaciones = async () => {
    const ubiSnap = await getDocs(collection(db, 'ubicaciones'));
    const ubicacionesData = [];
    ubiSnap.forEach(docu => ubicacionesData.push(docu.data()));
    setUbicaciones(ubicacionesData);
  };

  useEffect(() => {
    if (usuarioUbicacion) {
      const interval = setInterval(cargarUbicaciones, 30000); // cada 30 segundos
      setGeoInterval(interval);
      return () => clearInterval(interval);
    }
  }, [usuarioUbicacion]);

  const iniciarSeguimientoUbicacion = () => {
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

  if (!user) {
    return (
      <div className="bg-light min-vh-100 d-flex justify-content-center align-items-center">
        <div className="card shadow-lg p-4" style={{ maxWidth: '400px' }}>
          <h2 className="text-center mb-3">🚌 CombiApp</h2>
          <p className="text-center">Accedé con tu cuenta Google para comenzar.</p>
          <button className="btn btn-primary w-100" onClick={() => signInWithPopup(auth, provider)}>Iniciar sesión con Google</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-0">👤 Bienvenido, {user.displayName}</h3>
        </div>
        <div className="btn-group">
          <button className="btn btn-outline-primary" onClick={() => setMostrarResumen((prev) => !prev)}>
            📋 {mostrarResumen ? 'Ocultar resumen del día' : 'Ver resumen del día'}
          </button>
          <button className="btn btn-outline-danger" onClick={() => signOut(auth)}>
            🔒 Cerrar sesión
          </button>
        </div>
      </div>

      {!geoActivo && usuarioUbicacion === null && (
        <button className="btn btn-info mb-4" onClick={iniciarSeguimientoUbicacion}>
          📍 Compartir ubicación en tiempo real
        </button>
      )}

      {geoActivo && (
        <button className="btn btn-warning mb-4" onClick={detenerSeguimientoUbicacion}>
          🛑 Detener ubicación compartida
        </button>
      )}

      {usuarioUbicacion && (
        <div className="alert alert-info">
          📡 {usuarioUbicacion === user.email ? 'Estás compartiendo tu ubicación en tiempo real' : `${usuarioUbicacion} está compartiendo ubicación`}
        </div>
      )}

      {mostrarResumen ? <ResumenViajes ubicaciones={ubicaciones} /> : <ResumenUsuario user={user} />}
    </div>
  );
}

function ResumenViajes({ ubicaciones }) {
  const [diaSeleccionado, setDiaSeleccionado] = useState(() => {
    const today = new Date();
    return DAYS[today.getDay() - 1] || 'Lunes';
  });
  const [registros, setRegistros] = useState({});
  const [no, setNo] = useState([]);
  const [sinContestar, setSinContestar] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const snapshot = await getDocs(collection(db, 'frecuencia'));
      const data = {};
      const noList = [];
      const sinCont = [];

      snapshot.forEach((doc) => {
        const d = doc.data();
        const dia = d.dias?.[diaSeleccionado];
        if (dia?.usar && dia.parada) {
          if (!data[dia.parada]) data[dia.parada] = [];
          data[dia.parada].push(d.nombre);
        } else if (dia && dia.usar === false) {
          noList.push(d.nombre);
        } else {
          sinCont.push(d.nombre);
        }
      });

      setRegistros(data);
      setNo(noList);
      setSinContestar(sinCont);
    };
    fetchData();
  }, [diaSeleccionado]);

  return (
    <div className="mt-4">
      <h4 className="mb-3">🗓️ Lista de pasajeros - {diaSeleccionado}</h4>
      <div className="mb-3">
        <label className="form-label">Seleccionar día</label>
        <select className="form-select" value={diaSeleccionado} onChange={(e) => setDiaSeleccionado(e.target.value)}>
          {DAYS.map((dia) => (
            <option key={dia} value={dia}>{dia}</option>
          ))}
        </select>
      </div>
      {Object.keys(registros).length === 0 ? (
        <p className="text-muted">No hay pasajeros registrados para este día.</p>
      ) : (
        Object.entries(registros).map(([parada, nombres]) => (
          <div key={parada} className="card mb-3 border-start border-primary">
            <div className="card-body">
              <h5 className="card-title">🚏 {parada}</h5>
              <ul className="mb-0">
                {nombres.map((nombre, i) => (
                  <li key={i}>{nombre}</li>
                ))}
              </ul>
            </div>
          </div>
        ))
      )}

      {no.length > 0 && (
        <div className="mt-4">
          <h5 className="text-warning">🙅 No usan la combi hoy:</h5>
          <ul>
            {no.map((nombre, i) => (
              <li key={i}>{nombre}</li>
            ))}
          </ul>
        </div>
      )}

      {sinContestar.length > 0 && (
        <div className="mt-4">
          <h5 className="text-danger">❗ Sin contestar:</h5>
          <ul>
            {sinContestar.map((nombre, i) => (
              <li key={i}>{nombre}</li>
            ))}
          </ul>
        </div>
      )}

      {ubicaciones.length > 0 && (
        <div className="mt-4">
          <h5 className="text-info">📍 Ubicación en tiempo real</h5>
          <MapContainer center={[ubicaciones[0].latitud, ubicaciones[0].longitud]} zoom={13} style={{ height: "300px", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {ubicaciones.map((u, i) => (
              <Marker key={i} position={[u.latitud, u.longitud]} icon={L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', iconSize: [30, 30] })}>
                <Popup>{u.nombre}</Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}


function ResumenUsuario({ user }) {
  const [viajes, setViajes] = useState({});
  const [loading, setLoading] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const ref = doc(db, 'frecuencia', user.email);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const datos = snap.data().dias || {};
        setViajes(datos);
      }
    };
    fetchData();
  }, [user.email]);

  const handleChange = (dia, campo, valor) => {
    setViajes((prev) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [campo]: valor,
      },
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    const ref = doc(db, 'frecuencia', user.email);
    await setDoc(ref, {
      email: user.email,
      nombre: user.displayName,
      dias: viajes,
      updated: Timestamp.now(),
    });
    setLoading(false);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  };

  return (
    <div className="mt-4">
      <h5 className="mb-3">🗓️ Mi resumen semanal</h5>
      {guardado && <div className="alert alert-success">✅ Cambios guardados</div>}
      {DAYS.map((dia) => {
        const usar = viajes[dia]?.usar;
        return (
          <div key={dia} className="card mb-2 border-start border-success border-3">
            <div className="card-body">
              <h6 className="card-title">📅 {dia}</h6>
              <div className="mb-2">
                <label className="form-label">¿Usás la combi?</label>
                <select
                  className="form-select"
                  value={usar === true ? 'si' : usar === false ? 'no' : ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleChange(dia, 'usar', value === 'si' ? true : value === 'no' ? false : null);
                  }}
                >
                  <option value="">Sin responder</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
              {usar !== null && (
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`rec-${dia}`}
                    checked={viajes[dia]?.recurrente || false}
                    onChange={(e) => handleChange(dia, 'recurrente', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor={`rec-${dia}`}>
                    Opción recurrente
                  </label>
                </div>
              )}
              {usar === true && (
                <div className="mb-2">
                  <label className="form-label">Parada</label>
                  <select
                    className="form-select"
                    value={viajes[dia]?.parada || ''}
                    onChange={(e) => handleChange(dia, 'parada', e.target.value)}
                  >
                    <option value="">Seleccionar parada</option>
                    {STOPS.map((stop, i) => (
                      <option key={i} value={stop}>{stop}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div className="text-end">
        <button className="btn btn-success mt-2" onClick={handleSubmit} disabled={loading}>
          {loading && <span className="spinner-border spinner-border-sm me-2" role="status" />}Guardar selección
        </button>
      </div>
    </div>
  );
}


export default App;
