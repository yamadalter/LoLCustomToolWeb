chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FETCH_LCU_LOBBY') {
    const { port, password } = request;
    const authHeader = 'Basic ' + btoa(`riot:${password}`);

    fetch(`https://127.0.0.1:${port}/lol-lobby/v2/lobby`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    })
    .then(response => {
      if (!response.ok) throw new Error('Failed to fetch lobby');
      return response.json();
    })
    .then(data => {
      if (data && data.members) {
        const players = data.members.map(m => ({
          name: m.gameName || m.summonerName,
          tag: m.tagLine || 'JP1',
          rank: 'UNRANKED' 
        }));
        sendResponse({ success: true, players });
      } else {
        sendResponse({ success: false, error: 'ロビーにプレイヤーがいません' });
      }
    })
    .catch(err => {
      console.error(err);
      sendResponse({ 
        success: false, 
        error: `接続失敗。 https://127.0.0.1:${port} をブラウザで開き、「詳細設定」からアクセスを許可してください。` 
      });
    });

    return true;
  }
});
