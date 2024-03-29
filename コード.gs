// シートの2行目以降の全データをリストとして取得する関数
function lectureSheet(sheetUrl, sheetName) {
  // シートを変数定義
  let sheet = SpreadsheetApp.openByUrl(sheetUrl);
  const ss = sheet.getSheetByName(sheetName);
  // シートの最終行を取得
  let lastRow = ss.getLastRow();
  // シートの最終列を取得
  let lastColumn = ss.getLastColumn();

  // 全データリストを変数定義
  let lists = [];
  const FIRST_ROW = 2;// 大抵のスプレッドシートデータは2行目から始まるので2にしています

  // １行分ずつリストにして、全データリストに加えるループを作成する
  for (i = FIRST_ROW; i <= lastRow; i++) {
    // i行目を最終列まで二次元配列で取得し、flat()で一次元配列に変換
    let list = ss.getRange(i, 1, 1, lastColumn).getValues().flat();
    lists.push(list);
  }
  return lists
}
function lectureBase(sheetUrl, sheetName) {
  // シートを変数定義
  let sheet = SpreadsheetApp.openByUrl(sheetUrl);
  const ss = sheet.getSheetByName(sheetName);
  let subjectName = ss.getRange(1, 2).getValue();
  let target = ss.getRange(2, 2).getValue();
  return [subjectName, target]
}
// 翻訳
function transscript(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, inputCol, outputCol) {
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);
  let startKey = startRow - 2;
  let inputKey = inputCol - 1;

  let text = data[startKey][inputKey]
  let language = "JA"
  let tr = DeepLAPI.translateText(text, language)
  SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setValue(tr);
}

