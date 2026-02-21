import { useState, useEffect, useCallback } from 'react';
import { ROLE_MAP } from '../constants';

export function useMatchHistory(lcuInfo, matchesWebhookUrl, isRatingUpdateEnabled, addLog, players, setPlayers) {
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentUserPuuid, setCurrentUserPuuid] = useState(null);
  const [championMap, setChampionMap] = useState({});
  const [ddragonUrl, setDdragonUrl] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Fetch champion data on mount
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
        const champMap = Object.values(data.data).reduce((acc, champ) => {
            acc[champ.key] = champ.id;
            return acc;
        }, {});
        setChampionMap(champMap);
        addLog('SUCCESS', 'Champion data loaded successfully');
      } catch (error) {
        addLog('ERROR', 'Failed to fetch champion data:', error);
      }
    };
    fetchChampionData();
  }, [addLog]);

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
  
  const processMatchHistoryData = useCallback((data) => {
    setIsLoadingMatches(false);
    const { games, puuid } = data;
    let extractedGames = Array.isArray(games) ? games : (games?.games && Array.isArray(games.games) ? games.games : []);
    
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
    // Add championName to bans
    if (extractedGames.length > 0 && extractedGames[0].teams) {
      extractedGames.forEach(match => {
        if (match.teams && Array.isArray(match.teams)) {
          match.teams.forEach(team => {
            if (team.bans && Array.isArray(team.bans)) {
              team.bans.forEach(ban => {
                ban.championName = championMap[ban.championId] || 'Unknown';
              });
            }
          });
        }
      });
    }

    setMatches(extractedGames);
    setCurrentUserPuuid(puuid);
    setStatusMsg('対戦履歴を取得しました。');
    addLog('SUCCESS', `対戦履歴取得完了 (PUUID: ${puuid})`);
    setTimeout(() => setStatusMsg(''), 3000);
  }, [addLog, championMap]);


  const handleSendMatchToDiscord = async (matchData, ratingChanges = null) => {
    if (!matchData || !matchesWebhookUrl) {
      setStatusMsg('試合データまたはWebhook URLがありません。');
      setTimeout(() => setStatusMsg(''), 3000);
      return;
    }
    setStatusMsg('Discordに送信中...');
    addLog('SEND', '試合結果をDiscordに送信します', { matchData, ratingChanges });

    const blueTeam = matchData.participants.filter(p => p.teamId === 100);
    const redTeam = matchData.participants.filter(p => p.teamId === 200);
    const getTeamStats = (team) => team.reduce((acc, p) => ({
        kills: acc.kills + p.stats.kills,
        deaths: acc.deaths + p.stats.deaths,
        assists: acc.assists + p.stats.assists
    }), { kills: 0, deaths: 0, assists: 0 });
    const blueStats = getTeamStats(blueTeam);
    const redStats = getTeamStats(redTeam);
    const blueWon = blueTeam[0]?.stats.win;

    const formatPlayer = (p) => {
        const identity = matchData.participantIdentities.find(pi => pi.participantId === p.participantId);
        return `> ${p.championName} **${identity?.player.gameName || p.summonerName}** (${p.stats.kills}/${p.stats.deaths}/${p.stats.assists})`;
    };
    
    const embed = {
      title: `カスタムゲーム 対戦結果 (${new Date(matchData.gameCreation).toLocaleDateString()})`,
      description: `試合時間: ${Math.floor(matchData.gameDuration / 60)}分${matchData.gameDuration % 60}秒`,
      color: blueWon ? 3447003 : 15158332,
      fields: [
        { name: `🔵 ${blueWon ? '勝利' : '敗北'} (ブルー) - ${blueStats.kills}/${blueStats.deaths}/${blueStats.assists}`, value: blueTeam.map(formatPlayer).join('\n'), inline: false },
        { name: `🔴 ${!blueWon ? '勝利' : '敗北'} (レッド) - ${redStats.kills}/${redStats.deaths}/${redStats.assists}`, value: redTeam.map(formatPlayer).join('\n'), inline: false },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'LoLチーム分けツール' },
    };

    if (ratingChanges && ratingChanges.length > 0) {
        embed.fields.push({
            name: '📈 レート変動',
            value: ratingChanges.map(c => {
                const sign = c.diff >= 0 ? '+' : '';
                return `> **${c.name}** (${ROLE_MAP[c.role] || c.role}): ${c.oldRate.toFixed(0)} → **${c.newRate.toFixed(0)}** (${sign}${c.diff.toFixed(2)})`;
            }).join('\n'),
            inline: false,
        });
    }

    try {
        const response = await fetch(matchesWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'LoLチーム分けツール', embeds: [embed] }),
        });
        if (!response.ok) throw new Error(`Discord APIエラー: ${response.status} ${await response.text()}`);
        setStatusMsg('Discordに送信しました！');
        addLog('SUCCESS', 'Discord Webhook(試合結果)送信成功');
    } catch (error) {
        setStatusMsg('Discordへの送信に失敗しました。');
        addLog('ERROR', `Discord Webhook(試合結果)送信失敗: ${error.message}`);
        alert(`Discordへの送信に失敗しました: ${error.message}`);
    } finally {
        setTimeout(() => setStatusMsg(''), 3000);
    }
  };
  
  const handleUploadMatch = async (matchData) => {
    if (!matchData) {
      alert('アップロードする試合が選択されていません。');
      return;
    }
    setIsUploading(true);
    setStatusMsg('試合結果をアップロード中...');
    addLog('SEND', 'サーバーへ試合結果をアップロードします', { matchId: matchData.gameId, updateRating: isRatingUpdateEnabled });

    const playersBeforeUpdate = JSON.parse(JSON.stringify(players));

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...matchData, updateRating: isRatingUpdateEnabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'サーバーでエラーが発生しました。');

      setStatusMsg('アップロード成功！プレイヤーレートを更新しました。');
      addLog('SUCCESS', 'アップロード成功、レート更新', result);
      
      let ratingChanges = [];
      if (isRatingUpdateEnabled && result.updated_ratings?.length > 0) {
        const LANE_TO_ROLE_MAP = Object.fromEntries(Object.entries(ROLE_MAP).map(([role, lane]) => [lane, role]));
        const ratingsByPuuid = new Map(result.updated_ratings.map(r => [r.puuid, r]));

        result.updated_ratings.forEach(update => {
          const oldPlayer = playersBeforeUpdate.find(p => p.puuid === update.puuid);
          const role = LANE_TO_ROLE_MAP[update.lane];
          if (oldPlayer && role) {
            ratingChanges.push({
              name: oldPlayer.name,
              role: role,
              oldRate: oldPlayer[`${role}_rate`] || 1500,
              newRate: update.mu,
              diff: update.mu - (oldPlayer[`${role}_rate`] || 1500),
            });
          }
        });

        setPlayers(prev => prev.map(player => {
          const updates = result.updated_ratings.filter(r => r.puuid === player.puuid);
          if (updates.length > 0) {
            const newRates = { ...player };
            updates.forEach(update => {
              const role = LANE_TO_ROLE_MAP[update.lane];
              if (role) newRates[`${role}_rate`] = update.mu;
            });
            return newRates;
          }
          return player;
        }));
      }

      if (matchesWebhookUrl) {
        await handleSendMatchToDiscord(matchData, ratingChanges);
      }
    } catch (error) {
      setStatusMsg(`アップロード失敗: ${error.message}`);
      addLog('ERROR', `アップロード失敗: ${error.message}`);
      alert(`アップロードに失敗しました: ${error.message}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setStatusMsg(''), 5000);
    }
  };

  const selectedMatch = Array.isArray(matches) ? matches.find(m => (m.gameId || m.gameid).toString() === selectedMatchId) : null;

  return {
    matches,
    selectedMatchId,
    setSelectedMatchId,
    isLoadingMatches,
    isUploading,
    currentUserPuuid,
    championMap,
    ddragonUrl,
    statusMsg,
    handleFetchMatches,
    processMatchHistoryData,
    handleUploadMatch,
    handleSendMatchToDiscord,
    selectedMatch,
  };
}
