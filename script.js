/* =========================================================
   学習ツール script.js
   - 管理者ログイン: 9999（最初のログイン画面から直接ログイン可能）
   - 学習者ログイン: 当日パスワード → 学習者番号
   - 教材ごとの4桁パスワード
   - localStorage履歴 + Google Spreadsheet送信拡張対応
========================================================= */

const ADMIN_PASSWORD = "9999";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxr678i7FucanH3Asa7wYRlNCBcRJ1LaeeEIlUndem1eOfy_zh5jlplv3plW95gKpNI/exec"; // Google Apps Script の WebアプリURLを入れるとスプレッドシート送信が有効になります。

const STORAGE_KEYS = {
  sessionStudent: "learningTool_sessionStudent",
  answerHistory: "learningTool_answerHistory",
  streak: "learningTool_streak"
};

const SENTENCE_FILES = [
  "data/sentence_order/sentence_order_1_100.csv",
  "data/sentence_order/sentence_order_101_200.csv"
];

const TEST_CONFIG = {
  vocab: {
    title: "Stock 3000 単語テスト",
    type: "choice",
    password: "3000",
    defaultTime: 15,
    path: "data/vocab/stock_3000_master.csv",
    review: true,
    description: "単語の意味を素早く確認します。迷った問題は間違い復習に保存されます。"
  },
  sokudokuVocab: {
    title: "速読英単語",
    type: "choice",
    password: "5000",
    defaultTime: 15,
    path: "data/vocab/sokudoku_vocab.csv",
    review: true,
    description: "速読英単語の単語ページから作成した語彙問題を練習します。"
  },
  sentence: {
    title: "語順並べ替えテスト",
    type: "sentence",
    password: "1200",
    defaultTime: 45,
    files: SENTENCE_FILES,
    description: "語順を意識しながら、英文を正確にアウトプットします。"
  },
  monitor: {
    title: "TOEIC S&W モニター練習",
    type: "choice",
    password: "2180",
    defaultTime: 45,
    path: "data/monitor/monitor_questions.csv",
    description: "TOEIC S&Wで使いやすい自然な表現を選びます。"
  },
  speakingReview: {
    title: "TOEIC Speaking 復習",
    type: "choice",
    password: "2180",
    defaultTime: 30,
    path: "data/speaking_review/toeic_speaking_review.csv",
    description: "スピーキングで使う表現を短く正確に復習します。"
  },
  englishTheory: {
    title: "英語教育理論",
    type: "choice",
    password: "3303",
    defaultTime: 30,
    path: "data/english_theory/chapter3_theory.csv",
    description: "SLA Chapter 3 の重要概念を四択で確認します。UG・feature・morphology・interface の区別を重点的に練習します。"
  },
  classicalWords: {
    title: "古典単語",
    type: "choice",
    password: "1110",
    defaultTime: 15,
    path: "data/classics/classical_words.csv",
    description: "古典単語の意味をテンポよく確認します。"
  },
  classicalGrammar: {
    title: "古典文法",
    type: "choice",
    password: "2220",
    defaultTime: 30,
    path: "data/classics/classical_grammar.csv",
    description: "助動詞・敬語・識別などを確認します。"
  },
  classicalKnowledge: {
    title: "古文常識",
    type: "choice",
    password: "3330",
    defaultTime: 20,
    path: "data/classics/classical_knowledge.csv",
    description: "古文常識を選択問題で確認します。"
  }
};

let currentStudentId = "";
let isAdmin = false;
let pendingMaterialType = "";
let testType = "";
let reviewMode = false;
let loadedQuestions = {};
let questions = [];
let currentIndex = 0;
let score = 0;
let selectedChoice = "";
let answersLog = [];
let mistakes = [];
let startTime = null;
let questionStartTime = null;
let selectedTimeLimit = 0;
let timerId = null;
let remainingSeconds = 0;
let toeicCalendar = [];

/* =========================
   初期化・イベント登録
========================= */

