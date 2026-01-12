chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { port, password } = request;
  const auth = 'Basic ' + btoa(`riot:${password}`);
  if (request.action === 'FETCH_LCU_LOBBY') {
    const url = `https://127.0.0.1:${port}/lol-lobby/v2/lobby`;

    console.log(`[LCU Connect] Connecting to ${url}`); // コンソール確認用

    fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': auth,
        'Accept': 'application/json'
      }
    })
    .then(async (res) => {
      console.log(`[LCU Connect] Status: ${res.status}`);
      
      if (!res.ok) {
        // ステータスコードも含めてエラーを返す
        throw new Error(`LCU Error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("[LCU Connect] Success (Lobby):", data);

      if (!data.members || data.members.length === 0) {
        sendResponse({ success: true, data: [] });
        return;
      }

      // 各プレイヤーの追加情報を取得
      const playersPromises = data.members.map(async (member) => {
        const puuid = member.puuid;

        // 1. puuidからサモナーネームとタグラインを取得
        const summonerRes = await fetch(`https://127.0.0.1:${port}/lol-summoner/v2/summoners/puuid/${puuid}`, {
          headers: { 'Authorization': auth }
        });
        if (!summonerRes.ok) {
          console.error(`[LCU Connect] Failed to get summoner data for ${puuid}`);
          return { name: '', error: 'Failed to get summoner data' };
        }
        const summonerData = await summonerRes.json();
        const gameName = summonerData.gameName;
        const tagLine = summonerData.tagLine;

        // 2. puuidからランク情報を取得
        const rankedRes = await fetch(`https://127.0.0.1:${port}/lol-ranked/v1/ranked-stats/${puuid}`, {
          headers: { 'Authorization': auth }
        });
        if (!rankedRes.ok) {
          console.error(`[LCU Connect] Failed to get ranked stats for ${puuid}`);
          return { name: '', error: 'Failed to get ranked stats' };
        }
        const rankedData = await rankedRes.json();
        
        // 必要なランク情報を抽出
        const rankedStats = rankedData.queueMap.RANKED_SOLO_5x5;
        const previousSeasonHighestTier = rankedStats.previousSeasonHighestTier ? rankedStats.previousSeasonHighestTier : 'UNRANKED';
        const previousSeasonHighestDivision = rankedStats.previousSeasonHighestDivision ? rankedStats.previousSeasonHighestDivision : 'NA';
        var tier = rankedStats ? rankedStats.tier : 'UNRANKED';
        var division = rankedStats ? rankedStats.division : 'NA';

        // 過去の最高ランクと現在のランクを比較して、より高い方を使用
        if (previousSeasonHighestTier !== 'UNRANKED') {
          const tiers = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
          const currentTierIndex = tiers.indexOf(tier);
          const previousTierIndex = tiers.indexOf(previousSeasonHighestTier);

          if (previousTierIndex > currentTierIndex) {
            tier = previousSeasonHighestTier;
            division = previousSeasonHighestDivision;
          }
        }

        return {
          name: gameName,
          tag: tagLine,
          tier: tier,
          division: division,
          // 他にも必要な情報があればここに追加
        };
      });

      const players = await Promise.all(playersPromises);
      console.log("[LCU Connect] Success (Players with stats):", players);
      sendResponse({ success: true, data: players });
    })
    .catch((err) => {
      console.error("[LCU Connect] Failed:", err);
      // エラー内容をテキストで返す
      sendResponse({ success: false, error: err.toString() });
    });

    return true; // 非同期レスポンスのために必須
  }else if (request.action === 'FETCH_MATCH_HISTORY') {

    const url = `https://127.0.0.1:${port}/lol-summoner/v1/current-summoner/`;
    console.log(`[LCU Connect] Connecting to ${url}`); // コンソール確認用
    fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': auth,
        'Accept': 'application/json'
      }
    })
    .then(async (res) => {
      console.log(`[LCU Connect] Status: ${res.status}`);
      // 現在のサモナーの情報を取得
      const summonerRes = await fetch(`https://127.0.0.1:${port}/lol-summoner/v1/current-summoner/`, {
        headers: { 'Authorization': auth }
      });
      if (!summonerRes.ok) {
        console.error(`[LCU Connect] Failed to get summoner data`);
        sendResponse({ success: false, error: 'Failed to get summoner data' });
        return true;
      }
      const summonerData = await summonerRes.json();
      const url = `https://127.0.0.1:${port}/lol-match-history/v1/products/lol/${summonerData.puuid}/matches`;
      fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': auth,
          'Accept': 'application/json'
        }
      })
      .then(async (res) => {
        console.log(`[LCU Connect] Status: ${res.status}`);
        
        if (!res.ok) {
          // ステータスコードも含めてエラーを返す
          throw new Error(`LCU Error: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        console.log("[LCU Connect] Success (Match History):", data);
        sendResponse({ success: true, data });
        // 'GameComplete' した'CUSTOM_GAME'の試合履歴データを返す
        const customGames = data.games.games.filter(game => game.gameType === 'CUSTOM_GAME' && game.gameMode === 'CLASSIC' && game.endOfGameResult === 'GameComplete'); 
        sendResponse({ success: true, data: customGames });
        
        // 1試合ずつ詳細データを取得する
        const detailedCustomGamesPromises = customGames.map(async (game) => {
          const matchDetailsRes = await fetch(`https://127.0.0.1:${port}/lol-match-history/v1/games/${game.gameId}`, {
            headers: { 'Authorization': auth }
          });
          if (!matchDetailsRes.ok) {
            console.error(`[LCU Connect] Failed to get match details for gameId: ${game.gameId}`);
            return null;
          }
          const matchDetails = await matchDetailsRes.json();
          return matchDetails;
        });

        const detailedCustomGames = (await Promise.all(detailedCustomGamesPromises)).filter(game => game !== null);
        sendResponse({ success: true, data: detailedCustomGames });
        
        return detailedCustomGames;
      })
      .catch((err) => {
        console.error("[LCU Connect] Failed:", err);
        // エラー内容をテキストで返す
        sendResponse({ success: false, error: err.toString() });
      });
    })
    .catch((err) => {
      console.error("[LCU Connect] Failed:", err);
      // エラー内容をテキストで返す
      sendResponse({ success: false, error: err.toString() });
    });
    return true; // 非同期レスポンスのために必須
  }
});