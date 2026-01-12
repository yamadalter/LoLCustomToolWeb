// Webアプリ（App.jsx）からのメッセージを待受
window.addEventListener('message', (event) => {
  // 送信元が自分自身であり、かつリクエストタイプが一致するか確認
  if (event.source !== window || !event.data) {
    return;
  }

  const { port, password } = event.data;

  if (event.data.type == 'FETCH_LCU_LOBBY_REQUEST') {
    // Background Scriptへ通信を依頼
    chrome.runtime.sendMessage({
      action: 'FETCH_LCU_LOBBY',
      port,
      password
    }, (response) => {
      // Backgroundからの結果をWebアプリに返す
      window.postMessage({
        type: 'LCU_LOBBY_DATA_RESPONSE',
        ...response
      }, "*");
    });
  }else if (event.data.type == 'FETCH_MATCH_HISTORY_REQUEST') {
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
  }else{
    return;
  }

});