document.addEventListener("DOMContentLoaded", () => {
  const todayPasswordHint = document.getElementById("todayPasswordHint");
  if (todayPasswordHint) todayPasswordHint.textContent = "";

  safeAddEvent("loginButton", "click", checkDatePassword);
  safeAddEvent("passwordInput", "keydown", event => { if (event.key === "Enter") checkDatePassword(); });
  safeAddEvent("showPassword", "change", function () { togglePasswordField("passwordInput", this.checked); });

  safeAddEvent("studentLoginButton", "click", checkStudentLogin);
  safeAddEvent("studentLoginInput", "keydown", event => { if (event.key === "Enter") checkStudentLogin(); });
  safeAddEvent("showStudentPassword", "change", function () { togglePasswordField("studentLoginInput", this.checked); });
  safeAddEvent("studentBackButton", "click", () => showOnly("loginScreen"));

  document.querySelectorAll(".material-card[data-material]").forEach(button => {
    button.addEventListener("click", () => openMaterialPassword(button.dataset.material));
  });

  safeAddEvent("showMaterialPassword", "change", function () { togglePasswordField("materialPasswordInput", this.checked); });
  safeAddEvent("materialPasswordButton", "click", checkMaterialPassword);
  safeAddEvent("materialPasswordInput", "keydown", event => { if (event.key === "Enter") checkMaterialPassword(); });
  safeAddEvent("materialPasswordBackButton", "click", () => showOnly("menuScreen"));

  safeAddEvent("calendarButton", "click", openCalendar);
  safeAddEvent("calendarBackButton", "click", () => showOnly("menuScreen"));
  safeAddEvent("resetCalendarButton", "click", resetCalendarChecks);

  safeAddEvent("historyButton", "click", openHistoryScreen);
  safeAddEvent("historyBackButton", "click", () => showOnly("menuScreen"));
  safeAddEvent("historySearchInput", "input", renderHistory);
  safeAddEvent("exportHistoryButton", "click", exportHistoryCSV);
  safeAddEvent("clearHistoryButton", "click", clearHistory);

  safeAddEvent("startButton", "click", startNormalQuiz);
  safeAddEvent("reviewButton", "click", startReviewQuiz);
  safeAddEvent("clearStoredMistakesButton", "click", clearStoredMistakes);
  safeAddEvent("backToMenuButton", "click", () => showOnly("menuScreen"));

  safeAddEvent("checkButton", "click", checkAnswer);
  safeAddEvent("nextButton", "click", nextQuestion);
  safeAddEvent("quitButton", "click", quitQuiz);

  safeAddEvent("restartButton", "click", () => {
    resetQuizState();
    openSettings(testType);
  });
  safeAddEvent("resultMenuButton", "click", () => {
    resetQuizState();
    showOnly("menuScreen");
    refreshDashboard();
  });
  safeAddEvent("logoutButton", "click", logout);
});

function safeAddEvent(id, event, handler) {
  const element = document.getElementById(id);
  if (element) element.addEventListener(event, handler);
}

/* =========================
   ログイン
========================= */

function getTodayPassword() {
  const now = new Date();
  return String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0");
}

function checkDatePassword() {
  const input = document.getElementById("passwordInput").value.trim();
  const message = document.getElementById("loginMessage");

  // 管理者は最初のログイン画面で直接ログインできます。
  if (input === ADMIN_PASSWORD) {
    currentStudentId = ADMIN_PASSWORD;
    isAdmin = true;
    localStorage.setItem(STORAGE_KEYS.sessionStudent, ADMIN_PASSWORD);
    if (message) message.textContent = "";
    showOnly("menuScreen");
    refreshDashboard();
    return;
  }

  // 学習者は、管理者から配布された当日用パスワードで次の画面へ進みます。
  if (input === getTodayPassword()) {
    currentStudentId = "";
    isAdmin = false;
    if (message) message.textContent = "";
    showOnly("studentScreen");
    return;
  }

  if (message) message.textContent = "パスワードが違います。";
}

function checkStudentLogin() {
  const input = document.getElementById("studentLoginInput").value.trim();
  const message = document.getElementById("studentLoginMessage");

  if (!/^\d{4}$/.test(input)) {
    if (message) message.textContent = "4桁の数字を入力してください。";
    return;
  }

  // 念のため、2つ目の画面でも管理者ログインを許可します。
  if (input === ADMIN_PASSWORD) {
    currentStudentId = ADMIN_PASSWORD;
    isAdmin = true;
    localStorage.setItem(STORAGE_KEYS.sessionStudent, ADMIN_PASSWORD);
    if (message) message.textContent = "";
    showOnly("menuScreen");
    refreshDashboard();
    return;
  }

  currentStudentId = input;
  isAdmin = false;
  localStorage.setItem(STORAGE_KEYS.sessionStudent, input);
  if (message) message.textContent = "";
  showOnly("menuScreen");
  refreshDashboard();
}

function logout() {
  currentStudentId = "";
  isAdmin = false;
  localStorage.removeItem(STORAGE_KEYS.sessionStudent);
  document.getElementById("passwordInput").value = "";
  document.getElementById("studentLoginInput").value = "";
  showOnly("loginScreen");
}

