import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Copy, 
  ExternalLink,
  Github,
  Twitter,
} from 'lucide-react';

import Header from './components/Header';
import PlayerInput from './components/PlayerInput';
import TeamResults from './components/TeamResults';
import PlayerList from './components/PlayerList';
import MatchHistory from './components/MatchHistory';

import { VERSION, ROLES, RANK_DATA, RANK_MAP } from './constants';

// --- Components ---

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
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [currentUserPuuid, setCurrentUserPuuid] = useState(null);
  
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
      }else if (event.data && event.data.type === 'LCU_MATCH_HISTORY_DATA_RESPONSE') {
        setIsLoadingMatches(false);
        if (event.data.success && event.data.data) {
          const { games, puuid } = event.data.data;

          let extractedGames = [];
          if (Array.isArray(games)) {
            extractedGames = games;
          } else if (games?.games) {
            if (Array.isArray(games.games)) {
              extractedGames = games.games;
            }
          }

          setMatches(extractedGames);
          setCurrentUserPuuid(puuid);
          setStatusMsg('対戦履歴を取得しました。');
          addLog('SUCCESS', `対戦履歴取得完了 (PUUID: ${puuid})`);
        } else {
          const errorMsg = event.data.error || '対戦履歴の取得に失敗しました。';
          setStatusMsg(errorMsg);
          addLog('ERROR', errorMsg);
          alert(errorMsg);
        }
      } else if (event.data && event.data.type === 'LCU_ERROR') {
        const errorMsg = event.data.error || 'エラーが発生しました。';
        setIsLoadingLobby(false);   
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
  }, [lcuInfo, addLog]);

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

  

  const handleFetchMatches = () => {
    if (!lcuInfo) return;
    setIsLoadingMatches(true);
    setStatusMsg('拡張機能経由で対戦履歴を取得中...');

    const messageData = {
      type: 'FETCH_MATCH_HISTORY_REQUEST',
      port: lcuInfo.port,
      password: lcuInfo.password,
      protocol: lcuInfo.protocol || 'https'
    };
    addLog('SEND', '拡張機能へ対戦履歴リクエスト送信', messageData);
    window.postMessage(messageData, "*");
  };

  const handleUploadMatch = async (matchData) => {
    if (!matchData) {
      setStatusMsg('アップロードする試合が選択されていません。');
      return;
    }
    setIsUploading(true);
    setStatusMsg('試合結果をアップロード中...');
    addLog('SEND', 'サーバーへ試合結果をアップロードします', matchData);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(matchData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'サーバーでエラーが発生しました。');
      }

      setStatusMsg('アップロードに成功しました！');
      addLog('SUCCESS', 'アップロード成功', result);
    } catch (error) {
      console.error('Upload failed:', error);
      setStatusMsg(`アップロード失敗: ${error.message}`);
      addLog('ERROR', `アップロード失敗: ${error.message}`);
      alert(`アップロードに失敗しました: ${error.message}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setStatusMsg(''), 5000); // 5秒後にメッセージを消す
    }
  };

  const selectedMatch = Array.isArray(matches) ? matches.find(m => (m.gameId || m.gameid).toString() === selectedMatchId) : null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-screen-3xl mx-auto">
        <Header
          pathDisplay={pathDisplay}
          onPathChange={(e) => setPathDisplay(e.target.value)}
          onPickFolder={handlePickFolder}
          isFileSystemApiSupported={isFileSystemApiSupported}
          onReadLockfile={handleReadLockfile}
          onFetchLobby={fetchLobbyFromExtension}
          lcuInfo={lcuInfo}
          isLoadingLobby={isLoadingLobby}
          onExport={exportJSON}
          onFileUpload={handleFileUpload}
          showDebug={showDebug}
          onToggleDebug={() => setShowDebug(!showDebug)}
          debugLogs={logs}
          logsEndRef={logsEndRef}
          onClearLogs={() => setLogs([])}
        />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          <div className="md:col-span-2 space-y-6">
            <PlayerInput
              inputName={inputName}
              onInputNameChange={(e) => setInputName(e.target.value)}
              inputRank={inputRank}
              onInputRankChange={(e) => setInputRank(e.target.value)}
              onAddPlayer={() => addPlayer()}
            />

            
            <TeamResults
              result={result}
              onCopy={copyResults}
              statusMsg={statusMsg}
            />

            <PlayerList
              players={players}
              tolerance={tolerance}
              onToleranceChange={(e) => setTolerance(parseInt(e.target.value) || 0)}
              onDivide={handleDivide}
              onClear={() => setPlayers([])}
              onUpdatePlayer={updatePlayer}
              onCheckAllRoles={checkAllRoles}
              onRemovePlayer={removePlayer}
            />
          </div>
          <div className="md:col-span-3 space-y-6">
            <MatchHistory
              lcuInfo={lcuInfo}
              isLoading={isLoadingMatches}
              isUploading={isUploading}
              onFetch={handleFetchMatches}
              onUpload={handleUploadMatch}
              matches={matches}
              selectedMatchId={selectedMatchId}
              onSelectMatch={setSelectedMatchId}
              currentUserPuuid={currentUserPuuid}
              selectedMatch={selectedMatch}
            />
          </div>
        </div>
        <footer className="flex flex-col items-center gap-4 text-slate-500 pt-8 mt-8 border-t border-slate-800">
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
  );
}