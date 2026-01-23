import { useState, useCallback, useRef, useEffect } from 'react';

export function useLogger(showDebug) {
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  const addLog = useCallback((type, message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, type, message, data: data ? JSON.stringify(data) : null }]);
  }, []);

  useEffect(() => {
    if (showDebug && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showDebug]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, addLog, logsEndRef, clearLogs };
}
