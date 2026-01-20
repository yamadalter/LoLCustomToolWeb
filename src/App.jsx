import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Twitter, Github } from 'lucide-react';
import Header from './components/Header';
import PlayerInput from './components/PlayerInput';
import PlayerList from './components/PlayerList';
import TeamResults from './components/TeamResults';
import MatchHistory from './components/MatchHistory';
import './App.css';
import { ROLES, RANK_MAP, DDRAGON_VERSION, ROLE_MAP } from './constants';


const VERSION = "v2.0.0-β.1";

function App() {
  const [players, setPlayers] = useState([]);
  const [inputName, setInputName] = useState('');
  const [inputRate, setInputRate] = useState(1500);
  const [statusMsg, setStatusMsg] = useState('');
  const [lcuInfo, setLcuInfo] = useState(null);
  const [dirHandle, setDirHandle] = useState(null);
  const [pathDisplay, setPathDisplay] = useState('C:\\Riot Games\\League of Legends');
  const [isLoadingLobby, setIsLoadingLobby] = useState(false);
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUpdatingRatings, setIsUpdatingRatings] = useState(false);
  const [updateRatingsError, setUpdateRatingsError] = useState(null);
  const [isLoadingFromDB, setIsLoadingFromDB] = useState(false);
  
  // DB-based team generation
  const [teams, setTeams] = useState(null);
  const [isGeneratingTeams, setIsGeneratingTeams] = useState(false);
  const [generateTeamsError, setGenerateTeamsError] = useState(null);
  const [championMap, setChampionMap] = useState({});
  
  const [currentUserPuuid, setCurrentUserPuuid] = useState(null);
  
  // Debug State
  const [showDebug, setShowDebug] = useState(false);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  const addLog = useCallback((type, message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, type, message, data: data ? JSON.stringify(data) : null }]);
  }, []);

  useEffect(() => {
    const fetchChampionData = async () => {
      try {
        const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/en_US/champion.json`);
        const data = await response.json();
        const champData = data.data;
        const champMap = {};
        for (const champ in champData) {
          champMap[champData[champ].key] = champData[champ].id;
        }
        setChampionMap(champMap);
        addLog('SUCCESS', 'Champion data loaded successfully');
      } catch (error) {
        addLog('ERROR', 'Failed to fetch champion data:', error);
      }
    };
    fetchChampionData();
  }, [addLog]);

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

  const handleMessage = useCallback(async (event) => {
    if (event.data && (event.data.type === 'LCU_LOBBY_DATA_RESPONSE' || event.data.type === 'LCU_ERROR')) {
      addLog('RECEIVE', `メッセージを受信しました: ${event.data.type}`, event.data);
    }
  
    if (event.data && event.data.type === 'LCU_LOBBY_DATA_RESPONSE') {
      setIsLoadingLobby(false);
      if (event.data.success && event.data.data) {
        addLog('INFO', '拡張機能から受信したプレイヤーデータ:', event.data.data);
        const lcuPlayers = event.data.data;
        const puuids = lcuPlayers.map(p => p.puuid).filter(Boolean);
  
        let dbRatings = new Map(); // Mapを使用
        if (puuids.length > 0) {
          try {
            addLog('SEND', 'DBからプレイヤーレートを取得します', { puuids });
            const response = await fetch('/api/get_ratings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ puuids }),
            });
            const ratingsData = await response.json();
            if (response.ok) {
              addLog('SUCCESS', 'DBレート取得成功', ratingsData);
              ratingsData.forEach(p => {
                dbRatings.set(p.puuid, p); // puuidをキーに、プレイヤーオブジェクト全体を保存
              });
            } else {
              throw new Error(ratingsData.error || 'DBレートの取得に失敗しました。');
            }
          } catch (error) {
            addLog('ERROR', `DBレート取得失敗: ${error.message}`);
            // エラーでも処理は続行する
          }
        }
  
        const newPlayers = lcuPlayers.map(p => {
          const playerDbRatings = dbRatings.get(p.puuid);
          
          let fallbackRate = 1500;
          if (p.tier && p.tier.toUpperCase() !== 'UNRANKED') {
            const tier = p.tier.toUpperCase();
            const division = p.division ? p.division.toUpperCase() : '';
            const rankString = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier) ? tier : `${tier} ${division}`.trim();
            fallbackRate = RANK_MAP[rankString] !== undefined ? RANK_MAP[rankString] : 1500;
          }
          
          const roleRates = {};
          if (playerDbRatings) {
            // DBに情報があれば、各レーンのレートを使用
            ROLES.forEach(role => {
              const lane = ROLE_MAP[role]; // 'TOP' -> 'top'
              roleRates[`${role}_rate`] = playerDbRatings[lane] || fallbackRate;
            });
          } else {
            // DBに情報がなければ、全レーンにフォールバックレートを設定
            ROLES.forEach(role => {
              roleRates[`${role}_rate`] = fallbackRate;
            });
          }
    
          return {
            id: p.puuid,
            puuid: p.puuid,
            name: p.name,
            tag: p.tag || 'JP1',
            ...roleRates,
            ...ROLES.reduce((acc, role) => ({ ...acc, [role]: true }), {})
          };
        });
              
        // ★★★ ロジック変更: マージするのではなく、完全に置き換える
        setPlayers(newPlayers);
  
        setStatusMsg(`${newPlayers.length}人のプレイヤーを読み込み/更新しました。`);
        addLog('SUCCESS', `プレイヤー読み込み/更新完了: ${newPlayers.length}人`);
        setTimeout(() => setStatusMsg(''), 3000);
  
      } else {
        const errorMsg = event.data.error || 'ロビー情報の取得に失敗しました。';
        setStatusMsg(errorMsg);
        addLog('ERROR', errorMsg);
        alert(errorMsg);
      }
    } else if (event.data && event.data.type === 'LCU_MATCH_HISTORY_DATA_RESPONSE') {
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
        
        // Add championName to participants
        if (Object.keys(championMap).length > 0) {
          extractedGames.forEach(match => {
            if (match.participants && Array.isArray(match.participants)) {
              match.participants.forEach(participant => {
                participant.championName = championMap[participant.championId] || 'Unknown';
              });
            }
          });
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
  }, [addLog, setIsLoadingLobby, setStatusMsg, setMatches, setCurrentUserPuuid, championMap]);

  // 拡張機能からのメッセージを待受
  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);
  
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

  const addPlayer = (name = inputName, rate = inputRate) => {
    if (!name.trim()) return;
    const newPlayer = {
      id: Date.now() + Math.random(),
      name: name.trim(),
      tag: 'JP1',
      ...ROLES.reduce((acc, role) => ({
        ...acc,
        [`${role}_rate`]: rate,
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

  const handleGenerateTeams = async () => {
    setTeams(null);
    setGenerateTeamsError(null);
    setIsGeneratingTeams(true);

    const activePlayers = players.filter(p => ROLES.some(role => p[role]));
    
    if (activePlayers.length < 2 || activePlayers.length % 2 !== 0) {
      const errorMsg = "プレイヤー人数は2人以上の偶数にしてください。";
      setGenerateTeamsError(errorMsg);
      setIsGeneratingTeams(false);
      alert(errorMsg);
      return;
    }

    addLog('INFO', 'フロントエンドのレートでチーム分けを実行します', activePlayers);

    try {
      const playerRatings = activePlayers.map(player => {
        const selectedRoles = ROLES.filter(role => player[role]);
        const totalRate = selectedRoles.reduce((acc, role) => acc + (player[`${role}_rate`] || 1500), 0);
        const averageRate = selectedRoles.length > 0 ? totalRate / selectedRoles.length : 1500;
        return {
          ...player,
          mu: averageRate,
        };
      });

      // レート（mu）で降順にソート
      const sortedPlayers = [...playerRatings].sort((a, b) => b.mu - a.mu);

      const teamA = [];
      const teamB = [];
      let scoreA = 0;
      let scoreB = 0;

      // グリーディ法でチーム分け
      sortedPlayers.forEach(player => {
        const playerWithDisplayName = {
          ...player,
          displayName: `${player.name}#${player.tag}`
        };

        if (scoreA <= scoreB) {
          teamA.push(playerWithDisplayName);
          scoreA += player.mu;
        } else {
          teamB.push(playerWithDisplayName);
          scoreB += player.mu;
        }
      });
      
      const teamsData = { teamA, teamB, scoreA: scoreA.toFixed(2), scoreB: scoreB.toFixed(2) };
      setTeams(teamsData);
      addLog('SUCCESS', 'フロントエンドでのチーム分け成功', teamsData);

    } catch (error) {
      console.error('Team generation failed:', error);
      const errorMsg = error.message || '不明なエラーが発生しました。';
      setGenerateTeamsError(errorMsg);
      addLog('ERROR', `チーム分け失敗: ${errorMsg}`);
      alert(`チーム分けに失敗しました: ${errorMsg}`);
    } finally {
      setIsGeneratingTeams(false);
    }
  };

  const copyResults = (type = 'standard') => {
    if (!teams) return;

    let text;
    const team1 = teams.teamA;
    const team2 = teams.teamB;
    
    text = `チーム1 (合計レート: ${teams.scoreA})----
` +
            team1.map(p => `${p.displayName} (レート: ${p.mu.toFixed(2)})`).join('\n') +
            `\n\nチーム2 (合計レート: ${teams.scoreB})----
` +
            team2.map(p => `${p.displayName} (レート: ${p.mu.toFixed(2)})`).join('\n');

    if (type === 'opgg') {
      const getOpgg = (team) => {
        const summoners = team.map(p => {
          const namePart = p.displayName.split('#')[0];
          const tagPart = p.displayName.split('#')[1];
          return encodeURIComponent(`${namePart}#${tagPart}`);
        }).join('%2C');
        return `https://www.op.gg/multisearch/jp?summoners=${summoners}`;
      };
      text += `\n\nTeam1 OPGG: ${getOpgg(team1)}\nTeam2 OPGG: ${getOpgg(team2)}`;
    }

    navigator.clipboard.writeText(text).then(() => {
      setStatusMsg('コピーしました！');
      setTimeout(() => setStatusMsg(''), 3000);
    });
  };

  const exportJSON = async () => {
    const data = players.reduce((acc, p) => {
      acc[p.name] = { 
        tag: p.tag, 
        rate: ROLES.reduce((rAcc, r) => ({ ...rAcc, [r]: p[`${r}_rate`] }), {}), 
        role: ROLES.reduce((rAcc, r) => ({ ...rAcc, [r]: p[r] }), {}) 
      };
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
    
      const handleUpdateRatings = async () => {
        setUpdateRatingsError(null);
        addLog('INFO', 'DB保存実行前のプレイヤーリスト:', players);
        setIsUpdatingRatings(true);
        setStatusMsg('DBにレートを保存中...');
    
        const playersWithPuuid = players.filter(p => p.puuid);
        if (playersWithPuuid.length === 0) {
          const errorMsg = "レートを保存するには、ロビーからプレイヤー情報を読み込み、PUUIDが設定されている必要があります。";
          setUpdateRatingsError(errorMsg);
          setIsUpdatingRatings(false);
          setStatusMsg('');
          alert(errorMsg);
          return;
        }
    
        const ratingsData = playersWithPuuid.flatMap(player =>
          ROLES.map(role => ({
            puuid: player.puuid,
            lane: ROLE_MAP[role],
            mu: player[`${role}_rate`] || 1500,
          }))
        );
    
        addLog('SEND', 'プレイヤーレートをDBに保存します', ratingsData);
    
        try {
          const response = await fetch('/api/update_ratings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ratings: ratingsData }),
          });
    
          const result = await response.json();
    
          if (!response.ok) {
            throw new Error(result.error || 'レートの更新に失敗しました。');
          }
    
          setStatusMsg('プレイヤーレートをDBに保存しました！');
          addLog('SUCCESS', 'プレイヤーレートのDB保存成功', result);
          setTimeout(() => setStatusMsg(''), 3000);
        } catch (error) {
          console.error('Rating update failed:', error);
          const errorMsg = error.message || '不明なエラーが発生しました。';
          setUpdateRatingsError(errorMsg);
          setStatusMsg(`エラー: ${errorMsg}`);
          addLog('ERROR', `レート保存失敗: ${errorMsg}`);
          alert(`レートの保存に失敗しました: ${errorMsg}`);
          setTimeout(() => setStatusMsg(''), 5000);
        } finally {
          setIsUpdatingRatings(false);
        }
      };

      const handleLoadFromDB = async () => {
        setIsLoadingFromDB(true);
        setStatusMsg('DBから既存プレイヤーのレートを読み込み中...');
        addLog('SEND', 'DBから全プレイヤーのレートを読み込みます');
    
        try {
          const response = await fetch('/api/get_all_ratings');
          const dbPlayers = await response.json();
    
          if (!response.ok) {
            throw new Error(dbPlayers.error || 'DBからのレート読み込みに失敗しました。');
          }
    
          addLog('SUCCESS', 'DBからのレート読み込み成功', dbPlayers);
    
          setPlayers(prevPlayers => {
            const dbRatingsMap = new Map();
            dbPlayers.forEach(p => dbRatingsMap.set(p.puuid, p));

            const updatedPlayers = prevPlayers.map(player => {
              if (player.puuid && dbRatingsMap.has(player.puuid)) {
                const dbPlayer = dbRatingsMap.get(player.puuid);
                return {
                  ...player,
                  name: dbPlayer.gameName,
                  tag: dbPlayer.tagLine,
                  TOP_rate: dbPlayer.top,
                  JUNGLE_rate: dbPlayer.jg,
                  MIDDLE_rate: dbPlayer.mid,
                  BOTTOM_rate: dbPlayer.bot,
                  UTILITY_rate: dbPlayer.sup,
                };
              }
              return player;
            });
            return updatedPlayers;
          });
    
          setStatusMsg(`既存プレイヤーの情報をDBから更新しました。`);
          setTimeout(() => setStatusMsg(''), 3000);
    
        } catch (error) {
          console.error('Failed to load ratings from DB:', error);
          const errorMsg = error.message || '不明なエラーが発生しました。';
          setStatusMsg(`エラー: ${errorMsg}`);
          addLog('ERROR', `DBからのレート読み込み失敗: ${errorMsg}`);
          alert(`DBからのレート読み込みに失敗しました: ${errorMsg}`);
          setTimeout(() => setStatusMsg(''), 5000);
        } finally {
          setIsLoadingFromDB(false);
        }
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
            throw new Error(result.error || 'サーバーでエラーが発生しました。');
          }
    
          setStatusMsg('アップロード成功！プレイヤーレートを更新しました。');
          addLog('SUCCESS', 'アップロード成功、レート更新', result);
          
          if (result.updated_ratings && result.updated_ratings.length > 0) {
            const LANE_TO_ROLE_MAP = Object.fromEntries(Object.entries(ROLE_MAP).map(([role, lane]) => [lane, role]));
            
            const ratingsByPuuid = new Map();
            result.updated_ratings.forEach(rating => {
              if (!ratingsByPuuid.has(rating.puuid)) {
                ratingsByPuuid.set(rating.puuid, []);
              }
              ratingsByPuuid.get(rating.puuid).push(rating);
            });
    
            setPlayers(prevPlayers => {
              return prevPlayers.map(player => {
                const playerUpdates = ratingsByPuuid.get(player.puuid);
                if (playerUpdates) {
                  const updatedPlayer = { ...player };
                  playerUpdates.forEach(update => {
                    const role = LANE_TO_ROLE_MAP[update.lane];
                    if (role) {
                      updatedPlayer[`${role}_rate`] = update.mu;
                    }
                  });
                  return updatedPlayer;
                }
                return player;
              });
            });
          }
    
        } catch (error) {
          console.error('Upload failed:', error);
          setStatusMsg(`アップロード失敗: ${error.message}`);
          addLog('ERROR', `アップロード失敗: ${error.message}`);
          alert(`アップロードに失敗しました: ${error.message}`);
        } finally {
          setIsUploading(false);
          setTimeout(() => setStatusMsg(''), 5000);
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
                          inputRate={inputRate}
                          onInputRateChange={(e) => setInputRate(parseFloat(e.target.value) || 0)}
                          onAddPlayer={() => addPlayer()}
                        />
            
                        
                        <TeamResults
                          teams={teams}
                          isGeneratingTeams={isGeneratingTeams}
                          generateTeamsError={generateTeamsError}
                          onCopy={copyResults}
                          statusMsg={statusMsg}
                        />
            
                        <PlayerList
                          players={players}
                          onGenerateTeams={handleGenerateTeams}
                          onUpdateRatings={handleUpdateRatings}
                          isUpdatingRatings={isUpdatingRatings}
                          onLoadFromDB={handleLoadFromDB}
                          isLoadingFromDB={isLoadingFromDB}
                          onClear={() => setPlayers([])}
                          onUpdatePlayer={updatePlayer}
                          onCheckAllRoles={checkAllRoles}
                          onRemovePlayer={removePlayer}
                        />          </div>
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
              championMap={championMap}
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

export default App;