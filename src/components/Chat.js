import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

function Chat({ user, onClose }) {
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

    setNewMessage('');
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
        <button type="button" className="btn-close btn-close-white small" onClick={onClose}></button>
      </div>
      
      <div className="card-body p-3" style={{ overflowY: 'auto', flex: 1, backgroundColor: '#f8f9fa' }}>
        {messages.map((msg) => {
          const isMe = msg.senderEmail === user.email;
          return (
            <div key={msg.id} className={`d-flex flex-column mb-2 ${isMe ? 'align-items-end' : 'align-items-start'}`}>
              <div 
                className={`p-2 rounded-3 shadow-sm ${isMe ? 'bg-primary text-white' : 'bg-white text-dark'}`}
                style={{ maxWidth: '80%', fontSize: '0.9rem' }}
              >
                {!isMe && <div className="fw-bold small text-secondary mb-1">{msg.senderName}</div>}
                <div>{msg.text}</div>
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
