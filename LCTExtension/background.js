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

      const puuids = [
        "0269e9d9-d7d9-5d85-b260-246a1b3626c8",
        "07129cf4-ae14-5c43-9589-198cb0ff30b4",
        "0dc7723b-2acc-5759-bd2f-0f582052e78b",
        "10a0fcb3-6d07-5ac0-a414-30a33a583b2e",
        "1426300c-d78d-5bbc-8383-f1ee9f3003cf",
        "180627ac-b56e-5473-aa51-878a36f7f0e8",
        "22f12cc3-725e-55b2-8c3b-45f9e42f2d45",
        "23b2dabd-b0ab-57ae-ac68-2ffef44db5b5",
        "2412aa3e-1c83-5d8b-82f5-bcaa221c18cc",
        "26973110-b4b3-5051-a459-e545ce4d311b",
        "29df5084-bf72-5def-a2c3-ead8483a5cb2",
        "3b703cf3-cd49-56d3-9c64-68fbf4fc795b",
        "570ebe21-f6e0-5c36-b4c6-8f57d73e5299",
        "617851a5-19c0-59d0-b862-9448bc697cdb",
        "774fe413-45b7-5e25-85c8-dbcbc3d0e89c",
        "8ae6535a-400a-55dd-ad5d-b219fa11479a",
        "9f606835-2296-5aa1-af01-20171e3fb807",
        "a119f709-e58c-592c-b6aa-a04254fd1971",
        "a8ec806d-962b-5996-8e8d-3215a7f373c2",
        "b3662ea0-5d8d-5a29-8497-743610aabc73",
        "ebfb1ec9-459b-559a-a40a-672cf4cc273e",
        "ed98e58a-9f9d-551f-aa18-62948a399daf",
        "f5b5dea3-9f98-51ca-b20d-13216331e171",
        "f9d084f9-374f-536f-99bc-a22e8f216350",
        "fdde135a-29d1-5ef4-8c9c-9099cbe213af"]
      // 各プレイヤーの追加情報を取得
      const playersPromises = puuids.map(async (pid) => {
        const puuid = pid;

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
          const tiers = ['UNRANKED', 'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
          const currentTierIndex = tiers.indexOf(tier);
          const previousTierIndex = tiers.indexOf(previousSeasonHighestTier);

          if (previousTierIndex > currentTierIndex) {
            tier = previousSeasonHighestTier;
            division = previousSeasonHighestDivision;
          }
        }

        return {
          puuid: puuid,
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
  } else if (request.action === 'SEARCH_PLAYER_BY_RIOT_ID') {
    (async () => {
      try {
        const { port, password, gameName, tagLine } = request;
        const auth = 'Basic ' + btoa(`riot:${password}`);

        // Step 1: Get PUUID from Riot ID
        const summonerSearchRes = await fetch(`https://127.0.0.1:${port}/lol-summoner/v1/summoners/names`, {
          method: 'POST',
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{ "name": `${gameName}#${tagLine}` }])
        });

        if (!summonerSearchRes.ok) {
          throw new Error(`プレイヤー検索に失敗しました: ${summonerSearchRes.status} ${summonerSearchRes.statusText}`);
        }
        
        const summonerDataArray = await summonerSearchRes.json();
        if (!summonerDataArray || summonerDataArray.length === 0) {
          throw new Error('プレイヤーが見つかりませんでした。');
        }
        const summonerData = summonerDataArray[0];
        const { puuid } = summonerData;

        // Step 2: Get ranked stats using PUUID
        const rankedRes = await fetch(`https://127.0.0.1:${port}/lol-ranked/v1/ranked-stats/${puuid}`, {
          headers: { 'Authorization': auth }
        });
        if (!rankedRes.ok) {
          throw new Error(`ランク情報の取得に失敗しました: ${rankedRes.status} ${rankedRes.statusText}`);
        }
        const rankedData = await rankedRes.json();
        
        const rankedStats = rankedData.queueMap.RANKED_SOLO_5x5;
        const previousSeasonHighestTier = rankedStats.previousSeasonHighestTier || 'UNRANKED';
        const previousSeasonHighestDivision = rankedStats.previousSeasonHighestDivision || 'NA';
        let tier = rankedStats.tier || 'UNRANKED';
        let division = rankedStats.division || 'NA';

        if (previousSeasonHighestTier !== 'UNRANKED') {
          const tiers = ['UNRANKED', 'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'];
          const currentTierIndex = tiers.indexOf(tier);
          const previousTierIndex = tiers.indexOf(previousSeasonHighestTier);

          if (previousTierIndex > currentTierIndex) {
            tier = previousSeasonHighestTier;
            division = previousSeasonHighestDivision;
          }
        }

        const playerData = {
          puuid,
          name: summonerData.gameName,
          tag: summonerData.tagLine,
          tier,
          division,
        };
        
        console.log("[LCU Connect] Success (Player Search):", playerData);
        sendResponse({ success: true, data: playerData });

      } catch (err) {
        console.error("[LCU Connect] Player Search Failed:", err);
        sendResponse({ success: false, error: err.toString() });
      }
    })();
    return true; //  必須
  } else if (request.action === 'FETCH_MATCH_HISTORY') {
    (async () => {
      try {
        // 現在のサモナーの情報を取得
        const summonerRes = await fetch(`https://127.0.0.1:${port}/lol-summoner/v1/current-summoner`, {
          headers: { 'Authorization': auth }
        });
        if (!summonerRes.ok) {
          throw new Error(`LCU Error: ${summonerRes.status} ${summonerRes.statusText}`);
        }
        const summonerData = await summonerRes.json();
        const puuid = summonerData.puuid;

        // puuidを使用して試合履歴を取得
        const matchHistoryRes = await fetch(`https://127.0.0.1:${port}/lol-match-history/v1/products/lol/${puuid}/matches`, {
          headers: { 'Authorization': auth }
        });
        if (!matchHistoryRes.ok) {
          throw new Error(`LCU Error: ${matchHistoryRes.status} ${matchHistoryRes.statusText}`);
        }
        const matchHistoryData = await matchHistoryRes.json();

        // 'GameComplete' した'CUSTOM_GAME'の試合履歴データをフィルタリング
        const customGames = matchHistoryData.games.games.filter(game => 
          game.gameType === 'CUSTOM_GAME' && 
          game.gameMode === 'CLASSIC' && 
          game.endOfGameResult === 'GameComplete'
        );

        // 1試合ずつ詳細データを取得
        const detailedCustomGamesPromises = customGames.map(async (game) => {
          const matchDetailsRes = await fetch(`https://127.0.0.1:${port}/lol-match-history/v1/games/${game.gameId}`, {
            headers: { 'Authorization': auth }
          });
          if (!matchDetailsRes.ok) {
            console.error(`[LCU Connect] Failed to get match details for gameId: ${game.gameId}`);
            return null; // エラーが発生した場合はnullを返す
          }
          return await matchDetailsRes.json();
        });

        const detailedCustomGames = (await Promise.all(detailedCustomGamesPromises)).filter(game => game !== null);
        
        console.log("[LCU Connect] Success (Detailed Custom Games):", detailedCustomGames);
        sendResponse({ success: true, data: { games: detailedCustomGames, puuid: puuid } });

      } catch (err) {
        console.error("[LCU Connect] Failed:", err);
        sendResponse({ success: false, error: err.toString() });
      }
    })();
    return true; // 非同期レスポンスのために必須
  }
});