//校正
function proofread(API_KEY, sheetUrl, sheetName, startRow, inputCol, outputCol) {

  let data = lectureSheet(sheetUrl, sheetName);
  // 列数をを配列キーに変換する
  let startKey = startRow - 2;
  let inputKey = inputCol - 1;
  //プロンプト
  if (data[startKey][inputKey].length >= 2000) {
    var content = "";

    if (data[startKey][inputKey].length <= 4000) {
      var textList = splitText(data[startKey][inputKey], 2000);
      Logger.log(textList);
      textList.forEach(function (element) {
        let prompt = "以下のテキストを校正し、誤字脱字を修正・補完してください。\n冗長な改行や装飾を削除してください。###\n" + element + "`\n###"
        content = content + OpenAIAPIwithGAS.chatContinue(API_KEY, "gpt-4", prompt);
      })
    } else {
      let prompt = "以下のテキストを校正し、誤字脱字を修正・補完してください。\n冗長な改行や装飾を削除してください。###\n" + data[startKey][inputKey] + "`\n###"
      content = OpenAIAPIwithGAS.chatContinue(API_KEY, "gpt-3.5-turbo-16k", prompt);
    }
    SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setValue(content.replace("undefined"));
  } else {
    let prompt = "以下のテキストを校正し、誤字脱字を修正・補完してください。\n冗長な改行や装飾を削除してください。###\n" + data[startKey][inputKey] + "`\n###"
    chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4");
  }
}
//要約
function summary(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, inputCol, outputCol) {
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);
  let startKey = startRow - 2;
  let inputKey = inputCol - 1;


  let prompt = "#以下の講義内容を要約して下さい。lang:jp \n#本文\n" + data[startKey][inputKey] + "\n###\n{Summarize text}";

  let lastContent = OpenAIAPIwithGAS.chatContinue(API_KEY, "gpt-3.5-turbo-16k-0613", prompt);

  SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setValue(lastContent);
}
//キーワード
function keyword(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, inputCol, outputCol) {
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);
  let goal = "これから「" + base[0] + "」における「" + data[startRow - 2][themeCol - 1] + "」というテーマの授業のプロフェッショナルな講義原稿を作成します。ターゲットは" + base[1] + "な属性を持つ人たちです。ターゲットの共感性と学習意欲を引き出す講義を行います。\n";
  var content = ""
  var text = String(data[startRow - 2][inputCol - 1]);
  var splitText = text.split("。");
  let chunk = [];
  for (let i = 0; i < splitText.length; i++) {
    chunk.push(splitText[i]);
    if (chunk.length === 20 || i === splitText.length - 1) {
      Logger.log(chunk)
      // 30文のまとまりごとに関数を実行
      let prompt = goal + "\n【" + chunk.join("。") + "】\n\n上述した文章は、講義で扱う教科書の文章です。この文章から" + data[startRow - 2][themeCol - 1] + "に密接に関連する重要キーワードや重要概念をカンマ区切りで列挙しなさい。###\n{word,...,word}"
      content = content + OpenAIAPIwithGAS.chatContinue(API_KEY, "gpt-3.5-turbo", prompt) + "\n";
      chunk = []; // チャンクをリセット
    }
  }
  let prompt2 = "以下のカンマ区切り「, 」のキーワード群から重複を削除し、再度カンマ区切り「, 」でMECEにリスト化してください。\n###\n" + content + "###\n{word,...,word}"
  content = OpenAIAPIwithGAS.chatContinue(API_KEY, "gpt-3.5-turbo", prompt2)
  SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setValue(content.replace("undefined"));
}
//キーフレーズ
function keyphrase(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, summaryCol, keywordCol, factDataCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(inputCol) - 校正前のセルの列
  @param(outputCol) - 校正前のセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);
  /*
  //プロンプト
  let goal = "これから「" + data[startRow - 2][themeCol - 1] + "」というテーマの授業のプロフェッショナルな講義原稿を作成します。共感性と学習意欲を引き出す講義を行います。";
  let prompt = "以下に示した「" + data[startRow - 2][themeCol - 1] + "」というテーマのキーワード群全てを用いて構成されるメカニズムや因果関係、概念を講義の概要(lecture Summary)に沿って箇条書きで正しく説明しなさい。また初学者にとって難解な概念や語句は分解析してstep by stepで正しく説明しなさい。\n###lecture Summary:###\n" + data[startRow - 2][summaryCol - 1] + "\n###keyword:###\n" + data[startRow - 2][keywordCol - 1] + "###\n";
  let first = OpenAIAPIwithGAS.chatContinue(API_KEY, "gpt-4", prompt);
  */
  let fact = data[startRow - 2][factDataCol - 1]
  let upgrade = "以下に示した" + base[0] + "における「" + data[startRow - 2][themeCol - 1] + "」というテーマの語句・概念の解説文について、わかりやすく丁寧語のリストでまとめて、markdown形式で出力してください。難解な用語や複雑な概念の意味や説明を追加のリストで補足してください。\n###Output Style\n```## {Headline}\n- {text}\n- {text}\n...\n## {Headline}\n- text\,...\n```###keyphrase\n" + fact + "\n```markdown";
  chatGpt(API_KEY, sheetUrl, sheetName, upgrade, startRow, outputCol, "4");
}
// factをそのままキーフレーズ
function keyphrase2(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, summaryCol, keywordCol, factDataCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(inputCol) - 校正前のセルの列
  @param(outputCol) - 校正前のセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);
  /*
  //プロンプト
  let goal = "これから「" + data[startRow - 2][themeCol - 1] + "」というテーマの授業のプロフェッショナルな講義原稿を作成します。共感性と学習意欲を引き出す講義を行います。";
  let prompt = "以下に示した「" + data[startRow - 2][themeCol - 1] + "」というテーマのキーワード群全てを用いて構成されるメカニズムや因果関係、概念を講義の概要(lecture Summary)に沿って箇条書きで正しく説明しなさい。また初学者にとって難解な概念や語句は分解析してstep by stepで正しく説明しなさい。\n###lecture Summary:###\n" + data[startRow - 2][summaryCol - 1] + "\n###keyword:###\n" + data[startRow - 2][keywordCol - 1] + "###\n";
  let first = OpenAIAPIwithGAS.chatContinue(API_KEY, "gpt-4", prompt);
  */
  let fact = data[startRow - 2][factDataCol - 1]
  /*
  let upgrade = "以下に示した" + base[0] + "における「" + data[startRow - 2][themeCol - 1] + "」というテーマの語句・概念の解説文について、難解な用語や複雑な概念にわかりやすい具体例や喩えを補足し、リストやテーブルを用いてmarkdown形式で出力してください。\n###keyphrase\n" + fact + "\n```markdown";
  */
  chatGpt(API_KEY, sheetUrl, sheetName, fact, startRow, outputCol, "4");
}
//講義アウトライン
function outline(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, summaryCol, keyphraseCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(keyphraseCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);
  //プロンプト
  let prompt = "# あなたは最高のアウトライン作成AIです。これから「" + data[startRow - 2][themeCol - 1] + "」というテーマについて説明する文章のシンプルな概要アウトラインを作成し、markdown形式で出力してください。\n##条件:\n- 重要単語・概念に関して個々に説明する見出しを作成します。\nSummaryを逸脱した見出しは作成しません。\n- 可能な限り「要点(結論・全体像・要約)→理由→具体例という順で論理展開します。\n- アウトラインは「1. 「" + data[startRow - 2][themeCol - 1] + "」のOverview\n 」から始まります。\n###\nlang:jp" + "\n###Summary:\n" + data[startRow - 2][summaryCol - 1] + "\n```markdown";
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4")
}
//講義本文
function mainScript(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, keyphraseCol, outlineCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(keyphraseCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);
  //プロンプト
  let goal = "これから「" + base[0] + "」における「" + data[startRow - 2][themeCol - 1] + "」というテーマの授業のプロフェッショナルな講義原稿を作成します。ターゲットは" + base[1] + "な属性を持つ人たちです。ターゲットの共感性と学習意欲を引き出す講義を行います。";
  let prompt = "以下に示した講義のキーフレーズとアウトラインに基づいて、わかりやすい講義の原稿を再構成してください。はじめにテーマのOverviewから定義してください。 \n#keyphrase:###{" + data[startRow - 2][keyphraseCol - 1] + "},\n#outline:###{" + data[startRow - 2][outlineCol - 1] + "}###\n中学生にとって難解な概念はstep by stepでわかりやすく説明してください。\n```";
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4")
}
//スライドアウトライン（演習問題あり）
function slideOutline(API_KEY, sheetUrl, sheetName, startRow, scriptCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(keyphraseCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列
   */
  let data = lectureSheet(sheetUrl, sheetName);
  //プロンプト
  let prompt = "#以下に示す講義原稿をもとにして、PowerPoint用のスライド原稿を日本語で作成してください。\n## 「1 Slide 1 Meaning」で作成します。\## 可能な限り多くのスライドを作成し、情報を丁寧に細分化してください。\n##各スライドのコンテンツは最小の文字数で、重要な事実や数値をMECEに取り入れ、簡潔に箇条書きしてください。\n##「〜において重要」のような、『テーマ理解において重要な事』を示す文章は冗長なので無視してください。\n##最後のスライドとして、3択で回答する演習問題を作成し、追加してください。\n##lang:ja \n### 講義:\n" + data[startRow - 2][scriptCol - 1] + "###Output Style:\n```\n## Slide1: {Heading_1}\n- {content}\n- {content}\n...\n## Slide2: {Heading_2}\n- {content}\n- {content}...## Slide3:{Heading_3}\n- {content}\n- {content}...\n```\n###\n```";
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4")
}
//スライドアウトライン（演習問題なし）
function slideOutlineNoQ(API_KEY, sheetUrl, sheetName, startRow, scriptCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(keyphraseCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列
   */
  let data = lectureSheet(sheetUrl, sheetName);
  //プロンプト
  let prompt = "#以下に示す講義原稿をもとにして、PowerPoint用のスライド原稿を日本語で作成してください。\n## 「1 Slide 1 Meaning」で作成し、スライドには具体的な数値や重要な定義を必ず記述してください。\## 可能な限り多くのスライドを作成し、情報を丁寧に細分化してください。\n##各スライドのコンテンツは最小の文字数で、重要な事実や具体的な数値をMECEで記述し、簡潔に箇条書きしてください。\n##「〜において重要」のような、『テーマ理解において重要な事』を示す文章は冗長なので無視してください。\n##lang:ja \n### 講義:\n```" + data[startRow - 2][scriptCol - 1] + "```\n###Output Style:\n```markdown\n## Slide1: {Heading_1}\n- {content}\n- {content}\n...\n## Slide2: {Heading_2}\n- {content}\n- {content}...\n## Slide3:{Heading_3}\n- {content}\n- {content}...\n```\n###結果:\n```markdown";
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4")
}
//要するに
function charactorSummarize(API_KEY, sheetUrl, sheetName, startRow, scriptCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(keyphraseCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列
   */
  let data = lectureSheet(sheetUrl, sheetName);
  //プロンプト
  let prompt = "# 以下のブログ文章において最も理解が難解なセクションを読み手にフレンドリーなキャラクターに「要するに、～ってことですね」というように言い換えをさせたい。最も情報が多いセクションを「要するに、～ってことですね」と言い換えた文章を、markdown形式のリストにして出力してください。\n## lang:ja \n## 講義:\n" + data[startRow - 2][scriptCol - 1] + "##\n```markdown";
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4")
}
//追加イラスト案
function addIllust(API_KEY, sheetUrl, sheetName, baseSheet, startRow, blogCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(keyphraseCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);

  //プロンプト
  let prompt = "For the creation of the following blog, we require English prompts for DALLE3 to be proposed for charts, illustrations, and images created by the image generation AI in accordance with the lecture. The prompts should be highly specific and simple in design with a detailed background and description of the subject matter.\n### blog:\n{" + data[startRow - 2][blogCol - 1] + "}\n###\n- {prompt1}\n- {prompt2}\n...";
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "turbo")
}
//mermaidJS
function mermaidJS(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, scriptCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(keyphraseCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);

  //プロンプト
  let goal = "これから「" + base[0] + "」における「" + data[startRow - 2][themeCol - 1] + "」というテーマの授業のプロフェッショナルな講義原稿を作成します。ターゲットは" + base[1] + "な属性を持つ人たちです。ターゲットの共感性と学習意欲を引き出す講義を行います。";
  let prompt = goal + "以下の講義原稿を基にして、難解なキーワード・概念を分解析・段階詳細化しながら、簡潔なノードのマインドマップをmermaidJSで作成してください。### script:【" + data[startRow - 2][scriptCol - 1] + "】###\n ```mermaid";
  try {
    //APIを叩く
    let response = OpenAIAPIwithGAS.gptTurbo(API_KEY, prompt);

    Logger.log(response.choices[0].message.content)
    //レスポンスを処理する
    let content = response.choices[0].message.content.replace(/、/g, ",");
    content = content.replace(/・/g, "/");
    // 要約列にレスポンスを入力する
    SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setValue(content);
  } catch {
    Logger.log("error")
  }
}
//T/F問題
function quiz(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, mainScriptCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(keyphraseCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);

  //プロンプト
  let prompt = "今から「" + base[0] + "」における「" + data[startRow - 2][themeCol - 1] + "」というテーマで知識確認のためのTrue or False問題を作成します。\n###出題範囲:###\n" + data[startRow - 2][mainScriptCol - 1] + "\n###条件:\nはじめに「{keyword}は{meaning}である。」/「{keyword}は{meaning}ている。」のような形式で答えがTrueになる問題を可能な限り作成してください。\n次に、答えがFalseとなる問題を「{keyword}は{meaning}である。」/「{keyword}は{meaning}ている。」という形式で簡潔な解説も加えて可能な限り作成すれば報酬として100ドル与えられます。否定系の文章(「〜ではない」/「〜でない」など)を出力した場合にはペナルティが与えられます。\n###\n Created true text:\n1. {question}\n2.{question} ...\n \n lang:jp";
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4")
}
//T問題
function trueQuiz(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, mainScriptCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(keyphraseCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);

  //プロンプト
  let prompt = "今から「" + base[0] + "」における「" + data[startRow - 2][themeCol - 1] + "」というテーマで知識確認のためのTrue問題を作成します。\n###出題範囲:###\n" + data[startRow - 2][mainScriptCol - 1] + "\n###条件:\nはじめに「{keyword}は{meaning}である。」/「{keyword}は{meaning}ている。」という形式で答えがTrueになる問題を、全ての問題で前提条件と主語と述語を明確にしながら、可能な限りたくさん作成してください。可能な限り多く作成すれば報酬として100ドル与えられます。\n###\n Created true text:\n1. {question}\n2. {question}\3...\n \n lang:jp";
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4")
}
//F問題
function falseQuiz(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, mainScriptCol, trueText, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(keyphraseCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);

  //プロンプト
  let prompt = "今から「" + base[0] + "」における「" + data[startRow - 2][themeCol - 1] + "」というテーマで知識確認のためのTrue or False問題を作成します。すでに作成済みのTrue問題の内容を誤ったものに書き換えてFalse問題を作成してください。作成した文章がFalseである簡潔な解説も出題範囲を参考に作成してください。\n###出題範囲:###\n" + data[startRow - 2][mainScriptCol - 1] + "\n###条件:\n答えがFalseとなる問題を\n{created false keyword}は{meaning}である。\n{created false keyword}は{meaning}ている。\nという肯定形式で簡潔な解説も加えて作成してください。\nTrueとなるkeywordを別の単語と置き換えてFalse問題を作成してください。\n10個作成すれば報酬として100ドル与えられます。\n否定系の文章(「〜ではない」/「〜でない」など)は固く禁じます。否定系の文章(「〜ではない」/「〜でない」など)を出力した場合にはペナルティとして1000ドルの罰金が課せられます。\n###\n  Output Sytle:\n{False text}- {true explanation}\n...\n \n lang:jp\n###作成済みのTrue Text\n" + trueText + "\n###False Text\n";
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4")
}
//Instagram
function instagram(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, inputCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(inputCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);

  //プロンプト
  let prompt = "#命令\n" + base[0] + "における「" + data[startRow - 2][themeCol - 1] + "」というテーマについてわかりやすく解説するInstagram用の投稿文を作成します。絵文字も用いてターゲットから共感を得られる丁寧な解説をして下さい。元気の良い敬語で作成します。\nターゲットは「" + base[1] + "」です。投稿主は男性です。\n#投稿アウトライン\n\n#解説内容\n" + data[startRow - 2][inputCol - 1] + "\n#投稿文\n'''";
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "turbo")
}
//Twitter
function twitter(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, inputCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(inputCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);

  //プロンプト
  let prompt = "#命令\n" + base[0] + "における「" + data[startRow - 2][themeCol - 1] + "」というテーマにおける最も重要かつ具体的な概念や知見についてわかりやすくシンプルに解説するTwitter用の投稿文を作成します。最も重要かつ具体的な数値やデータに関する知見を80字以内で解説してください。敬語で解説します。No Tag(#) \n#投稿アウトライン\n\n#解説内容\n" + data[startRow - 2][inputCol - 1] + "\n###投稿文(合計80文字)\n{tweetText}\n";
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4")
}
//blog
function blog(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, outlineCol, keyphraseCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(keyphraseCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);

  //プロンプト
  let prompt = "# 命令:\n「" + data[startRow - 2][themeCol - 1] + "」というテーマについてわかりやすく解説するブログ記事を作成します。\n\n# 条件:\n- 内容は細分化し、可能な限り多くの見出しをつくる。\n- 「～は重要です」「～が重要です」のような曖昧な強調は避ける。\n- 一部で箇条書きを活用する。\n- 漢字を連続させない。\n- 同じ口調を続けない。\n- 講義内容の知見は語句の定義、重要な事実、具体的な数値の説明を、可能な限りMECEで記載する。\n- 1つの見出しで最大3つの情報を記述する。\n- まとめや結論では重要かつ具体的なポイントを3つほど列挙する。\n\n# ブログアウトライン\n" + data[startRow - 2][outlineCol - 1] + "\n# 講義内容：\n" + data[startRow - 2][keyphraseCol - 1] + "\n## 投稿文:\n```markdown\n";
  Logger.log("OK");
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4")
}
//fact & data
function factData(API_KEY, sheetUrl, sheetName, baseSheet, startRow, inputCol, outputCol) {
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);
  var content = ""
  var text = String(data[startRow - 2][inputCol - 1]);
  var splitText = text.split("。");
  let chunk = [];
  for (let i = 0; i < splitText.length; i++) {
    chunk.push(splitText[i]);
    if (chunk.length === 20 || i === splitText.length - 1) {
      Logger.log(chunk)
      // 20文のまとまりごとに関数を実行
      let prompt = "以下の文章から語句の定義、重要な事実、具体的な数値の説明すべてを、可能な限りMECEで抜き出して、箇条書きしてください。\n###文章;\n" + chunk.join("。") + "\n###fact & data:\n```"
      content = content + OpenAIAPIwithGAS.chatContinue(API_KEY, "gpt-3.5-turbo", prompt) + "\n";
      chunk = []; // チャンクをリセット
    }
  }
  SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setValue(content.replace("undefined"));
}
//fact分類
function categorizeFactData(API_KEY, sheetUrl, sheetName, baseSheet, startRow, inputCol, outputCol) {
  Logger.log("fact分類開始")
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);

  let prompt = "# 以下の文章群を、互いに密に関連する文章同士でわかりやすく分類し、全体をMECEで出力してください。\n## 条件\n- MECE\n\n Input Text: \n" + data[startRow - 2][inputCol - 1] + "\n\n Output Text: \n"
  Logger.log("OK")
  let reply = OpenAIAPIwithGAS.chatContinue(API_KEY, "gpt-3.5-turbo-16k-0613", prompt);
  SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setValue(reply)
}
// blogBrushUp
function blogBrushUp(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, blogCol, factDataCol, outputCol) {
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);
  let prompt = "# 下記に示したブログ記事にkeyphraseの情報を自然な形式で補足し、MECEに統合し、brush upさせ、markdown形式で出力してください。###blog:\n" + data[startRow - 2][blogCol - 1] + "\n###\n###keyphrase:\n" + data[startRow - 2][factDataCol - 1] + "###\n\n## 条件:\n- 内容は細分化し、可能な限り多くの見出しをつくる。\n- 一部で箇条書きを活用する \n- 講義内容の知見は語句の定義、重要な事実、具体的な数値の説明を、可能な限りMECEで記載する。\n- 各セクションの文は論理的に繋がり、前のセクションのの内容に基づいて次の文へと自然に移行するように文章を追加してください。\n- まとめや結論は重要な点を3つほど列挙する。\n###blogBrushUp:\n```markdown\n"
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4")
}
function professionalKeyword(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, inputCol, outputCol) {
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);

  if (data[startRow - 2][inputCol - 1].length >= 2000) {
    var content = "";
    if (data[startRow - 2][inputCol - 1].length <= 4000) {
      var textList = splitText(data[startRow - 2][inputCol - 1], 2000);
      Logger.log(textList);
      textList.forEach(function (element) {
        let prompt2 = "\n【" + element + "】\n\n上述した文章は、講義で扱う教科書の文章です。この文章から「" + data[startRow - 2][themeCol - 1] + "」のテーマに密接に関連する専門用語をカンマ区切りで20個程度列挙しなさい。一般的な口語は排除してください。###\n{word,...,word}";
        content = content + OpenAIAPIwithGAS.chatContinue(API_KEY, "gpt-3.5-turbo", prompt2);
      })
    } else {
      let prompt2 = "\n【" + data[startRow - 2][inputCol - 1] + "】\n\n上述した文章は、講義で扱う教科書の文章です。この文章から「" + data[startRow - 2][themeCol - 1] + "」のテーマに密接に関連する専門用語をカンマ区切りで20個程度列挙しなさい。一般的な口語は排除してください。###\n{word,...,word}";
      content = OpenAIAPIwithGAS.chatContinue(API_KEY, "gpt-3.5-turbo-16k", prompt2);
    }
    SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setValue(content.replace("undefined"));
  } else {
    let prompt2 = "\n【" + data[startRow - 2][inputCol - 1] + "】\n\n上述した文章は、講義で扱う教科書の文章です。この文章から「" + data[startRow - 2][themeCol - 1] + "」のテーマに密接に関連する専門用語をカンマ区切りで20個程度列挙しなさい。一般的な口語は排除してください。###\n{word,...,word}";
    chatGpt(API_KEY, sheetUrl, sheetName, prompt2, startRow, outputCol, "4");
  }
}
// 穴埋め問題
function blankQuiz(API_KEY, sheetUrl, sheetName, baseSheet, startRow, themeCol, keywordCol, mainScriptCol, outputCol) {
  /*
  @param(startRow) - 処理開始行
  @param(summaryCol) - 要約のセルの列
  @param(keyphraseCol) - キーフレーズのセルの列
  @param(outputCol) - 出力するのセルの列

   */
  let data = lectureSheet(sheetUrl, sheetName);
  let base = lectureBase(sheetUrl, baseSheet);

  //プロンプト
  let prompt = "今から「" + data[startRow - 2][themeCol - 1] + "」というテーマでkeywords内の専門用語確認のために厳選された穴埋め問題をMECEに20個程度作成します。\n###keywords\n" + data[startRow - 2][keywordCol - 1] + "\n###出題範囲:###\n" + data[startRow - 2][mainScriptCol - 1] + "###条件\n- 出力形式1. 「{blank}は{explanation}である。」, Answer: {keyword}\n- 出力形式2. 「{explanation}は{blank}という。」, Answer: {keyword}\n- 出力形式3. 「{category}のうち、{explanation}であるものは{blank}である。」, Answer: {keyword}\n- blankにはkeywords内の専門用語(名詞)が入るように作成してください。\n- {explanation}は可能な限り説明を充実させ、Answerが複数該当することのないように作成してください。\n- keywords内の単語が漏れなくAnswerとなるように問題を作成する。\n- lang:jp\n- 20問程度作成する。\n```\n";
  chatGpt(API_KEY, sheetUrl, sheetName, prompt, startRow, outputCol, "4")
}
function checkUnit(apikey, sheetUrl, sheetName, baseSheet, row) {
  let data = lectureSheet(sheetUrl, sheetName)

  Logger.log(row + "列目");
  try {
    if (data[row - 2][2] == "") {
      /*校正*/
      proofread(apikey, sheetUrl, sheetName, row, 2, 3);
    }
    if (data[row - 2][3] == "") {
      /*要約*/
      summary(apikey, sheetUrl, sheetName, baseSheet, row, 1, 3, 4);
    }
    if (data[row - 2][4] == "") {
      /*キーワード*/
      keyword(apikey, sheetUrl, sheetName, baseSheet, row, 1, 3, 5);
    }
    if (data[row - 2][5] == "") {
      /*事実抽出 */
      factData(apikey, sheetUrl, sheetName, baseSheet, row, 3, 6);
      Logger.log("事実抽出完了")
      categorizeFactData(apikey, sheetUrl, sheetName, baseSheet, row, 6, 6);
    }
    if (data[row - 2][6] == "") {
      /*講義アウトライン*/
      outline(apikey, sheetUrl, sheetName, baseSheet, row, 1, 4, 6, 7);
    }
    if (data[row - 2][7] == "") {
      /*blog*/
      blog(apikey, sheetUrl, sheetName, baseSheet, row, 1, 7, 6, 8);
    }
    if (data[row - 2][8] == "") {
      /*キーフレーズ*/
      try {
        keyphrase(apikey, sheetUrl, sheetName, baseSheet, row, 1, 4, 5, 6, 9);
      } catch {
        keyphrase2(apikey, sheetUrl, sheetName, baseSheet, row, 1, 4, 5, 6, 9)
      }
    }
    if (data[row - 2][9] == "") {
      /*ブログ改善*/
      blogBrushUp(apikey, sheetUrl, sheetName, baseSheet, row, 1, 8, 9, 10);
    }
    if (data[row - 2][10] == "") {
      /*スライドアウトライン*/
      slideOutlineNoQ(apikey, sheetUrl, sheetName, row, 10, 11);
    }
    if (data[row - 2][11] == "") {
      /*要するに*/
      charactorSummarize(apikey, sheetUrl, sheetName, row, 10, 12)
    }
    if (data[row - 2][12] == "") {
      /*instagram*/
      instagram(apikey, sheetUrl, sheetName, baseSheet, row, 1, 10, 13)
    }
    if (data[row - 2][13] == "") {
      /*Twitter*/
      twitter(apikey, sheetUrl, sheetName, baseSheet, row, 1, 10, 14)
    }
    if (data[row - 2][14] == "") {
      /*キーワード*/
      professionalKeyword(apikey, sheetUrl, sheetName, baseSheet, row, 1, 10, 15);
    }
    if (data[row - 2][15] == "") {
      /*穴埋め */
      blankQuiz(apikey, sheetUrl, sheetName, baseSheet, row, 1, 15, 10, 16);
    }
    if (data[row - 2][16] == "") {
      /*追加イラスト案*/
      addIllust(apikey, sheetUrl, sheetName, baseSheet, row, 10, 17)
    }
    if (data[row - 2][17] == "") {
      /*一問一答 */
      trueQuiz(apikey, sheetUrl, sheetName, baseSheet, row, 1, 11, 18);
    }
    if (data[row - 2][18] == "") {
      /*FacttoT/F */
      falseQuiz(apikey, sheetUrl, sheetName, baseSheet, row, 1, 7, 18, 19);
    }

  } catch {
    Logger.log("error:" + row + "列")
  }
}

