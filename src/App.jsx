import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Twitter, Github } from 'lucide-react';
import Header from './components/Header';
import PlayerInput from './components/PlayerInput';
import PlayerList from './components/PlayerList';
import TeamResults from './components/TeamResults';
import MatchHistory from './components/MatchHistory';
import Profile from './components/Profile';
import './App.css';
import { ROLES, RANK_MAP, ROLE_MAP } from './constants';


const VERSION = "v2.0.0-β.1";

function App() {
  const [players, setPlayers] = useState([]);
  const [inputName, setInputName] = useState('');
  const [inputTag, setInputTag] = useState('');
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
  const [rateTolerance, setRateTolerance] = useState(500);
  
  const [ddragonUrl, setDdragonUrl] = useState('');
  const [currentUserPuuid, setCurrentUserPuuid] = useState(null);

  // Profile State
  const [showProfile, setShowProfile] = useState(false);
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
  const [matchesWebhookUrl, setMatchesWebhookUrl] = useState('');
  
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
        const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
        const versions = await versionsResponse.json();
        const latestVersion = versions[0];
        setDdragonUrl(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}`);
        addLog('INFO', `Latest DDragon version: ${latestVersion}`);

        const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
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
    const savedTeamsUrl = localStorage.getItem('lol_custom_teams_webhook_url');
    if (savedTeamsUrl) setTeamsWebhookUrl(savedTeamsUrl);
    const savedMatchesUrl = localStorage.getItem('lol_custom_matches_webhook_url');
    if (savedMatchesUrl) setMatchesWebhookUrl(savedMatchesUrl);
  }, []);

  useEffect(() => {
    localStorage.setItem('lol_custom_players', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem('lol_custom_path', pathDisplay);
  }, [pathDisplay]);

  useEffect(() => {
    localStorage.setItem('lol_custom_teams_webhook_url', teamsWebhookUrl);
  }, [teamsWebhookUrl]);

  useEffect(() => {
    localStorage.setItem('lol_custom_matches_webhook_url', matchesWebhookUrl);
  }, [matchesWebhookUrl]);

  const handleMessage = useCallback(async (event) => {
    if (event.data && (event.data.type === 'LCU_LOBBY_DATA_RESPONSE' || event.data.type === 'LCU_ERROR' || event.data.type === 'LCU_SEARCH_PLAYER_RESPONSE')) {
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
            } else {
              throw new Error(ratingsData.error || 'DBレートの取得に失敗しました。');
            }
          } catch (error) {
            addLog('ERROR', `DBレート取得失敗: ${error.message}`);
            // エラーでも処理は続行する
          }
        }
  
        setPlayers(prevPlayers => {
          const newPlayersToAdd = [];
          lcuPlayers.forEach(lcuPlayer => {
            const existingPlayer = prevPlayers.find(p => p.puuid === lcuPlayer.puuid);
            if (!existingPlayer) {
              const playerDbRatings = ratingsData ? ratingsData[lcuPlayer.puuid] : null;
              let fallbackRate = 1500;
              if (lcuPlayer.tier) {
                const tier = lcuPlayer.tier.toUpperCase();
                const division = lcuPlayer.division ? lcuPlayer.division.toUpperCase() : '';
                const rankString = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier) ? tier : `${tier} ${division}`.trim();
                fallbackRate = RANK_MAP[rankString] !== undefined ? RANK_MAP[rankString] : 1500;
              }
              const roleRates = {};
              if (playerDbRatings) {
                ROLES.forEach(role => {
                  const lane = ROLE_MAP[role];
                  roleRates[`${role}_rate`] = playerDbRatings[lane] || fallbackRate;
                });
              } else {
                ROLES.forEach(role => {
                  roleRates[`${role}_rate`] = fallbackRate;
                });
              }
              
              newPlayersToAdd.push({
                id: lcuPlayer.puuid,
                puuid: lcuPlayer.puuid,
                name: lcuPlayer.name,
                tag: lcuPlayer.tag || 'JP1',
                ...roleRates,
                ...ROLES.reduce((acc, role) => ({ ...acc, [role]: true }), {})
              });
            }
          });

          if (newPlayersToAdd.length > 0) {
            setStatusMsg(`${newPlayersToAdd.length}人の新しいプレイヤーを読み込みました。`);
            addLog('SUCCESS', `新しいプレイヤーを追加: ${newPlayersToAdd.length}人`);
            setTimeout(() => setStatusMsg(''), 3000);
          } else {
            setStatusMsg('新しいプレイヤーはいませんでした。');
            addLog('INFO', '追加する新しいプレイヤーはいません');
            setTimeout(() => setStatusMsg(''), 3000);
          }
          
          return [...prevPlayers, ...newPlayersToAdd];
        });
  
      } else {
        const errorMsg = event.data.error || 'ロビー情報の取得に失敗しました。';
        setStatusMsg(errorMsg);
        addLog('ERROR', errorMsg);
        alert(errorMsg);
      }
    } else if (event.data && event.data.type === 'LCU_SEARCH_PLAYER_RESPONSE') {
      setIsLoadingLobby(false); // スピナーを止めるために流用
      if (event.data.success && event.data.data) {
          addLog('INFO', '拡張機能から受信した検索プレイヤーデータ:', event.data.data);
          const searchedPlayer = event.data.data;
  
          // プレイヤーがリストに既にいるか確認
          if (players.some(p => p.puuid === searchedPlayer.puuid)) {
              setStatusMsg('このプレイヤーは既に追加されています。');
              addLog('WARN', 'プレイヤーは既に追加されています', searchedPlayer);
              setTimeout(() => setStatusMsg(''), 3000);
              return;
          }
  
          // レート情報を取得
          let fallbackRate = 1500;
          if (searchedPlayer.tier) {
              const tier = searchedPlayer.tier.toUpperCase();
              const division = searchedPlayer.division ? searchedPlayer.division.toUpperCase() : '';
              const rankString = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier) ? tier : `${tier} ${division}`.trim();
              fallbackRate = RANK_MAP[rankString] !== undefined ? RANK_MAP[rankString] : 1500;
          }
          const roleRates = {};
          ROLES.forEach(role => {
              roleRates[`${role}_rate`] = fallbackRate;
          });
  
          const newPlayer = {
              id: searchedPlayer.puuid,
              puuid: searchedPlayer.puuid,
              name: searchedPlayer.name,
              tag: searchedPlayer.tag,
              ...roleRates,
              ...ROLES.reduce((acc, role) => ({ ...acc, [role]: true }), {})
          };
  
          setPlayers(prev => [...prev, newPlayer]);
          setStatusMsg(`${newPlayer.name}#${newPlayer.tag} を追加しました。`);
          addLog('SUCCESS', 'プレイヤー追加完了', newPlayer);
          setTimeout(() => setStatusMsg(''), 3000);
  
      } else {
          const errorMsg = event.data.error || 'プレイヤーの検索に失敗しました。';
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
  }, [addLog, setIsLoadingLobby, setStatusMsg, setMatches, setCurrentUserPuuid, championMap, players]);

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

  const handleAddPlayerByRiotId = () => {
    if (!inputName.trim() || !inputTag.trim()) {
      alert('サモナー名とゲームタグを入力してください。');
      return;
    }
    
    if (!lcuInfo) {
      alert('先にLoLクライアントの情報を読み込んでください。');
      return;
    }

    setIsLoadingLobby(true); // スピナー表示
    const messageData = {
      type: 'SEARCH_PLAYER_BY_RIOT_ID_REQUEST',
      port: lcuInfo.port,
      password: lcuInfo.password,
      gameName: inputName,
      tagLine: inputTag,
    };
    
    addLog('SEND', '拡張機能へプレイヤー検索リクエストを送信', messageData);
    window.postMessage(messageData, "*");

    setInputName('');
    setInputTag('');
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

  const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // --- New Team Generation Logic ---

  /**
   * Generates all combinations of n elements from an array.
   * @param {Array} arr The source array.
   * @param {number} n The number of elements to combine.
   * @returns {Generator<Array<any>>} A generator for the combinations.
   */
  function* combinations(arr, n) {
    if (n === 0) {
      yield [];
      return;
    }
    for (let i = 0; i <= arr.length - n; i++) {
      for (const rest of combinations(arr.slice(i + 1), n - 1)) {
        yield [arr[i], ...rest];
      }
    }
  }

  /**
   * Generates the Cartesian product of multiple arrays.
   * @param {Array<Array<any>>} arrays An array of arrays.
   * @returns {Generator<Array<any>>} A generator for the product.
   */
  function* product(...arrays) {
    if (arrays.length === 0) {
      yield [];
      return;
    }
    const [head, ...tail] = arrays;
    for (const h of head) {
      for (const t of product(...tail)) {
        yield [h, ...t];
      }
    }
  }

  /**
   * Creates valid 5-player team combinations from a list of 10 players.
   * A valid team combination is one where both teams can cover all 5 roles.
   * @param {Array<Object>} players - The list of 10 players.
   * @returns {Array<Array<Array<Object>>>} An array of valid [teamA, teamB] pairs.
   */
  const createTeams = (players) => {
    const validTeams = [];
    for (const teamA of combinations(players, 5)) {
      const teamB = players.filter(p => !teamA.includes(p));

      const teamACanCoverAllRoles = ROLES.every(role =>
        teamA.some(player => player[role])
      );
      const teamBCanCoverAllRoles = ROLES.every(role =>
        teamB.some(player => player[role])
      );

      if (teamACanCoverAllRoles && teamBCanCoverAllRoles) {
        validTeams.push([teamA, teamB]);
      }
    }
    return validTeams;
  };

  /**
   * Assigns roles to a 5-player team, generating all valid unique assignments.
   * @param {Array<Object>} team - A 5-player team.
   * @returns {Array<Array<Object>>} An array of assigned teams, where each element is a 5-player array ordered by ROLES.
   */
  const assignRoles = (team) => {
    const assignments = [];
    const rolePlayerOptions = ROLES.map(role =>
      team.filter(player => player[role])
    );

    if (rolePlayerOptions.some(options => options.length === 0)) {
      return []; // A role cannot be filled.
    }

    for (const assignment of product(...rolePlayerOptions)) {
      // Check for uniqueness (each player assigned to exactly one role)
      if (new Set(assignment).size === 5) {
        assignments.push(assignment);
      }
    }
    return assignments;
  };


  const handleGenerateTeams = async () => {
    setTeams(null);
    setGenerateTeamsError(null);
    setIsGeneratingTeams(true);
    addLog('INFO', '組み合わせベースのチーム分けを開始します', { players, rateTolerance });

    let activePlayers = players.filter(p => ROLES.some(role => p[role]));

    if (activePlayers.length !== 10) {
      const errorMsg = "プレイヤー人数は10人にしてください。";
      setGenerateTeamsError(errorMsg);
      setIsGeneratingTeams(false);
      alert(errorMsg);
      addLog('ERROR', errorMsg, { playerCount: activePlayers.length });
      return;
    }
    
    // Shuffle players to ensure variety in team compositions
    activePlayers = shuffleArray(activePlayers);

    // Use a Promise to move the heavy computation off the main thread briefly, allowing UI to update.
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const possibleTeamCombinations = createTeams(activePlayers);
      if (possibleTeamCombinations.length === 0) {
        throw new Error("全ロールをカバーできるチームの組み合わせが見つかりませんでした。各プレイヤーの希望ロールを確認してください。");
      }

      let bestTeamArrangement = null;
      let minDifference = Infinity;

      searchLoop: for (const [teamA, teamB] of possibleTeamCombinations) {
        const assignmentsA = shuffleArray(assignRoles(teamA));
        const assignmentsB = shuffleArray(assignRoles(teamB));

        if (assignmentsA.length === 0 || assignmentsB.length === 0) {
          continue; // No valid role assignments for this team combination.
        }

        for (const assignedTeamA of assignmentsA) {
          for (const assignedTeamB of assignmentsB) {
            const scoreA = assignedTeamA.reduce((acc, player, index) => {
              const role = ROLES[index];
              return acc + (player[`${role}_rate`] || 1500);
            }, 0);

            const scoreB = assignedTeamB.reduce((acc, player, index) => {
              const role = ROLES[index];
              return acc + (player[`${role}_rate`] || 1500);
            }, 0);

            const currentDifference = Math.abs(scoreA - scoreB);

            if (currentDifference < minDifference) {
              minDifference = currentDifference;
              bestTeamArrangement = {
                teamA: assignedTeamA,
                teamB: assignedTeamB,
                scoreA: scoreA,
                scoreB: scoreB,
              };

              // If the difference is within tolerance, stop searching
              if (minDifference <= rateTolerance) {
                addLog('INFO', `許容誤差内の組み合わせを発見。計算を終了します。 (差: ${minDifference})`);
                break searchLoop;
              }
            }
          }
        }
      }

      if (bestTeamArrangement) {
        const formatTeam = (assignedTeam) => {
          return assignedTeam.map((player, index) => {
            const role = ROLES[index];
            return {
              ...player,
              displayName: `${player.name}#${player.tag}`,
              assignedRole: role,
              mu: player[`${role}_rate`] || 1500,
            };
          });
        };
        
        const finalTeams = {
          teamA: formatTeam(bestTeamArrangement.teamA),
          teamB: formatTeam(bestTeamArrangement.teamB),
          scoreA: bestTeamArrangement.scoreA.toFixed(2),
          scoreB: bestTeamArrangement.scoreB.toFixed(2)
        };
        
        setTeams(finalTeams);
        addLog('SUCCESS', 'チーム分け成功', { finalTeams, minDifference });

      } else {
        throw new Error('チーム分けに失敗しました。適切な組み合わせが見つかりません。');
      }

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

  const handleSendTeamsToDiscord = async () => {
    if (!teams || !teamsWebhookUrl) {
      setStatusMsg('チームデータまたはWebhook URLがありません。');
      setTimeout(() => setStatusMsg(''), 3000);
      return;
    }

    setStatusMsg('Discordに送信中...');

    const { teamA, teamB, scoreA, scoreB } = teams;
    const diff = Math.abs(scoreA - scoreB).toFixed(2);
    const getOpgg = (team) => {
      const summoners = team.map(p => {
        const namePart = p.displayName.split('#')[0];
        const tagPart = p.displayName.split('#')[1];
        return encodeURIComponent(`${namePart}#${tagPart}`);
      }).join('%2C');
      return `https://www.op.gg/multisearch/jp?summoners=${summoners}`;
    };
    const embed = {
      title: 'カスタムゲーム チーム分け結果',
      color: 3447003, // Blue
      fields: [
        {
          name: `🔵 チーム1 (合計レート: ${Math.trunc(scoreA)})`,
          value: teamA.map(p => `> **${ROLE_MAP[p.assignedRole]}**: ${p.displayName.split('#')[0]} (${p.mu.toFixed(0)})`).join('\n') + `\n\n**[OPGG](${getOpgg(teamA)})**\n`,
          inline: true,
        },
        {
          name: `🔴 チーム2 (合計レート: ${Math.trunc(scoreB)})`,
          value: teamB.map(p => `> **${ROLE_MAP[p.assignedRole]}**: ${p.displayName.split('#')[0]} (${p.mu.toFixed(0)})`).join('\n') + `\n\n**[OPGG](${getOpgg(teamB)})**\n`,
          inline: true,
        },
        {
            name: '📈 レート差',
            value: `**${diff}**`,
            inline: false,
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'LoLチーム分けツール',
      },
    };

    try {
      const response = await fetch(teamsWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'LoLチーム分けツール',
          // avatar_url: 'https://i.imgur.com/hGGY7p8.png', // A generic league-related icon
          embeds: [embed],
        }),
      });

      if (response.ok) {
        setStatusMsg('Discordに送信しました！');
        addLog('SUCCESS', 'Discord Webhook送信成功');
      } else {
        const errorText = await response.text();
        throw new Error(`Discord APIエラー: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Discord webhook send failed:', error);
      setStatusMsg('Discordへの送信に失敗しました。');
      addLog('ERROR', `Discord Webhook送信失敗: ${error.message}`);
      alert(`Discordへの送信に失敗しました: ${error.message}`);
    } finally {
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  const handleSaveWebhookUrls = (urls) => {
    setTeamsWebhookUrl(urls.teams);
    setMatchesWebhookUrl(urls.matches);
    setShowProfile(false);
    setStatusMsg('Webhook URLを保存しました！');
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const copyResults = (type = 'standard') => {
    if (!teams) return;

    let text;
    const team1 = teams.teamA;
    const team2 = teams.teamB;
    
    text = ` \nチーム1 (合計レート: ${teams.scoreA})----
` +
            team1.map(p => `${ROLE_MAP[p.assignedRole]}:${p.displayName} `).join('\n') +
            `\n\nチーム2 (合計レート: ${teams.scoreB})----
` +
            team2.map(p => `${ROLE_MAP[p.assignedRole]}:${p.displayName} `).join('\n');

    if (type === 'opgg') {
      const getOpgg = (team) => {
        const summoners = team.map(p => {
          const namePart = p.displayName.split('#')[0];
          const tagPart = p.displayName.split('#')[1];
          return encodeURIComponent(`${namePart}#${tagPart}`);
        }).join('%2C');
        return `[OPGG](https://www.op.gg/multisearch/jp?summoners=${summoners})`;
      };
      text += `\n\nTeam1 OPGG: ${getOpgg(team1)}\nTeam2 OPGG: ${getOpgg(team2)}`;
    }

    navigator.clipboard.writeText(text).then(() => {
      setStatusMsg('コピーしました！');
      setTimeout(() => setStatusMsg(''), 3000);
    });
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
    
      const handleSendMatchToDiscord = async (matchData, ratingChanges = null) => {
        if (!matchData || !matchesWebhookUrl) {
          setStatusMsg('試合データまたはWebhook URLがありません。');
          setTimeout(() => setStatusMsg(''), 3000);
          return;
        }

        setStatusMsg('Discordに送信中...');
        addLog('SEND', '試合結果をDiscordに送信します', {matchData, ratingChanges});

        const blueTeam = matchData.participants.filter(p => p.teamId === 100);
        const redTeam = matchData.participants.filter(p => p.teamId === 200);

        const getTeamStats = (team) => team.reduce((acc, p) => {
            acc.kills += p.stats.kills;
            acc.deaths += p.stats.deaths;
            acc.assists += p.stats.assists;
            return acc;
        }, { kills: 0, deaths: 0, assists: 0 });

        const blueTeamStats = getTeamStats(blueTeam);
        const redTeamStats = getTeamStats(redTeam);
        const blueTeamWon = blueTeam[0]?.stats.win;

        const formatPlayer = (p) => {
            const identity = matchData.participantIdentities.find(pi => pi.participantId === p.participantId);
            const name = identity?.player.gameName || p.summonerName;
            return `> ${p.championName} **${name}** (${p.stats.kills}/${p.stats.deaths}/${p.stats.assists})`;
        };

        const embed = {
          title: `カスタムゲーム 対戦結果 (${new Date(matchData.gameCreation).toLocaleDateString()})`,
          description: `試合時間: ${Math.floor(matchData.gameDuration / 60)}分${matchData.gameDuration % 60}秒`,
          color: blueTeamWon ? 3447003 : 15158332, // Blue for win, Red for loss
          fields: [
            {
              name: `🔵 ${blueTeamWon ? '勝利' : '敗北'} (ブルーチーム) - ${blueTeamStats.kills}/${blueTeamStats.deaths}/${blueTeamStats.assists}`,
              value: blueTeam.map(formatPlayer).join('\n'),
              inline: false,
            },
            {
              name: `🔴 ${!blueTeamWon ? '勝利' : '敗北'} (レッドチーム) - ${redTeamStats.kills}/${redTeamStats.deaths}/${redTeamStats.assists}`,
              value: redTeam.map(formatPlayer).join('\n'),
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'LoLチーム分けツール',
          },
        };

        if (ratingChanges && ratingChanges.length > 0) {
            embed.fields.push({
                name: '📈 レート変動',
                value: ratingChanges.map(c => {
                    const sign = c.diff >= 0 ? '+' : '';
                    const roleName = ROLE_MAP[c.role] || c.role;
                    return `> **${c.name}** (${roleName}): ${c.oldRate.toFixed(0)} → **${c.newRate.toFixed(0)}** (${sign}${c.diff.toFixed(2)})`;
                }).join('\n'),
                inline: false,
            });
        }

        try {
          const response = await fetch(matchesWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'LoLチーム分けツール',
              // avatar_url: 'https://i.imgur.com/hGGY7p8.png',
              embeds: [embed],
            }),
          });

          if (response.ok) {
            setStatusMsg('Discordに送信しました！');
            addLog('SUCCESS', 'Discord Webhook(試合結果)送信成功');
          } else {
            const errorText = await response.text();
            throw new Error(`Discord APIエラー: ${response.status} ${errorText}`);
          }
        } catch (error) {
          console.error('Discord webhook send failed:', error);
          setStatusMsg('Discordへの送信に失敗しました。');
          addLog('ERROR', `Discord Webhook(試合結果)送信失敗: ${error.message}`);
          alert(`Discordへの送信に失敗しました: ${error.message}`);
        } finally {
          // Do not clear status message here as it might be controlled by the calling function (handleUploadMatch)
        }
      };

      const handleUploadMatch = async (matchData) => {
        if (!matchData) {
          setStatusMsg('アップロードする試合が選択されていません。');
          return;
        }
        setIsUploading(true);
        setStatusMsg('試合結果をアップロード中...');
        addLog('SEND', 'サーバーへ試合結果をアップロードします', matchData);
    
        // Keep a copy of players before the update to calculate rating changes
        const playersBeforeUpdate = JSON.parse(JSON.stringify(players));
    
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
          
          let ratingChanges = [];
    
          if (result.updated_ratings && result.updated_ratings.length > 0) {
            const LANE_TO_ROLE_MAP = Object.fromEntries(Object.entries(ROLE_MAP).map(([role, lane]) => [lane, role]));
            
            const ratingsByPuuid = new Map();
            result.updated_ratings.forEach(rating => {
              if (!ratingsByPuuid.has(rating.puuid)) {
                ratingsByPuuid.set(rating.puuid, []);
              }
              ratingsByPuuid.get(rating.puuid).push(rating);
            });
    
            // Calculate rating changes
            result.updated_ratings.forEach(update => {
              const oldPlayer = playersBeforeUpdate.find(p => p.puuid === update.puuid);
              const role = LANE_TO_ROLE_MAP[update.lane];
              if (oldPlayer && role) {
                const oldRate = oldPlayer[`${role}_rate`] || 1500;
                const newRate = update.mu;
                ratingChanges.push({
                  name: oldPlayer.name,
                  role: role,
                  oldRate: oldRate,
                  newRate: newRate,
                  diff: newRate - oldRate,
                });
              }
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
    
            // Notify Discord with rating changes
            if (matchesWebhookUrl) {
              await handleSendMatchToDiscord(matchData, ratingChanges);
            }
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
                      showDebug={showDebug}
                      onToggleDebug={() => setShowDebug(!showDebug)}
                      debugLogs={logs}
                      logsEndRef={logsEndRef}
                      onClearLogs={() => setLogs([])}
                      onToggleProfile={() => setShowProfile(true)}
                    />
            
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                      <div className="md:col-span-2 space-y-6">
                        <PlayerInput
                          inputName={inputName}
                          onInputNameChange={(e) => setInputName(e.target.value)}
                          inputTag={inputTag}
                          onInputTagChange={(e) => setInputTag(e.target.value)}
                          onAddPlayer={handleAddPlayerByRiotId}
                        />
            
                        
                        <TeamResults
                          teams={teams}
                          isGeneratingTeams={isGeneratingTeams}
                          generateTeamsError={generateTeamsError}
                          onCopy={copyResults}
                          statusMsg={statusMsg}
                          onSendToDiscord={handleSendTeamsToDiscord}
                          teamsWebhookUrl={teamsWebhookUrl}
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
                          rateTolerance={rateTolerance}
                          onRateToleranceChange={setRateTolerance}
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
              ddragonUrl={ddragonUrl}
              onSendMatchToDiscord={handleSendMatchToDiscord}
              matchesWebhookUrl={matchesWebhookUrl}
            />
          </div>
        </div>

        {showProfile && (
          <Profile
            onClose={() => setShowProfile(false)}
            onSave={handleSaveWebhookUrls}
            initialTeamsWebhookUrl={teamsWebhookUrl}
            initialMatchesWebhookUrl={matchesWebhookUrl}
          />
        )}

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