const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const app = express();

// 環境設定
const LINE_CONFIG = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL; // 環境変数から取得

// LINEミドルウェア
app.use('/webhook', line.middleware(LINE_CONFIG));

// 基本ルート - サーバー稼働確認用
app.get('/', (req, res) => {
  res.send('LINE Bot with Dify is running!');
});

// Webhookルート
app.post('/webhook', async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

// LINE Clientの初期化
const lineClient = new line.Client(LINE_CONFIG);

// イベントハンドラ
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
        inputs: { query: userMessage }, // queryパラメータをinputsに設定
        response_mode: "blocking", // blockingモードで同期レスポンスを取得
        user: "line-user" // ユーザー識別子
      },
      {
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Dify API応答受信');
    console.log(JSON.stringify(difyResponse.data).substring(0, 200) + '...'); // 応答の一部をログ出力
    
    // Difyからの応答を取得
    let botResponse = "応答が取得できませんでした";
    if (difyResponse.data && difyResponse.data.response) {
      botResponse = difyResponse.data.response;
    } else if (difyResponse.data && difyResponse.data.answer) {
      botResponse = difyResponse.data.answer;
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

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