function togglePasswordField(id, checked) {
  const field = document.getElementById(id);
  if (field) field.type = checked ? "text" : "password";
}

/* =========================
   教材パスワード
========================= */

function openMaterialPassword(type) {
  if (!currentStudentId) {
    showOnly("studentScreen");
    return;
  }

  pendingMaterialType = type;
  const config = TEST_CONFIG[type];
  document.getElementById("materialPasswordTitle").textContent = `${config.title} のパスワード`;
  document.getElementById("materialPasswordInput").value = "";
  document.getElementById("materialPasswordMessage").textContent = "";
  showOnly("materialPasswordScreen");
}

function checkMaterialPassword() {
  const input = document.getElementById("materialPasswordInput").value.trim();
  const config = TEST_CONFIG[pendingMaterialType];

  if (!config) return;

  if (input === config.password || isAdmin) {
    document.getElementById("materialPasswordMessage").textContent = "";
    openSettings(pendingMaterialType);
  } else {
    document.getElementById("materialPasswordMessage").textContent = "教材パスワードが違います。";
  }
}

/* =========================
   設定画面
========================= */

async function openSettings(type) {
  testType = type;
  reviewMode = false;
  const config = TEST_CONFIG[type];

  showOnly("settingScreen");
  document.getElementById("settingTitle").textContent = config.title;
  document.getElementById("settingDescription").textContent = config.description || "";
  document.getElementById("vocabReviewArea").classList.toggle("hidden", !config.review);
  document.getElementById("timeLimitSelect").value = String(config.defaultTime || 0);

  const sourceQuestions = await ensureQuestionsLoaded(type);
  setupSectionSelect(sourceQuestions);
  updateMistakeCountInSettings();
}

async function ensureQuestionsLoaded(type) {
  if (loadedQuestions[type]) return loadedQuestions[type];

  const config = TEST_CONFIG[type];
  if (config.type === "sentence") {
    loadedQuestions[type] = await loadSentenceQuestions(config.files);
  } else {
    loadedQuestions[type] = await loadChoiceQuestions(config.path);
  }

  return loadedQuestions[type];
}

function setupSectionSelect(sourceQuestions) {
  const select = document.getElementById("sectionSelect");

  const sections = [...new Set(sourceQuestions.map(q => q.section))]
    .filter(Boolean)
    .sort((a, b) =>
      String(a).localeCompare(String(b), "ja", { numeric: true })
    );

  select.innerHTML = `<option value="all">すべてのセクション</option>`;

  sections.forEach(section => {
    const option = document.createElement("option");
    option.value = section;

    // speakingReviewだけSection表記を消す
    if (testType === "speakingReview" || testType === "englishTheory") {
      option.textContent = section;
    } else {
      option.textContent = isNaN(Number(section))
        ? section
        : `Section ${section}`;
    }

    select.appendChild(option);
  });
}

/* =========================
   CSV読み込み
========================= */

async function loadChoiceQuestions(filePath) {
  const response = await fetch(filePath);
  if (!response.ok) {
    alert(`${filePath} を読み込めませんでした。フォルダ名・ファイル名を確認してください。`);
    return [];
  }

  const text = await response.text();
  const rows = parseCSV(text);
  rows.shift();

  return rows.map(row => ({
    id: row[0],
    section: row[1],
    word: row[2],
    correctAnswer: row[3],
    choices: [row[3], row[4], row[5], row[6]].filter(Boolean),
    points: Number(row[7]) || 1,
    explanation: row[8] || ""
  })).filter(q => q.id && q.section && q.word && q.correctAnswer && q.choices.length > 0);
}

async function loadSentenceQuestions(files) {
  const all = [];

  for (const file of files) {
    const response = await fetch(file);
    if (!response.ok) {
      console.warn(`読み込み失敗: ${file}`);
      continue;
    }

    const text = await response.text();
    const rows = parseCSV(text);
    rows.shift();

    const loaded = rows.map(row => ({
      id: row[0],
      section: row[1],
      answer: row[2],
      points: 1
    })).filter(q => q.id && q.section && q.answer);

    all.push(...loaded);
  }

  return all;
}

/* =========================
   テスト開始
========================= */

async function startNormalQuiz() {
  reviewMode = false;
  const sourceQuestions = await ensureQuestionsLoaded(testType);
  prepareQuiz(sourceQuestions);

  if (questions.length === 0) {
    alert("問題がありません。CSVファイルの場所や内容を確認してください。");
    return;
  }

  startQuizCommon();
}

