import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

// Real-time layer (Socket.io): live messages, online presence, typing, XP updates
const SocketContext = createContext({ socket: null, online: [] });
export const useSocket = () => useContext(SocketContext);
export const useOnline = () => useContext(SocketContext).online;

export function SocketProvider({ children }) {
  const { token, setUser } = useAuth();
  const [socket, setSocket] = useState(null);
  const [online, setOnline] = useState([]);
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;

  useEffect(() => {
    if (!token) return;
    const s = io({ auth: { token }, transports: ['websocket', 'polling'] });
    s.on('presence', setOnline);
    s.on('connect', () => s.emit('presence:get', setOnline));
    s.on('xp', ({ amount, reason, profile }) => {
      if (profile) setUserRef.current(profile);
      if (amount > 0) toast.success(`+${amount} XP · ${reason}`, { icon: '⚡', duration: 2000 });
    });
    s.on('project:invited', ({ by }) => toast(`${by} added you to a project 🎉`, { icon: '👥' }));
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setOnline([]);
    };
  }, [token]);

  return <SocketContext.Provider value={{ socket, online }}>{children}</SocketContext.Provider>;
}

/** Subscribe to a socket event for the lifetime of a component. */
export function useSocketEvent(event, handler) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return;
    const fn = (...args) => ref.current(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}

/** Join a project or community room channel while mounted (re-joins after reconnect). */
export function useChannel(type, id) {
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket || !id) return;
    const join = () => socket.emit('join', { type, id });
    join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      socket.emit('leave', { type, id });
    };
  }, [socket, type, id]);
}
