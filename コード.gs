/*
このライブラリの使い方
ID:1XfXAZJYp7VGEMgLWgdPbkxy21Jt_v_oDHxops2nQCIBe86Twd_zigZtG
あらかじめAPIキーを用意して下さい

基本
- post(model, apiKey, temperature, messages)
  - model:gpt-4/gpt-3.5-turboなどのモデルを指定する
  - apiKey：OpenAI APIのAPIキーを指定する
  - temperature：回答のばらつきを0～2で設定する。0に近いほど確定的な返答になる（通常、0～0.7で良い）
  - messages：messageオブジェクトを指定する。content()もしくはmessages()で作成できる

- content(role, prompt)
  - role:user/system/assisstantなどの発言者を指定する。通常userで良い
  - prompt:ChatGPTに尋ねる文章の全文を指定する

- messages(postMessages,newContent):連続したチャットをする場合に利用する
  - postMessages:前回までの会話（messagesオブジェクト）
  - newContent:新たに追加する会話(content)

- gpt4(api, prompt)/gptTurbo(api,prompt)
  - api:OpenAI APIキー
  - prompt:ChatGPTに投げるプロンプト
 */
function headers(apiKey) {
  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey
  };
  return headers;
}
//httpレスポンスをOpenAI APIに投げる
// 修正したpost関数
function post(model, apiKey, temperature, messages) {
  var payload = {
    "model": model,
    "messages": messages,
    "temperature": temperature
  };

  var options = {
    'method': 'POST',
    'headers': headers(apiKey),
    'payload': JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
    var data = JSON.parse(response.getContentText());
    return data;
  } catch (e) {
    Logger.log('Error:')
    Logger.log(e)
    throw new Error('API request failed: ' + e);
  }
}

// contentを作成する
function makeContent(role, prompt) {
  let content = { "role": role, "content": prompt };
  return content;
}
// contentをあつめてメッセージを作成する。（関数なんか使わないほうが早い）
function makeConversation(postMessages, newContent) {// 
  let messages = postMessages.push(newContent);
  return messages
}
// chat of GPT4o
function gpt4o(api, prompt) {
  let messages = [makeContent("user", prompt)];
  let data = post("gpt-4o-2024-05-13", api, 0, messages)
  Logger.log(data)
  return data;
}
// chat of GPT4
// chatContinue を使用するように修正
function gpt4(api, prompt) {
  var model = "gpt-4"; // 使用するモデル名（必要に応じて変更）
  var responseContent = chatContinue(api, model, prompt);
  return responseContent;
}

// chat of gpt-3.5-turbo
function gptTurbo(api, prompt) {
  let messages = [makeContent("user", prompt)];
  let data = post("gpt-4o-mini-2024-07-18", api, 0, messages)
  return data;
}
// chat of gpt-3.5-turbo-16k
function gptTurbo16k(api, prompt) {
  let messages = [makeContent("user", prompt)];
  let data = post("gpt-4o-mini-2024-07-18", api, 0, messages)
  return data;
}
function chatContinue(api, model, prompt) {
  var messages = [makeContent("user", prompt)];
  Logger.log(messages);
  var data = post(model, api, 0, messages);
  Logger.log(data);
  var responseContent = '';
  try {
    var finish_reason = data.choices[0].finish_reason;
    Logger.log(finish_reason);
    var responseMessages = data.choices[0].message;
    responseContent += responseMessages.content;
    messages.push(makeContent("assistant", responseMessages.content));
    Logger.log(messages);
    var i = 0;
    // finish_reason が 'stop' になるまでチャットを続ける
    while (finish_reason !== "stop") {
      Logger.log(i);
      Logger.log(finish_reason);
      if (finish_reason === "length") {
        data = post(model, api, 0, messages);
        Logger.log(data);
        finish_reason = data.choices[0].finish_reason;
        responseMessages = data.choices[0].message;
        responseContent += responseMessages.content;
        messages.push(makeContent("assistant", responseMessages.content));
      } else {
        break;
      }
      i++;
    }
  } catch (e) {
    Logger.log(e);
    return e;
  }
  return responseContent;
}

/**
 * テキストを「。」で分割し、10文ずつのまとまりに関数を実行する。
 * @param {string} text - 分割されるテキスト。
 */
function splitChat(api, model, text) {
  // テキストを「。」で分割
  const sentences = text.split('。');

  let chunk = [];
  for (let i = 0; i < sentences.length; i++) {
    chunk.push(sentences[i]);

    if (chunk.length === 10 || i === sentences.length - 1) {
      // 10文のまとまりごとに関数を実行
      chatContinue(chunk.join('。') + '。');
      chunk = []; // チャンクをリセット
    }
  }
}
