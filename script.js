const PASSWORD = "testing";

document.getElementById("showPassword").addEventListener("change", function () {
  const passwordField = document.getElementById("passwordInput");

  if (this.checked) {
    passwordField.type = "text";
  } else {
    passwordField.type = "password";
  }
});

let questions = [];
let currentIndex = 0;
let score = 0;
let studentId = "";
let answersLog = [];
let startTime = "";

document.getElementById("loginButton").addEventListener("click", checkPassword);
document.getElementById("sentenceTestButton").addEventListener("click", showIdScreen);
document.getElementById("startButton").addEventListener("click", startQuiz);
document.getElementById("checkButton").addEventListener("click", checkAnswer);
document.getElementById("nextButton").addEventListener("click", nextQuestion);
document.getElementById("restartButton").addEventListener("click", () => location.reload());
document.getElementById("quitButton").addEventListener("click", quitQuiz);

function checkPassword() {
  const input = document.getElementById("passwordInput").value;

  if (input === PASSWORD) {
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("menuScreen").classList.remove("hidden");
  } else {
    document.getElementById("loginMessage").textContent = "パスワードが違います。";
  }
}

function showIdScreen() {
  document.getElementById("menuScreen").classList.add("hidden");
  document.getElementById("idScreen").classList.remove("hidden");
}

async function startQuiz() {
  studentId = document.getElementById("studentIdInput").value.trim();

  if (!studentId) {
    alert("回答者番号を入力してください。");
    return;
  }

  const response = await fetch("data/sentence_order.json");
  questions = await response.json();

  currentIndex = 0;
  score = 0;
  answersLog = [];
  startTime = new Date().toLocaleString("ja-JP");

  document.getElementById("idScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.remove("hidden");

  showQuestion();
}

function showQuestion() {
  const q = questions[currentIndex];

  document.getElementById("questionNumber").textContent =
    `問題 ${currentIndex + 1} / ${questions.length}`;

  document.getElementById("wordsDisplay").textContent =
    q.words.join(" / ");

function quitQuiz() {
  const confirmQuit = confirm("途中で終了しますか？現在までの結果を表示します。");

  if (!confirmQuit) {
    return;
  }

  showResult(true);
}  

  document.getElementById("answerInput").value = "";
  document.getElementById("feedback").textContent = "";
  document.getElementById("feedback").className = "";
  document.getElementById("nextButton").classList.add("hidden");
  document.getElementById("checkButton").disabled = false;
}

function normalize(text) {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"');
}

function checkAnswer() {
  const q = questions[currentIndex];
  const userAnswer = document.getElementById("answerInput").value;
  const correctAnswer = q.answer;

  const isCorrect = normalize(userAnswer) === normalize(correctAnswer);

  if (isCorrect) {
    score++;
    document.getElementById("feedback").textContent = "正解です！";
    document.getElementById("feedback").className = "correct";
  } else {
    document.getElementById("feedback").innerHTML =
      `不正解です。<br>正解：${correctAnswer}`;
    document.getElementById("feedback").className = "wrong";
  }

  answersLog.push({
    studentId: studentId,
    id: q.id,
    question: q.words.join(" / "),
    userAnswer: userAnswer,
    correctAnswer: correctAnswer,
    correct: isCorrect,
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
  function showResult(isQuit = false) {
  const endTime = new Date().toLocaleString("ja-JP");

  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.remove("hidden");

  const answeredCount = answersLog.length;

  document.getElementById("scoreDisplay").textContent =
    isQuit
      ? `途中終了：${answeredCount}問中 ${score}問正解`
      : `${questions.length}問中 ${score}問正解`;

  document.getElementById("dateDisplay").textContent =
    `回答日時：${endTime}`;

  console.log({
    studentId: studentId,
    status: isQuit ? "途中終了" : "完了",
    score: score,
    total: isQuit ? answeredCount : questions.length,
    startTime: startTime,
    endTime: endTime,
    answers: answersLog
  });
};
  }
}

function showResult() {
  const endTime = new Date().toLocaleString("ja-JP");

  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.remove("hidden");

  document.getElementById("scoreDisplay").textContent =
    `${questions.length}問中 ${score}問正解`;

  document.getElementById("dateDisplay").textContent =
    `回答日時：${endTime}`;

  console.log({
    studentId: studentId,
    score: score,
    total: questions.length,
    startTime: startTime,
    endTime: endTime,
    answers: answersLog
  });
}
