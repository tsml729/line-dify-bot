// イベントハンドラ内のレスポンス処理部分を修正
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const userMessage = event.message.text;
  console.log(`受信メッセージ: ${userMessage}`);
  
  try {
    console.log(`Dify API URL: ${DIFY_API_URL}`);
    console.log('Dify APIにリクエスト送信...');
    
    // Dify APIにリクエスト
    const difyResponse = await axios.post(
      DIFY_API_URL,
      {
        inputs: { query: userMessage },
        response_mode: "blocking",
        user: "line-user"
      },
      {
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Dify API応答受信');
    
    // レスポンス形式に合わせて処理を修正
    let botResponse = "応答が取得できませんでした";
    
    // 正確なレスポンスパスに基づいて取得
    if (difyResponse.data && 
        difyResponse.data.data && 
        difyResponse.data.data.outputs && 
        difyResponse.data.data.outputs.response) {
      botResponse = difyResponse.data.data.outputs.response;
    } else {
      console.log('未知の応答形式:', JSON.stringify(difyResponse.data));
    }
    
    // LINEに返信
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: botResponse
    });
  } catch (error) {
    console.error('エラー詳細:', error.message);
    if (error.response) {
      console.error('API応答:', error.response.status, error.response.statusText);
      console.error('API応答データ:', JSON.stringify(error.response.data).substring(0, 200));
    }
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: 'エラーが発生しました。しばらくしてからもう一度お試しください。'
    });
  }
}
