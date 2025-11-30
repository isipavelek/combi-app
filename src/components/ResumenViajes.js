import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { db } from '../firebaseConfig';
import { getOrderedWeekDays } from '../utils/dateUtils';
import { STOPS_IDA, STOPS_VUELTA } from '../constants';

// Fix Leaflet icons
if (L.Icon.Default && L.Icon.Default.prototype) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

// Helper component to auto-center map
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 14, { animate: true });
    }
  }, [center, map]);
  return null;
}

function ResumenViajes({ ubicaciones }) {
  const [orderedDays, setOrderedDays] = useState([]);
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);
  const [registrosIda, setRegistrosIda] = useState({});
  const [registrosVuelta, setRegistrosVuelta] = useState({});
  const [no, setNo] = useState([]);
  const [sinContestar, setSinContestar] = useState([]);

  const [vueltaPendiente, setVueltaPendiente] = useState([]);
  const [vueltaNo, setVueltaNo] = useState([]);
  
  const [stopsIda, setStopsIda] = useState(STOPS_IDA);
  const [stopsVuelta, setStopsVuelta] = useState(STOPS_VUELTA);

  useEffect(() => {
    const days = getOrderedWeekDays();
    setOrderedDays(days);
    if (days.length > 0) {
      setDiaSeleccionado(days[0]);
    }

    // Fetch dynamic stops
    const fetchStops = async () => {
      try {
        const stopsSnap = await getDoc(doc(db, 'config', 'stops'));
        if (stopsSnap.exists()) {
          const data = stopsSnap.data();
          
          const processStops = (list) => {
            if (!list) return [];
            return list.map(s => {
              if (typeof s === 'object' && s.name) {
                return `${s.name} (${s.time})`;
              }
              return s;
            });
          };

          setStopsIda(processStops(data.ida) || STOPS_IDA);
          setStopsVuelta(processStops(data.vuelta) || STOPS_VUELTA);
        }
      } catch (error) {
        console.error("Error fetching stops:", error);
      }
    };
    fetchStops();
  }, []);

  useEffect(() => {
    if (!diaSeleccionado) return;

    const fetchData = async () => {
      const snapshot = await getDocs(collection(db, 'frecuencia'));
      const dataIda = {};
      const dataVuelta = {};
      const noList = [];
      const sinCont = [];
      const vPendiente = [];
      const vNo = [];

      const targetKey = diaSeleccionado.key;
      const targetDate = diaSeleccionado.date;

      snapshot.forEach((doc) => {
        const d = doc.data();
        const diaData = d.dias?.[targetKey];
        
        const isValid = (entry) => {
          if (!entry) return false;
          if (entry.recurrente) return true;
          return entry.fecha === targetDate;
        };

        const idaValid = isValid(diaData?.ida);
        const vueltaValid = isValid(diaData?.vuelta);

        // Check Ida
        if (idaValid && diaData.ida.usar && diaData.ida.parada) {
          if (!dataIda[diaData.ida.parada]) dataIda[diaData.ida.parada] = [];
          dataIda[diaData.ida.parada].push(d.nombre);
        }

        // Check Vuelta
        if (vueltaValid && diaData.vuelta.usar && diaData.vuelta.parada) {
          if (!dataVuelta[diaData.vuelta.parada]) dataVuelta[diaData.vuelta.parada] = [];
          dataVuelta[diaData.vuelta.parada].push(d.nombre);
        }

        // Check for Ida passengers with special Vuelta status
        if (idaValid && diaData.ida.usar === true) {
            const isVueltaSi = vueltaValid && diaData.vuelta.usar === true;
            const isVueltaNo = vueltaValid && diaData.vuelta.usar === false;

            if (isVueltaNo) {
                vNo.push(d.nombre);
            } else if (!isVueltaSi) {
                // Went Ida but didn't say Yes (and didn't say No validly, or didn't answer)
                vPendiente.push(d.nombre);
            }
        }

        const idaNo = idaValid && diaData?.ida?.usar === false;
        const vueltaNo = vueltaValid && diaData?.vuelta?.usar === false;
        const hasIdaResponse = idaValid && diaData?.ida?.usar !== undefined;
        const hasVueltaResponse = vueltaValid && diaData?.vuelta?.usar !== undefined;

        if (hasIdaResponse || hasVueltaResponse) {
            if (idaNo && vueltaNo) {
                noList.push(d.nombre);
            }
        } else {
            sinCont.push(d.nombre);
        }
      });

      setRegistrosIda(dataIda);
      setRegistrosVuelta(dataVuelta);
      setNo(noList);
      setSinContestar(sinCont);
      setVueltaPendiente(vPendiente);
      setVueltaNo(vNo);
    };
    fetchData();
  }, [diaSeleccionado]);

  const renderCards = (registros) => (
    Object.keys(registros).length === 0 ? (
      <p className="text-muted small">No hay pasajeros registrados.</p>
    ) : (
      Object.entries(registros).map(([parada, nombres]) => (
        <div key={parada} className="card mb-3 shadow-sm">
          <div className="card-header bg-light py-2">
            <h6 className="card-title mb-0 small fw-bold">🚏 {parada}</h6>
          </div>
          <ul className="list-group list-group-flush">
            {nombres.map((nombre, i) => (
              <li key={i} className="list-group-item py-2 small">{nombre}</li>
            ))}
          </ul>
        </div>
      ))
    )
  );

  return (
    <div className="mt-4">
      <h4 className="mb-4">🗓️ Lista de pasajeros {diaSeleccionado ? `- ${diaSeleccionado.name} (${diaSeleccionado.date})` : ''}</h4>
      
      <div className="mb-4">
        <label className="form-label">Seleccionar día</label>
        <select 
            className="form-select" 
            value={diaSeleccionado ? JSON.stringify(diaSeleccionado) : ''} 
            onChange={(e) => {
                if (e.target.value) setDiaSeleccionado(JSON.parse(e.target.value));
            }}
        >
          {orderedDays.map((day) => (
            <option key={day.key} value={JSON.stringify(day)}>{day.name} ({day.date})</option>
          ))}
        </select>
      </div>

      <div className="row">
        <div className="col-md-6 mb-4">
            <h5 className="text-primary border-bottom pb-2 mb-3">🌅 Ida (Mañana)</h5>
            {renderCards(registrosIda)}
        </div>
        <div className="col-md-6 mb-4">
            <h5 className="text-primary border-bottom pb-2 mb-3">🌇 Vuelta (Tarde)</h5>
            {renderCards(registrosVuelta)}

            {vueltaPendiente.length > 0 && (
                <div className="card mb-3 shadow-sm border-warning mt-3">
                    <div className="card-header bg-warning bg-opacity-25 py-2">
                        <h6 className="card-title mb-0 small fw-bold text-dark">⚠️ No registró regreso</h6>
                    </div>
                    <ul className="list-group list-group-flush">
                        {vueltaPendiente.map((nombre, i) => (
                            <li key={i} className="list-group-item py-2 small">{nombre}</li>
                        ))}
                    </ul>
                </div>
            )}

            {vueltaNo.length > 0 && (
                <div className="card mb-3 shadow-sm border-danger mt-3">
                    <div className="card-header bg-danger bg-opacity-25 py-2">
                        <h6 className="card-title mb-0 small fw-bold text-danger">🛑 No vuelve</h6>
                    </div>
                    <ul className="list-group list-group-flush">
                        {vueltaNo.map((nombre, i) => (
                            <li key={i} className="list-group-item py-2 small">{nombre}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
      </div>

      {no.length > 0 && (
        <div className="mt-4 p-3 bg-light rounded">
          <h6 className="text-warning mb-2">🙅 No viajan hoy (ni ida ni vuelta):</h6>
          <ul className="list-inline mb-0">
            {no.map((nombre, i) => (
              <li key={i} className="list-inline-item badge bg-warning text-dark me-2">{nombre}</li>
            ))}
          </ul>
        </div>
      )}

      {sinContestar.length > 0 && (
        <div className="mt-3 p-3 bg-light rounded">
          <h6 className="text-danger mb-2">❗ Sin contestar (o datos vencidos):</h6>
          <ul className="list-inline mb-0">
            {sinContestar.map((nombre, i) => (
              <li key={i} className="list-inline-item badge bg-danger me-2">{nombre}</li>
            ))}
          </ul>
        </div>
      )}

      {ubicaciones.length > 0 && (
        <div className="mt-5">
          <h5 className="text-info mb-3">📍 Ubicación en tiempo real</h5>
          <MapContainer center={[ubicaciones[0].latitud, ubicaciones[0].longitud]} zoom={13} style={{ height: "300px", width: "100%", borderRadius: "12px" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapUpdater center={[ubicaciones[0].latitud, ubicaciones[0].longitud]} />
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

export default ResumenViajes;