async function startReviewQuiz() {
  const config = TEST_CONFIG[testType];
  if (!config || !config.review) {
    alert("復習機能は単語テスト用です。");
    return;
  }

  reviewMode = true;
  const sourceQuestions = await ensureQuestionsLoaded(testType);
  const wrongIds = getWrongIds();
  questions = sourceQuestions.filter(q => wrongIds.includes(String(q.id)));

  if (questions.length === 0) {
    alert("保存された間違いがありません。");
    return;
  }

  questions = shuffle(questions);
  startQuizCommon();
}

function prepareQuiz(sourceQuestions) {
  const selectedSection = document.getElementById("sectionSelect").value;
  const countValue = document.getElementById("questionCountSelect").value;

  let pool = selectedSection === "all"
    ? [...sourceQuestions]
    : sourceQuestions.filter(q => q.section === selectedSection);

  pool = shuffle(pool);
  if (countValue !== "all") pool = pool.slice(0, Number(countValue));
  questions = pool;
}

function startQuizCommon() {
  currentIndex = 0;
  score = 0;
  selectedChoice = "";
  answersLog = [];
  mistakes = [];
  startTime = new Date();
  selectedTimeLimit = Number(document.getElementById("timeLimitSelect").value) || 0;
  showOnly("quizScreen");
  showQuestion();
}

/* =========================
   問題表示・タイマー
========================= */

function showQuestion() {
  clearQuestionTimer();
  selectedChoice = "";
  questionStartTime = new Date();

  document.getElementById("questionNumber").textContent = `問題 ${currentIndex + 1} / ${questions.length}`;
  document.getElementById("feedback").textContent = "";
  document.getElementById("feedback").className = "";
  document.getElementById("nextButton").classList.add("hidden");
  document.getElementById("checkButton").disabled = false;
  document.getElementById("progressBar").style.width = `${Math.round((currentIndex / questions.length) * 100)}%`;

  if (TEST_CONFIG[testType].type === "choice") showChoiceQuestion();
  if (TEST_CONFIG[testType].type === "sentence") showSentenceQuestion();

  startQuestionTimer();
}