// 翻訳版
// スプレッドシートの全テーブルをチェックし、空欄に入力する関数
function checkAlldeepL(sheetUrl, apikey) {
  var sheetName = "マスタ"
  var baseSheet = "基本情報"
  let data = lectureSheet(sheetUrl, sheetName)
  var startTime = new Date(); // 開始時刻の記録
  //列ごとにループさせる
  for (var row = 2; row < data.length + 2; row++) {
    Logger.log(row + "列目");
    var columnNumber = 1
    try {
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*校正*/
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 300) {
          break
        }
        Logger.log(columnNumber + "番目")
        proofread(apikey, sheetUrl, sheetName, row, 2, columnNumber + 1);
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*翻訳*/
        Logger.log(columnNumber + "番目")
        transscript(apikey, sheetUrl, sheetName, baseSheet, row, 1, 3, columnNumber + 1);
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*要約*/
        Logger.log(columnNumber + "番目")
        summary(apikey, sheetUrl, sheetName, baseSheet, row, 1, 4, columnNumber + 1);
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*キーワード*/
        Logger.log(columnNumber + "番目")
        keyword(apikey, sheetUrl, sheetName, baseSheet, row, 1, 4, columnNumber + 1);
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*事実抽出 */
        Logger.log(columnNumber + "番目")
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 300) {
          continue
        }
        factData(apikey, sheetUrl, sheetName, baseSheet, row, 4, columnNumber + 1);
        Logger.log("事実抽出完了")
        categorizeFactData(apikey, sheetUrl, sheetName, baseSheet, row, columnNumber + 1, columnNumber + 1);
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*講義アウトライン*/
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 240) {
          continue
        }
        Logger.log(columnNumber + "番目")
        outline(apikey, sheetUrl, sheetName, baseSheet, row, 1, 5, 7, columnNumber + 1);
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*blog*/
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 240) {
          continue
        }
        Logger.log(columnNumber + "番目")
        blog(apikey, sheetUrl, sheetName, baseSheet, row, 1, 8, 7, columnNumber + 1);
        continue
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 60) {
          continue
        }
        /*キーフレーズ*/
        Logger.log(columnNumber + "番目")
        try {
          keyphrase(apikey, sheetUrl, sheetName, baseSheet, row, 1, 5, 6, 7, columnNumber + 1);
          continue
        } catch {
          keyphrase2(apikey, sheetUrl, sheetName, baseSheet, row, 1, 5, 6, 7, columnNumber + 1)
          continue
        }
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*ブログ改善*/
        Logger.log(columnNumber + "番目")
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 240) {
          continue
        }
        blogBrushUp(apikey, sheetUrl, sheetName, baseSheet, row, 1, 9, 10, columnNumber + 1);
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*スライドアウトライン*/
        Logger.log(columnNumber + "番目")
        slideOutlineNoQ(apikey, sheetUrl, sheetName, row, 11, columnNumber + 1);
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*要するに*/
        Logger.log(columnNumber + "番目")
        charactorSummarize(apikey, sheetUrl, sheetName, row, 11, columnNumber + 1)
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*instagram*/
        Logger.log(columnNumber + "番目")
        instagram(apikey, sheetUrl, sheetName, baseSheet, row, 1, 11, columnNumber + 1)
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*Twitter*/
        Logger.log(columnNumber + "番目")
        twitter(apikey, sheetUrl, sheetName, baseSheet, row, 1, 11, columnNumber + 1)
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*キーワード*/
        Logger.log(columnNumber + "番目")
        professionalKeyword(apikey, sheetUrl, sheetName, baseSheet, row, 1, 11, columnNumber + 1);
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*穴埋め */
        Logger.log(columnNumber + "番目")
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 240) {
          continue
        }
        blankQuiz(apikey, sheetUrl, sheetName, baseSheet, row, 1, 15, 11, columnNumber + 1);
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*追加イラスト案*/
        Logger.log(columnNumber + "番目")
        addIllust(apikey, sheetUrl, sheetName, baseSheet, row, 11, columnNumber + 1)
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*一問一答 */
        Logger.log(columnNumber + "番目")
        trueQuiz(apikey, sheetUrl, sheetName, baseSheet, row, 1, 11, columnNumber + 1);
      }
      columnNumber = columnNumber + 1
      if (data[row - 2][columnNumber] == "") {
        /*FacttoT/F */
        Logger.log(columnNumber + "番目")
        falseQuiz(apikey, sheetUrl, sheetName, baseSheet, row, 1, 7, columnNumber, columnNumber + 1);
      }

    } catch {
      Logger.log("error:" + row + "列")
    }
  }
}
//スプレッドシートの全テーブルをチェックし、空欄に入力する関数
function checkAll(sheetUrl, apikey) {
  var sheetName = "マスタ"
  var baseSheet = "基本情報"
  let data = lectureSheet(sheetUrl, sheetName)
  var startTime = new Date(); // 開始時刻の記録
  //列ごとにループさせる
  for (var row = 2; row < data.length + 2; row++) {
    Logger.log(row + "列目");
    try {
      if (data[row - 2][2] == "") {
        /*校正*/
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 300) {
          break
        }
        proofread(apikey, sheetUrl, sheetName, row, 2, 3);
      }
      if (data[row - 2][3] == "") {
        /*要約*/
        summary(apikey, sheetUrl, sheetName, baseSheet, row, 1, 3, 4);
      }
      if (data[row - 2][4] == "") {
        /*キーワード*/
        keyword(apikey, sheetUrl, sheetName, baseSheet, row, 1, 3, 5);
      }
      if (data[row - 2][5] == "") {
        /*事実抽出 */
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 300) {
          continue
        }
        factData(apikey, sheetUrl, sheetName, baseSheet, row, 3, 6);
        Logger.log("事実抽出完了")
        categorizeFactData(apikey, sheetUrl, sheetName, baseSheet, row, 6, 6);
      }
      if (data[row - 2][6] == "") {
        /*講義アウトライン*/
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 240) {
          continue
        }
        outline(apikey, sheetUrl, sheetName, baseSheet, row, 1, 4, 6, 7);
      }
      if (data[row - 2][7] == "") {
        /*blog*/
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 240) {
          continue
        }
        blog(apikey, sheetUrl, sheetName, baseSheet, row, 1, 7, 6, 8);
        continue
      }
      if (data[row - 2][8] == "") {
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 60) {
          continue
        }
        /*キーフレーズ*/
        try {
          keyphrase(apikey, sheetUrl, sheetName, baseSheet, row, 1, 4, 5, 6, 9);
          continue
        } catch {
          keyphrase2(apikey, sheetUrl, sheetName, baseSheet, row, 1, 4, 5, 6, 9)
          continue
        }
      }
      if (data[row - 2][9] == "") {
        /*ブログ改善*/
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 240) {
          continue
        }
        blogBrushUp(apikey, sheetUrl, sheetName, baseSheet, row, 1, 8, 9, 10);
      }
      if (data[row - 2][10] == "") {
        /*スライドアウトライン*/
        slideOutlineNoQ(apikey, sheetUrl, sheetName, row, 9, 11);
      }
      if (data[row - 2][11] == "") {
        /*要するに*/
        charactorSummarize(apikey, sheetUrl, sheetName, row, 10, 12)
      }
      if (data[row - 2][12] == "") {
        /*instagram*/
        instagram(apikey, sheetUrl, sheetName, baseSheet, row, 1, 10, 13)
      }
      if (data[row - 2][13] == "") {
        /*Twitter*/
        twitter(apikey, sheetUrl, sheetName, baseSheet, row, 1, 10, 14)
      }
      if (data[row - 2][14] == "") {
        /*キーワード*/
        professionalKeyword(apikey, sheetUrl, sheetName, baseSheet, row, 1, 10, 15);
      }
      if (data[row - 2][15] == "") {
        /*穴埋め */
        var endTime = new Date(); // 終了時刻の記録
        var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
        if (executionTime > 240) {
          continue
        }
        blankQuiz(apikey, sheetUrl, sheetName, baseSheet, row, 1, 15, 10, 16);
      }
      if (data[row - 2][16] == "") {
        /*追加イラスト案*/
        addIllust(apikey, sheetUrl, sheetName, baseSheet, row, 10, 17)
      }
      if (data[row - 2][17] == "") {
        /*一問一答 */
        trueQuiz(apikey, sheetUrl, sheetName, baseSheet, row, 1, 11, 18);
      }
      if (data[row - 2][18] == "") {
        /*FacttoT/F */
        falseQuiz(apikey, sheetUrl, sheetName, baseSheet, row, 1, 7, 18, 19);
      }

    } catch {
      Logger.log("error:" + row + "列")
    }
  }
}
function checkFront(sheetUrl, apikey) {
  var sheetName = "マスタ"
  var baseSheet = "基本情報"
  var startTime = new Date(); // 開始時刻の記録
  let data = lectureSheet(sheetUrl, sheetName)
  //列ごとにループさせる
  for (var row = 2; row < data.length + 2; row++) {
    Logger.log(row + "列目");
    try {
      if (data[row - 2][2] == "") {
        /*校正*/
        proofread(apikey, sheetUrl, sheetName, row, 2, 3);
      }
      // if (data[row - 2][3] == "") {
      //   /*要約*/
      //   summary(apikey, sheetUrl, sheetName, baseSheet, row, 1, 3, 4);
      // }
      // if (data[row - 2][4] == "") {
      //   /*キーワード*/
      //   keyword(apikey, sheetUrl, sheetName, baseSheet, row, 1, 3, 5);
      // }
      // if (data[row - 2][5] == "") {
      //   /*事実抽出 */
      //   factData(apikey, sheetUrl, sheetName, baseSheet, row, 3, 6);
      //   Logger.log("事実抽出完了")
      //   categorizeFactData(apikey, sheetUrl, sheetName, baseSheet, row, 6, 6);
      // }
      // if (data[row - 2][6] == "") {
      //   /*講義アウトライン*/
      //   outline(apikey, sheetUrl, sheetName, baseSheet, row, 1, 4, 6, 7);
      // }
      // if (data[row - 2][7] == "") {
      //   /*blog*/
      //   blog(apikey, sheetUrl, sheetName, baseSheet, row, 1, 7, 6, 8);
      // }
      // if (data[row - 2][8] == "") {
      //   var endTime = new Date(); // 終了時刻の記録
      //   var executionTime = (endTime.getTime() - startTime.getTime()) / 1000; // 実行時間（秒単位）の計算
      //   if (executionTime > 60) {
      //     continue
      //   }
      //   /*キーフレーズ*/
      //   keyphrase(apikey, sheetUrl, sheetName, baseSheet, row, 1, 4, 5, 6, 9);
      //   continue
      // }
      // if (data[row - 2][9] == "") {
      //   /*ブログ改善*/
      //   blogBrushUp(apikey, sheetUrl, sheetName, baseSheet, row, 1, 8, 9, 10);
      // }
    } catch {
      Logger.log("error:" + row + "列")
    }
  }
}

