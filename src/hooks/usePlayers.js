import { useState, useEffect, useCallback } from 'react';
import { ROLES, RANK_MAP, ROLE_MAP } from '../constants';

export function usePlayers(addLog, lcuInfo) {
  const [players, setPlayers] = useState([]);
  const [inputName, setInputName] = useState('');
  const [inputTag, setInputTag] = useState('');
  const [isUpdatingRatings, setIsUpdatingRatings] = useState(false);
  const [updateRatingsError, setUpdateRatingsError] = useState(null);
  const [isLoadingFromDB, setIsLoadingFromDB] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Load players from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lol_custom_players');
      if (saved) {
        setPlayers(JSON.parse(saved));
        addLog('INFO', 'プレイヤーデータをlocalStorageから読み込みました。');
      }
    } catch (error) {
      addLog('ERROR', 'localStorageからのプレイヤーデータの読み込みに失敗しました。', error);
    }
  }, [addLog]);

  // Save players to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lol_custom_players', JSON.stringify(players));
    } catch (error) {
      addLog('ERROR', 'localStorageへのプレイヤーデータの保存に失敗しました。', error);
    }
  }, [players, addLog]);

  const removePlayer = (id) => {
    setPlayers(currentPlayers => currentPlayers.filter(p => p.id !== id));
    addLog('INFO', `プレイヤーを削除しました (ID: ${id})`);
  };

  const updatePlayer = (id, field, value) => {
    setPlayers(currentPlayers =>
      currentPlayers.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const checkAllRoles = (id) => {
    setPlayers(currentPlayers =>
      currentPlayers.map(p => {
        if (p.id === id) {
          const updates = ROLES.reduce((acc, r) => ({ ...acc, [r]: true }), {});
          return { ...p, ...updates };
        }
        return p;
      })
    );
  };

  const clearPlayers = () => {
    setPlayers([]);
    addLog('INFO', 'すべてのプレイヤーをリストから削除しました。');
  };

  const handleAddPlayerByRiotId = () => {
    if (!inputName.trim() || !inputTag.trim()) {
      alert('サモナー名とゲームタグを入力してください。');
      return;
    }
    if (!lcuInfo) {
      alert('先にLoLクライアントの情報を読み込んでください。');
      return;
    }

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

  const processLobbyData = useCallback(async (lcuPlayers) => {
      addLog('INFO', '拡張機能から受信したプレイヤーデータ:', lcuPlayers);
      const puuids = lcuPlayers.map(p => p.puuid).filter(Boolean);
      const dbRatings = new Map();

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
            if (Array.isArray(ratingsData)) {
              ratingsData.forEach(p => dbRatings.set(p.puuid, p));
            }
          } else {
            throw new Error(ratingsData.error || 'DBレートの取得に失敗しました。');
          }
        } catch (error) {
          addLog('ERROR', `DBレート取得失敗: ${error.message}`);
        }
      }

      setPlayers(prevPlayers => {
        const newPlayersToAdd = [];
        lcuPlayers.forEach(lcuPlayer => {
          const existingPlayer = prevPlayers.find(p => p.puuid === lcuPlayer.puuid);
          if (!existingPlayer) {
            const playerDbRatings = dbRatings.get(lcuPlayer.puuid);
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
        } else {
            setStatusMsg('新しいプレイヤーはいませんでした。');
            addLog('INFO', '追加する新しいプレイヤーはいません');
        }
        setTimeout(() => setStatusMsg(''), 3000);
        
        return [...prevPlayers, ...newPlayersToAdd];
      });
  }, [addLog]);

  const processSearchedPlayerData = useCallback((searchedPlayer) => {
    addLog('INFO', '拡張機能から受信した検索プレイヤーデータ:', searchedPlayer);

    if (players.some(p => p.puuid === searchedPlayer.puuid)) {
        setStatusMsg('このプレイヤーは既に追加されています。');
        addLog('WARN', 'プレイヤーは既に追加されています', searchedPlayer);
        setTimeout(() => setStatusMsg(''), 3000);
        return;
    }

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
  }, [addLog, players]);


  const handleUpdateRatings = async () => {
    setUpdateRatingsError(null);
    setIsUpdatingRatings(true);
    setStatusMsg('DBにレートを保存中...');

    const playersWithPuuid = players.filter(p => p.puuid);
    if (playersWithPuuid.length === 0) {
      const errorMsg = "レートを保存するには、ロビーからプレイヤー情報を読み込み、PUUIDが設定されている必要があります。";
      setUpdateRatingsError(errorMsg);
      setIsUpdatingRatings(false);
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
      if (!response.ok) throw new Error(result.error || 'レートの更新に失敗しました。');
      setStatusMsg('プレイヤーレートをDBに保存しました！');
      addLog('SUCCESS', 'プレイヤーレートのDB保存成功', result);
    } catch (error) {
      const errorMsg = error.message || '不明なエラーが発生しました。';
      setUpdateRatingsError(errorMsg);
      setStatusMsg(`エラー: ${errorMsg}`);
      addLog('ERROR', `レート保存失敗: ${errorMsg}`);
      alert(`レートの保存に失敗しました: ${errorMsg}`);
    } finally {
      setIsUpdatingRatings(false);
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };
  
  const handleLoadFromDB = async () => {
    setIsLoadingFromDB(true);
    setStatusMsg('DBから既存プレイヤーのレートを読み込み中...');
    addLog('SEND', 'DBから全プレイヤーのレートを読み込みます');

    try {
      const response = await fetch('/api/get_all_ratings');
      const dbPlayers = await response.json();
      if (!response.ok) throw new Error(dbPlayers.error || 'DBからのレート読み込みに失敗しました。');
      
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
    } catch (error) {
      const errorMsg = error.message || '不明なエラーが発生しました。';
      setStatusMsg(`エラー: ${errorMsg}`);
      addLog('ERROR', `DBからのレート読み込み失敗: ${errorMsg}`);
      alert(`DBからのレート読み込みに失敗しました: ${errorMsg}`);
    } finally {
      setIsLoadingFromDB(false);
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  return {
    players,
    setPlayers,
    inputName,
    setInputName,
    inputTag,
    setInputTag,
    statusMsg,
    isUpdatingRatings,
    isLoadingFromDB,
    updateRatingsError,
    removePlayer,
    updatePlayer,
    checkAllRoles,
    clearPlayers,
    handleAddPlayerByRiotId,
    handleUpdateRatings,
    handleLoadFromDB,
    processLobbyData,
    processSearchedPlayerData,
  };
}
