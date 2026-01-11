import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Copy, 
  ExternalLink, 
  Save, 
  Upload, 
  ChevronRight,
  Settings,
  Github,
  Twitter,
  FolderOpen,
  RefreshCw,
  AlertCircle,
  Terminal,
  FileSearch,
  MapPin,
  Gamepad2,
  Bug
} from 'lucide-react';

// --- Constants ---
const VERSION = 'v1.4.1-web-debug';
const ROLES = ['top', 'jg', 'mid', 'bot', 'sup'];

const RANK_DATA = [
  { tag: "UN", name: "UNRANKED", val: 0, color: "#FFFFFF" },
  { tag: "I4", name: "IRON IV", val: 1, color: "#51484A" },
  { tag: "I3", name: "IRON III", val: 2, color: "#51484A" },
  { tag: "I2", name: "IRON II", val: 3, color: "#51484A" },
  { tag: "I1", name: "IRON I", val: 4, color: "#51484A" },
  { tag: "B4", name: "BRONZE IV", val: 5, color: "#8C5229" },
  { tag: "B3", name: "BRONZE III", val: 6, color: "#8C5229" },
  { tag: "B2", name: "BRONZE II", val: 7, color: "#8C5229" },
  { tag: "B1", name: "BRONZE I", val: 8, color: "#8C5229" },
  { tag: "S4", name: "SILVER IV", val: 9, color: "#8098A1" },
  { tag: "S3", name: "SILVER III", val: 10, color: "#8098A1" },
  { tag: "S2", name: "SILVER II", val: 11, color: "#8098A1" },
  { tag: "S1", name: "SILVER I", val: 12, color: "#8098A1" },
  { tag: "G4", name: "GOLD IV", val: 13, color: "#CD8837" },
  { tag: "G3", name: "GOLD III", val: 14, color: "#CD8837" },
  { tag: "G2", name: "GOLD II", val: 15, color: "#CD8837" },
  { tag: "G1", name: "GOLD I", val: 16, color: "#CD8837" },
  { tag: "P4", name: "PLATINUM IV", val: 17, color: "#4E9996" },
  { tag: "P3", name: "PLATINUM III", val: 18, color: "#4E9996" },
  { tag: "P2", name: "PLATINUM II", val: 19, color: "#4E9996" },
  { tag: "P1", name: "PLATINUM I", val: 20, color: "#4E9996" },
  { tag: "E4", name: "EMERALD IV", val: 21, color: "#2ECC71" },
  { tag: "E3", name: "EMERALD III", val: 22, color: "#2ECC71" },
  { tag: "E2", name: "EMERALD II", val: 23, color: "#2ECC71" },
  { tag: "E1", name: "EMERALD I", val: 24, color: "#2ECC71" },
  { tag: "D4", name: "DIAMOND IV", val: 25, color: "#576ACC" },
  { tag: "D3", name: "DIAMOND III", val: 26, color: "#576ACC" },
  { tag: "D2", name: "DIAMOND II", val: 27, color: "#576ACC" },
  { tag: "D1", name: "DIAMOND I", val: 28, color: "#576ACC" },
  { tag: "M", name: "MASTER", val: 29, color: "#9A4E9E" },
  { tag: "GM", name: "GRANDMASTER", val: 34, color: "#CD4545" },
  { tag: "C", name: "CHALLENGER", val: 38, color: "#F4C775" },
];

const RANK_MAP = RANK_DATA.reduce((acc, r) => ({ ...acc, [r.name]: r.val }), {});

