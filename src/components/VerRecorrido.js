import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { STOPS_IDA, STOPS_VUELTA } from '../constants';

function VerRecorrido({ onClose }) {
  const [stopsIda, setStopsIda] = useState([]);
  const [stopsVuelta, setStopsVuelta] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStops = async () => {
      try {
        const docRef = doc(db, 'config', 'stops');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setStopsIda(processStops(data.ida || []));
          setStopsVuelta(processStops(data.vuelta || []));
        } else {
          setStopsIda(processStops(STOPS_IDA));
          setStopsVuelta(processStops(STOPS_VUELTA));
        }
      } catch (error) {
        console.error("Error fetching stops:", error);
      }
      setLoading(false);
    };
    fetchStops();
  }, []);

  const processStops = (list) => {
    if (!list) return [];
    const processed = list.map(s => {
      if (typeof s === 'string') {
        // Try to parse "Name (Time)" for backward compatibility
        const match = s.match(/^(.*) \((.*)\)$/);
        if (match) {
          return { name: match[1], time: match[2] };
        }
        return { name: s, time: '' };
      }
      return s;
    });
    // Sort by time
    return processed.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  };

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: '15px' }}>
          <div className="modal-header bg-primary text-white" style={{ borderTopLeftRadius: '15px', borderTopRightRadius: '15px' }}>
            <h5 className="modal-title fw-bold">📍 Recorrido y Horarios</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
              </div>
            ) : (
              <div className="row">
                <div className="col-md-6 mb-4 mb-md-0">
                  <div className="card h-100 border-0 shadow-sm">
                    <div className="card-header bg-success text-white fw-bold text-center py-3">
                      🌅 IDA (Mañana)
                    </div>
                    <div className="list-group list-group-flush">
                      {stopsIda.map((stop, index) => (
                        <div key={index} className="list-group-item d-flex justify-content-between align-items-center py-3">
                          <span className="fw-bold text-dark">{stop.name}</span>
                          <span className="badge bg-success rounded-pill px-3">{stop.time} hs</span>
                        </div>
                      ))}
                      {stopsIda.length === 0 && <div className="p-3 text-center text-muted">No hay paradas definidas.</div>}
                    </div>
                  </div>
                </div>
                
                <div className="col-md-6">
                  <div className="card h-100 border-0 shadow-sm">
                    <div className="card-header bg-danger text-white fw-bold text-center py-3">
                      🌇 VUELTA (Tarde)
                    </div>
                    <div className="list-group list-group-flush">
                      {stopsVuelta.map((stop, index) => (
                        <div key={index} className="list-group-item d-flex justify-content-between align-items-center py-3">
                          <span className="fw-bold text-dark">{stop.name}</span>
                          <span className="badge bg-danger rounded-pill px-3">{stop.time} hs</span>
                        </div>
                      ))}
                      {stopsVuelta.length === 0 && <div className="p-3 text-center text-muted">No hay paradas definidas.</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer border-0">
            <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerRecorrido;
