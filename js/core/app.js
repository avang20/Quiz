/* =========================================================
   QuizDuo - Core Application
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbwQNOpTNYI6jD2obOFkK02eEjSZd2OzkPiwvBgN_xnDgsZ90B3a_FCmXIvzVyuxzJiZQ/exec";
/* =========================================================
   GLOBAL STATE
========================================================= */

const STORAGE_KEY = "quizduo_state_v2";
const USERS_KEY = "quizduo_users_v2";
const THEME_KEY = "quizduo_theme";

let quizData = {
  general: [],
  fun: []
};

let state = loadState();

let currentCategory = "general";
let currentStage = null;
let currentQuestionIndex = 0;
let currentQuizScore = 0;
let currentQuizXP = 0;
let selectedPlan = null;
let discountValue = 0;
let discountCodeUsed = "";

let authMode = "login";


/* =========================================================
   PLAN CONFIG
========================================================= */

const PLANS = {
  monthly: {
    id: "monthly",
    title: "اشتراک ماهانه",
    durationMonths: 1,
    price: 100000,
    premium: false
  },

  quarterly: {
    id: "quarterly",
    title: "اشتراک سه‌ماهه",
    durationMonths: 3,
    price: 270000,
    premium: false
  },

  sixMonth: {
    id: "sixMonth",
    title: "اشتراک شش‌ماهه",
    durationMonths: 7,
    price: 480000,
    premium: false,
    giftMonths: 1
  },

  nineMonth: {
    id: "nineMonth",
    title: "اشتراک نه‌ماهه Premium",
    durationMonths: 11,
    price: 660000,
    premium: true,
    giftMonths: 2
  }
};


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (selector, parent = document) =>
  parent.querySelector(selector);

const $$ = (selector, parent = document) =>
  [...parent.querySelectorAll(selector)];


function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatNumber(value) {
  return Number(value || 0).toLocaleString("fa-IR");
}


function showMessage(element, text, type = "") {
  if (!element) return;

  element.textContent = text;
  element.className = `message ${type}`.trim();
}


function toast(message, type = "") {
  let container = $(".toast-container");

  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const item = document.createElement("div");
  item.className = `toast ${type}`.trim();
  item.textContent = message;

  container.appendChild(item);

  setTimeout(() => {
    item.remove();
  }, 3500);
}


/* =========================================================
   DEFAULT STATE
========================================================= */

function defaultState() {
  return {
    user: null,

    xp: 0,
    hearts: 5,
    streak: 0,

    progress: {
      general: 0,
      fun: 0
    },

    completedStages: {
      general: [],
      fun: []
    },

    subscription: {
      active: false,
      planId: "",
      title: "",
      startDate: "",
      expiryDate: "",
      premium: false,
      status: "free"
    },

    notifications: [],

    supportTickets: [],

    chatMessages: [],

    lastSync: 0
  };
}


function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultState();
    }

    const saved = JSON.parse(raw);

    return deepMerge(defaultState(), saved);
  } catch (error) {
    console.warn("Could not load QuizDuo state:", error);
    return defaultState();
  }
}


function deepMerge(base, extra) {
  if (!extra || typeof extra !== "object") {
    return base;
  }

  const output = Array.isArray(base)
    ? [...base]
    : { ...base };

  Object.keys(extra).forEach((key) => {

    if (
      extra[key] &&
      typeof extra[key] === "object" &&
      !Array.isArray(extra[key]) &&
      base[key] &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key])
    ) {
      output[key] = deepMerge(base[key], extra[key]);
    } else {
      output[key] = extra[key];
    }

  });

  return output;
}


function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state)
  );
}


/* =========================================================
   USER STORAGE
========================================================= */

function loadLocalUsers() {
  try {
    return JSON.parse(
      localStorage.getItem(USERS_KEY) || "[]"
    );
  } catch {
    return [];
  }
}


function saveLocalUsers(users) {
  localStorage.setItem(
    USERS_KEY,
    JSON.stringify(users)
  );
}


/* =========================================================
   AUTH
========================================================= */

function isLoggedIn() {
  return Boolean(state.user);
}


function requireLogin() {
  if (isLoggedIn()) {
    return true;
  }

  toast(
    "برای ادامه ابتدا وارد حساب کاربری شوید.",
    "warning"
  );

  navigate("auth");
  return false;
}


function openAuth(mode = "login") {

  authMode = mode;

  const title = $("#authTitle");
  const submit = $("#authSubmit");
  const toggle = $("#toggleAuth");
  const phoneField = $("#phoneField");

  if (mode === "register") {

    if (title) {
      title.textContent = "ساخت حساب";
    }

    if (submit) {
      submit.textContent = "ثبت‌نام";
    }

    if (toggle) {
      toggle.textContent = "قبلاً حساب دارم";
    }

    phoneField?.classList.remove("hidden");

  } else {

    if (title) {
      title.textContent = "ورود";
    }

    if (submit) {
      submit.textContent = "ورود";
    }

    if (toggle) {
      toggle.textContent = "ساخت حساب جدید";
    }

    phoneField?.classList.add("hidden");
  }

  navigate("auth");
}


