// Webアプリ（App.jsx）からのメッセージを待受
window.addEventListener('message', (event) => {
  // 送信元が自分自身であり、かつリクエストタイプが一致するか確認
  if (event.source !== window || !event.data || event.data.type !== 'FETCH_LCU_LOBBY_REQUEST') {
    return;
  }

  const { port, password } = event.data;

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
});
