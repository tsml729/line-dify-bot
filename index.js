const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const app = express();

// 環境変数情報を出力
console.log('環境変数PORT:', process.env.PORT);

// 環境設定
const LINE_CONFIG = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const DIFY_API_KEY = process.env.DIFY_API_KEY;
const DIFY_API_URL = process.env.DIFY_API_URL;

// LINEミドルウェア
app.use('/webhook', line.middleware(LINE_CONFIG));

// 基本ルート - サーバー稼働確認用
app.get('/', (req, res) => {
  res.send('LINE Bot with Dify is running!');
});

// UptimeRobot用のpingエンドポイント
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
  console.log('Ping received at:', new Date().toISOString());
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
  
  // 会話コンテキスト情報を取得
  const sourceType = event.source.type; // 'user', 'group', 'room'のいずれか
  const userId = event.source.userId || 'unknown'; // 送信者のユーザーID
  
  // グループIDやルームID（存在する場合）
  const groupId = sourceType === 'group' ? event.source.groupId : null;
  const roomId = sourceType === 'room' ? event.source.roomId : null;
  
  // コンテキスト情報をログ出力
  console.log(`メッセージ受信: ${userMessage}`);
  console.log(`コンテキスト: type=${sourceType}, userId=${userId}, groupId=${groupId}, roomId=${roomId}`);
  
  try {
    console.log(`Dify API URL: ${DIFY_API_URL}`);
    console.log('Dify APIにリクエスト送信...');
    
    // 会話情報をオブジェクトとして準備
    const conversationInfo = {
      sourceType: sourceType,
      userId: userId,
      groupId: groupId,
      roomId: roomId,
      isGroup: sourceType === 'group',
      isRoom: sourceType === 'room', 
      isDM: sourceType === 'user'
    };
    
    // アプローチ1: context変数をJSON文字列として送信
    const conversationContextString = JSON.stringify(conversationInfo);
    
    // Dify APIにリクエスト
    const difyResponse = await axios.post(
      DIFY_API_URL,
      {
        inputs: { 
          query: userMessage,
          // アプローチ1: 文字列化したJSONを送信
          // context: conversationContextString,
          
          // アプローチ2: 別の変数名を使用
          conversation_info: conversationInfo
        },
        response_mode: "blocking",
        user: userId
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

// サーバー起動
const PORT = process.env.PORT || 3000;
console.log(`サーバーをポート ${PORT} で起動します...`);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
