// Webアプリ（App.jsx）からのメッセージを待受
window.addEventListener('message', (event) => {
  // 送信元が自分自身であり、かつリクエストタイプが一致するか確認
  if (event.source !== window || !event.data) {
    return;
  }

  if (event.data.type === 'FETCH_LCU_LOBBY_REQUEST') {
    // Background Scriptへ通信を依頼
    chrome.runtime.sendMessage({
      action: 'FETCH_LCU_LOBBY',
      port: event.data.port,
      password: event.data.password
    }, (response) => {
      // Backgroundからの結果をWebアプリに返す
      window.postMessage({
        type: 'LCU_LOBBY_DATA_RESPONSE',
        ...response
      }, "*");
    });
  } else if (event.data.type === 'FETCH_MATCH_HISTORY_REQUEST') {
    // Background Scriptへ通信を依頼
    chrome.runtime.sendMessage({
      action: 'FETCH_MATCH_HISTORY',
      port: event.data.port,
      password: event.data.password,
      protocol: event.data.protocol
    }, (response) => {
      // Backgroundからの結果をWebアプリに返す
      window.postMessage({
        type: 'LCU_MATCH_HISTORY_DATA_RESPONSE',
        ...response
      }, "*");
    });
  } else if (event.data.type === 'SEARCH_PLAYER_BY_RIOT_ID_REQUEST') {
    chrome.runtime.sendMessage({
      action: 'SEARCH_PLAYER_BY_RIOT_ID',
      port: event.data.port,
      password: event.data.password,
      gameName: event.data.gameName,
      tagLine: event.data.tagLine,
    }, (response) => {
      window.postMessage({
        type: 'LCU_SEARCH_PLAYER_RESPONSE',
        ...response
      }, "*");
    });
  }
});
