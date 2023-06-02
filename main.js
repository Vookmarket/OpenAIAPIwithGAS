function headers(apiKey) {
  var headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + apiKey
  };
  return headers;
}
//httpレスポンスをOpenAI APIに投げる
function post(model, apiKey, temperature=0.7, messages) {
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
    Logger.log(response)
  } catch (e) {
    // 例外エラー処理
    Logger.log('Error:')
    Logger.log(e)
    throw new Error('API request failed: ' + e);
  }
  var data = JSON.parse(response.getContentText());
  return data;
}
// contentを作成する
function makeContent(role, prompt) {
  let content = { "role": role, "content": prompt };
  return content;
}
// contentをあつめてメッセージを作成する。（関数なんか使わないほうが早い）
function makeConversation(postMessages,newContent) {// 
  let messages = postMessages.push(newContent);
  return messages
}
// chat of GPT4
function gpt4(api, prompt) {
  let messages = [makeContent("user", prompt)];
  let data = post("gpt-4", api, 0, messages)
  return data;
}
// chat of gpt-3.5-turbo
function gptTurbo(api, prompt) {
  let messages = [makeContent("user", prompt)];
  let data = post("gpt-3.5-turbo", api, 0, messages)
  return data;
}
