const PASSWORD = "testing";

let testType = "";
let allVocabQuestions = [];
let questions = [];
let currentIndex = 0;
let score = 0;
let studentId = "";
let selectedChoice = "";
let answersLog = [];
let mistakes = [];
let startTime = "";

document.getElementById("loginButton").addEventListener("click", checkPassword);
document.getElementById("showPassword").addEventListener("change", togglePassword);
document.getElementById("vocabTestButton").addEventListener("click", () => openSettings("vocab"));
document.getElementById("sentenceTestButton").addEventListener("click", () => openSettings("sentence"));
document.getElementById("startButton").addEventListener("click", startQuiz);
document.getElementById("backToMenuButton").addEventListener("click", backToMenu);
document.getElementById("checkButton").addEventListener("click", checkAnswer);
document.getElementById("nextButton").addEventListener("click", nextQuestion);
document.getElementById("quitButton").addEventListener("click", quitQuiz);
document.getElementById("restartButton").addEventListener("click", () => location.reload());
document.getElementById("clearMistakesButton").addEventListener("click", clearMistakes);

function checkPassword() {
  const input = document.getElementById("passwordInput").value;
  if (input === PASSWORD) {
    showOnly("menuScreen");
  } else {
    document.getElementById("loginMessage").textContent = "パスワードが違います。";
  }
}

function togglePassword() {
  document.getElementById("passwordInput").type = this.checked ? "text" : "password";
}

async function openSettings(type) {
  testType = type;
  showOnly("settingScreen");

  document.getElementById("settingTitle").textContent =
    type === "vocab" ? "Stock 3000 単語テスト" : "語順並べ替えテスト";

  if (type === "vocab") {
    document.getElementById("vocabSettings").classList.remove("hidden");
    if (allVocabQuestions.length === 0) {
      await loadVocabQuestions();
    }
    setupSectionSelect();
  } else {
    document.getElementById("vocabSettings").classList.add("hidden");
  }
}

function backToMenu() {
  showOnly("menuScreen");
}

async function startQuiz() {
  studentId = document.getElementById("studentIdInput").value.trim();

  if (!studentId) {
    alert("回答者番号を入力してください。");
    return;
  }

  if (testType === "vocab") {
    prepareVocabQuiz();
  } else {
    await loadSentenceQuestions();
  }

  currentIndex = 0;
  score = 0;
  selectedChoice = "";
  answersLog = [];
  mistakes = [];
  startTime = new Date().toLocaleString("ja-JP");

  showOnly("quizScreen");
  showQuestion();
}

async function loadVocabQuestions() {
  const response = await fetch("data/stock_3000_master.csv");
  const text = await response.text();
  const rows = parseCSV(text);

  const header = rows.shift();

  allVocabQuestions = rows.map(row => ({
    id: row[0],
    section: row[1],
    word: row[2],
    correctAnswer: row[3],
    wrongs: [row[4], row[5], row[6]].filter(Boolean),
    points: row[7] || "1"
  })).filter(q => q.id && q.word && q.correctAnswer);
}

function setupSectionSelect() {
  const select = document.getElementById("sectionSelect");
  const sections = [...new Set(allVocabQuestions.map(q => q.section))].filter(Boolean);

  select.innerHTML = `<option value="all">全セクション</option>`;
  sections.forEach(sec => {
    select.innerHTML += `<option value="${sec}">Section ${sec}</option>`;
  });
}

function prepareVocabQuiz() {
  const selectedSection = document.getElementById("sectionSelect").value;
  const countValue = document.getElementById("questionCountSelect").value;

  let pool = selectedSection === "all"
    ? [...allVocabQuestions]
    : allVocabQuestions.filter(q => q.section === selectedSection);

  pool = shuffle(pool);

  if (countValue !== "all") {
    pool = pool.slice(0, Number(countValue));
  }

  questions = pool;
}

async function loadSentenceQuestions() {
  const response = await fetch("data/sentence_order.json");
  questions = await response.json();
}

