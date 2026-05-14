const PASSWORD = "testing";

const SENTENCE_FILES = [
  "data/sentence_order/sentence_order_1_100.csv",
  "data/sentence_order/sentence_order_101_200.csv"
];

let testType = "";
let reviewMode = false;

let allVocabQuestions = [];
let allSentenceQuestions = [];
let allSpeakingReviewQuestions = [];
let questions = [];

let currentIndex = 0;
let score = 0;
let studentId = "";
let selectedChoice = "";
let answersLog = [];
let mistakes = [];
let startTime = null;

let toeicCalendar = [];

async function loadCalendarData() {
  const response = await fetch("data/calendar/toeic_calendar.json");

  if (!response.ok) {
    alert("カレンダーデータを読み込めませんでした。");
    return;
  }

  toeicCalendar = await response.json();
}

safeAddEvent("loginButton", "click", checkPassword);
safeAddEvent("showPassword", "change", togglePassword);
safeAddEvent("vocabTestButton", "click", () => openSettings("vocab"));
safeAddEvent("sentenceTestButton", "click", () => openSettings("sentence"));
safeAddEvent("calendarButton", "click", openCalendar);
safeAddEvent("speakingReviewButton", "click", () => openSettings("speakingReview"));
safeAddEvent("calendarBackButton", "click", () => showOnly("menuScreen"));
safeAddEvent("resetCalendarButton", "click", resetCalendarChecks);
safeAddEvent("startButton", "click", startNormalQuiz);
safeAddEvent("reviewButton", "click", startReviewQuiz);
safeAddEvent("clearStoredMistakesButton", "click", clearStoredMistakes);
safeAddEvent("backToMenuButton", "click", () => showOnly("menuScreen"));
safeAddEvent("checkButton", "click", checkAnswer);
safeAddEvent("nextButton", "click", nextQuestion);
safeAddEvent("quitButton", "click", quitQuiz);
safeAddEvent("restartButton", "click", () => location.reload());
safeAddEvent("studentIdInput", "input", updateMistakeCountInSettings);

function safeAddEvent(id, event, handler) {
  const element = document.getElementById(id);
  if (element) element.addEventListener(event, handler);
}

function checkPassword() {
  const input = document.getElementById("passwordInput").value;

  if (input === PASSWORD) {
    showOnly("menuScreen");
  } else {
    document.getElementById("loginMessage").textContent = "パスワードが違います。";
  }
}

function togglePassword() {
  const field = document.getElementById("passwordInput");
  field.type = this.checked ? "text" : "password";
}

async function openSettings(type) {
  testType = type;
  reviewMode = false;

  showOnly("settingScreen");

  document.getElementById("settingTitle").textContent =
    type === "vocab"
      ? "Stock 3000 単語テスト"
      : type === "sentence"
        ? "語順並べ替えテスト"
        : "TOEIC Speaking 復習";

  document.getElementById("vocabReviewArea").classList.toggle("hidden", type !== "vocab");

  if (type === "vocab") {
    if (allVocabQuestions.length === 0) await loadVocabQuestions();
    setupSectionSelect(allVocabQuestions);
    updateMistakeCountInSettings();
  }

  if (type === "sentence") {
    if (allSentenceQuestions.length === 0) await loadSentenceQuestions();
    setupSectionSelect(allSentenceQuestions);
  }

  if (type === "speakingReview") {
    if (allSpeakingReviewQuestions.length === 0) {
      await loadSpeakingReviewQuestions();
    }
    setupSectionSelect(allSpeakingReviewQuestions);
  }
}

async function loadVocabQuestions() {
  const response = await fetch("data/vocab/stock_3000_master.csv");
  const text = await response.text();
  const rows = parseCSV(text);

  rows.shift();

  allVocabQuestions = rows.map(row => ({
    id: row[0],
    section: row[1],
    word: row[2],
    correctAnswer: row[3],
    choices: [row[3], row[4], row[5], row[6]].filter(Boolean),
    points: Number(row[7]) || 1
  })).filter(q => q.id && q.section && q.word && q.correctAnswer);
}

