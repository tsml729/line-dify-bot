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

// イベントハンドラを修正
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  // constからletに変更
  let userMessage = event.message.text;
  const sourceType = event.source.type; // 'user', 'group', 'room'のいずれか
  
  // グループチャットやマルチパーソンチャットの場合、メンションチェック
  if (sourceType === 'group' || sourceType === 'room') {
    // ボットへのメンションがあるか確認
    const botName = process.env.BOT_NAME || "ボット"; // 環境変数からボット名を取得
    const mentionPatterns = [
      `@${botName}`, 
      `＠${botName}`,
      `@${botName} `,
      `＠${botName} `
    ];
    
    // いずれかのメンションパターンに一致するか確認
    const isMentioned = mentionPatterns.some(pattern => 
      userMessage.includes(pattern)
    );
    
    // メンションがなければ応答しない
    if (!isMentioned) {
      console.log('メンションなしのグループメッセージ、応答しません');
      return null;
    }
    
    // メンション部分を除去したメッセージを作成
    let cleanedMessage = userMessage;
    mentionPatterns.forEach(pattern => {
      cleanedMessage = cleanedMessage.replace(pattern, '').trim();
    });
    
    console.log(`メンション検出、処理メッセージ: ${cleanedMessage}`);
    userMessage = cleanedMessage; // メンションを除去したメッセージに置き換え
  }
  
  console.log(`受信メッセージ: ${userMessage}`);
  
  // 以下は既存のコード
  try {
    console.log(`Dify API URL: ${DIFY_API_URL}`);
    console.log('Dify APIにリクエスト送信...');
    
    // 会話情報をJSON文字列に変換
    const conversationInfo = JSON.stringify({
      sourceType: sourceType,
      userId: event.source.userId || 'unknown',
      groupId: sourceType === 'group' ? event.source.groupId : null,
      roomId: sourceType === 'room' ? event.source.roomId : null,
      isGroup: sourceType === 'group',
      isRoom: sourceType === 'room', 
      isDM: sourceType === 'user'
    });
    
    // Dify APIにリクエスト
    const difyResponse = await axios.post(
      DIFY_API_URL,
      {
        inputs: { 
          query: userMessage,
          conversation_info: conversationInfo
        },
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

// サーバー起動
const PORT = process.env.PORT || 3000;
console.log(`サーバーをポート ${PORT} で起動します...`);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