function showQuestion() {
  selectedChoice = "";

  document.getElementById("questionNumber").textContent =
    `問題 ${currentIndex + 1} / ${questions.length}`;

  document.getElementById("feedback").textContent = "";
  document.getElementById("feedback").className = "";
  document.getElementById("nextButton").classList.add("hidden");
  document.getElementById("checkButton").disabled = false;

  if (testType === "vocab") {
    showVocabQuestion();
  } else {
    showSentenceQuestion();
  }
}

function showVocabQuestion() {
  const q = questions[currentIndex];
  document.getElementById("testTitle").textContent = "Stock 3000 単語テスト";

  const choices = shuffle([q.correctAnswer, ...q.wrongs]);

  document.getElementById("questionArea").innerHTML = `
    <div class="words">${escapeHtml(q.word)}</div>
    ${choices.map(choice =>
      `<button class="choice-button" data-choice="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`
    ).join("")}
  `;

  document.querySelectorAll(".choice-button").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedChoice = btn.dataset.choice;
      document.querySelectorAll(".choice-button").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
  });
}

function showSentenceQuestion() {
  const q = questions[currentIndex];
  document.getElementById("testTitle").textContent = "語順並べ替えテスト";

  document.getElementById("questionArea").innerHTML = `
    <div class="words">${q.words.join(" / ")}</div>
    <input type="text" id="answerInput" placeholder="英文を入力してください" />
  `;
}

function checkAnswer() {
  if (testType === "vocab") {
    checkVocabAnswer();
  } else {
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
  processAnswer({
    id: q.id,
    section: q.section,
    question: q.word,
    userAnswer: selectedChoice,
    correctAnswer: q.correctAnswer,
    isCorrect
  });
}

function checkSentenceAnswer() {
  const q = questions[currentIndex];
  const userAnswer = document.getElementById("answerInput").value;
  const isCorrect = normalize(userAnswer) === normalize(q.answer);

  processAnswer({
    id: q.id,
    section: "",
    question: q.words.join(" / "),
    userAnswer,
    correctAnswer: q.answer,
    isCorrect
  });
}

function processAnswer(data) {
  if (data.isCorrect) {
    score++;
    document.getElementById("feedback").textContent = "正解です！";
    document.getElementById("feedback").className = "correct";
  } else {
    document.getElementById("feedback").innerHTML =
      `不正解です。<br>正解：${escapeHtml(data.correctAnswer)}`;
    document.getElementById("feedback").className = "wrong";

    mistakes.push(data);
  }

  answersLog.push({
    studentId,
    testType: testType === "vocab" ? "Stock 3000 単語テスト" : "語順並べ替えテスト",
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
    currentIndex = 0;
    score = 0;
    selectedChoice = "";
    answersLog = [];
    mistakes = [];

    document.getElementById("feedback").textContent = "";
    document.getElementById("questionArea").innerHTML = "";

    showOnly("menuScreen");
  }
}

function showResult(isQuit) {
  const endTime = new Date().toLocaleString("ja-JP");
  const answeredCount = answersLog.length;

  showOnly("resultScreen");

  document.getElementById("scoreDisplay").textContent =
    isQuit
      ? `途中終了：${answeredCount}問中 ${score}問正解`
      : `${questions.length}問中 ${score}問正解`;

  document.getElementById("dateDisplay").textContent = `回答日時：${endTime}`;

  showMistakes();

  console.log({
    studentId,
    testType,
    status: isQuit ? "途中終了" : "完了",
    score,
    total: isQuit ? answeredCount : questions.length,
    startTime,
    endTime,
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
      <h3>ミスした問題</h3>
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

function clearMistakes() {
  mistakes = [];
  document.getElementById("mistakeArea").innerHTML = "<p>ミスを削除しました。</p>";
}

function showOnly(id) {
  ["loginScreen", "menuScreen", "settingScreen", "quizScreen", "resultScreen"].forEach(screen => {
    document.getElementById(screen).classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");
}

function normalize(text) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"');
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
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
