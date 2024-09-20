# OpenAI ChatGPT API 統合ライブラリ (GAS)

このライブラリは、Google Apps Script (GAS) を使用して OpenAI の ChatGPT API にアクセスするためのものです。GPT-4 や GPT-3.5-turbo などのモデルに対応しています。このライブラリを使用するには、OpenAI API キーが必要です。

## セットアップ
1. [OpenAIのウェブサイト](https://platform.openai.com/account/api-keys)からAPIキーを取得してください。
2. APIキーは安全に保管してください。

## 関数の概要

### `post(model, apiKey, temperature, messages)`
- OpenAI API にリクエストを送信し、チャットの回答を取得します。
- **引数:**
  - `model`: 使用するモデルを指定します（例: `gpt-4`, `gpt-3.5-turbo`）。
  - `apiKey`: あなたの OpenAI API キー。
  - `temperature`: 回答のばらつきを制御します（範囲: 0 から 2）。値が低いほど確定的な返答になり、高いほど多様な返答が得られます。
  - `messages`: 会話の履歴または送信するプロンプト。
- **戻り値:** API からの応答データ。

### `content(role, prompt)`
- `content` オブジェクトを作成します。
- **引数:**
  - `role`: 発言者の役割を指定します（`user`, `system`, `assistant` など）。
  - `prompt`: ChatGPT に送信するメッセージや質問文。
- **戻り値:** 会話に使用するメッセージオブジェクト。

### `messages(postMessages, newContent)`
- 新しいメッセージを会話履歴に追加します。
- **引数:**
  - `postMessages`: これまでの会話履歴。
  - `newContent`: 追加する新しいメッセージ。
- **戻り値:** 更新された会話履歴。

### `gpt4(apiKey, prompt)`
- GPT-4 モデルにリクエストを送信します。
- **引数:**
  - `apiKey`: あなたの OpenAI API キー。
  - `prompt`: 送信するプロンプト。
- **戻り値:** API からの応答データ。

### `gptTurbo(apiKey, prompt)`
- GPT-3.5-turbo モデルにリクエストを送信します。
- **引数:**
  - `apiKey`: あなたの OpenAI API キー。
  - `prompt`: 送信するプロンプト。
- **戻り値:** API からの応答データ。

### `gptTurbo16k(apiKey, prompt)`
- GPT-3.5-turbo-16k モデルにリクエストを送信します。
- **引数:**
  - `apiKey`: あなたの OpenAI API キー。
  - `prompt`: 送信するプロンプト。
- **戻り値:** API からの応答データ。

### `chatContinue(apiKey, model, prompt)`
- 指定されたモデルを使用して、チャットの会話を続けます。
- **引数:**
  - `apiKey`: あなたの OpenAI API キー。
  - `model`: 会話に使用するモデル。
  - `prompt`: 送信するプロンプト。
- **戻り値:** 会話の結果が返され、完了条件が満たされるまで会話が続きます。

### `splitChat(apiKey, model, text)`
- テキストを分割し、10文ずつのチャンクに分けて処理します。
- **引数:**
  - `apiKey`: あなたの OpenAI API キー。
  - `model`: 処理に使用するモデル。
  - `text`: 分割して処理する入力テキスト。
- **戻り値:** 処理されたテキストチャンクの結果を連結したもの。

## 使用例

```javascript
// GPT-4 にプロンプトを送信する例
function testGpt4() {
  const apiKey = 'your-api-key-here';
  const prompt = 'ジョークを教えてください。';
  const result = gpt4(apiKey, prompt);
  Logger.log(result);
}
