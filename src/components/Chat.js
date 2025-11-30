import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, where, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';

function Chat({ user, isAdmin, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Calculate cutoff time (Last 19:00)
    const now = new Date();
    const cutoff = new Date(now);
    if (now.getHours() >= 19) {
      cutoff.setHours(19, 0, 0, 0);
    } else {
      cutoff.setDate(cutoff.getDate() - 1);
      cutoff.setHours(19, 0, 0, 0);
    }

    const q = query(
      collection(db, 'chat_messages'),
      where('timestamp', '>=', cutoff),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
      setTimeout(scrollToBottom, 100);
    });

    return () => unsubscribe();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    await addDoc(collection(db, 'chat_messages'), {
      text: newMessage,
      senderEmail: user.email,
      senderName: user.displayName,
      timestamp: serverTimestamp(),
    });

    // Notification is handled by Cloud Function trigger on 'chat_messages' collection

    setNewMessage('');
  };

  const handleDeleteMessage = async (id) => {
    if (!window.confirm("¿Borrar este mensaje?")) return;
    try {
      await deleteDoc(doc(db, 'chat_messages', id));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm("⚠️ ¿Seguro que quieres ELIMINAR TODO el historial del chat?")) return;
    try {
      // Delete all messages (not just the visible ones)
      // Note: In a real large app, this should be a Cloud Function to handle >500 docs.
      // For this app, client-side batch is likely fine.
      const q = query(collection(db, 'chat_messages'));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      alert("✅ Chat vaciado.");
    } catch (error) {
      console.error("Error clearing chat:", error);
      alert("Error al vaciar el chat.");
    }
  };

  // Format timestamp to HH:mm
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="card shadow-lg border-0" style={{ 
      position: 'fixed', 
      bottom: '80px', 
      right: '20px', 
      width: '350px', 
      height: '500px', 
      zIndex: 2000,
      borderRadius: '15px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center" style={{ borderTopLeftRadius: '15px', borderTopRightRadius: '15px' }}>
        <h5 className="mb-0 small fw-bold">💬 Chat Grupal</h5>
        <div className="d-flex align-items-center gap-2">
          {isAdmin && (
            <button 
              type="button" 
              className="btn btn-sm btn-danger py-0 px-2" 
              style={{ fontSize: '0.8rem' }}
              onClick={handleClearChat}
              title="Vaciar Chat"
            >
              🗑️ Vaciar
            </button>
          )}
          <button type="button" className="btn-close btn-close-white small" onClick={onClose}></button>
        </div>
      </div>
      
      <div className="card-body p-3" style={{ overflowY: 'auto', flex: 1, backgroundColor: '#f8f9fa' }}>
        <div className="text-center mb-3">
          <span className="badge bg-light text-muted border fw-normal" style={{ fontSize: '0.7rem' }}>
            🕒 Los mensajes se eliminan automáticamente luego de las 19:00 hs
          </span>
        </div>
        {messages.map((msg) => {
          const isMe = msg.senderEmail === user.email;
          return (
            <div key={msg.id} className={`d-flex flex-column mb-2 ${isMe ? 'align-items-end' : 'align-items-start'}`}>
              <div 
                className={`p-2 rounded-3 shadow-sm ${isMe ? 'bg-primary text-white' : 'bg-white text-dark'}`}
                style={{ maxWidth: '80%', fontSize: '0.9rem' }}
              >
                {!isMe && <div className="fw-bold small text-secondary mb-1">{msg.senderName}</div>}
                <div className="d-flex justify-content-between align-items-center gap-2">
                  <div>{msg.text}</div>
                  {isAdmin && (
                    <button 
                      className="btn btn-link text-danger p-0 ms-2" 
                      style={{ textDecoration: 'none', fontSize: '1rem', lineHeight: 1 }}
                      onClick={() => handleDeleteMessage(msg.id)}
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>
              <div className="text-muted small mt-1" style={{ fontSize: '0.7rem' }}>
                {formatTime(msg.timestamp)}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="card-footer bg-white border-top p-2">
        <form onSubmit={handleSend} className="d-flex">
          <input
            type="text"
            className="form-control me-2 rounded-pill"
            placeholder="Escribe un mensaje..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type="submit" className="btn btn-primary rounded-circle">
            ➤
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chat;
