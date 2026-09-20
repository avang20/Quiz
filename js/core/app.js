/* =========================================================
   QuizDuo - Core Application
   ========================================================= */

import {
  createDefaultState,
  addXP,
  getUnlockedStage,
  isStageCompleted,
  markStageCompleted
} from "./state.js";

import {
  loadState,
  saveState,
  getCurrentUser,
  setCurrentUser,
  logoutUser,
  getUsers,
  saveUsers
} from "./storage.js";

import {
  updateStreak,
  escapeHTML
} from "./utils.js";

import {
  QuizEngine
} from "./quiz.js";


/* =========================================================
   CONFIG
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbwQNOpTNYI6jD2obOFKk02eEjSZd2OzkPiwvBgN_xnDgsZ90B3a_FCmXkIvzVyuxzJiZQ/exec";


/* =========================================================
   STATE
   ========================================================= */

const savedUsername =
  getCurrentUser() || "guest";

const state =
  loadState(
    createDefaultState(),
    savedUsername
  );

let authMode = "login";

let currentCategory =
  "general";

let currentStage =
  null;

let selectedPlan =
  null;

let discountValue =
  0;

let discountCodeUsed =
  "";


/* =========================================================
   QUIZ ENGINE
   ========================================================= */

const quiz =
  new QuizEngine(
    state,
    () =>
      saveState(
        state,
        state.username || "guest"
      )
  );


/* =========================================================
   HELPERS
   ========================================================= */

const $ = (
  selector,
  parent = document
) =>
  parent.querySelector(selector);


const $$ = (
  selector,
  parent = document
) =>
  [...parent.querySelectorAll(selector)];


function formatNumber(value) {
  return Number(
    value || 0
  ).toLocaleString("fa-IR");
}


function toast(
  message,
  type = ""
) {
  let container =
    $(".toast-container");

  if (!container) {
    container =
      document.createElement("div");

    container.className =
      "toast-container";

    document.body.appendChild(
      container
    );
  }

  const item =
    document.createElement("div");

  item.className =
    `toast ${type}`.trim();

  item.textContent =
    message;

  container.appendChild(
    item
  );

  setTimeout(
    () => item.remove(),
    3500
  );
}


function showMessage(
  element,
  text,
  type = ""
) {
  if (!element) return;

  element.textContent =
    text;

  element.className =
    `message ${type}`.trim();
}


/* =========================================================
   AUTH COMPATIBILITY
   ========================================================= */

function getUsername() {
  return (
    state.username ||
    "بازیکن مهمان"
  );
}


function isLoggedIn() {
  return (
    !!state.username &&
    state.username !==
      "بازیکن مهمان" &&
    state.username !==
      "guest"
  );
}


function requireLogin() {
  if (isLoggedIn()) {
    return true;
  }

  toast(
    "برای ادامه ابتدا وارد حساب کاربری شوید.",
    "warning"
  );

  openAuth("login");

  return false;
}


function normalizeUsername(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}


function openAuth(
  mode = "login"
) {
  authMode =
    mode;

  const title =
    $("#authTitle");

  const submit =
    $("#authSubmit");

  const toggle =
    $("#toggleAuth");

  const phoneField =
    $("#phoneField");

  if (mode === "register") {
    if (title)
      title.textContent =
        "ساخت حساب";

    if (submit)
      submit.textContent =
        "ثبت‌نام";

    if (toggle)
      toggle.textContent =
        "قبلاً حساب دارم";

    phoneField?.classList.remove(
      "hidden"
    );
  } else {
    if (title)
      title.textContent =
        "ورود";

    if (submit)
      submit.textContent =
        "ورود";

    if (toggle)
      toggle.textContent =
        "ساخت حساب جدید";

    phoneField?.classList.add(
      "hidden"
    );
  }

  navigate("auth");
}


/* =========================================================
   LOCAL AUTH
   ========================================================= */

function registerUser(
  name,
  phone,
  password
) {
  const users =
    getUsers();

  const normalized =
    normalizeUsername(name);

  if (!normalized || !password) {
    throw new Error(
      "نام کاربری و رمز عبور الزامی است."
    );
  }

  const exists =
    users.some(
      user =>
        normalizeUsername(
          user.name
        ) === normalized
    );

  if (exists) {
    throw new Error(
      "این نام کاربری قبلاً ثبت شده است."
    );
  }

  const user = {
    id:
      `user_${Date.now()}`,

    name:
      String(name).trim(),

    phone:
      String(phone || "").trim(),

    password,

    createdAt:
      new Date().toISOString()
  };

  users.push(user);

  saveUsers(users);

  return user;
}