function startQuestionTimer() {
  const display = document.getElementById("timerDisplay");

  if (!selectedTimeLimit) {
    display.textContent = "制限なし";
    display.classList.remove("timer-warning");
    return;
  }

  remainingSeconds = selectedTimeLimit;
  updateTimerDisplay();

  timerId = setInterval(() => {
    remainingSeconds--;
    updateTimerDisplay();

    if (remainingSeconds <= 0) {
      clearQuestionTimer();
      handleTimeUp();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const display = document.getElementById("timerDisplay");
  display.textContent = `${remainingSeconds}秒`;
  display.classList.toggle("timer-warning", remainingSeconds <= 5);
}

function clearQuestionTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
}

function handleTimeUp() {
  if (document.getElementById("checkButton").disabled) return;

  const q = questions[currentIndex];
  const correctAnswer = TEST_CONFIG[testType].type === "sentence" ? q.answer : q.correctAnswer;
  const questionText = TEST_CONFIG[testType].type === "sentence" ? shuffle(splitSentence(q.answer)).join(" / ") : q.word;
  const typedAnswer = document.getElementById("answerInput") ? document.getElementById("answerInput").value : "";

  processAnswer({
    id: q.id,
    section: q.section,
    question: questionText,
    userAnswer: typedAnswer || "時間切れ",
    correctAnswer,
    explanation: q.explanation || "",
    isCorrect: false,
    points: q.points || 1,
    timedOut: true
  });
}

function showChoiceQuestion() {
  const q = questions[currentIndex];
  document.getElementById("testTitle").textContent = reviewMode ? `${TEST_CONFIG[testType].title} 間違い復習` : TEST_CONFIG[testType].title;

  const area = document.getElementById("questionArea");
  area.innerHTML = "";

  const wordDiv = document.createElement("div");
  wordDiv.className = "words";

  if (testType === "monitor") {
    wordDiv.innerHTML = `No.${escapeHtml(q.id)} | ${escapeHtml(q.section)}<br><span class="monitor-label">最も自然で正確な表現を選んでください。</span><br>"${escapeHtml(q.word)}"`;
 } else if (testType === "speakingReview") {
  wordDiv.innerHTML =
    `No.${escapeHtml(q.id)} | ${escapeHtml(q.section)}
    <br>より自然な表現は？
    <br>"${escapeHtml(q.word)}"`;
} else if (testType === "englishTheory") {
    wordDiv.innerHTML =
      `No.${escapeHtml(q.id)} | ${escapeHtml(q.section)}
      <br>説明に合う概念を選んでください。
      <br>"${escapeHtml(q.word)}"`;
  } else if (testType.startsWith("classical")) {
    wordDiv.innerHTML = `No.${escapeHtml(q.id)} | ${escapeHtml(q.section)}<br>${escapeHtml(q.word)}`;
  } else {
    wordDiv.innerHTML = `No.${escapeHtml(q.id)} | Section ${escapeHtml(q.section)}<br>"${escapeHtml(q.word)}" の意味は？`;
  }

  area.appendChild(wordDiv);

  shuffle(q.choices).forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choice-button";
    btn.textContent = choice;
    btn.addEventListener("click", () => {
      selectedChoice = choice;
      document.querySelectorAll(".choice-button").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
    area.appendChild(btn);
  });
}

function showSentenceQuestion() {
  const q = questions[currentIndex];
  document.getElementById("testTitle").textContent = TEST_CONFIG[testType].title;
  q.words = shuffle(splitSentence(q.answer));

  document.getElementById("questionArea").innerHTML = `
    <div class="sentence-hint">${createInitialHint(q.answer)}</div>
    <div class="words" id="sentenceWords">${q.words.map(word => `<span class="word-chip">${escapeHtml(word)}</span>`).join("")}</div>
    <input type="text" id="answerInput" placeholder="英文を入力してください" autocomplete="off" />
  `;

  document.getElementById("answerInput").addEventListener("input", updateUsedWords);
  document.getElementById("answerInput").focus();
}

function createInitialHint(sentence) {
  return String(sentence).trim().split(/\s+/).map(word => {
    const cleanWord = word.replace(/[.,!?;:]/g, "");
    const firstLetter = cleanWord.replace(/^[“"']+/, "").charAt(0);
    const remainingSpaces = "_".repeat(Math.max(cleanWord.length - 1, 1));
    const punctuation = word.match(/[.,!?;:]$/);
    return punctuation ? `${firstLetter}${remainingSpaces}${punctuation[0]}` : `${firstLetter}${remainingSpaces}`;
  }).join("   ");
}

function updateUsedWords() {
  const inputWords = splitSentence(document.getElementById("answerInput").value).map(w => normalizeForCompare(w));
  document.querySelectorAll(".word-chip").forEach(chip => {
    const word = normalizeForCompare(chip.textContent);
    chip.classList.toggle("used", inputWords.includes(word));
  });
}

/* =========================
   解答判定
========================= */

function checkAnswer() {
  if (TEST_CONFIG[testType].type === "choice") checkChoiceAnswer();
  if (TEST_CONFIG[testType].type === "sentence") checkSentenceAnswer();
}

function checkChoiceAnswer() {
  const q = questions[currentIndex];
  if (!selectedChoice) {
    alert("選択肢を選んでください。");
    return;
  }

  const isCorrect = selectedChoice === q.correctAnswer;
  if (TEST_CONFIG[testType].review) {
    if (isCorrect && reviewMode) removeWrongWord(q.id);
    if (!isCorrect) saveWrongWord(q.id);
  }

  processAnswer({
    id: q.id,
    section: q.section,
    question: q.word,
    userAnswer: selectedChoice,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation || "",
    isCorrect,
    points: q.points || 1
  });
}

function checkSentenceAnswer() {
  const q = questions[currentIndex];
  const userAnswer = document.getElementById("answerInput").value;
  const isCorrect = normalizeSentence(userAnswer) === normalizeSentence(q.answer);

  processAnswer({
    id: q.id,
    section: q.section,
    question: q.words.join(" / "),
    userAnswer,
    correctAnswer: q.answer,
    explanation: "",
    isCorrect,
    points: 1
  });
}

function processAnswer(data) {
  clearQuestionTimer();
  const now = new Date();
  const responseSeconds = questionStartTime ? Math.max(0, Math.round((now - questionStartTime) / 1000)) : 0;

  if (data.isCorrect) {
    score += data.points;
    document.getElementById("feedback").textContent = "✅ 正解！";
    document.getElementById("feedback").className = "correct";
  } else {
    document.getElementById("feedback").innerHTML = `${data.timedOut ? "⏰ 時間切れ。" : "❌ 不正解。"}<br>正解：${escapeHtml(data.correctAnswer)}`;
    document.getElementById("feedback").className = "wrong";
    mistakes.push(data);
  }

  if (data.explanation) {
    document.getElementById("feedback").innerHTML += `<br><span class="explanation">解説：${escapeHtml(data.explanation)}</span>`;
  }

  const record = {
    date: now.toLocaleString("ja-JP"),
    dateKey: getDateKey(now),
    studentId: currentStudentId,
    material: TEST_CONFIG[testType].title,
    testType,
    mode: reviewMode ? "復習" : "通常",
    questionId: data.id,
    section: data.section,
    question: data.question,
    userAnswer: data.userAnswer,
    correctAnswer: data.correctAnswer,
    result: data.isCorrect ? "正解" : "不正解",
    correct: data.isCorrect,
    responseTime: responseSeconds,
    timeLimit: selectedTimeLimit || "制限なし",
    timedOut: Boolean(data.timedOut),
    explanation: data.explanation || ""
  };

  answersLog.push(record);
  appendLocalHistory(record);

  document.getElementById("checkButton").disabled = true;
  document.getElementById("nextButton").classList.remove("hidden");
  document.getElementById("progressBar").style.width = `${Math.round(((currentIndex + 1) / questions.length) * 100)}%`;
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex < questions.length) showQuestion();
  else showResult(false);
}

function quitQuiz() {
  if (confirm("途中で終了して、結果画面に進みますか？")) showResult(true);
}

/* =========================
   結果表示・送信
========================= */

async function showResult(isQuit) {
  clearQuestionTimer();
  const endTime = new Date();
  const answeredCount = answersLog.length;
  const totalSeconds = Math.floor((endTime - startTime) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const accuracy = answeredCount ? Math.round((answersLog.filter(a => a.correct).length / answeredCount) * 100) : 0;

  updateStreak();
  showOnly("resultScreen");

  document.getElementById("motivationMessage").innerHTML = getMotivationMessage(accuracy, answeredCount);
  document.getElementById("scoreDisplay").textContent = isQuit ? `途中終了：${answeredCount}問中 ${score}点` : `テスト終了：${answeredCount}問中 ${score}点`;
  document.getElementById("dateDisplay").textContent = `回答日時：${endTime.toLocaleString("ja-JP")}`;
  document.getElementById("timeDisplay").textContent = `合計解答時間：${minutes}分 ${seconds}秒`;
  showMistakes();

  await sendResultsToSpreadsheet({ isQuit, endTime, answeredCount, totalSeconds, accuracy });
}

function getMotivationMessage(accuracy, answeredCount) {
  if (answeredCount === 0) return "<strong>今日は準備だけでもOKです。</strong><br>次は1問だけ始めてみましょう。";
  if (accuracy >= 90) return "<strong>すばらしい安定感です。</strong><br>次は制限時間を少し短くすると、さらに実戦力が上がります。";
  if (accuracy >= 70) return "<strong>かなり良いペースです。</strong><br>ミスした問題だけをもう一度解くと定着しやすくなります。";
  return "<strong>復習の価値が高い回です。</strong><br>今日はミスを見つけられたこと自体が成果です。";
}

function showMistakes() {
  const area = document.getElementById("mistakeArea");

  if (mistakes.length === 0) {
    area.innerHTML = "<p class='correct'>ミスはありません。</p>";
    return;
  }

  area.innerHTML = `
    <div class="mistake-list">
      <h3>今回ミスした問題</h3>
      ${mistakes.map(m => `
        <div class="mistake-item">
          <strong>問題：</strong>${escapeHtml(m.question)}<br>
          <strong>あなたの答え：</strong>${escapeHtml(m.userAnswer)}<br>
          <strong>正解：</strong>${escapeHtml(m.correctAnswer)}<br>
          ${m.explanation ? `<strong>解説：</strong>${escapeHtml(m.explanation)}` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

async function sendResultsToSpreadsheet(resultInfo) {
  const statusDisplay = document.getElementById("sendStatusDisplay");

  if (!GAS_WEB_APP_URL) {
    statusDisplay.textContent = "スプレッドシート送信：未設定（現在は端末内履歴に保存）";
    return;
  }

  const payload = {
    studentId: currentStudentId,
    material: TEST_CONFIG[testType].title,
    testType,
    mode: reviewMode ? "復習" : "通常",
    status: resultInfo.isQuit ? "途中終了" : "完了",
    score,
    totalQuestions: questions.length,
    answeredCount: resultInfo.answeredCount,
    accuracy: resultInfo.accuracy,
    totalSeconds: resultInfo.totalSeconds,
    startTime: startTime.toLocaleString("ja-JP"),
    endTime: resultInfo.endTime.toLocaleString("ja-JP"),
    answers: answersLog
  };

  try {
    await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    statusDisplay.textContent = "スプレッドシート送信：完了";
  } catch (error) {
    console.error("スプレッドシート送信エラー:", error);
    statusDisplay.textContent = "スプレッドシート送信：失敗";
  }
}

/* =========================
   解答履歴
========================= */

function appendLocalHistory(record) {
  const history = getLocalHistory();
  history.push(record);
  localStorage.setItem(STORAGE_KEYS.answerHistory, JSON.stringify(history));
}

function getLocalHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.answerHistory)) || [];
  } catch {
    return [];
  }
}

function openHistoryScreen() {
  if (!isAdmin) {
    alert("解答履歴は管理者のみ閲覧できます。");
    return;
  }
  showOnly("historyScreen");
  renderHistory();
}

function renderHistory() {
  const query = (document.getElementById("historySearchInput")?.value || "").toLowerCase();
  const history = getLocalHistory().filter(item => {
    const text = `${item.studentId} ${item.material} ${item.question} ${item.userAnswer} ${item.correctAnswer}`.toLowerCase();
    return text.includes(query);
  }).reverse();

  renderHistorySummary(history);

  const area = document.getElementById("historyTableArea");
  if (history.length === 0) {
    area.innerHTML = "<p class='muted'>履歴がありません。</p>";
    return;
  }

  area.innerHTML = `
    <table class="history-table">
      <thead>
        <tr>
          <th>回答日時</th><th>学習者</th><th>教材</th><th>ID</th><th>問題</th><th>回答</th><th>正解</th><th>正誤</th><th>秒</th>
        </tr>
      </thead>
      <tbody>
        ${history.map(item => `
          <tr>
            <td>${escapeHtml(item.date)}</td>
            <td>${escapeHtml(item.studentId)}</td>
            <td>${escapeHtml(item.material)}</td>
            <td>${escapeHtml(item.questionId)}</td>
            <td>${escapeHtml(item.question)}</td>
            <td>${escapeHtml(item.userAnswer)}</td>
            <td>${escapeHtml(item.correctAnswer)}</td>
            <td class="${item.correct ? "correct" : "wrong"}">${escapeHtml(item.result)}</td>
            <td>${escapeHtml(item.responseTime)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderHistorySummary(history) {
  const total = history.length;
  const correct = history.filter(h => h.correct).length;
  const students = new Set(history.map(h => h.studentId)).size;
  const accuracy = total ? Math.round((correct / total) * 100) + "%" : "-";

  document.getElementById("historySummary").innerHTML = `
    <div class="stat-card"><span>履歴件数</span><strong>${total}件</strong></div>
    <div class="stat-card"><span>学習者数</span><strong>${students}人</strong></div>
    <div class="stat-card"><span>正答率</span><strong>${accuracy}</strong></div>
  `;
}

function exportHistoryCSV() {
  const history = getLocalHistory();
  if (history.length === 0) {
    alert("出力する履歴がありません。");
    return;
  }

  const headers = ["date", "studentId", "material", "questionId", "question", "userAnswer", "correctAnswer", "result", "responseTime", "mode", "section", "timeLimit", "timedOut"];
  const csv = [headers.join(",")]
    .concat(history.map(item => headers.map(header => csvEscape(item[header])).join(",")))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `answer_history_${getDateKey(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function clearHistory() {
  if (!isAdmin) return;
  if (!confirm("この端末内の解答履歴をすべて削除しますか？スプレッドシートに送信済みのデータは削除されません。")) return;
  localStorage.removeItem(STORAGE_KEYS.answerHistory);
  renderHistory();
  refreshDashboard();
}

function csvEscape(value) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

/* =========================
   間違い復習
========================= */

function saveWrongWord(id) {
  const key = getWrongKey();
  const wrongIds = getWrongIds();
  if (!wrongIds.includes(String(id))) wrongIds.push(String(id));
  localStorage.setItem(key, JSON.stringify(wrongIds));
  updateMistakeCountInSettings();
}

function removeWrongWord(id) {
  const key = getWrongKey();
  const wrongIds = getWrongIds().filter(wrongId => wrongId !== String(id));
  localStorage.setItem(key, JSON.stringify(wrongIds));
  updateMistakeCountInSettings();
}

function getWrongIds() {
  try {
    return JSON.parse(localStorage.getItem(getWrongKey())) || [];
  } catch {
    return [];
  }
}

function getWrongKey() {
  return `wrongWords_${testType}_${currentStudentId || "unknown"}`;
}

function clearStoredMistakes() {
  if (!confirm("この学習者の単語間違い履歴を削除しますか？")) return;
  localStorage.removeItem(getWrongKey());
  updateMistakeCountInSettings();
  alert("間違い履歴を削除しました。");
}

function updateMistakeCountInSettings() {
  const countText = document.getElementById("settingMistakeCount");
  if (!countText) return;
  countText.textContent = `保存された間違い：${getWrongIds().length}問`;
}

/* =========================
   カレンダー
========================= */

async function loadCalendarData() {
  const response = await fetch("data/calendar/toeic_calendar.json");
  if (!response.ok) {
    alert("カレンダーデータを読み込めませんでした。data/calendar/toeic_calendar.json を確認してください。");
    return;
  }
  toeicCalendar = await response.json();
}

async function openCalendar() {
  if (toeicCalendar.length === 0) await loadCalendarData();
  showOnly("calendarScreen");
  renderCalendar();
}

function renderCalendar() {
  const area = document.getElementById("calendarArea");
  area.innerHTML = "";

  toeicCalendar.forEach((day, dayIndex) => {
    const card = document.createElement("div");
    card.className = "calendar-card";
    const taskHtml = day.tasks.map((task, taskIndex) => {
      const key = `toeicCalendar_${currentStudentId}_${dayIndex}_${taskIndex}`;
      const checked = localStorage.getItem(key) === "true" ? "checked" : "";
      return `<label class="calendar-task"><input type="checkbox" data-key="${key}" ${checked}>${escapeHtml(task)}</label>`;
    }).join("");

    card.innerHTML = `<h3>${escapeHtml(day.date)}</h3>${taskHtml}<p class="calendar-comment">${escapeHtml(day.comment)}</p>`;
    area.appendChild(card);
  });

  document.querySelectorAll("#calendarArea input[type='checkbox']").forEach(box => {
    box.addEventListener("change", function () {
      localStorage.setItem(this.dataset.key, this.checked);
    });
  });
}

function resetCalendarChecks() {
  if (!confirm("この学習者のカレンダーチェックをすべてリセットしますか？")) return;
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(`toeicCalendar_${currentStudentId}_`)) localStorage.removeItem(key);
  });
  renderCalendar();
}

/* =========================
   ダッシュボード・連続学習
========================= */

function refreshDashboard() {
  const role = isAdmin ? "管理者" : "学習者";
  document.getElementById("studentStatus").textContent = `${role}：${currentStudentId}`;

  const today = getDateKey(new Date());
  const history = getLocalHistory().filter(h => h.studentId === currentStudentId && h.dateKey === today);
  const correct = history.filter(h => h.correct).length;
  const accuracy = history.length ? `${Math.round((correct / history.length) * 100)}%` : "-";

  document.getElementById("todayCountDisplay").textContent = `${history.length}問`;
  document.getElementById("todayAccuracyDisplay").textContent = accuracy;
  document.getElementById("streakDisplay").textContent = `${getStreakInfo().count}日`;
}

function updateStreak() {
  const today = getDateKey(new Date());
  const info = getStreakInfo();
  const yesterday = getDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

  if (info.lastDate === today) return;
  const count = info.lastDate === yesterday ? info.count + 1 : 1;
  localStorage.setItem(STORAGE_KEYS.streak, JSON.stringify({ lastDate: today, count }));
}

function getStreakInfo() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.streak)) || { lastDate: "", count: 0 };
  } catch {
    return { lastDate: "", count: 0 };
  }
}

/* =========================
   共通関数
========================= */

function resetQuizState() {
  clearQuestionTimer();
  currentIndex = 0;
  score = 0;
  selectedChoice = "";
  answersLog = [];
  mistakes = [];
  questions = [];
  document.getElementById("feedback").textContent = "";
  document.getElementById("questionArea").innerHTML = "";
}

function showOnly(id) {
  [
    "loginScreen", "registerScreen", "studentScreen", "menuScreen", "materialPasswordScreen", "calendarScreen",
    "settingScreen", "quizScreen", "resultScreen", "historyScreen"
  ].forEach(screen => {
    const element = document.getElementById(screen);
    if (element) element.classList.add("hidden");
  });

  const target = document.getElementById(id);
  if (target) target.classList.remove("hidden");
}

function splitSentence(text) {
  return String(text).replace(/[.,!?;:]/g, "").replace(/[“”]/g, '"').replace(/[’‘]/g, "'").trim().split(/\s+/).filter(Boolean);
}

function normalizeSentence(text) {
  return String(text).replace(/[.,!?;:]/g, "").replace(/[“”]/g, '"').replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeForCompare(text) {
  return String(text).replace(/[.,!?;:]/g, "").replace(/[“”]/g, '"').replace(/[’‘]/g, "'").trim().toLowerCase();
}

function shuffle(array) {
  const copied = [...array];
  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function getDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (cell || row.length) {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = "";
      }
      if (char === "\r" && next === "\n") i++;
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}