function checkCore(sheetUrl, apikey) {
  var sheetName = "マスタ"
  var baseSheet = "基本情報"
  let data = lectureSheet(sheetUrl, sheetName)
  //列ごとにループさせる
  for (var row = 2; row < data.length + 2; row++) {
    Logger.log(row + "列目");
    try {
      if (data[row - 2][5] == "") {
        /*キーフレーズ*/
        /*事実抽出 */
        factData(apikey, sheetUrl, sheetName, baseSheet, row, 3, 6, 6);
        Logger.log("事実抽出完了")
        categorizeFactData(apikey, sheetUrl, sheetName, baseSheet, row, 6, 6);
      }
      if (data[row - 2][6] == "") {
        /*講義アウトライン*/
        outline(apikey, sheetUrl, sheetName, baseSheet, row, 1, 4, 6, 7);
      }
    } catch {
      Logger.log("error:" + row + "列")
    }
  }
}

function checkEnd(sheetUrl, apikey) {
  var sheetName = "マスタ"
  var baseSheet = "基本情報"
  var startTime = new Date(); // 開始時刻の記録
  let data = lectureSheet(sheetUrl, sheetName)
  //列ごとにループさせる
  for (var row = 2; row < data.length + 2; row++) {
    Logger.log(row + "列目");
    try {
      if (data[row - 2][10] == "") {
        /*スライドアウトライン*/
        slideOutlineNoQ(apikey, sheetUrl, sheetName, row, 10, 11);
      }
      if (data[row - 2][11] == "") {
        /*要するに*/
        charactorSummarize(apikey, sheetUrl, sheetName, row, 10, 12)
      }
      if (data[row - 2][12] == "") {
        /*instagram*/
        instagram(apikey, sheetUrl, sheetName, baseSheet, row, 1, 10, 13)
      }
      if (data[row - 2][13] == "") {
        /*Twitter*/
        twitter(apikey, sheetUrl, sheetName, baseSheet, row, 1, 10, 14)
      }
      if (data[row - 2][14] == "") {
        /*キーワード*/
        professionalKeyword(apikey, sheetUrl, sheetName, baseSheet, row, 1, 10, 15);
      }
      if (data[row - 2][15] == "") {
        /*穴埋め */
        blankQuiz(apikey, sheetUrl, sheetName, baseSheet, row, 1, 21, 10, 16);
      }
      if (data[row - 2][16] == "") {
        /*追加イラスト案*/
        addIllust(apikey, sheetUrl, sheetName, baseSheet, row, 10, 17)
      }
      if (data[row - 2][17] == "") {
        /*一問一答 */
        quiz(apikey, sheetUrl, sheetName, baseSheet, row, 1, 10, 18);
      }
      if (data[row - 2][18] == "") {
        /*FacttoT/F */
        quiz(apikey, sheetUrl, sheetName, baseSheet, row, 1, 6, 19);
        continue
      }
    } catch (e) {
      console.error("error:" + row + "列" + e.message)
    }
  }
}