function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


function localRegister(name, phone, password) {

  const username = normalizeUsername(name);

  if (!username || !password) {
    throw new Error(
      "نام کاربری و رمز عبور الزامی است."
    );
  }

  const users = loadLocalUsers();

  const exists = users.some(
    (u) => normalizeUsername(u.name) === username
  );

  if (exists) {
    throw new Error(
      "این نام کاربری قبلاً ثبت شده است."
    );
  }

  const user = {
    id:
      "local_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 8),

    name: name.trim(),
    phone: String(phone || "").trim(),
    password,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  saveLocalUsers(users);

  return user;
}


function localLogin(name, password) {

  const username = normalizeUsername(name);

  const users = loadLocalUsers();

  return users.find(
    (u) =>
      normalizeUsername(u.name) === username &&
      u.password === password
  );
}


async function handleAuthSubmit() {

  const name = $("#authName")?.value.trim();
  const phone = $("#authPhone")?.value.trim();
  const password = $("#authPassword")?.value;

  const message = $("#authMsg");

  if (!name || !password) {
    showMessage(
      message,
      "نام کاربری و رمز عبور را وارد کنید.",
      "error"
    );
    return;
  }


  try {

    if (authMode === "register") {

      if (!phone) {
        showMessage(
          message,
          "شماره تماس را وارد کنید.",
          "error"
        );
        return;
      }

      const user = localRegister(
        name,
        phone,
        password
      );

      state.user = {
        id: user.id,
        name: user.name,
        phone: user.phone
      };

      saveState();

      showMessage(
        message,
        "حساب با موفقیت ساخته شد.",
        "success"
      );

      await syncUser();

      updateUI();

      setTimeout(() => {
        navigate("profile");
      }, 400);

    } else {

      const user = localLogin(
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

      state.user = {
        id: user.id,
        name: user.name,
        phone: user.phone
      };

      saveState();

      showMessage(
        message,
        "ورود موفق بود.",
        "success"
      );

      await syncUser();

      updateUI();

      setTimeout(() => {
        navigate("profile");
      }, 400);
    }

  } catch (error) {

    showMessage(
      message,
      error.message || "خطایی رخ داد.",
      "error"
    );
  }
}


function logout() {

  state.user = null;

  state.subscription = defaultState().subscription;

  saveState();

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

function navigate(pageId) {

  const page = document.getElementById(pageId);

  if (!page) {
    return;
  }

  $$(".page").forEach((section) => {
    section.classList.remove("active");
  });

  page.classList.add("active");

  $$(".main-nav button").forEach((button) => {

    button.classList.toggle(
      "active",
      button.dataset.page === pageId
    );

  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  if (pageId === "quiz") {
    renderStages();
  }

  if (pageId === "leaderboard") {
    renderLeaderboard();
  }

  if (pageId === "profile") {
    renderDashboard();
  }

  if (pageId === "subscription") {
    renderSubscription();
  }

  if (pageId === "chat") {
    renderChat();
  }
}


/* =========================================================
   SUBSCRIPTION
========================================================= */

function isSubscriptionActive() {

  const subscription = state.subscription;

  if (!subscription?.active) {
    return false;
  }

  if (!subscription.expiryDate) {
    return false;
  }

  const expiry = new Date(
    subscription.expiryDate
  );

  if (
    Number.isNaN(expiry.getTime()) ||
    expiry <= new Date()
  ) {

    state.subscription.active = false;
    state.subscription.status = "expired";

    saveState();

    return false;
  }

  return true;
}


function hasFullAccess() {
  return isSubscriptionActive();
}


function canAccessStage(stageNumber) {

  /*
   * EXACT FREE ACCESS RULE:
   *
   * Stage 1 = free
   * Stage 2+ = approved active subscription required
   */

  if (Number(stageNumber) === 1) {
    return true;
  }

  return hasFullAccess();
}


function subscriptionLabel() {

  if (!isSubscriptionActive()) {
    return "رایگان";
  }

  if (state.subscription.premium) {
    return "Premium 👑";
  }

  return state.subscription.title || "فعال";
}


function calculateExpiry(startDate, months) {

  const date = new Date(startDate);

  date.setMonth(
    date.getMonth() + Number(months || 0)
  );

  return date;
}


function activateSubscriptionFromServer(subscription) {

  if (!subscription) {
    return;
  }

  const active =
    subscription.active === true ||
    subscription.status === "active" ||
    subscription.status === "approved";

  state.subscription = {
    active,
    planId: subscription.planId || "",
    title: subscription.title || "",
    startDate: subscription.startDate || "",
    expiryDate: subscription.expiryDate || "",
    premium:
      subscription.premium === true ||
      subscription.planId === "nineMonth",
    status:
      subscription.status ||
      (active ? "active" : "free")
  };

  saveState();
}


function renderSubscription() {

  $$(".select-plan").forEach((button) => {

    const planId = button.dataset.plan;
    const plan = PLANS[planId];

    if (!plan) return;

    button.textContent =
      plan.premium
        ? "انتخاب Premium"
        : "انتخاب";

  });

  updatePaymentInfo();
}


/* =========================================================
   PAYMENT
========================================================= */

function selectPlan(planId) {

  if (!PLANS[planId]) {
    return;
  }

  if (!requireLogin()) {
    return;
  }

  selectedPlan = PLANS[planId];
  discountValue = 0;
  discountCodeUsed = "";

  const discountInput = $("#discountCode");

  if (discountInput) {
    discountInput.value = "";
  }

  showPaymentPanel();

  updatePaymentInfo();
}


function showPaymentPanel() {

  const panel = $("#paymentPanel");

  if (!panel) return;

  panel.classList.remove("hidden");

  panel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function closePaymentPanel() {

  $("#paymentPanel")?.classList.add("hidden");

  selectedPlan = null;
  discountValue = 0;
  discountCodeUsed = "";

  const discountMessage =
    $("#discountMessage");

  if (discountMessage) {
    showMessage(
      discountMessage,
      ""
    );
  }
}


function updatePaymentInfo() {

  if (!selectedPlan) {
    return;
  }

  const selectedTitle =
    $("#selectedPlanTitle");

  const selectedAmount =
    $("#selectedAmount");

  const finalPrice =
    $("#finalPrice");

  const account =
    $("#accountNumber");

  if (selectedTitle) {
    selectedTitle.textContent =
      selectedPlan.title;
  }

  if (selectedAmount) {
    selectedAmount.textContent =
      `${formatNumber(selectedPlan.price)} تومان`;
  }

  if (finalPrice) {
    const amount =
      Math.max(
        0,
        selectedPlan.price - discountValue
      );

    finalPrice.textContent =
      `${formatNumber(amount)} تومان`;
  }

  /*
   * The actual bank/account value should come
   * from Code.gs/general.json if configured.
   * This placeholder is intentionally visible
   * until the server provides the configured value.
   */

  if (account) {
    account.textContent =
      window.QUIZDUO_CONFIG?.accountNumber ||
      "اطلاعات حساب در بخش پرداخت";
  }
}


async function applyDiscountCode() {

  if (!selectedPlan) {
    return;
  }

  const input = $("#discountCode");
  const message = $("#discountMessage");

  const code =
    input?.value.trim();

  if (!code) {

    showMessage(
      message,
      "کد تخفیف را وارد کنید.",
      "warning"
    );

    return;
  }


  try {

    const response =
      await postJSON({
        action: "discount",
        code,
        planId: selectedPlan.id,
        username: state.user?.name || "",
        userId: state.user?.id || ""
      });


    if (response?.success) {

      discountValue =
        Number(response.discountAmount || 0);

      discountCodeUsed = code;

      showMessage(
        message,
        response.message ||
          "کد تخفیف اعمال شد.",
        "success"
      );

      updatePaymentInfo();

      return;
    }


    /*
     * Local fallback for common test codes.
     * Server-side validation remains authoritative.
     */

    const localCodes = {
      QUIZ10: 10,
      DUO10: 10
    };

    const percent =
      localCodes[code.toUpperCase()];

    if (percent) {

      discountValue =
        Math.round(
          selectedPlan.price * percent / 100
        );

      discountCodeUsed =
        code.toUpperCase();

      showMessage(
        message,
        `${percent}٪ تخفیف اعمال شد.`,
        "success"
      );

      updatePaymentInfo();

    } else {

      discountValue = 0;
      discountCodeUsed = "";

      showMessage(
        message,
        response?.message ||
          "کد تخفیف معتبر نیست.",
        "error"
      );

      updatePaymentInfo();
    }

  } catch (error) {

    showMessage(
      message,
      "امکان بررسی کد تخفیف وجود ندارد.",
      "error"
    );
  }
}


function fileToBase64(file) {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = () => {

      const result =
        String(reader.result || "");

      const comma =
        result.indexOf(",");

      resolve(
        comma >= 0
          ? result.slice(comma + 1)
          : result
      );
    };

    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
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
    $("#paymentFile")?.files?.[0];

  const message =
    $("#paymentMessage");

  if (!file) {

    showMessage(
      message,
      "تصویر فیش پرداخت را انتخاب کنید.",
      "error"
    );

    return;
  }


  const maxBytes =
    5 * 1024 * 1024;

  if (file.size > maxBytes) {

    showMessage(
      message,
      "حجم تصویر نباید بیشتر از ۵ مگابایت باشد.",
      "error"
    );

    return;
  }


  if (!file.type.startsWith("image/")) {

    showMessage(
      message,
      "لطفاً یک فایل تصویری انتخاب کنید.",
      "error"
    );

    return;
  }


  const submitButton =
    $("#submitPayment");

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent =
      "در حال ارسال...";
  }


  try {

    const base64 =
      await fileToBase64(file);

    const finalAmount =
      Math.max(
        0,
        selectedPlan.price - discountValue
      );


    const response =
      await postJSON({
        action: "payment",

        userId:
          state.user?.id || "",

        username:
          state.user?.name || "",

        phone:
          state.user?.phone || "",

        planId:
          selectedPlan.id,

        planTitle:
          selectedPlan.title,

        amount:
          finalAmount,

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


    if (response?.success) {

      showMessage(
        message,
        response.message ||
          "فیش با موفقیت ارسال شد و پس از تأیید، اشتراک فعال می‌شود.",
        "success"
      );

      toast(
        "فیش برای بررسی ارسال شد.",
        "success"
      );

      $("#paymentFile").value = "";
      $("#fileName").textContent =
        "فایلی انتخاب نشده است";

      return;
    }


    showMessage(
      message,
      response?.message ||
        "ارسال فیش ناموفق بود.",
      "error"
    );

  } catch (error) {

    console.error(error);

    showMessage(
      message,
      "ارتباط با سرور پرداخت برقرار نشد.",
      "error"
    );

  } finally {

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent =
        "ارسال فیش برای بررسی";
    }
  }
}


/* =========================================================
   QUIZ DATA
========================================================= */

async function loadQuizData() {

  try {

    const [generalResponse, funResponse] =
      await Promise.all([
        fetch("../../data/general.json", {
          cache: "no-store"
        }),

        fetch("../../data/fun.json", {
          cache: "no-store"
        })
      ]);


    if (!generalResponse.ok) {
      throw new Error(
        `Could not load ../../data/general.json (${generalResponse.status})`
      );
    }


    if (!funResponse.ok) {
      throw new Error(
        `Could not load ../../data/fun.json (${funResponse.status})`
      );
    }


    const [generalData, funData] =
      await Promise.all([
        generalResponse.json(),
        funResponse.json()
      ]);


    quizData.general =
      normalizeQuizData(
        Array.isArray(generalData)
          ? generalData
          : generalData.questions ||
            generalData.items ||
            []
      );


    quizData.fun =
      normalizeQuizData(
        Array.isArray(funData)
          ? funData
          : funData.questions ||
            funData.items ||
            []
      );


    console.log(
      "QuizDuo quiz data loaded:",
      {
        general:
          quizData.general.length,

        fun:
          quizData.fun.length
      }
    );


  } catch (error) {

    console.error(
      "Could not load quiz data:",
      error
    );


    quizData = {
      general: [],
      fun: []
    };


    toast(
      "فایل سوالات پیدا نشد. مسیر data/general.json و data/fun.json را بررسی کنید.",
      "error"
    );
  }
}


function normalizeQuizData(data) {

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((question, index) => {

    const options =
      Array.isArray(question.options)
        ? question.options
        : [];

    let correctIndex =
      Number.isInteger(question.correctIndex)
        ? question.correctIndex
        : -1;

    if (
      correctIndex < 0 &&
      question.answer !== undefined
    ) {
      correctIndex =
        options.findIndex(
          (option) =>
            String(option).trim() ===
            String(question.answer).trim()
        );
    }

    return {
      id:
        question.id ||
        `${index + 1}`,

      question:
        question.question ||
        question.text ||
        "",

      options,

      correctIndex,

      explanation:
        question.explanation || "",

      category:
        question.category || currentCategory
    };
  });
}


function getStageQuestions(category, stage) {

  const all =
    quizData[category] || [];

  /*
   * 15 questions per stage for stages 1–7.
   * Stage 8 contains 18 questions.
   */

  if (stage <= 0) {
    return [];
  }

  const start =
    stage <= 7
      ? (stage - 1) * 15
      : 7 * 15;

  const count =
    stage === 8
      ? 18
      : 15;

  return all.slice(
    start,
    start + count
  );
}


function getStageCount(category) {
  const questions = quizData[category] || [];

  if (!questions.length) {
    return 0;
  }

  return Math.min(
    8,
    Math.ceil(questions.length / 15)
  );
}


/* =========================================================
   STAGE ACCESS
========================================================= */

function renderStages() {

  const container = $("#stages");

  if (!container) {
    return;
  }

  const totalStages =
    Math.max(
      8,
      getStageCount(currentCategory)
    );


  container.innerHTML = "";


  for (
    let stage = 1;
    stage <= totalStages;
    stage++
  ) {

    const questions =
      getStageQuestions(
        currentCategory,
        stage
      );

    const completed =
      state.completedStages[
        currentCategory
      ]?.includes(stage);


    const unlocked =
      canAccessStage(stage);

    const card =
      document.createElement("article");

    card.className =
      "stage-card" +
      (completed ? " completed" : "") +
      (!unlocked ? " locked" : "");


    const lock =
      unlocked
        ? completed
          ? "✅"
          : "▶️"
        : "🔒";


    card.innerHTML = `
      <span class="stage-lock">${lock}</span>

      <div>
        <div class="stage-number">
          ${stage}
        </div>

        <h3>
          مرحله ${stage}
        </h3>

        <p>
          ${
            questions.length
              ? `${questions.length} سؤال`
              : "در حال آماده‌سازی"
          }
        </p>
      </div>

      <button
        class="${unlocked ? "primary" : "secondary"}"
        data-stage="${stage}"
        ${questions.length ? "" : "disabled"}
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

    if (button) {

      button.addEventListener(
        "click",
        () => {

          if (!canAccessStage(stage)) {

            toast(
              "برای دسترسی به مرحله ۲ به بعد، اشتراک تأییدشده لازم است.",
              "warning"
            );

            navigate("subscription");

            return;
          }

          startStage(
            currentCategory,
            stage
          );
        }
      );
    }


    container.appendChild(card);
  }


  updateQuizStats();
}


function updateQuizStats() {

  const element =
    $("#quizStats");

  if (!element) return;

  const progress =
    state.progress[currentCategory] || 0;

  const total =
    getStageCount(currentCategory);

  element.textContent =
    `مرحله ${formatNumber(progress)} از ${formatNumber(total)}`;
}


/* =========================================================
   START QUIZ
========================================================= */

function startStage(category, stage) {

  if (!canAccessStage(stage)) {

    toast(
      "این مرحله قفل است.",
      "warning"
    );

    return;
  }


  const questions =
    getStageQuestions(
      category,
      stage
    );


  if (!questions.length) {

    toast(
      "برای این مرحله سوالی وجود ندارد.",
      "error"
    );

    return;
  }


  currentCategory = category;
  currentStage = stage;
  currentQuestionIndex = 0;
  currentQuizScore = 0;
  currentQuizXP = 0;


  const quizBox =
    $("#quizBox");

  if (!quizBox) return;

  quizBox.classList.remove("hidden");

  renderCurrentQuestion();

  quizBox.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function renderCurrentQuestion() {

  const quizBox =
    $("#quizBox");

  if (!quizBox) return;


  const questions =
    getStageQuestions(
      currentCategory,
      currentStage
    );

  const question =
    questions[currentQuestionIndex];


  if (!question) {
    finishStage();
    return;
  }


  const progress =
    Math.round(
      (
        currentQuestionIndex /
        questions.length
      ) * 100
    );


  quizBox.innerHTML = `

    <div class="quiz-question">

      <div class="section-heading">

        <div>

          <span class="eyebrow">
            مرحله ${currentStage}
          </span>

          <h3>
            سؤال
            ${currentQuestionIndex + 1}
            از
            ${questions.length}
          </h3>

        </div>

        <span class="quiz-score">
          امتیاز:
          ${formatNumber(currentQuizScore)}
        </span>

      </div>


      <div class="quiz-progress">
        <div
          style="width:${progress}%"
        ></div>
      </div>


      <h3>
        ${escapeHTML(question.question)}
      </h3>


      <div class="quiz-options">

        ${question.options
          .map(
            (option, index) => `
              <button
                class="quiz-option"
                data-option-index="${index}"
              >
                ${escapeHTML(option)}
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
          ${formatNumber(state.hearts)}
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


  $$(".quiz-option", quizBox)
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          answerQuestion(
            Number(
              button.dataset.optionIndex
            )
          );
        }
      );

    });


  $("#exitQuiz")?.addEventListener(
    "click",
    () => {
      quizBox.classList.add("hidden");
    }
  );
}


/* =========================================================
   ANSWER
========================================================= */

function answerQuestion(selectedIndex) {

  const questions =
    getStageQuestions(
      currentCategory,
      currentStage
    );

  const question =
    questions[currentQuestionIndex];


  if (!question) {
    return;
  }


  const buttons =
    $$(".quiz-option");


  buttons.forEach((button) => {
    button.disabled = true;
  });


  const isCorrect =
    selectedIndex === question.correctIndex;


  const feedback =
    $("#answerFeedback");


  if (isCorrect) {

    currentQuizScore += 10;
    currentQuizXP += 10;

    state.xp += 10;

    state.hearts =
      Math.min(
        10,
        Number(state.hearts || 0) + 1
      );

    showMessage(
      feedback,
      "✅ پاسخ درست بود!",
      "success"
    );

    buttons[selectedIndex]
      ?.classList.add("correct");

  } else {

    state.hearts =
      Math.max(
        0,
        Number(state.hearts || 0) - 1
      );

    showMessage(
      feedback,
      `❌ پاسخ نادرست بود. پاسخ درست: ${
        question.options[
          question.correctIndex
        ] || "نامشخص"
      }`,
      "error"
    );

    buttons[selectedIndex]
      ?.classList.add("wrong");

    buttons[question.correctIndex]
      ?.classList.add("correct");
  }


  saveState();
  updateUI();


  if (question.explanation) {

    const explanation =
      document.createElement("p");

    explanation.className = "muted";

    explanation.textContent =
      question.explanation;

    feedback?.appendChild(
      explanation
    );
  }


  setTimeout(() => {

    currentQuestionIndex++;

    if (
      currentQuestionIndex >=
      questions.length
    ) {
      finishStage();
    } else {
      renderCurrentQuestion();
    }

  }, 1000);
}


/* =========================================================
   FINISH STAGE
========================================================= */

function finishStage() {

  const category =
    currentCategory;

  const stage =
    currentStage;


  if (
    !state.completedStages[category]
  ) {
    state.completedStages[category] = [];
  }


  if (
    !state.completedStages[category]
      .includes(stage)
  ) {

    state.completedStages[category]
      .push(stage);
  }


  state.progress[category] =
    Math.max(
      Number(state.progress[category] || 0),
      stage
    );


  state.xp += currentQuizScore;


  saveState();


  const quizBox =
    $("#quizBox");


  if (quizBox) {

    quizBox.innerHTML = `

      <div class="access-denied">

        <span class="lock">
          🎉
        </span>

        <h3>
          مرحله ${stage} تمام شد!
        </h3>

        <p>
          امتیاز این مرحله:
          <b>
            ${formatNumber(currentQuizScore)}
          </b>
        </p>

        <p>
          XP دریافت‌شده:
          <b>
            ${formatNumber(currentQuizXP)}
          </b>
        </p>

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
          quizBox.classList.add("hidden");
          renderStages();
        }
      );
  }


  updateUI();

  syncProgress();
}


/* =========================================================
   CATEGORY
========================================================= */

function setCategory(category) {

  if (
    category !== "general" &&
    category !== "fun"
  ) {
    return;
  }

  currentCategory = category;

  $$(".tabs button")
    .forEach((button) => {

      button.classList.toggle(
        "active",
        button.dataset.categoryTab ===
          category
      );

    });

  renderStages();
}


/* =========================================================
   DASHBOARD
========================================================= */

function renderDashboard() {

  const user =
    state.user;

  $("#dashboardName").textContent =
    user?.name || "بازیکن مهمان";

  $("#dashboardXP").textContent =
    formatNumber(state.xp);

  $("#dashboardHearts").textContent =
    formatNumber(state.hearts);

  $("#dashboardStreak").textContent =
    formatNumber(state.streak);

  $("#dashboardGeneralStage").textContent =
    formatNumber(
      state.progress.general || 0
    );

  $("#dashboardFunStage").textContent =
    formatNumber(
      state.progress.fun || 0
    );


  const active =
    isSubscriptionActive();


  const badge =
    $("#dashboardAccessBadge");


  const subscriptionText =
    $("#dashboardSubscription");


  const title =
    $("#dashboardSubscriptionTitle");


  const text =
    $("#dashboardSubscriptionText");


  if (active) {

    badge?.classList.remove("free");
    badge?.classList.add("premium");

    if (badge) {
      badge.textContent =
        state.subscription.premium
          ? "👑 Premium فعال"
          : "🔓 اشتراک فعال";
    }

    if (subscriptionText) {
      subscriptionText.textContent =
        subscriptionLabel();
    }

    if (title) {
      title.textContent =
        state.subscription.premium
          ? "Premium فعال است 👑"
          : "اشتراک فعال است";
    }

    if (text) {
      text.textContent =
        `تا ${formatDate(
          state.subscription.expiryDate
        )} همه مراحل برای شما باز هستند.`;
    }

  } else {

    badge?.classList.add("free");
    badge?.classList.remove("premium");

    if (badge) {
      badge.textContent =
        "🔒 فقط ۱ مرحله رایگان";
    }

    if (subscriptionText) {
      subscriptionText.textContent =
        "رایگان — ۱ مرحله";
    }

    if (title) {
      title.textContent =
        "حساب رایگان";
    }

    if (text) {
      text.textContent =
        "حساب رایگان فقط به مرحله ۱ دسترسی دارد؛ با اشتراک تأییدشده، همه مراحل باز می‌شوند.";
    }
  }


  updateNoticeCount();
}


function updateNoticeCount() {

  const unread =
    state.notifications.filter(
      (n) => !n.read
    ).length;

  const element =
    $("#dashboardNoticeCount");

  if (!element) {
    return;
  }

  element.textContent =
    unread
      ? `${formatNumber(unread)} پیام جدید`
      : "بدون پاسخ جدید";
}


/* =========================================================
   LEADERBOARD
========================================================= */

function renderLeaderboard() {

  const body =
    $("#leaderBody");

  if (!body) {
    return;
  }


  const users =
    loadLocalUsers();


  const current =
    state.user
      ? [{
          id: state.user.id,
          name: state.user.name,
          xp: state.xp,
          stage:
            Math.max(
              state.progress.general || 0,
              state.progress.fun || 0
            )
        }]
      : [];


  const entries = [
    ...users.map((user) => ({
      id: user.id,
      name: user.name,
      xp: Number(user.xp || 0),
      stage: Number(user.stage || 0)
    })),
    ...current
  ];


  const unique =
    new Map();

  entries.forEach((entry) => {
    unique.set(entry.id, entry);
  });


  const sorted =
    [...unique.values()]
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 50);


  if (!sorted.length) {

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
    sorted
      .map((entry, index) => {

        const medal =
          index === 0
            ? "🥇"
            : index === 1
              ? "🥈"
              : index === 2
                ? "🥉"
                : index + 1;


        return `
          <tr>
            <td class="rank-medal">
              ${medal}
            </td>

            <td>
              ${escapeHTML(entry.name)}
            </td>

            <td>
              ${formatNumber(entry.xp)}
            </td>

            <td>
              ${formatNumber(entry.stage)}
            </td>
          </tr>
        `;
      })
      .join("");
}


/* =========================================================
   CHAT
========================================================= */

function renderChat() {

  const container =
    $("#messages");

  if (!container) {
    return;
  }


  const messages =
    state.chatMessages || [];


  if (!messages.length) {

    container.innerHTML = `
      <div class="muted">
        هنوز پیامی وجود ندارد.
      </div>
    `;

    return;
  }


  container.innerHTML =
    messages
      .map((message) => {

        const mine =
          message.from === "user";


        return `
          <div
            class="chat-message ${
              mine ? "mine" : ""
            }"
          >
            ${escapeHTML(message.text)}

            <span class="meta">
              ${formatDateTime(
                message.date
              )}
            </span>
          </div>
        `;
      })
      .join("");


  container.scrollTop =
    container.scrollHeight;
}


async function sendChatMessage() {

  if (!requireLogin()) {
    return;
  }


  const input =
    $("#chatInput");

  const text =
    input?.value.trim();


  if (!text) {
    return;
  }


  const message = {
    id:
      "msg_" +
      Date.now(),

    from: "user",

    text,

    date:
      new Date().toISOString()
  };


  state.chatMessages.push(
    message
  );

  saveState();

  input.value = "";

  renderChat();


  try {

    await postJSON({
      action: "supportUserReply",

      userId:
        state.user.id,

      username:
        state.user.name,

      text
    });

  } catch (error) {

    console.warn(
      "Chat sync failed:",
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

  const message =
    $("#supportMsg");


  if (!subject || !text) {

    showMessage(
      message,
      "موضوع و متن پیام را وارد کنید.",
      "error"
    );

    return;
  }


  try {

    const response =
      await postJSON({
        action: "support",

        userId:
          state.user.id,

        username:
          state.user.name,

        phone:
          state.user.phone || "",

        subject,
        text
      });


    if (response?.success) {

      state.supportTickets.push({
        id:
          response.ticketId ||
          `ticket_${Date.now()}`,

        subject,
        text,

        status: "open",

        date:
          new Date().toISOString()
      });

      saveState();


      showMessage(
        message,
        response.message ||
          "درخواست پشتیبانی ارسال شد.",
        "success"
      );


      $("#supportSubject").value = "";
      $("#supportText").value = "";


      return;
    }


    showMessage(
      message,
      response?.message ||
        "ارسال درخواست ناموفق بود.",
      "error"
    );

  } catch (error) {

    showMessage(
      message,
      "ارتباط با سرور پشتیبانی برقرار نشد.",
      "error"
    );
  }
}


/* =========================================================
   SERVER SYNC
========================================================= */

async function postJSON(payload) {

  const response =
    await fetch(
      API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "text/plain;charset=utf-8"
        },

        body:
          JSON.stringify(payload)
      }
    );


  const text =
    await response.text();


  let data;


  try {
    data = JSON.parse(text);
  } catch {

    throw new Error(
      "پاسخ سرور JSON معتبر نیست."
    );
  }


  return data;
}


async function syncUser() {

  if (!state.user) {
    return null;
  }


  try {

    const data =
      await postJSON({
        action: "userUpdates",

        userId:
          state.user.id,

        username:
          state.user.name,

        phone:
          state.user.phone || "",

        localXP:
          state.xp,

        localGeneralStage:
          state.progress.general,

        localFunStage:
          state.progress.fun
      });


    if (!data?.success) {
      return data;
    }


    /*
     * Server is authoritative for subscription.
     * This is important because payment approval
     * happens in Admin.html / Code.gs.
     */

    if (data.subscription) {

      activateSubscriptionFromServer(
        data.subscription
      );
    }


    if (Array.isArray(data.notifications)) {

      state.notifications =
        data.notifications;
    }


    if (Array.isArray(data.supportTickets)) {

      state.supportTickets =
        data.supportTickets;
    }


    if (
      Number.isFinite(
        Number(data.xp)
      )
    ) {
      state.xp =
        Math.max(
          state.xp,
          Number(data.xp)
        );
    }


    if (data.progress) {

      state.progress.general =
        Math.max(
          Number(
            state.progress.general || 0
          ),
          Number(
            data.progress.general || 0
          )
        );

      state.progress.fun =
        Math.max(
          Number(
            state.progress.fun || 0
          ),
          Number(
            data.progress.fun || 0
          )
        );
    }


    state.lastSync =
      Date.now();

    saveState();

    updateUI();

    return data;

  } catch (error) {

    console.warn(
      "QuizDuo server sync failed:",
      error
    );

    return null;
  }
}


async function syncProgress() {

  if (!state.user) {
    return;
  }


  try {

    await postJSON({
      action: "userUpdates",

      userId:
        state.user.id,

      username:
        state.user.name,

      phone:
        state.user.phone || "",

      localXP:
        state.xp,

      localGeneralStage:
        state.progress.general,

      localFunStage:
        state.progress.fun
    });

  } catch (error) {

    console.warn(
      "Progress sync failed:",
      error
    );
  }
}


/* =========================================================
   DATE HELPERS
========================================================= */

function formatDate(value) {

  if (!value) {
    return "نامشخص";
  }


  const date =
    new Date(value);


  if (Number.isNaN(date.getTime())) {
    return "نامشخص";
  }


  return date.toLocaleDateString(
    "fa-IR",
    {
      year: "numeric",
      month: "long",
      day: "numeric"
    }
  );
}


function formatDateTime(value) {

  if (!value) {
    return "";
  }


  const date =
    new Date(value);


  if (Number.isNaN(date.getTime())) {
    return "";
  }


  return date.toLocaleString(
    "fa-IR",
    {
      dateStyle: "short",
      timeStyle: "short"
    }
  );
}


/* =========================================================
   THEME
========================================================= */

function loadTheme() {

  const theme =
    localStorage.getItem(
      THEME_KEY
    );


  if (theme === "dark") {
    document.body.classList.add("dark");
  }
}


function toggleTheme() {

  document.body.classList.toggle("dark");


  localStorage.setItem(
    THEME_KEY,

    document.body.classList.contains(
      "dark"
    )
      ? "dark"
      : "light"
  );
}


/* =========================================================
   FILE NAME
========================================================= */

function updateFileName(file) {

  const element =
    $("#fileName");

  if (!element) {
    return;
  }


  element.textContent =
    file
      ? file.name
      : "فایلی انتخاب نشده است";
}


/* =========================================================
   UPDATE UI
========================================================= */

function updateUI() {

  const authButton =
    $("#authButton");


  if (authButton) {

    authButton.textContent =
      state.user
        ? `👤 ${state.user.name}`
        : "ورود / ثبت‌نام";
  }


  renderDashboard();

  updateNoticeCount();

  updateQuizStats();
}


/* =========================================================
   GLOBAL EVENT HANDLERS
========================================================= */

function setupNavigation() {

  document.addEventListener(
    "click",
    (event) => {

      const button =
        event.target.closest(
          "[data-page]"
        );


      if (!button) {
        return;
      }


      event.preventDefault();


      const page =
        button.dataset.page;


      if (
        page === "profile" &&
        !state.user
      ) {
        openAuth("login");
        return;
      }


      navigate(page);
    }
  );
}


function setupAuth() {

  $("#authButton")
    ?.addEventListener(
      "click",
      () => {

        if (state.user) {
          navigate("profile");
        } else {
          openAuth("login");
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
      () => {

        openAuth(
          authMode === "login"
            ? "register"
            : "login"
        );
      }
    );


  $("#authBack")
    ?.addEventListener(
      "click",
      () => navigate("home")
    );


  $("#authPassword")
    ?.addEventListener(
      "keydown",
      (event) => {

        if (event.key === "Enter") {
          handleAuthSubmit();
        }
      }
    );
}


function setupQuiz() {

  $$("[data-category-tab]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          setCategory(
            button.dataset.categoryTab
          );
        }
      );
    });
}


function setupSubscription() {

  $$(".select-plan")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          selectPlan(
            button.dataset.plan
          );
        }
      );
    });


  $("#closePayment")
    ?.addEventListener(
      "click",
      closePaymentPanel
    );


  $("#applyDiscount")
    ?.addEventListener(
      "click",
      applyDiscountCode
    );


  $("#submitPayment")
    ?.addEventListener(
      "click",
      submitPayment
    );


  $("#paymentFile")
    ?.addEventListener(
      "change",
      (event) => {

        updateFileName(
          event.target.files?.[0]
        );
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
      (event) => {

        if (
          event.key === "Enter" &&
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


function setupDashboard() {

  $$("[data-dashboard-target]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          $$("[data-dashboard-target]")
            .forEach((item) => {
              item.classList.remove("active");
            });

          button.classList.add("active");
        }
      );
    });
}


/* =========================================================
   INIT
========================================================= */

async function init() {

  loadTheme();

  setupNavigation();
  setupAuth();
  setupQuiz();
  setupSubscription();
  setupChat();
  setupSupport();
  setupTheme();
  setupDashboard();

  updateUI();

  await loadQuizData();

  renderStages();

  /*
   * If user is logged in, retrieve the authoritative
   * subscription/payment status from Google Apps Script.
   */

  if (state.user) {
    await syncUser();
  }

  updateUI();
}


document.addEventListener(
  "DOMContentLoaded",
  init
);


/* =========================================================
   PUBLIC API
========================================================= */

window.QuizDuo = {

  state,

  navigate,

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