export default function App() {
  const [players, setPlayers] = useState([]);
  const [inputName, setInputName] = useState('');
  const [inputRank, setInputRank] = useState('SILVER IV');
  const [tolerance, setTolerance] = useState(5);
  const [result, setResult] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [lcuInfo, setLcuInfo] = useState(null);
  const [dirHandle, setDirHandle] = useState(null);
  const [pathDisplay, setPathDisplay] = useState('C:\\Riot Games\\League of Legends');
  const [isLoadingLobby, setIsLoadingLobby] = useState(false);
  
  // Debug State
  const [showDebug, setShowDebug] = useState(false);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  const addLog = (type, message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, type, message, data: data ? JSON.stringify(data) : null }]);
  };

  useEffect(() => {
    if (showDebug && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showDebug]);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('lol_custom_players');
    if (saved) setPlayers(JSON.parse(saved));
    const savedPath = localStorage.getItem('lol_custom_path');
    if (savedPath) setPathDisplay(savedPath);
  }, []);

  useEffect(() => {
    localStorage.setItem('lol_custom_players', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem('lol_custom_path', pathDisplay);
  }, [pathDisplay]);

  // 拡張機能からのメッセージを待受
  useEffect(() => {
    const handleMessage = (event) => {
      // セキュリティのためオリジンチェックを入れるのが望ましいが、拡張機能の場合は要検証
      // if (event.origin !== window.location.origin) return;
      if (event.data && (event.data.type === 'LCU_LOBBY_DATA_RESPONSE' || event.data.type === 'LCU_ERROR')) {
        addLog('RECEIVE', `メッセージを受信しました: ${event.data.type}`, event.data);
      }

      // 自分のウィンドウからのメッセージのみを処理（拡張機能のコンテンツスクリプト経由）
              if (event.data && event.data.type === 'LCU_LOBBY_DATA_RESPONSE') {
              setIsLoadingLobby(false);
              if (event.data.success && event.data.data) {
                const newPlayers = event.data.data.map(p => {
                  let rank = 'UNRANKED';
                  if (p.tier && p.tier.toUpperCase() !== 'UNRANKED') {
                    const tier = p.tier.toUpperCase();
                    const division = p.division ? p.division.toUpperCase() : '';
                    // MASTER, GRANDMASTER, CHALLENGERの場合はDivisionを含めない
                    rank = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier) ? tier : `${tier} ${division}`.trim();
                  }
                  return {
                    id: Math.random() + Date.now(),
                    name: p.name,
                    tag: p.tag || 'JP1',
                    ...ROLES.reduce((acc, role) => ({
                      ...acc,
                      [`${role}_rank`]: rank,
                      [role]: true
                    }), {})
                  };
                });
                
                setPlayers(prev => {
                  // 重複チェック
                  const existingNames = new Set(prev.map(p => p.name));
                  const filteredNew = newPlayers.filter(p => !existingNames.has(p.name));
                  return [...prev, ...filteredNew];
                });
                setStatusMsg(`${newPlayers.length}人のプレイヤーを読み込みました。`);
                addLog('SUCCESS', `プレイヤー読み込み完了: ${newPlayers.length}人`);
                setTimeout(() => setStatusMsg(''), 3000);
              } else {          const errorMsg = event.data.error || 'ロビー情報の取得に失敗しました。';
          setStatusMsg(errorMsg);
          addLog('ERROR', errorMsg);
          alert(errorMsg);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const isFileSystemApiSupported = typeof window.showDirectoryPicker === 'function';

  const parseLockfile = (text) => {
    const parts = text.split(':');
    if (parts.length >= 5) {
      return {
        name: parts[0],
        pid: parts[1],
        port: parts[2],
        password: parts[3],
        protocol: parts[4]
      };
    }
    return null;
  };

  const handlePickFolder = async () => {
    if (!isFileSystemApiSupported) {
      alert("お使いのブラウザはフォルダ選択に対応していません。");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'read',
        id: 'lol-installation-dir',
        startIn: 'documents'
      });
      setDirHandle(handle);
      setPathDisplay(handle.name); 
      setStatusMsg('フォルダを選択しました。');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      if (err.name !== 'AbortError') alert("フォルダの選択に失敗しました。");
    }
  };

  const handleReadLockfile = async () => {
    const manualInfo = parseLockfile(pathDisplay);
    if (manualInfo) {
      setLcuInfo(manualInfo);
      setStatusMsg('入力フォームから読み込みました！');
      addLog('INFO', 'Lockfile情報を手動入力から読み込みました', manualInfo);
      setTimeout(() => setStatusMsg(''), 3000);
      return;
    }

    if (!dirHandle) {
      alert("LoLフォルダを選択するか、lockfileの内容を貼り付けてください。");
      return;
    }

    try {
      let lockfileHandle = null;
      try {
        lockfileHandle = await dirHandle.getFileHandle('lockfile');
      } catch (e) {
        try {
          const gameDir = await dirHandle.getDirectoryHandle('League of Legends');
          lockfileHandle = await gameDir.getFileHandle('lockfile');
        } catch (innerE) {
          throw new Error("lockfileが見つかりませんでした。");
        }
      }

      const file = await lockfileHandle.getFile();
      const content = await file.text();
      const info = parseLockfile(content);
      if (info) {
        setLcuInfo(info);
        setStatusMsg('lockfileを読み込みました！');
        addLog('INFO', 'Lockfileをファイルシステムから読み込みました', info);
        setTimeout(() => setStatusMsg(''), 3000);
      }
    } catch (err) {
      addLog('ERROR', 'Lockfile読み込み失敗', err.message);
      alert(err.message || "読み込みに失敗しました。");
    }
  };

  // 拡張機能にロビー情報取得を依頼する関数
  const fetchLobbyFromExtension = useCallback(() => {
    if (!lcuInfo) return;
    setIsLoadingLobby(true);
    setStatusMsg('拡張機能経由でロビー情報を取得中...');
    
    console.log("送信する情報:", { type: 'FETCH_LCU_LOBBY_REQUEST', port: lcuInfo.port, password: lcuInfo.password }); // ★ログ追加

    const messageData = {
      type: 'FETCH_LCU_LOBBY_REQUEST',
      port: lcuInfo.port,
      password: lcuInfo.password,
      protocol: lcuInfo.protocol || 'https'
    };
    
    addLog('SEND', '拡張機能へリクエスト送信', messageData);

    // window.postMessage を使用してコンテンツスクリプトに送信
    window.postMessage(messageData, "*");

    // タイムアウト処理（5秒応答がなければエラーとする）
    setTimeout(() => {
      setIsLoadingLobby(prev => {
        if (prev) {
          addLog('TIMEOUT', '拡張機能からの応答がありません。拡張機能がインストールされているか、LCUが起動しているか確認してください。');
          setStatusMsg('タイムアウト: 拡張機能からの応答がありません。');
          return false;
        }
        return prev;
      });
    }, 5000);
  }, [lcuInfo]);

  const addPlayer = (name = inputName, rank = inputRank) => {
    if (!name.trim()) return;
    const newPlayer = {
      id: Date.now() + Math.random(),
      name: name.trim(),
      tag: 'JP1',
      ...ROLES.reduce((acc, role) => ({
        ...acc,
        [`${role}_rank`]: rank,
        [role]: true
      }), {})
    };
    setPlayers(prev => [...prev, newPlayer]);
    setInputName('');
  };

  const removePlayer = (id) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const updatePlayer = (id, field, value) => {
    setPlayers(players.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const checkAllRoles = (id) => {
    setPlayers(players.map(p => {
      if (p.id === id) {
        const updates = {};
        ROLES.forEach(r => updates[r] = true);
        return { ...p, ...updates };
      }
      return p;
    }));
  };

  const handleDivide = () => {
    const activePlayers = players.filter(p => ROLES.some(role => p[role]));
    if (activePlayers.length < 10) {
      alert("参加可能なプレイヤーを10人選択してください。");
      return;
    }

    const getCombinations = (array, size) => {
      const res = [];
      const f = (prefix, array) => {
        for (let i = 0; i < array.length; i++) {
          const next = prefix.concat([array[i]]);
          if (size === next.length) res.push(next);
          else f(next, array.slice(i + 1));
        }
      };
      f([], array);
      return res;
    };

    const playerPool = activePlayers.slice(0, 10);
    const combs = getCombinations(playerPool, 5);
    let bestMatch = null;
    let minDiff = Infinity;

    combs.sort(() => Math.random() - 0.5);

    for (let team1 of combs) {
      const team2 = playerPool.filter(p => !team1.includes(p));
      const assignRoles = (team) => {
        const assigned = [];
        const backtrack = (roleIdx) => {
          if (roleIdx === ROLES.length) return true;
          const role = ROLES[roleIdx];
          for (const p of team) {
            if (p[role] && !assigned.includes(p)) {
              assigned.push(p);
              if (backtrack(roleIdx + 1)) return true;
              assigned.pop();
            }
          }
          return false;
        };
        return backtrack(0) ? assigned : null;
      };

      const assigned1 = assignRoles(team1);
      const assigned2 = assignRoles(team2);

      if (assigned1 && assigned2) {
        const score1 = assigned1.reduce((sum, p, i) => sum + RANK_MAP[p[`${ROLES[i]}_rank`]], 0);
        const score2 = assigned2.reduce((sum, p, i) => sum + RANK_MAP[p[`${ROLES[i]}_rank`]], 0);
        const diff = Math.abs(score1 - score2);

        if (diff <= tolerance) {
          bestMatch = { team1: assigned1.map((p, i) => ({ ...p, role: ROLES[i] })), team2: assigned2.map((p, i) => ({ ...p, role: ROLES[i] })), score1, score2, diff };
          break;
        }
        if (diff < minDiff) {
          minDiff = diff;
          bestMatch = { team1: assigned1.map((p, i) => ({ ...p, role: ROLES[i] })), team2: assigned2.map((p, i) => ({ ...p, role: ROLES[i] })), score1, score2, diff };
        }
      }
    }
    if (bestMatch) setResult(bestMatch);
    else alert("条件に合うチーム分けが見つかりませんでした。");
  };

  const copyResults = (type = 'standard') => {
    if (!result) return;
    let text = "チーム1----\n" + result.team1.map(p => `${p.role.toUpperCase()}: ${p.name}`).join('\n') + "\n\nチーム2----\n" + result.team2.map(p => `${p.role.toUpperCase()}: ${p.name}`).join('\n');
    if (type === 'opgg') {
      const getOpgg = (team) => `https://www.op.gg/multisearch/jp?summoners=${team.map(p => encodeURIComponent(p.name + '#' + p.tag)).join('%2C')}`;
      text += `\n\nTeam1 OPGG: ${getOpgg(result.team1)}\nTeam2 OPGG: ${getOpgg(result.team2)}`;
    }
    navigator.clipboard.writeText(text).then(() => {
      setStatusMsg('コピーしました！');
      setTimeout(() => setStatusMsg(''), 3000);
    });
  };

  const exportJSON = async () => {
    const data = players.reduce((acc, p) => {
      acc[p.name] = { tag: p.tag, rank: ROLES.reduce((rAcc, r) => ({ ...rAcc, [`${r}_rank`]: p[`${r}_rank`] }), {}), role: ROLES.reduce((rAcc, r) => ({ ...rAcc, [r]: p[r] }), {}) };
      return acc;
    }, {});
    
    const jsonStr = JSON.stringify(data, null, 2);
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'player_dictionary.json',
          types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        setStatusMsg('保存しました。');
        setTimeout(() => setStatusMsg(''), 3000);
      } else {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'player_dictionary.json';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err.name !== 'AbortError') alert("保存に失敗しました。");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        setPlayers(prev => prev.map(p => {
          const info = data[p.name];
          if (info) {
            return {
              ...p,
              ...ROLES.reduce((acc, r) => ({ ...acc, [r]: info.role?.[r] ?? p[r], [`${r}_rank`]: info.rank?.[`${r}_rank`] || p[`${r}_rank`] }), {})
            };
          }
          return p;
        }));
        setStatusMsg('設定を読み込みました。');
        setTimeout(() => setStatusMsg(''), 3000);
      } catch (err) { alert("形式エラー"); }
    };
    reader.readAsText(file);
  };

  const getAverageRank = (score) => {
    const avg = score / 5;
    const closest = RANK_DATA.reduce((prev, curr) => 
      Math.abs(curr.val - avg) < Math.abs(prev.val - avg) ? curr : prev
    );
    return closest.name;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/20">
              <span className="text-white font-bold"><Users size={32} /></span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">LoLチーム分けツール</h1>
              <p className="text-slate-400 text-sm">Balanced Team Maker for Custom Games</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 text-sm justify-center items-center">
             <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700 px-3 py-1 rounded text-[10px] font-mono shadow-inner group">
               <MapPin size={12} className="text-indigo-400 shrink-0" />
               <input 
                  type="text"
                  value={pathDisplay}
                  onChange={(e) => setPathDisplay(e.target.value)}
                  className="bg-transparent border-none focus:outline-none text-slate-400 w-[150px] md:w-[250px] placeholder:italic"
                  placeholder="Paste lockfile content here..."
               />
             </div>

             <button 
               onClick={handlePickFolder} 
               className={`flex items-center gap-2 px-3 py-2 rounded transition shadow-sm border ${isFileSystemApiSupported ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-700 border-slate-600 opacity-60'}`}
             >
               <FolderOpen size={16} /> フォルダ選択
             </button>
             <button 
               onClick={handleReadLockfile} 
               className="flex items-center gap-2 px-3 py-2 rounded transition shadow-sm border bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white"
             >
               <FileSearch size={16} /> 設定読込
             </button>
             
             {/* ロビー取得ボタン - lcuInfoがある時のみ表示 */}
             <button 
               onClick={fetchLobbyFromExtension}
               disabled={!lcuInfo || isLoadingLobby}
               className={`flex items-center gap-2 px-3 py-2 rounded transition shadow-sm border ${lcuInfo ? 'bg-amber-600 hover:bg-amber-500 border-amber-400 text-white animate-pulse-subtle' : 'bg-slate-800 border-slate-700 opacity-40 cursor-not-allowed text-slate-500'}`}
             >
               <Gamepad2 size={16} className={isLoadingLobby ? 'animate-spin' : ''} />
               {isLoadingLobby ? '取得中...' : 'ロビー取得'}
             </button>

             <button onClick={exportJSON} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded transition shadow-sm border border-slate-700">
               <Save size={16} /> SAVE
             </button>
             <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded transition cursor-pointer shadow-sm border border-slate-700">
               <Upload size={16} /> LOAD
               <input type="file" className="hidden" onChange={handleFileUpload} accept=".json" />
             </label>
             <button 
               onClick={() => setShowDebug(!showDebug)} 
               className={`flex items-center gap-2 px-3 py-2 rounded transition shadow-sm border ${showDebug ? 'bg-red-900/50 border-red-500 text-red-200' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
               title="デバッグログを表示"
             >
               <Bug size={16} />
             </button>
          </div>
        </header>

        {/* Debug Console */}
        {showDebug && (
          <div className="bg-black/80 font-mono text-xs p-4 rounded-xl border border-red-500/30 mb-6 shadow-xl max-h-60 overflow-y-auto">
            <div className="flex justify-between items-center mb-2 border-b border-red-900/50 pb-2">
              <span className="text-red-400 font-bold flex items-center gap-2"><Terminal size={12}/> DEBUG CONSOLE</span>
              <button onClick={() => setLogs([])} className="text-slate-500 hover:text-slate-300">CLEAR</button>
            </div>
            <div className="space-y-1">
              {logs.length === 0 && <span className="text-slate-600 italic">No logs yet...</span>}
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2 break-all">
                  <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                  <span className={`font-bold shrink-0 w-16 ${
                    log.type === 'SEND' ? 'text-blue-400' : 
                    log.type === 'RECEIVE' ? 'text-green-400' : 
                    log.type === 'ERROR' ? 'text-red-500' : 
                    log.type === 'TIMEOUT' ? 'text-amber-500' : 'text-slate-300'
                  }`}>{log.type}</span>
                  <span className="text-slate-300">{log.message}</span>
                  {log.data && <span className="text-slate-500 truncate ml-2">{log.data}</span>}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {lcuInfo && (
          <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4 mb-6 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg shadow-indigo-900/10">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 p-2 rounded-full text-indigo-400">
                <RefreshCw size={16} />
              </div>
              <div>
                <div className="text-indigo-300 font-bold text-sm">LCU接続情報取得済み</div>
                <div className="text-[10px] text-slate-500 font-mono">Port: {lcuInfo.port} | Auth: {lcuInfo.password.substring(0,4)}***</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-amber-300 bg-amber-400/5 px-3 py-1.5 rounded-full border border-amber-500/20">
              <AlertCircle size={12} className="shrink-0" />
              <span>拡張機能を介してローカル通信を行います</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-xl">
              <h2 className="flex items-center gap-2 text-lg font-semibold mb-4 text-blue-400">
                <UserPlus size={20} /> プレイヤー追加
              </h2>
              <div className="flex flex-wrap gap-3">
                <input 
                  type="text" 
                  placeholder="サモナー名"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 flex-grow focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                />
                <select 
                  className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={inputRank}
                  onChange={(e) => setInputRank(e.target.value)}
                >
                  {RANK_DATA.map(r => (
                    <option key={r.name} value={r.name}>{r.name}</option>
                  ))}
                </select>
                <button 
                  onClick={() => addPlayer()}
                  className="bg-blue-600 hover:bg-blue-500 px-8 py-2 rounded-lg font-bold transition shadow-lg shadow-blue-900/40 active:scale-95 text-white"
                >
                  追加
                </button>
              </div>
            </section>

            <section className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-xl overflow-x-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-blue-400">プレイヤーリスト ({players.length})</h2>
                <button onClick={() => setPlayers([])} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                  <Trash2 size={12} /> 全削除
                </button>
              </div>
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-[10px] uppercase tracking-widest">
                    <th className="py-3 px-1">Name</th>
                    {ROLES.map(r => <th key={r} className="py-3 text-center">{r}</th>)}
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {players.map((p) => (
                    <tr key={p.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                      <td className="py-4 font-medium max-w-[150px] truncate text-slate-200">{p.name}</td>
                      {ROLES.map(role => (
                        <td key={role} className="py-4 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <input 
                              type="checkbox" 
                              checked={p[role]} 
                              onChange={(e) => updatePlayer(p.id, role, e.target.checked)}
                              className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-600 transition-all cursor-pointer"
                            />
                            <select 
                              className="text-[9px] bg-slate-900/50 border border-slate-700/50 rounded px-1.5 py-0.5 cursor-pointer font-bold tracking-tighter"
                              style={{ color: RANK_DATA.find(r => r.name === p[`${role}_rank`])?.color }}
                              value={p[`${role}_rank`]}
                              onChange={(e) => updatePlayer(p.id, `${role}_rank`, e.target.value)}
                            >
                              {RANK_DATA.map(r => (
                                <option key={r.tag} value={r.name}>{r.tag}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                      ))}
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => checkAllRoles(p.id)} className="p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-all" title="全選択">
                            <Settings size={14} />
                          </button>
                          <button onClick={() => removePlayer(p.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-all" title="削除">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {players.length === 0 && (
                    <tr><td colSpan={7} className="py-16 text-center text-slate-500 italic font-light tracking-wide">リストが空です。ロビーから取得するか手動で追加してください。</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>

          <div className="space-y-6 text-slate-200">
            <section className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 shadow-xl">
              <h2 className="text-lg font-semibold mb-6 text-blue-400">チーム分け実行</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between text-sm bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                  <label className="text-slate-400 font-medium">許容ランク誤差:</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-center font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      value={tolerance}
                      onChange={(e) => setTolerance(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleDivide}
                  disabled={players.length < 10}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:opacity-40 py-4 rounded-xl font-bold transition shadow-lg shadow-emerald-900/20 active:scale-[0.98] text-white"
                >
                  チーム分け実行
                </button>
              </div>

              {result && (
                <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-700 pb-3">
                    <span>MATCH PREVIEW</span>
                    <span className="text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20 font-mono">Diff: {result.diff}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-bold text-blue-400 flex items-center justify-between px-1">
                        <span>TEAM 1 <span className="text-slate-500 font-normal ml-1">({getAverageRank(result.score1)})</span></span>
                        <span className="font-mono">{result.score1}</span>
                      </p>
                      {result.team1.map((p, i) => (
                        <div key={i} className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50 shadow-inner group">
                          <span className="text-slate-500 font-mono text-[9px] mr-2 inline-block w-6 uppercase group-hover:text-blue-400 transition-colors">{p.role}</span>
                          <span className="font-medium truncate block text-xs">{p.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-bold text-red-400 flex items-center justify-between px-1">
                        <span>TEAM 2 <span className="text-slate-500 font-normal ml-1">({getAverageRank(result.score2)})</span></span>
                        <span className="font-mono">{result.score2}</span>
                      </p>
                      {result.team2.map((p, i) => (
                        <div key={i} className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-700/50 shadow-inner group">
                          <span className="text-slate-500 font-mono text-[9px] mr-2 inline-block w-6 uppercase group-hover:text-red-400 transition-colors">{p.role}</span>
                          <span className="font-medium truncate block text-xs">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-6 space-y-3">
                    <button onClick={() => copyResults()} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] text-white border border-slate-600 shadow-sm"><Copy size={14} /> 結果コピー</button>
                    <button onClick={() => copyResults('opgg')} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] text-blue-300 border border-slate-600 shadow-sm"><ExternalLink size={14} /> OPGGコピー</button>
                    {statusMsg && <p className="text-center text-[10px] text-emerald-400 font-medium animate-pulse">{statusMsg}</p>}
                  </div>
                </div>
              )}
            </section>
            
            <footer className="flex flex-col items-center gap-4 text-slate-500 pt-4">
               <div className="flex gap-6">
                  <a href="https://x.com/yamadalter" target="_blank" rel="noreferrer" className="hover:text-blue-400 transition-colors"><Twitter size={20} /></a>
                  <a href="https://github.com/yamadalter/LOLCustomTool" target="_blank" rel="noreferrer" className="hover:text-white transition-colors"><Github size={20} /></a>
               </div>
               <div className="text-[10px] text-center space-y-1 font-mono tracking-tight opacity-50">
                 <p>VERSION {VERSION}</p>
                 <p>© 2026 Produced by yamadalter</p>
               </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}