//APIを叩く＋指定した列と行に出力する関数（各モデルで不可能な場合は自動でモデルチェンジします）
function chatGpt(apikey, sheetUrl, sheetName, prompt, startRow, outputCol, model) {
  /**
   * @param(apikey) - OpenAI PIのAPIキー
   * @param(prompt) - 送信するプロンプト
   * @param(startRow) - 編集をする列
   * @param(outputCol) - 出力する列
   * @param(model) - ChatGPTのモデル（"turbo"か"4"を入力する）
   */
  try {
    //APIを叩く
    if (model == "turbo") {
      try {
        var content = OpenAIAPIwithGAS.chatContinue(apikey, "gpt-3.5-turbo", prompt);
      } catch {
        //失敗した場合、モデルチェンジをしてフォントカラーを赤にする
        Logger.log("turbo不可")
        var content = OpenAIAPIwithGAS.chatContinue(apikey, "gpt-3.5-turbo-16k-0613", prompt);
        SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setFontColor("red");
      }
    } else if (model == "4") {
      try {
        var content = OpenAIAPIwithGAS.chatContinue(apikey, "gpt-4", prompt);
      } catch {
        //失敗した場合、モデルチェンジをしてフォントカラーを赤にする
        Logger.log("gpt4不可")
        var content = OpenAIAPIwithGAS.chatContinue(apikey, "gpt-3.5-turbo-16k-0613", prompt);
        SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setFontColor("red");
      }
    }
    // 要約列にレスポンスを入力する
    SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setValue(content);
    SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setBackground("white");

  } catch (e) {
    Logger.log(e)
    SpreadsheetApp.openByUrl(sheetUrl).getSheetByName(sheetName).getRange(startRow, outputCol).setBackground("gray");
  }
}

//配列内の空欄をチェックする関数
function arrayContainsBlank(arr) {
  // Array#some()は、配列の少なくとも1つの要素が
  // 渡されたテスト関数を満たす場合にtrueを返します。
  // ここでは、要素が空白であるかどうかをテストしています。
  return arr.some(function (element) {
    // String#trim()は、文字列の両端の空白を削除します。
    // その結果が空文字列（""）である場合、元の文字列は空白だけで構成されていました。
    return element == "編集中";
  });
}
// テキストを指定された文字数ごとに分割する関数
function splitText(text, maxLength) {
  var splitTextList = [];
  var textLength = text.length;
  var startIndex = 0;

  while (startIndex < textLength) {
    var endIndex = startIndex + maxLength;
    if (endIndex > textLength) {
      endIndex = textLength;
    }
    var substring = text.substring(startIndex, endIndex);
    splitTextList.push(substring);
    startIndex += maxLength;
  }

  return splitTextList;
}