async function loadSentenceQuestions() {
  allSentenceQuestions = [];

  for (const file of SENTENCE_FILES) {
    const response = await fetch(file);

    if (!response.ok) {
      console.warn(`読み込み失敗: ${file}`);
      continue;
    }

    const text = await response.text();
    const rows = parseCSV(text);

    rows.shift();

    const loadedQuestions = rows.map(row => ({
      id: row[0],
      section: row[1],
      answer: row[2],
      words: shuffle(splitSentence(row[2] || "")),
      points: 1
    })).filter(q => q.id && q.section && q.answer);

    allSentenceQuestions.push(...loadedQuestions);
  }
}

async function loadSpeakingReviewQuestions() {
  const response = await fetch("data/speaking_review/toeic_speaking_review.csv");

  if (!response.ok) {
    alert("TOEIC Speaking復習問題を読み込めませんでした。");
    return;
  }

  const text = await response.text();
  const rows = parseCSV(text);

  rows.shift();

  allSpeakingReviewQuestions = rows.map(row => ({
    id: row[0],
    section: row[1],
    word: row[2],
    correctAnswer: row[3],
    choices: [row[3], row[4], row[5], row[6]].filter(Boolean),
    points: 1
  })).filter(q => q.id && q.section && q.word && q.correctAnswer);
}

function setupSectionSelect(sourceQuestions) {
  const select = document.getElementById("sectionSelect");

  const sections = [...new Set(sourceQuestions.map(q => q.section))]
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));

  select.innerHTML = `<option value="all">すべてのセクション</option>`;

  sections.forEach(section => {
    const option = document.createElement("option");
    option.value = section;
    option.textContent = `Section ${section}`;
    select.appendChild(option);
  });
}

async function startNormalQuiz() {
  studentId = document.getElementById("studentIdInput").value.trim();

  if (!studentId) {
    alert("回答者番号を入力してください。");
    return;
  }

  reviewMode = false;

  if (testType === "vocab") {
    prepareQuiz(allVocabQuestions);
  } else if (testType === "sentence") {
    prepareQuiz(allSentenceQuestions);
  } else if (testType === "speakingReview") {
    prepareQuiz(allSpeakingReviewQuestions);
  }

  if (questions.length === 0) {
    alert("問題がありません。");
    return;
  }

  startQuizCommon();
}

function startReviewQuiz() {
  studentId = document.getElementById("studentIdInput").value.trim();

  if (!studentId) {
    alert("回答者番号を入力してください。");
    return;
  }

  if (testType !== "vocab") {
    alert("復習機能は単語テスト用です。");
    return;
  }

  reviewMode = true;

  const wrongIds = getWrongIds();
  questions = allVocabQuestions.filter(q => wrongIds.includes(String(q.id)));

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

  if (countValue !== "all") {
    pool = pool.slice(0, Number(countValue));
  }

  questions = pool;
}

function startQuizCommon() {
  currentIndex = 0;
  score = 0;
  selectedChoice = "";
  answersLog = [];
  mistakes = [];
  startTime = new Date();

  showOnly("quizScreen");
  showQuestion();
}

function showQuestion() {
  selectedChoice = "";

  document.getElementById("questionNumber").textContent =
    `問題 ${currentIndex + 1} / ${questions.length}`;

  document.getElementById("feedback").textContent = "";
  document.getElementById("feedback").className = "";
  document.getElementById("nextButton").classList.add("hidden");
  document.getElementById("checkButton").disabled = false;

  if (testType === "vocab" || testType === "speakingReview") {
    showVocabQuestion();
  } else if (testType === "sentence") {
    showSentenceQuestion();
  }
}

