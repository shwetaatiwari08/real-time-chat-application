import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { io } from "socket.io-client";
import "./style.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const socket = io(API);

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [room, setRoom] = useState("general");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/api/users`, { headers }).then(r => setUsers(r.data)).catch(e => setError(e.response?.data?.message || e.message));
    socket.emit("user_online", user.id);
    socket.on("receive_message", msg => setMessages(prev => [...prev, msg]));
    socket.on("status_changed", ({ userId, online }) => {
      setUsers(prev => prev.map(u => String(u._id) === String(userId) ? { ...u, online } : u));
    });
    return () => socket.off("receive_message");
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const endpoint = selected
        ? `${API}/api/messages/private/${selected._id}`
        : `${API}/api/messages/${room}`;
      const result = await axios.get(endpoint, { headers });
      setMessages(result.data);
      if (!selected) socket.emit("join_room", room);
    };
    load().catch(e => setError(e.response?.data?.message || e.message));
  }, [selected, room, token]);

  const submitAuth = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const result = await axios.post(API + endpoint, form);
      localStorage.setItem("token", result.data.token);
      localStorage.setItem("user", JSON.stringify(result.data.user));
      setToken(result.data.token);
      setUser(result.data.user);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const targetRoom = selected ? `private-${[user.id, selected._id].sort().join("-")}` : room;
    socket.emit("send_message", {
      sender: user.id,
      receiver: selected?._id,
      room: targetRoom,
      text
    });
    setText("");
  };

  const logout = () => {
    socket.emit("user_offline", user.id);
    localStorage.clear();
    setToken(null);
    setUser(null);
  };

  if (!token) return (
    <main className="auth">
      <form onSubmit={submitAuth} className="card">
        <h1>ChatWave 💬</h1>
        <p>{mode === "login" ? "Login to continue" : "Create your account"}</p>
        {mode === "register" && <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />}
        <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
        <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
        <button>{mode === "login" ? "Login" : "Register"}</button>
        <p className="error">{error}</p>
        <button type="button" className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Create account" : "Already have an account? Login"}
        </button>
      </form>
    </main>
  );

  return (
    <main className="app">
      <aside>
        <div className="profile"><strong>{user.name}</strong><button onClick={logout}>Logout</button></div>
        <h3>Rooms</h3>
        <button className={!selected && room === "general" ? "active" : ""} onClick={() => { setSelected(null); setRoom("general"); }}># General</button>
        <button className={!selected && room === "developers" ? "active" : ""} onClick={() => { setSelected(null); setRoom("developers"); }}># Developers</button>
        <h3>Users</h3>
        {users.map(u => <button key={u._id} className={selected?._id === u._id ? "active" : ""} onClick={() => setSelected(u)}>{u.name} <span>{u.online ? "🟢" : "⚪"}</span></button>)}
      </aside>
      <section className="chat">
        <header><h2>{selected ? `Private chat with ${selected.name}` : `Room: ${room}`}</h2></header>
        <div className="messages">
          {messages.map((m, i) => <div key={m._id || i} className={String(m.sender?._id || m.sender) === String(user.id) ? "message mine" : "message"}><b>{m.sender?.name || "You"}</b><p>{m.text}</p></div>)}
        </div>
        <form className="composer" onSubmit={send}><input value={text} onChange={e => setText(e.target.value)} placeholder="Write a message..." /><button>Send</button></form>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
