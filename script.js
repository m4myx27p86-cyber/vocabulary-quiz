const PASSWORD = "testing";

let testType = "";
let questions = [];
let currentIndex = 0;
let score = 0;
let studentId = "";
let answersLog = [];
let startTime = "";
let selectedChoice = "";

// ボタン設定
document.getElementById("loginButton").addEventListener("click", checkPassword);
document.getElementById("showPassword").addEventListener("change", togglePassword);
document.getElementById("vocabTestButton").addEventListener("click", () => showIdScreen("vocab"));
document.getElementById("sentenceTestButton").addEventListener("click", () => showIdScreen("sentence"));
document.getElementById("startButton").addEventListener("click", startQuiz);
document.getElementById("checkButton").addEventListener("click", checkAnswer);
document.getElementById("nextButton").addEventListener("click", nextQuestion);
document.getElementById("quitButton").addEventListener("click", quitQuiz);
document.getElementById("restartButton").addEventListener("click", () => location.reload());

function checkPassword() {
  const input = document.getElementById("passwordInput").value;

  if (input === PASSWORD) {
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("menuScreen").classList.remove("hidden");
  } else {
    document.getElementById("loginMessage").textContent = "パスワードが違います。";
  }
}

function togglePassword() {
  const passwordField = document.getElementById("passwordInput");
  passwordField.type = this.checked ? "text" : "password";
}

function showIdScreen(type) {
  testType = type;
  document.getElementById("menuScreen").classList.add("hidden");
  document.getElementById("idScreen").classList.remove("hidden");
}

async function startQuiz() {
  studentId = document.getElementById("studentIdInput").value.trim();

  if (!studentId) {
    alert("回答者番号を入力してください。");
    return;
  }

  if (testType === "sentence") {
    await loadSentenceQuestions();
  } else if (testType === "vocab") {
    await loadVocabQuestions();
  }

  currentIndex = 0;
  score = 0;
  answersLog = [];
  startTime = new Date().toLocaleString("ja-JP");

  document.getElementById("idScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.remove("hidden");

  showQuestion();
}

// 語順問題の読み込み
async function loadSentenceQuestions() {
  const response = await fetch("data/sentence_order.json");
  questions = await response.json();
}

// 単語テストCSVの読み込み
async function loadVocabQuestions() {
  const response = await fetch("data/stock_3000_master.csv");
  const csvText = await response.text();

  const rows = csvText.trim().split("\n").map(row => row.split(","));

  // 1行目が見出しの場合は削除
  if (rows[0][0].toLowerCase().includes("word") || rows[0][0].includes("単語")) {
    rows.shift();
  }

  questions = rows.map((row, index) => {
    return {
      id: index + 1,
      word: row[0]?.trim(),
      correctAnswer: row[1]?.trim(),
      choices: shuffle([
        row[1]?.trim(),
        row[2]?.trim(),
        row[3]?.trim(),
        row[4]?.trim()
      ].filter(Boolean))
    };
  }).filter(q => q.word && q.correctAnswer && q.choices.length >= 2);
}

function showQuestion() {
  selectedChoice = "";

  document.getElementById("questionNumber").textContent =
    `問題 ${currentIndex + 1} / ${questions.length}`;

  document.getElementById("feedback").textContent = "";
  document.getElementById("feedback").className = "";
  document.getElementById("nextButton").classList.add("hidden");
  document.getElementById("checkButton").disabled = false;

  if (testType === "sentence") {
    showSentenceQuestion();
  } else if (testType === "vocab") {
    showVocabQuestion();
  }
}

function showSentenceQuestion() {
  const q = questions[currentIndex];

  document.getElementById("testTitle").textContent = "語順並べ替えテスト";

  document.getElementById("questionArea").innerHTML = `
    <div class="words">${q.words.join(" / ")}</div>
    <input type="text" id="answerInput" placeholder="英文を入力してください" />
  `;
}

function showVocabQuestion() {
  const q = questions[currentIndex];

  document.getElementById("testTitle").textContent = "単語テスト";

  const choiceButtons = q.choices.map(choice => {
    return `<button class="choice-button" onclick="selectChoice(this, '${escapeHtml(choice)}')">${choice}</button>`;
  }).join("");

  document.getElementById("questionArea").innerHTML = `
    <div class="words">${q.word}</div>
    <div>${choiceButtons}</div>
  `;
}

function selectChoice(button, choice) {
  selectedChoice = choice;

  document.querySelectorAll(".choice-button").forEach(btn => {
    btn.classList.remove("selected");
  });

  button.classList.add("selected");
}

function checkAnswer() {
  if (testType === "sentence") {
    checkSentenceAnswer();
  } else if (testType === "vocab") {
    checkVocabAnswer();
  }
}

function checkSentenceAnswer() {
  const q = questions[currentIndex];
  const userAnswer = document.getElementById("answerInput").value;
  const correctAnswer = q.answer;

  const isCorrect = normalize(userAnswer) === normalize(correctAnswer);

  showFeedback(isCorrect, correctAnswer);

  answersLog.push({
    studentId: studentId,
    testType: "語順並べ替えテスト",
    id: q.id,
    question: q.words.join(" / "),
    userAnswer: userAnswer,
    correctAnswer: correctAnswer,
    correct: isCorrect,
    answeredAt: new Date().toLocaleString("ja-JP")
  });
}

function checkVocabAnswer() {
  const q = questions[currentIndex];

  if (!selectedChoice) {
    alert("選択肢を選んでください。");
    return;
  }

  const isCorrect = selectedChoice === q.correctAnswer;

  showFeedback(isCorrect, q.correctAnswer);

  answersLog.push({
    studentId: studentId,
    testType: "単語テスト",
    id: q.id,
    question: q.word,
    userAnswer: selectedChoice,
    correctAnswer: q.correctAnswer,
    correct: isCorrect,
    answeredAt: new Date().toLocaleString("ja-JP")
  });
}

function showFeedback(isCorrect, correctAnswer) {
  if (isCorrect) {
    score++;
    document.getElementById("feedback").textContent = "正解です！";
    document.getElementById("feedback").className = "correct";
  } else {
    document.getElementById("feedback").innerHTML =
      `不正解です。<br>正解：${correctAnswer}`;
    document.getElementById("feedback").className = "wrong";
  }

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
  const confirmQuit = confirm("途中で終了しますか？現在までの結果を表示します。");

  if (!confirmQuit) {
    return;
  }

  showResult(true);
}

function showResult(isQuit = false) {
  const endTime = new Date().toLocaleString("ja-JP");
  const answeredCount = answersLog.length;

  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.remove("hidden");

  document.getElementById("scoreDisplay").textContent =
    isQuit
      ? `途中終了：${answeredCount}問中 ${score}問正解`
      : `${questions.length}問中 ${score}問正解`;

  document.getElementById("dateDisplay").textContent =
    `回答日時：${endTime}`;

  console.log({
    studentId: studentId,
    testType: testType,
    status: isQuit ? "途中終了" : "完了",
    score: score,
    total: isQuit ? answeredCount : questions.length,
    startTime: startTime,
    endTime: endTime,
    answers: answersLog
  });
}

function normalize(text) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"');
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function escapeHtml(text) {
  return String(text)
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;");
}