function loginUser(
  name,
  password
) {
  const normalized =
    normalizeUsername(name);

  return getUsers().find(
    user =>
      normalizeUsername(
        user.name
      ) === normalized &&
      user.password === password
  );
}


async function handleAuthSubmit() {
  const name =
    $("#authName")
      ?.value
      .trim();

  const phone =
    $("#authPhone")
      ?.value
      .trim();

  const password =
    $("#authPassword")
      ?.value;

  const message =
    $("#authMsg");

  if (!name || !password) {
    showMessage(
      message,
      "نام کاربری و رمز عبور را وارد کنید.",
      "error"
    );

    return;
  }

  try {
    let user;

    if (
      authMode ===
      "register"
    ) {
      if (!phone) {
        showMessage(
          message,
          "شماره تماس را وارد کنید.",
          "error"
        );

        return;
      }

      user =
        registerUser(
          name,
          phone,
          password
        );

      showMessage(
        message,
        "حساب با موفقیت ساخته شد.",
        "success"
      );
    } else {
      user =
        loginUser(
          name,
          password
        );

      if (!user) {
        showMessage(
          message,
          "نام کاربری یا رمز عبور اشتباه است.",
          "error"
        );

        return;
      }

      showMessage(
        message,
        "ورود موفق بود.",
        "success"
      );
    }

    state.username =
      user.name;

    state.userId =
      user.id;

    state.phone =
      user.phone;

    setCurrentUser(
      user.name
    );

    updateStreak(
      state
    );

    saveState(
      state,
      user.name
    );

    updateUI();

    await syncUser();

    setTimeout(
      () => navigate("profile"),
      300
    );

  } catch (error) {
    showMessage(
      message,
      error.message ||
        "خطایی رخ داد.",
      "error"
    );
  }
}