function showVocabQuestion() {
  const q = questions[currentIndex];

  document.getElementById("testTitle").textContent =
    testType === "speakingReview"
      ? "TOEIC Speaking 復習"
      : reviewMode
        ? "Stock 3000 間違い復習"
        : "Stock 3000 単語テスト";

  const choices = shuffle(q.choices);
  const area = document.getElementById("questionArea");
  area.innerHTML = "";

  const wordDiv = document.createElement("div");
  wordDiv.className = "words";

  if (testType === "speakingReview") {
    wordDiv.innerHTML =
      `No.${escapeHtml(q.id)} | Section ${escapeHtml(q.section)}<br>より自然な表現は？<br>"${escapeHtml(q.word)}"`;
  } else {
    wordDiv.innerHTML =
      `No.${escapeHtml(q.id)} | Section ${escapeHtml(q.section)}<br>"${escapeHtml(q.word)}" の意味は？`;
  }

  area.appendChild(wordDiv);

  choices.forEach(choice => {
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

  document.getElementById("testTitle").textContent = "語順並べ替えテスト";

  q.words = shuffle(splitSentence(q.answer));

  document.getElementById("questionArea").innerHTML = `
    <div class="sentence-hint">
      ${createInitialHint(q.answer)}
    </div>

    <div class="words" id="sentenceWords">
      ${q.words.map(word => `<span class="word-chip">${escapeHtml(word)}</span>`).join("")}
    </div>

    <input type="text" id="answerInput" placeholder="英文を入力してください" />
  `;

  document.getElementById("answerInput").addEventListener("input", updateUsedWords);
}

function createInitialHint(sentence) {
  return String(sentence)
    .trim()
    .split(/\s+/)
    .map(word => {
      const firstLetter = word.replace(/^[“"']+/, "").charAt(0);
      const punctuation = word.match(/[.,!?;:]$/);
      return punctuation ? `${firstLetter} ${punctuation[0]}` : firstLetter;
    })
    .join(" ");
}

function updateUsedWords() {
  const inputWords = splitSentence(document.getElementById("answerInput").value)
    .map(w => normalizeForCompare(w));

  const chips = document.querySelectorAll(".word-chip");

  chips.forEach(chip => {
    const word = normalizeForCompare(chip.textContent);

    if (inputWords.includes(word)) {
      chip.classList.add("used");
    } else {
      chip.classList.remove("used");
    }
  });
}

function checkAnswer() {
  if (testType === "vocab" || testType === "speakingReview") {
    checkVocabAnswer();
  } else if (testType === "sentence") {
    checkSentenceAnswer();
  }
}

function checkVocabAnswer() {
  const q = questions[currentIndex];

  if (!selectedChoice) {
    alert("選択肢を選んでください。");
    return;
  }

  const isCorrect = selectedChoice === q.correctAnswer;

  if (testType === "vocab") {
    if (isCorrect && reviewMode) removeWrongWord(q.id);
    if (!isCorrect) saveWrongWord(q.id);
  }

  processAnswer({
    id: q.id,
    section: q.section,
    question: q.word,
    userAnswer: selectedChoice,
    correctAnswer: q.correctAnswer,
    isCorrect,
    points: q.points
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
    isCorrect,
    points: 1
  });
}

function processAnswer(data) {
  if (data.isCorrect) {
    score += data.points;
    document.getElementById("feedback").textContent = "✅ 正解！";
    document.getElementById("feedback").className = "correct";
  } else {
    document.getElementById("feedback").innerHTML =
      `❌ 不正解。<br>正解：${escapeHtml(data.correctAnswer)}`;
    document.getElementById("feedback").className = "wrong";
    mistakes.push(data);
  }

  answersLog.push({
    studentId,
    testType: getTestName(),
    mode: reviewMode ? "復習" : "通常",
    id: data.id,
    section: data.section,
    question: data.question,
    userAnswer: data.userAnswer,
    correctAnswer: data.correctAnswer,
    correct: data.isCorrect,
    answeredAt: new Date().toLocaleString("ja-JP")
  });

  document.getElementById("checkButton").disabled = true;
  document.getElementById("nextButton").classList.remove("hidden");
}

function nextQuestion() {
  currentIndex++;

  if (currentIndex < questions.length) {
    showQuestion();
  } else {
    showResult(false);
  }
}

function quitQuiz() {
  if (confirm("途中で終了して、教材選択画面に戻りますか？")) {
    resetQuizState();
    showOnly("menuScreen");
  }
}

function showResult(isQuit) {
  const endTime = new Date();
  const answeredCount = answersLog.length;
  const totalSeconds = Math.floor((endTime - startTime) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  showOnly("resultScreen");

  document.getElementById("scoreDisplay").textContent =
    isQuit
      ? `途中終了：${answeredCount}問中 ${score}点`
      : `テスト終了：${answeredCount}問中 ${score}点`;

  document.getElementById("dateDisplay").textContent =
    `回答日時：${endTime.toLocaleString("ja-JP")}`;

  document.getElementById("timeDisplay").textContent =
    `解答時間：${minutes}分 ${seconds}秒`;

  showMistakes();

  console.log({
    studentId,
    testType: getTestName(),
    mode: reviewMode ? "復習" : "通常",
    status: isQuit ? "途中終了" : "完了",
    score,
    answeredCount,
    totalQuestions: questions.length,
    startTime: startTime.toLocaleString("ja-JP"),
    endTime: endTime.toLocaleString("ja-JP"),
    mistakes,
    answers: answersLog
  });
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
          <strong>正解：</strong>${escapeHtml(m.correctAnswer)}
        </div>
      `).join("")}
    </div>
  `;
}

function saveWrongWord(id) {
  const key = getWrongKey();
  const wrongIds = getWrongIds();

  if (!wrongIds.includes(String(id))) {
    wrongIds.push(String(id));
  }

  localStorage.setItem(key, JSON.stringify(wrongIds));
  updateMistakeCountInSettings();
}

function removeWrongWord(id) {
  const key = getWrongKey();
  let wrongIds = getWrongIds();

  wrongIds = wrongIds.filter(wrongId => wrongId !== String(id));
  localStorage.setItem(key, JSON.stringify(wrongIds));
  updateMistakeCountInSettings();
}

function getWrongIds() {
  const key = getWrongKey();
  return JSON.parse(localStorage.getItem(key)) || [];
}

function getWrongKey() {
  const id = studentId || document.getElementById("studentIdInput").value.trim() || "default";
  return `wrongWords_${id}`;
}

function clearStoredMistakes() {
  studentId = document.getElementById("studentIdInput").value.trim() || "default";

  if (!confirm("この回答者番号の間違い履歴を削除しますか？")) return;

  localStorage.removeItem(getWrongKey());
  updateMistakeCountInSettings();
  alert("間違い履歴を削除しました。");
}

function updateMistakeCountInSettings() {
  const countText = document.getElementById("settingMistakeCount");
  if (!countText) return;

  const id = document.getElementById("studentIdInput").value.trim();

  if (!id) {
    countText.textContent = "回答者番号を入力すると、その番号の間違い履歴を確認できます。";
    return;
  }

  studentId = id;
  countText.textContent = `保存された間違い：${getWrongIds().length}問`;
}

function resetQuizState() {
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
  ["loginScreen", "menuScreen", "calendarScreen", "settingScreen", "quizScreen", "resultScreen"].forEach(screen => {
    const element = document.getElementById(screen);
    if (element) element.classList.add("hidden");
  });

  document.getElementById(id).classList.remove("hidden");
}

function getTestName() {
  if (testType === "vocab") return "Stock 3000 単語テスト";
  if (testType === "sentence") return "語順並べ替えテスト";
  if (testType === "speakingReview") return "TOEIC Speaking 復習";
  return "";
}

function splitSentence(text) {
  return String(text)
    .replace(/[.,!?;:]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeSentence(text) {
  return String(text)
    .replace(/[.,!?;:]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeForCompare(text) {
  return String(text)
    .replace(/[.,!?;:]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .trim()
    .toLowerCase();
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
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

async function openCalendar() {
  if (toeicCalendar.length === 0) {
    await loadCalendarData();
  }

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
      const key = `toeicCalendar_${dayIndex}_${taskIndex}`;
      const checked = localStorage.getItem(key) === "true" ? "checked" : "";

      return `
        <label class="calendar-task">
          <input type="checkbox" data-key="${key}" ${checked}>
          ${escapeHtml(task)}
        </label>
      `;
    }).join("");

    card.innerHTML = `
      <h3>${escapeHtml(day.date)}</h3>
      ${taskHtml}
      <p class="calendar-comment">${escapeHtml(day.comment)}</p>
    `;

    area.appendChild(card);
  });

  document.querySelectorAll("#calendarArea input[type='checkbox']").forEach(box => {
    box.addEventListener("change", function () {
      localStorage.setItem(this.dataset.key, this.checked);
    });
  });
}

function resetCalendarChecks() {
  if (!confirm("カレンダーのチェックをすべてリセットしますか？")) return;

  Object.keys(localStorage).forEach(key => {
    if (key.startsWith("toeicCalendar_")) {
      localStorage.removeItem(key);
    }
  });

  renderCalendar();
}