function logout() {
  logoutUser();

  state.username =
    "بازیکن مهمان";

  state.userId =
    null;

  state.phone =
    "";

  state.subscription =
    "free";

  saveState(
    state,
    "guest"
  );

  updateUI();

  toast(
    "از حساب کاربری خارج شدید.",
    "success"
  );

  navigate("home");
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function navigate(
  pageId
) {
  const page =
    document.getElementById(
      pageId
    );

  if (!page) return;

  $$(".page").forEach(
    section =>
      section.classList.remove(
        "active"
      )
  );

  page.classList.add(
    "active"
  );

  $$(".main-nav button").forEach(
    button => {
      button.classList.toggle(
        "active",
        button.dataset.page ===
          pageId
      );
    }
  );

  if (
    pageId === "quiz"
  ) {
    renderStages();

  } else if (
    pageId === "profile"
  ) {
    renderProfile();

  } else if (
    pageId === "leaderboard"
  ) {
    renderLeaderboard();

  } else if (
    pageId === "subscription"
  ) {
    renderSubscription();

  } else if (
    pageId === "chat"
  ) {
    renderChat();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/*
 * سازگاری با index.html قدیمی
 *
 * دکمه‌های index.html از این استفاده می‌کنند:
 *
 * QuizDuo.showPage("home")
 *
 * بنابراین showPage باید به navigate وصل باشد.
 */
function showPage(
  pageId
) {
  navigate(pageId);
}


/* =========================================================
   SUBSCRIPTION
   ========================================================= */

const PLANS = {
  monthly: {
    id: "monthly",
    title: "اشتراک ماهانه",
    price: 100000
  },

  quarterly: {
    id: "quarterly",
    title: "اشتراک سه‌ماهه",
    price: 270000
  },

  sixMonth: {
    id: "sixMonth",
    title: "اشتراک شش‌ماهه",
    price: 480000
  },

  nineMonth: {
    id: "nineMonth",
    title: "اشتراک نه‌ماهه Premium",
    price: 660000,
    premium: true
  }
};


function isSubscriptionActive() {
  const subscription =
    state.subscription;

  if (
    typeof subscription ===
    "string"
  ) {
    return (
      subscription ===
      "active"
    );
  }

  if (
    !subscription ||
    typeof subscription !==
      "object"
  ) {
    return false;
  }

  if (
    subscription.active ===
    true
  ) {
    if (
      !subscription.expiryDate
    ) {
      return true;
    }

    const expiry =
      new Date(
        subscription.expiryDate
      );

    return (
      !Number.isNaN(
        expiry.getTime()
      ) &&
      expiry > new Date()
    );
  }

  return (
    subscription.status ===
      "active" ||
    subscription.status ===
      "approved"
  );
}


function hasFullAccess() {
  return isSubscriptionActive();
}


function canAccessStage(
  stage
) {
  /*
   * مرحله ۱ برای همه رایگان است.
   * مرحله ۲ به بعد فقط با اشتراک تأییدشده.
   */

  if (
    Number(stage) === 1
  ) {
    return true;
  }

  return hasFullAccess();
}


/* =========================================================
   QUIZ DATA
   ========================================================= */

async function loadCategory(
  category
) {
  try {
    await quiz.loadCategory(
      category
    );

    return true;

  } catch (error) {
    console.error(
      error
    );

    toast(
      `فایل data/${category}.json پیدا نشد.`,
      "error"
    );

    return false;
  }
}


/* =========================================================
   STAGES
   ========================================================= */

async function renderStages() {
  const container =
    $("#stages");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="panel loading">
      در حال بارگذاری مراحل...
    </div>
  `;

  const loaded =
    await loadCategory(
      currentCategory
    );

  if (!loaded) {
    container.innerHTML = `
      <div class="panel">
        امکان بارگذاری سوالات وجود ندارد.
      </div>
    `;

    return;
  }

  const questions =
    quiz.questions || [];

  if (!questions.length) {
    container.innerHTML = `
      <div class="panel">
        برای این بخش هنوز سوالی ثبت نشده است.
      </div>
    `;

    return;
  }

  const stages = [
    ...new Set(
      questions.map(
        question =>
          Number(
            question.stage
          ) || 1
      )
    )
  ].sort(
    (a, b) => a - b
  );

  container.innerHTML =
    "";

  stages.forEach(
    stage => {
      const stageQuestions =
        quiz.getStageQuestions(
          stage
        );

      const completed =
        isStageCompleted(
          state,
          currentCategory,
          stage
        );

      const unlocked =
        canAccessStage(
          stage
        );

      const card =
        document.createElement(
          "article"
        );

      card.className =
        [
          "stage-card",
          completed
            ? "completed"
            : "",
          !unlocked
            ? "locked"
            : ""
        ]
          .filter(Boolean)
          .join(" ");

      card.innerHTML = `
        <span class="stage-lock">
          ${
            unlocked
              ? completed
                ? "✅"
                : "▶️"
              : "🔒"
          }
        </span>

        <div>
          <div class="stage-number">
            ${stage}
          </div>

          <h3>
            مرحله ${stage}
          </h3>

          <p>
            ${formatNumber(
              stageQuestions.length
            )}
            سؤال
          </p>
        </div>

        <button
          class="${
            unlocked
              ? "primary"
              : "secondary"
          }"
          data-stage="${stage}"
        >
          ${
            unlocked
              ? completed
                ? "بازی دوباره"
                : "شروع مرحله"
              : "🔒 نیاز به اشتراک"
          }
        </button>
      `;

      const button =
        $("button", card);

      button?.addEventListener(
        "click",
        () => {
          if (
            !canAccessStage(
              stage
            )
          ) {
            toast(
              "برای مرحله ۲ به بعد اشتراک تأییدشده لازم است.",
              "warning"
            );

            navigate(
              "subscription"
            );

            return;
          }

          startStage(
            currentCategory,
            stage,
            completed
          );
        }
      );

      container.appendChild(
        card
      );
    }
  );

  updateQuizStats();
}


/* =========================================================
   CATEGORY
   ========================================================= */

function setCategory(
  category
) {
  if (
    category !==
      "general" &&
    category !==
      "fun"
  ) {
    return;
  }

  currentCategory =
    category;

  $$(
    "[data-category-tab]"
  ).forEach(
    button => {
      button.classList.toggle(
        "active",
        button.dataset.categoryTab ===
          category
      );
    }
  );

  renderStages();
}


/* =========================================================
   QUIZ
   ========================================================= */

async function startStage(
  category,
  stage,
  replay = false
) {
  if (
    !canAccessStage(
      stage
    )
  ) {
    toast(
      "این مرحله قفل است.",
      "warning"
    );

    return;
  }

  currentCategory =
    category;

  currentStage =
    stage;

  const loaded =
    await loadCategory(
      category
    );

  if (!loaded) {
    return;
  }

  const questions =
    quiz.startStage(
      category,
      stage,
      replay
    );

  if (
    !questions.length
  ) {
    toast(
      "این مرحله سؤال قابل اجرا ندارد.",
      "error"
    );

    return;
  }

  const box =
    $("#quizBox");

  if (!box) return;

  box.classList.remove(
    "hidden"
  );

  renderQuestion();

  box.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function renderQuestion() {
  const box =
    $("#quizBox");

  if (!box) return;

  const question =
    quiz.getCurrentQuestion();

  if (!question) {
    finishQuiz();
    return;
  }

  const number =
    quiz.currentQuestion + 1;

  const total =
    quiz.getQuestionCount();

  const progress =
    Math.round(
      ((number - 1) /
        total) *
        100
    );

  box.innerHTML = `
    <div class="quiz-question">

      <div class="section-heading">

        <div>
          <span class="eyebrow">
            مرحله ${currentStage}
          </span>

          <h3>
            سؤال ${number}
            از ${total}
          </h3>
        </div>

        <span class="quiz-score">
          درست:
          ${formatNumber(
            quiz.correctAnswers
          )}
        </span>

      </div>

      <div class="quiz-progress">
        <div
          style="width:${progress}%"
        ></div>
      </div>

      <h3>
        ${escapeHTML(
          question.question
        )}
      </h3>

      <div class="quiz-options">

        ${question.options
          .map(
            (option, index) => `
              <button
                class="quiz-option"
                data-option-index="${index}"
              >
                ${escapeHTML(
                  typeof option === "object"
                    ? option.text ?? option.label ?? option.value ?? ""
                    : option
                )}
              </button>
            `
          )
          .join("")}

      </div>

      <div
        id="answerFeedback"
        class="message"
      ></div>

      <div class="quiz-footer">

        <span>
          ❤️
          ${formatNumber(
            state.hearts
          )}
        </span>

        <button
          id="exitQuiz"
          class="dark-action"
        >
          خروج
        </button>

      </div>

    </div>
  `;

  $$(".quiz-option", box)
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () =>
            answerQuestion(
              Number(
                button.dataset
                  .optionIndex
              )
            )
        );
      }
    );

  $("#exitQuiz")
    ?.addEventListener(
      "click",
      () => {
        box.classList.add(
          "hidden"
        );

        renderStages();
      }
    );
}


function answerQuestion(
  index
) {
  const buttons =
    $$(".quiz-option");

  buttons.forEach(
    button =>
      button.disabled =
        true
  );

  const result =
    quiz.answer(
      index
    );

  const feedback =
    $("#answerFeedback");

  if (
    result.correct
  ) {
    buttons[index]
      ?.classList.add(
        "correct"
      );

    showMessage(
      feedback,
      "✅ پاسخ درست بود!",
      "success"
    );

  } else {
    buttons[index]
      ?.classList.add(
        "wrong"
      );

    if (
      result.correctAnswers !==
      undefined
    ) {
      const question =
        quiz.selectedQuestions[
          quiz.currentQuestion - 1
        ];

      if (
        question
      ) {
        buttons[
          question.answer
        ]?.classList.add(
          "correct"
        );

        const correctOption =
          question.options[
            question.answer
          ];

        const correctText =
          typeof correctOption === "object"
            ? correctOption.text ??
              correctOption.label ??
              correctOption.value ??
              "نامشخص"
            : correctOption;

        showMessage(
          feedback,
          `❌ پاسخ نادرست بود. پاسخ درست: ${correctText}`,
          "error"
        );
      }
    }
  }

  if (
    result.explanation
  ) {
    const explanation =
      document.createElement(
        "p"
      );

    explanation.className =
      "muted";

    explanation.textContent =
      result.explanation;

    feedback?.appendChild(
      explanation
    );
  }

  updateUI();

  setTimeout(
    () => {
      if (
        result.finished
      ) {
        finishQuiz(
          result
        );
      } else {
        renderQuestion();
      }
    },
    900
  );
}


function finishQuiz(
  result = null
) {
  const box =
    $("#quizBox");

  if (!box) return;

  const passed =
    result?.passed ?? true;

  if (
    result?.newlyCompleted
  ) {
    toast(
      `مرحله ${currentStage} با موفقیت تکمیل شد!`,
      "success"
    );
  }

  if (
    result?.heartLost
  ) {
    toast(
      "به دلیل رد شدن مرحله، یک قلب کم شد.",
      "warning"
    );
  }

  saveState(
    state,
    state.username ||
      "guest"
  );

  box.innerHTML = `
    <div class="access-denied">

      <span class="lock">
        ${
          passed
            ? "🎉"
            : "😕"
        }
      </span>

      <h3>
        ${
          passed
            ? `مرحله ${currentStage} تمام شد!`
            : "مرحله قبول نشد"
        }
      </h3>

      ${
        result
          ? `
            <p>
              پاسخ‌های درست:
              <b>
                ${formatNumber(
                  result.correctAnswers
                )}
              </b>
              از
              ${formatNumber(
                result.total
              )}
            </p>

            <p>
              XP:
              <b>
                ${formatNumber(
                  result.earnedXP
                )}
              </b>
            </p>
          `
          : ""
      }

      <button
        id="backToStages"
        class="primary"
      >
        بازگشت به مراحل
      </button>

    </div>
  `;

  $("#backToStages")
    ?.addEventListener(
      "click",
      () => {
        box.classList.add(
          "hidden"
        );

        renderStages();
      }
    );

  updateUI();

  if (
    state.username &&
    state.username !==
      "بازیکن مهمان"
  ) {
    syncProgress();
  }
}


/* =========================================================
   QUIZ STATS
   ========================================================= */

function updateQuizStats() {
  const element =
    $("#quizStats");

  if (!element) return;

  const completed =
    state[
      currentCategory ===
      "general"
        ? "completedGeneralStages"
        : "completedFunStages"
    ];

  const count =
    Array.isArray(
      completed
    )
      ? completed.length
      : 0;

  const total =
    quiz.questions?.length
      ? Math.max(
          ...quiz.questions.map(
            q =>
              Number(
                q.stage
              ) || 1
          )
        )
      : 0;

  element.textContent =
    `تکمیل‌شده: ${formatNumber(
      count
    )} از ${formatNumber(
      total
    )}`;
}


/* =========================================================
   PROFILE
   ========================================================= */

function renderProfile() {
  const name =
    $("#dashboardName");

  const xp =
    $("#dashboardXP");

  const hearts =
    $("#dashboardHearts");

  const streak =
    $("#dashboardStreak");

  const general =
    $("#dashboardGeneralStage");

  const fun =
    $("#dashboardFunStage");

  if (name)
    name.textContent =
      getUsername();

  if (xp)
    xp.textContent =
      formatNumber(
        state.xp
      );

  if (hearts)
    hearts.textContent =
      formatNumber(
        state.hearts
      );

  if (streak)
    streak.textContent =
      formatNumber(
        state.streak
      );

  if (general)
    general.textContent =
      formatNumber(
        Math.max(
          0,
          Number(
            state.generalStage || 1
          ) - 1
        )
      );

  if (fun)
    fun.textContent =
      formatNumber(
        Math.max(
          0,
          Number(
            state.funStage || 1
          ) - 1
        )
      );

  const badge =
    $("#dashboardAccessBadge");

  const title =
    $("#dashboardSubscriptionTitle");

  const text =
    $("#dashboardSubscriptionText");

  const sub =
    $("#dashboardSubscription");

  if (
    isSubscriptionActive()
  ) {
    badge?.classList.remove(
      "free"
    );

    badge?.classList.add(
      "premium"
    );

    if (badge)
      badge.textContent =
        "🔓 اشتراک فعال";

    if (sub)
      sub.textContent =
        "اشتراک فعال";

    if (title)
      title.textContent =
        "اشتراک فعال است";

    if (text)
      text.textContent =
        "همه مراحل برای شما باز هستند.";

  } else {
    badge?.classList.add(
      "free"
    );

    badge?.classList.remove(
      "premium"
    );

    if (badge)
      badge.textContent =
        "🔒 فقط ۱ مرحله رایگان";

    if (sub)
      sub.textContent =
        "رایگان — ۱ مرحله";

    if (title)
      title.textContent =
        "حساب رایگان";

    if (text)
      text.textContent =
        "حساب رایگان فقط به مرحله ۱ دسترسی دارد.";
  }
}


/* =========================================================
   LEADERBOARD
   ========================================================= */

function renderLeaderboard() {
  const body =
    $("#leaderBody");

  if (!body) return;

  const users =
    getUsers();

  const entries =
    users.map(
      user => {
        const saved =
          loadState(
            createDefaultState(),
            user.name
          );

        return {
          name:
            user.name,

          xp:
            Number(
              saved.xp || 0
            ),

          stage:
            Math.max(
              Number(
                saved.generalStage || 1
              ) - 1,

              Number(
                saved.funStage || 1
              ) - 1
            )
        };
      }
    );

  /*
   * اگر کاربر فعلی داخل getUsers نبود،
   * فقط یک بار به جدول اضافه می‌شود.
   */
  if (
    isLoggedIn() &&
    !entries.some(
      entry =>
        entry.name ===
        state.username
    )
  ) {
    entries.push({
      name:
        state.username,

      xp:
        Number(
          state.xp || 0
        ),

      stage:
        Math.max(
          Number(
            state.generalStage || 1
          ) - 1,

          Number(
            state.funStage || 1
          ) - 1
        )
    });
  }

  entries.sort(
    (a, b) =>
      b.xp - a.xp
  );

  if (!entries.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4">
          هنوز بازیکنی ثبت نشده است.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML =
    entries
      .slice(0, 50)
      .map(
        (entry, index) => `
          <tr>

            <td>
              ${
                index === 0
                  ? "🥇"
                  : index === 1
                    ? "🥈"
                    : index === 2
                      ? "🥉"
                      : index + 1
              }
            </td>

            <td>
              ${escapeHTML(
                entry.name
              )}
            </td>

            <td>
              ${formatNumber(
                entry.xp
              )}
            </td>

            <td>
              ${formatNumber(
                entry.stage
              )}
            </td>

          </tr>
        `
      )
      .join("");
}


/* =========================================================
   SUBSCRIPTION UI
   ========================================================= */

function renderSubscription() {
  $$(".select-plan")
    .forEach(
      button => {
        const plan =
          PLANS[
            button.dataset.plan
          ];

        if (!plan) return;

        button.textContent =
          plan.premium
            ? "انتخاب Premium"
            : "انتخاب";
      }
    );
}


function selectPlan(
  planId
) {
  if (!requireLogin()) {
    return;
  }

  const plan =
    PLANS[planId];

  if (!plan) return;

  selectedPlan =
    plan;

  discountValue =
    0;

  discountCodeUsed =
    "";

  const panel =
    $("#paymentPanel");

  panel?.classList.remove(
    "hidden"
  );

  const title =
    $("#selectedPlanTitle");

  const amount =
    $("#selectedAmount");

  const final =
    $("#finalPrice");

  if (title)
    title.textContent =
      plan.title;

  if (amount)
    amount.textContent =
      `${formatNumber(
        plan.price
      )} تومان`;

  if (final)
    final.textContent =
      `${formatNumber(
        plan.price
      )} تومان`;
}


/* =========================================================
   PAYMENT
   ========================================================= */

function fileToBase64(
  file
) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload =
        () => {
          const result =
            String(
              reader.result || ""
            );

          const index =
            result.indexOf(",");

          resolve(
            index >= 0
              ? result.slice(
                  index + 1
                )
              : result
          );
        };

      reader.onerror =
        reject;

      reader.readAsDataURL(
        file
      );
    }
  );
}


async function submitPayment() {
  if (!requireLogin()) {
    return;
  }

  if (!selectedPlan) {
    toast(
      "ابتدا یک پلن انتخاب کنید.",
      "warning"
    );

    return;
  }

  const file =
    $("#paymentFile")
      ?.files?.[0];

  if (!file) {
    showMessage(
      $("#paymentMessage"),
      "تصویر فیش پرداخت را انتخاب کنید.",
      "error"
    );

    return;
  }

  if (
    file.size >
    5 * 1024 * 1024
  ) {
    showMessage(
      $("#paymentMessage"),
      "حجم تصویر نباید بیشتر از ۵ مگابایت باشد.",
      "error"
    );

    return;
  }

  try {
    const base64 =
      await fileToBase64(
        file
      );

    const response =
      await postJSON({
        action:
          "payment",

        userId:
          state.userId || "",

        username:
          state.username,

        phone:
          state.phone || "",

        planId:
          selectedPlan.id,

        planTitle:
          selectedPlan.title,

        amount:
          selectedPlan.price,

        originalAmount:
          selectedPlan.price,

        discountAmount:
          discountValue,

        discountCode:
          discountCodeUsed,

        fileName:
          file.name,

        mimeType:
          file.type,

        receiptBase64:
          base64
      });

    if (
      response?.success
    ) {
      showMessage(
        $("#paymentMessage"),
        response.message ||
          "فیش با موفقیت ارسال شد و پس از تأیید اشتراک فعال می‌شود.",
        "success"
      );

      toast(
        "فیش ارسال شد.",
        "success"
      );

      if ($("#paymentFile"))
        $("#paymentFile").value =
          "";

      if ($("#fileName"))
        $("#fileName").textContent =
          "فایلی انتخاب نشده است";

    } else {
      showMessage(
        $("#paymentMessage"),
        response?.message ||
          "ارسال فیش ناموفق بود.",
        "error"
      );
    }

  } catch (error) {
    console.error(
      error
    );

    showMessage(
      $("#paymentMessage"),
      "ارتباط با سرور پرداخت برقرار نشد.",
      "error"
    );
  }
}


/* =========================================================
   CHAT
   ========================================================= */

function renderChat() {
  const box =
    $("#messages");

  if (!box) return;

  const messages =
    state.chatMessages ||
    [];

  if (!messages.length) {
    box.innerHTML = `
      <div class="muted">
        هنوز پیامی وجود ندارد.
      </div>
    `;

    return;
  }

  box.innerHTML =
    messages
      .map(
        message => `
          <div class="chat-message">
            ${escapeHTML(
              message.text
            )}
          </div>
        `
      )
      .join("");
}


async function sendChatMessage() {
  if (!requireLogin()) {
    return;
  }

  const input =
    $("#chatInput");

  const text =
    input?.value.trim();

  if (!text) return;

  if (
    !Array.isArray(
      state.chatMessages
    )
  ) {
    state.chatMessages =
      [];
  }

  state.chatMessages.push({
    id:
      `msg_${Date.now()}`,

    from:
      "user",

    text,

    date:
      new Date().toISOString()
  });

  saveState(
    state,
    state.username
  );

  input.value =
    "";

  renderChat();

  try {
    await postJSON({
      action:
        "supportUserReply",

      userId:
        state.userId || "",

      username:
        state.username,

      text
    });

  } catch (error) {
    console.warn(
      error
    );
  }
}


/* =========================================================
   SUPPORT
   ========================================================= */

async function sendSupport() {
  if (!requireLogin()) {
    return;
  }

  const subject =
    $("#supportSubject")
      ?.value.trim();

  const text =
    $("#supportText")
      ?.value.trim();

  if (!subject || !text) {
    showMessage(
      $("#supportMsg"),
      "موضوع و متن پیام را وارد کنید.",
      "error"
    );

    return;
  }

  try {
    const response =
      await postJSON({
        action:
          "support",

        userId:
          state.userId || "",

        username:
          state.username,

        phone:
          state.phone || "",

        subject,
        text
      });

    if (
      response?.success
    ) {
      showMessage(
        $("#supportMsg"),
        response.message ||
          "درخواست پشتیبانی ارسال شد.",
        "success"
      );

      if ($("#supportSubject"))
        $("#supportSubject").value =
          "";

      if ($("#supportText"))
        $("#supportText").value =
          "";

    } else {
      showMessage(
        $("#supportMsg"),
        response?.message ||
          "ارسال درخواست ناموفق بود.",
        "error"
      );
    }

  } catch {
    showMessage(
      $("#supportMsg"),
      "ارتباط با سرور برقرار نشد.",
      "error"
    );
  }
}


/* =========================================================
   SERVER
   ========================================================= */

async function postJSON(
  payload
) {
  const response =
    await fetch(
      API_URL,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },

        body:
          JSON.stringify(
            payload
          )
      }
    );

  const text =
    await response.text();

  try {
    return JSON.parse(
      text
    );

  } catch {
    throw new Error(
      "پاسخ سرور معتبر نیست."
    );
  }
}


async function syncUser() {
  if (!isLoggedIn()) {
    return;
  }

  try {
    const response =
      await postJSON({
        action:
          "userUpdates",

        userId:
          state.userId || "",

        username:
          state.username,

        phone:
          state.phone || "",

        localXP:
          state.xp,

        localGeneralStage:
          Math.max(
            0,
            Number(
              state.generalStage ||
              1
            ) - 1
          ),

        localFunStage:
          Math.max(
            0,
            Number(
              state.funStage ||
              1
            ) - 1
          )
      });

    if (!response?.success) {
      return;
    }

    if (
      response.subscription
    ) {
      state.subscription =
        response.subscription;
    }

    if (
      Number.isFinite(
        Number(
          response.xp
        )
      )
    ) {
      state.xp =
        Math.max(
          state.xp,
          Number(
            response.xp
          )
        );
    }

    saveState(
      state,
      state.username
    );

    updateUI();

  } catch (error) {
    console.warn(
      "Server sync failed:",
      error
    );
  }
}


async function syncProgress() {
  await syncUser();
}


/* =========================================================
   THEME
   ========================================================= */

function loadTheme() {
  const theme =
    localStorage.getItem(
      "quizduo_theme"
    );

  if (
    theme === "dark"
  ) {
    document.body.classList.add(
      "dark"
    );
  }
}


function toggleTheme() {
  document.body.classList.toggle(
    "dark"
  );

  localStorage.setItem(
    "quizduo_theme",
    document.body.classList.contains(
      "dark"
    )
      ? "dark"
      : "light"
  );
}


/* =========================================================
   UI
   ========================================================= */

function updateUI() {
  const auth =
    $("#authButton");

  if (auth) {
    auth.textContent =
      isLoggedIn()
        ? `👤 ${state.username}`
        : "ورود / ثبت‌نام";
  }

  renderProfile();

  updateQuizStats();
}


/* =========================================================
   EVENTS
   ========================================================= */

function setupNavigation() {
  document.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-page]"
        );

      if (!button) return;

      event.preventDefault();

      const page =
        button.dataset.page;

      if (
        page === "profile" &&
        !isLoggedIn()
      ) {
        openAuth(
          "login"
        );

        return;
      }

      navigate(
        page
      );
    }
  );
}


function setupAuth() {
  $("#authButton")
    ?.addEventListener(
      "click",
      () => {
        if (
          isLoggedIn()
        ) {
          navigate(
            "profile"
          );
        } else {
          openAuth(
            "login"
          );
        }
      }
    );

  $("#authSubmit")
    ?.addEventListener(
      "click",
      handleAuthSubmit
    );

  $("#toggleAuth")
    ?.addEventListener(
      "click",
      () =>
        openAuth(
          authMode === "login"
            ? "register"
            : "login"
        )
    );

  $("#authBack")
    ?.addEventListener(
      "click",
      () =>
        navigate(
          "home"
        )
    );

  $("#authPassword")
    ?.addEventListener(
      "keydown",
      event => {
        if (
          event.key ===
          "Enter"
        ) {
          handleAuthSubmit();
        }
      }
    );
}


function setupQuiz() {
  $$(
    "[data-category-tab]"
  ).forEach(
    button => {
      button.addEventListener(
        "click",
        () =>
          setCategory(
            button.dataset
              .categoryTab
          )
      );
    }
  );
}


function setupSubscription() {
  $$(".select-plan")
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () =>
            selectPlan(
              button.dataset.plan
            )
        );
      }
    );

  $("#closePayment")
    ?.addEventListener(
      "click",
      () =>
        $("#paymentPanel")
          ?.classList.add(
            "hidden"
          )
    );

  $("#submitPayment")
    ?.addEventListener(
      "click",
      submitPayment
    );

  $("#paymentFile")
    ?.addEventListener(
      "change",
      event => {
        const file =
          event.target.files?.[0];

        const label =
          $("#fileName");

        if (label) {
          label.textContent =
            file
              ? file.name
              : "فایلی انتخاب نشده است";
        }
      }
    );
}


function setupChat() {
  $("#sendChat")
    ?.addEventListener(
      "click",
      sendChatMessage
    );

  $("#chatInput")
    ?.addEventListener(
      "keydown",
      event => {
        if (
          event.key ===
            "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();

          sendChatMessage();
        }
      }
    );
}


function setupSupport() {
  $("#supportSend")
    ?.addEventListener(
      "click",
      sendSupport
    );
}


function setupTheme() {
  $("#themeToggle")
    ?.addEventListener(
      "click",
      toggleTheme
    );
}


/* =========================================================
   INIT
   ========================================================= */

async function init() {
  try {
    loadTheme();

    setupNavigation();
    setupAuth();
    setupQuiz();
    setupSubscription();
    setupChat();
    setupSupport();
    setupTheme();

    updateStreak(
      state
    );

    saveState(
      state,
      state.username ||
        "guest"
    );

    updateUI();

    /*
     * برای اینکه صفحه آزمون بلافاصله
     * سؤال‌های عمومی را داشته باشد.
     */
    await loadCategory(
      "general"
    );

    if (
      isLoggedIn()
    ) {
      await syncUser();
    }

    navigate(
      "home"
    );

  } catch (error) {
    console.error(
      "QuizDuo initialization error:",
      error
    );

    toast(
      "خطا در راه‌اندازی QuizDuo.",
      "error"
    );
  }
}


/* =========================================================
   PUBLIC API
   ========================================================= */

window.QuizDuo = {
  state,

  navigate,

  /*
   * برای سازگاری با onclickهای index.html
   */
  showPage,

  logout,

  openAuth,

  selectPlan,

  startStage,

  syncUser,

  isSubscriptionActive,

  hasFullAccess,

  canAccessStage,

  toast
};


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);
