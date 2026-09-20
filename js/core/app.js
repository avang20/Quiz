/* =========================================================
   QuizDuo - app.js
========================================================= */

const API_URL =
  'https://script.google.com/macros/s/AKfycbwQNOpTNYI6jD2obOFkK02eEjSZd2OzkPiwvBgN_xnDgsZ90B3a_FCmXkIvzVyuxzJiZQ/exec';

/* =========================================================
   STATE
========================================================= */

const state = {
  user: null,

  subscriptionInfo: {
    active: false,
    planId: '',
    planName: '',
    start: null,
    expiry: null
  },

  payments: [],
  support: [],

  currentStage: 1,
  currentQuestion: 0,
  score: 0,

  selectedAnswer: null,
  stageQuestions: [],

  loading: false
};

/* =========================================================
   LOCAL STORAGE
========================================================= */

const STORAGE_KEYS = {
  USER: 'quizduo_user',
  SUBSCRIPTION: 'quizduo_subscription',
  PAYMENTS: 'quizduo_payments',
  SUPPORT: 'quizduo_support'
};

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.USER,
      JSON.stringify(state.user)
    );

    localStorage.setItem(
      STORAGE_KEYS.SUBSCRIPTION,
      JSON.stringify(state.subscriptionInfo)
    );

    localStorage.setItem(
      STORAGE_KEYS.PAYMENTS,
      JSON.stringify(state.payments)
    );

    localStorage.setItem(
      STORAGE_KEYS.SUPPORT,
      JSON.stringify(state.support)
    );
  } catch (error) {
    console.warn('Storage error:', error);
  }
}

function loadState() {
  try {
    const user =
      localStorage.getItem(
        STORAGE_KEYS.USER
      );

    const subscription =
      localStorage.getItem(
        STORAGE_KEYS.SUBSCRIPTION
      );

    const payments =
      localStorage.getItem(
        STORAGE_KEYS.PAYMENTS
      );

    const support =
      localStorage.getItem(
        STORAGE_KEYS.SUPPORT
      );

    if (user) {
      state.user = JSON.parse(user);
    }

    if (subscription) {
      state.subscriptionInfo =
        JSON.parse(subscription);
    }

    if (payments) {
      state.payments =
        JSON.parse(payments);
    }

    if (support) {
      state.support =
        JSON.parse(support);
    }

  } catch (error) {
    console.warn(
      'Could not load saved state:',
      error
    );
  }
}

/* =========================================================
   USER
========================================================= */

function isLoggedIn() {
  return Boolean(
    state.user &&
    state.user.username
  );
}

function getUsername() {

  if (!state.user) {
    return '';
  }

  return String(
    state.user.username ||
    state.user.name ||
    ''
  ).trim();
}

function getPhone() {

  if (!state.user) {
    return '';
  }

  return String(
    state.user.phone ||
    ''
  ).trim();
}

/* =========================================================
   SUBSCRIPTION
========================================================= */

function hasActiveSubscription() {

  if (
    !state.subscriptionInfo ||
    state.subscriptionInfo.active !== true
  ) {
    return false;
  }

  if (!state.subscriptionInfo.expiry) {
    return false;
  }

  const expiry =
    new Date(
      state.subscriptionInfo.expiry
    );

  return (
    !isNaN(expiry.getTime()) &&
    expiry.getTime() > Date.now()
  );
}

function getSubscriptionExpiry() {

  if (
    !state.subscriptionInfo ||
    !state.subscriptionInfo.expiry
  ) {
    return null;
  }

  const date =
    new Date(
      state.subscriptionInfo.expiry
    );

  return isNaN(date.getTime())
    ? null
    : date;
}

function formatDate(date) {

  if (!date) {
    return '-';
  }

  try {

    return new Intl.DateTimeFormat(
      'fa-IR',
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }
    ).format(date);

  } catch (error) {

    return date.toLocaleDateString();
  }
}

/* =========================================================
   STAGE ACCESS
========================================================= */

/*
  مرحله ۱ همیشه رایگان است.

  مراحل ۲ به بعد فقط برای کاربر دارای
  اشتراک فعال باز هستند.
*/

function requireStageAccess(stage) {

  const stageNumber =
    Number(stage);

  if (
    !stageNumber ||
    stageNumber < 1
  ) {
    return false;
  }

  if (stageNumber === 1) {
    return true;
  }

  if (hasActiveSubscription()) {
    return true;
  }

  showSubscriptionRequired(stageNumber);

  return false;
}

function showSubscriptionRequired(stage) {

  const message =
    stage
      ? `مرحله ${stage} برای کاربران دارای اشتراک فعال است.`
      : 'برای ادامه باید اشتراک فعال داشته باشید.';

  alert(
    message +
    '\n\nلطفاً ابتدا ثبت‌نام کنید و سپس اشتراک خود را فعال کنید.'
  );

  if (
    typeof openSubscription ===
    'function'
  ) {
    openSubscription();
    return;
  }

  if (
    typeof showPage ===
    'function'
  ) {
    showPage('subscription');
    return;
  }

  const element =
    document.getElementById(
      'subscription'
    );

  if (element) {
    element.scrollIntoView({
      behavior: 'smooth'
    });
  }
}

/* =========================================================
   STAGES UI
========================================================= */

function renderStages() {

  const containers =
    document.querySelectorAll(
      '[data-stage-container]'
    );

  containers.forEach(
    container => {

      const stageElements =
        container.querySelectorAll(
          '[data-stage]'
        );

      stageElements.forEach(
        element => {

          const stage =
            Number(
              element.dataset.stage
            );

          const accessible =
            requireStageAccessSilently(
              stage
            );

          element.classList.toggle(
            'locked',
            !accessible
          );

          element.classList.toggle(
            'unlocked',
            accessible
          );

          const lock =
            element.querySelector(
              '.stage-lock'
            );

          if (lock) {
            lock.textContent =
              accessible
                ? '✓'
                : '🔒';
          }
        }
      );
    }
  );

  /*
    پشتیبانی از ساختارهای قدیمی
    که stage-card یا stage-item دارند.
  */

  const cards =
    document.querySelectorAll(
      '.stage-card, .stage-item, .stage-box'
    );

  cards.forEach(
    card => {

      const value =
        card.dataset.stage ||
        card.getAttribute(
          'data-stage'
        );

      if (!value) {
        return;
      }

      const stage =
        Number(value);

      const accessible =
        requireStageAccessSilently(
          stage
        );

      card.classList.toggle(
        'locked',
        !accessible
      );

      card.classList.toggle(
        'unlocked',
        accessible
      );

      let lock =
        card.querySelector(
          '.stage-lock'
        );

      if (!lock) {

        lock =
          document.createElement(
            'span'
          );

        lock.className =
          'stage-lock';

        card.appendChild(lock);
      }

      lock.textContent =
        accessible
          ? '✓'
          : '🔒';
    }
  );
}

function requireStageAccessSilently(stage) {

  if (Number(stage) === 1) {
    return true;
  }

  return hasActiveSubscription();
}

/* =========================================================
   START STAGE
========================================================= */

function startStage(stage) {

  const stageNumber =
    Number(stage);

  if (
    !requireStageAccess(
      stageNumber
    )
  ) {
    return;
  }

  if (
    typeof quizData ===
    'undefined'
  ) {

    alert(
      'اطلاعات سوالات هنوز بارگذاری نشده است.'
    );

    return;
  }

  state.currentStage =
    stageNumber;

  state.currentQuestion = 0;
  state.score = 0;
  state.selectedAnswer = null;

  state.stageQuestions =
    getQuestionsForStage(
      stageNumber
    );

  if (
    !state.stageQuestions.length
  ) {

    alert(
      'برای این مرحله سوالی ثبت نشده است.'
    );

    return;
  }

  showQuizScreen();

  renderQuestion();
}

/* =========================================================
   QUESTION DATA
========================================================= */

function getQuestionsForStage(stage) {

  const number =
    Number(stage);

  /*
    پشتیبانی از چند فرمت احتمالی
    quizData.
  */

  if (
    Array.isArray(
      window.quizData
    )
  ) {

    return window.quizData
      .filter(
        item =>
          Number(
            item.stage
          ) === number
      );
  }

  if (
    window.quizData &&
    Array.isArray(
      window.quizData.stages
    )
  ) {

    const stageData =
      window.quizData.stages
        .find(
          item =>
            Number(
              item.stage ||
              item.id
            ) === number
        );

    if (!stageData) {
      return [];
    }

    return (
      stageData.questions ||
      []
    );
  }

  if (
    window.quizData &&
    Array.isArray(
      window.quizData[number]
    )
  ) {

    return window.quizData[number];
  }

  return [];
}

/* =========================================================
   QUIZ SCREEN
========================================================= */

function showQuizScreen() {

  const quizScreen =
    document.getElementById(
      'quiz-screen'
    );

  if (quizScreen) {

    quizScreen.style.display =
      'block';

    quizScreen.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  if (
    typeof showPage ===
    'function'
  ) {
    try {
      showPage('quiz');
    } catch (error) {
      console.warn(error);
    }
  }
}

/* =========================================================
   RENDER QUESTION
========================================================= */

function renderQuestion() {

  const questions =
    state.stageQuestions;

  if (!questions.length) {
    return;
  }

  const index =
    state.currentQuestion;

  if (
    index >= questions.length
  ) {
    finishStage();
    return;
  }

  const question =
    questions[index];

  state.selectedAnswer =
    null;

  const questionText =
    question.question ||
    question.text ||
    question.q ||
    '';

  const options =
    getQuestionOptions(
      question
    );

  /*
    Question number
  */

  setText(
    [
      '#question-number',
      '#current-question',
      '[data-current-question]'
    ],
    String(index + 1)
  );

  /*
    Total
  */

  setText(
    [
      '#question-total',
      '[data-total-questions]'
    ],
    String(questions.length)
  );

  /*
    Question text
  */

  const questionElements =
    document.querySelectorAll(
      '#question-text, .question-text, [data-question-text]'
    );

  questionElements.forEach(
    element => {

      element.textContent =
        questionText;
    }
  );

  /*
    Options
  */

  renderOptions(options);

  /*
    Progress
  */

  const progress =
    (
      (index + 1) /
      questions.length
    ) * 100;

  document
    .querySelectorAll(
      '.quiz-progress-bar, [data-quiz-progress]'
    )
    .forEach(
      element => {

        element.style.width =
          progress + '%';
      }
    );

  /*
    Stage label
  */

  setText(
    [
      '#stage-title',
      '[data-stage-title]'
    ],
    `مرحله ${state.currentStage}`
  );
}

/* =========================================================
   OPTIONS
========================================================= */

function getQuestionOptions(question) {

  let options =
    question.options ||
    question.choices ||
    question.answers ||
    [];

  if (!Array.isArray(options)) {
    options = [];
  }

  /*
    هر سوال باید ۴ گزینه داشته باشد.
  */

  return options
    .slice(0, 4)
    .map(
      (option, index) => {

        if (
          typeof option ===
          'string'
        ) {

          return {
            text: option,
            value: option,
            index
          };
        }

        return {
          text:
            option.text ||
            option.label ||
            option.answer ||
            '',
          value:
            option.value ||
            option.text ||
            option.label ||
            '',
          index
        };
      }
    );
}

function renderOptions(options) {

  const container =
    document.querySelector(
      '#answer-options'
    ) ||
    document.querySelector(
      '.answer-options'
    ) ||
    document.querySelector(
      '[data-answer-options]'
    );

  if (!container) {
    return;
  }

  container.innerHTML = '';

  options.forEach(
    (option, index) => {

      const button =
        document.createElement(
          'button'
        );

      button.type =
        'button';

      button.className =
        'quiz-option';

      button.dataset.index =
        String(index);

      button.dataset.value =
        option.value;

      button.innerHTML = `
        <span class="option-letter">
          ${String.fromCharCode(65 + index)}
        </span>

        <span class="option-text">
          ${escapeHTML(option.text)}
        </span>
      `;

      button.addEventListener(
        'click',
        () => {

          selectAnswer(
            index,
            option.value
          );
        }
      );

      container.appendChild(
        button
      );
    }
  );
}

/* =========================================================
   ANSWER
========================================================= */

function selectAnswer(
  index,
  value
) {

  if (
    state.selectedAnswer !== null
  ) {
    return;
  }

  state.selectedAnswer =
    index;

  const question =
    state.stageQuestions[
      state.currentQuestion
    ];

  const correct =
    getCorrectAnswer(
      question
    );

  const isCorrect =
    isAnswerCorrect(
      value,
      index,
      correct
    );

  const buttons =
    document.querySelectorAll(
      '.quiz-option'
    );

  buttons.forEach(
    (button, buttonIndex) => {

      button.disabled =
        true;

      if (
        buttonIndex === index
      ) {

        button.classList.add(
          isCorrect
            ? 'correct'
            : 'wrong'
        );
      }

      if (
        !isCorrect &&
        isCorrectOption(
          buttonIndex,
          button.dataset.value,
          correct
        )
      ) {

        button.classList.add(
          'correct'
        );
      }
    }
  );

  if (isCorrect) {
    state.score++;
  }

  showAnswerResult(
    isCorrect,
    correct
  );

  setTimeout(
    () => {

      state.currentQuestion++;

      renderQuestion();

    },
    900
  );
}

/* =========================================================
   CORRECT ANSWER
========================================================= */

function getCorrectAnswer(question) {

  return (
    question.correct ??
    question.answer ??
    question.correctAnswer ??
    question.correctIndex ??
    ''
  );
}

function isAnswerCorrect(
  selectedValue,
  selectedIndex,
  correct
) {

  if (
    typeof correct ===
    'number'
  ) {

    return (
      selectedIndex ===
      correct
    );
  }

  const normalizedCorrect =
    normalizeAnswer(
      correct
    );

  const normalizedValue =
    normalizeAnswer(
      selectedValue
    );

  if (
    normalizedCorrect ===
    normalizedValue
  ) {
    return true;
  }

  /*
    اگر correctAnswer به صورت
    شماره گزینه ذخیره شده باشد.
  */

  const numeric =
    Number(correct);

  if (
    !isNaN(numeric) &&
    String(correct).trim() !== ''
  ) {

    return (
      selectedIndex === numeric ||
      selectedIndex + 1 === numeric
    );
  }

  return false;
}

function isCorrectOption(
  index,
  value,
  correct
) {

  return isAnswerCorrect(
    value,
    index,
    correct
  );
}

function normalizeAnswer(value) {

  return String(
    value ?? ''
  )
    .trim()
    .toLowerCase()
    .replace(
      /ي/g,
      'ی'
    )
    .replace(
      /ك/g,
      'ک'
    )
    .replace(
      /\s+/g,
      ' '
    );
}

/* =========================================================
   ANSWER RESULT
========================================================= */

function showAnswerResult(
  isCorrect,
  correct
) {

  const elements =
    document.querySelectorAll(
      '.answer-result, [data-answer-result]'
    );

  elements.forEach(
    element => {

      element.style.display =
        'block';

      element.className =
        'answer-result ' +
        (
          isCorrect
            ? 'correct'
            : 'wrong'
        );

      element.textContent =
        isCorrect
          ? '✓ پاسخ درست است!'
          : '✕ پاسخ نادرست است.';
    }
  );
}

/* =========================================================
   FINISH STAGE
========================================================= */

function finishStage() {

  const total =
    state.stageQuestions.length;

  const score =
    state.score;

  const percentage =
    total
      ? Math.round(
          (score / total) *
          100
        )
      : 0;

  const result =
    document.getElementById(
      'quiz-result'
    );

  if (result) {

    result.style.display =
      'block';

    const scoreElement =
      result.querySelector(
        '[data-score], .score'
      );

    if (scoreElement) {

      scoreElement.textContent =
        `${score} از ${total}`;
    }

    const percentageElement =
      result.querySelector(
        '[data-percentage], .percentage'
      );

    if (percentageElement) {

      percentageElement.textContent =
        `${percentage}%`;
    }
  }

  setText(
    [
      '#final-score',
      '[data-final-score]'
    ],
    `${score} از ${total}`
  );

  setText(
    [
      '#final-percentage',
      '[data-final-percentage]'
    ],
    `${percentage}%`
  );

  /*
    اگر مرحله ۱ تمام شد،
    مراحل بعدی فقط در صورت اشتراک فعال باز می‌شوند.
  */

  renderStages();

  if (
    typeof window.onQuizFinished ===
    'function'
  ) {

    try {

      window.onQuizFinished({
        stage: state.currentStage,
        score,
        total,
        percentage
      });

    } catch (error) {

      console.warn(
        'onQuizFinished error:',
        error
      );
    }
  }
}

/* =========================================================
   SUBSCRIPTION UI
========================================================= */

function renderSubscriptionStatus() {

  const active =
    hasActiveSubscription();

  document
    .querySelectorAll(
      '[data-subscription-status]'
    )
    .forEach(
      element => {

        element.textContent =
          active
            ? 'اشتراک فعال'
            : 'بدون اشتراک فعال';

        element.classList.toggle(
          'active',
          active
        );

        element.classList.toggle(
          'inactive',
          !active
        );
      }
    );

  const expiry =
    getSubscriptionExpiry();

  document
    .querySelectorAll(
      '[data-subscription-expiry]'
    )
    .forEach(
      element => {

        element.textContent =
          active && expiry
            ? formatDate(expiry)
            : '-';
      }
    );

  document
    .querySelectorAll(
      '[data-subscription-plan]'
    )
    .forEach(
      element => {

        element.textContent =
          active
            ? (
                state
                  .subscriptionInfo
                  .planName ||
                state
                  .subscriptionInfo
                  .planId ||
                'اشتراک فعال'
              )
            : 'رایگان';
      }
    );

  renderStages();
}

/* =========================================================
   PAYMENT CARDS
========================================================= */

function renderUserPanels() {

  renderPaymentCards();

  renderSupportConversation();

  renderSubscriptionStatus();
}

function renderPaymentCards() {

  const containers =
    document.querySelectorAll(
      '#payment-history, [data-payment-history], .payment-history'
    );

  containers.forEach(
    container => {

      container.innerHTML = '';

      if (
        !state.payments.length
      ) {

        container.innerHTML = `
          <div class="empty-state">
            هنوز پرداختی ثبت نشده است.
          </div>
        `;

        return;
      }

      state.payments.forEach(
        payment => {

          const card =
            document.createElement(
              'div'
            );

          card.className =
            'payment-card';

          const statusClass =
            getStatusClass(
              payment.status
            );

          card.innerHTML = `
            <div class="payment-card-header">
              <div>
                <strong>
                  ${escapeHTML(
                    payment.planName ||
                    payment.planId ||
                    'اشتراک'
                  )}
                </strong>

                <div class="payment-date">
                  ${escapeHTML(
                    formatServerDate(
                      payment.timestamp
                    )
                  )}
                </div>
              </div>

              <span class="payment-status ${statusClass}">
                ${escapeHTML(
                  payment.status ||
                  'در انتظار بررسی'
                )}
              </span>
            </div>

            <div class="payment-card-body">

              <div class="payment-row">
                <span>مبلغ</span>
                <strong>
                  ${formatMoney(
                    payment.amount
                  )}
                  تومان
                </strong>
              </div>

              ${
                payment.userMessage
                  ? `
                    <div class="payment-message">
                      ${escapeHTML(
                        payment.userMessage
                      )}
                    </div>
                  `
                  : ''
              }

            </div>
          `;

          container.appendChild(
            card
          );
        }
      );
    }
  );
}

/* =========================================================
   SUPPORT CONVERSATIONS
========================================================= */

function renderSupportConversation() {

  const containers =
    document.querySelectorAll(
      '#support-history, [data-support-history], .support-history'
    );

  containers.forEach(
    container => {

      container.innerHTML = '';

      if (
        !state.support.length
      ) {

        container.innerHTML = `
          <div class="empty-state">
            هنوز درخواست پشتیبانی ثبت نکرده‌اید.
          </div>
        `;

        return;
      }

      state.support.forEach(
        conversation => {

          const card =
            document.createElement(
              'div'
            );

          card.className =
            'support-card';

          let threadHTML = '';

          const thread =
            Array.isArray(
              conversation.thread
            )
              ? conversation.thread
              : [];

          thread.forEach(
            item => {

              const admin =
                item.sender ===
                'admin';

              threadHTML += `
                <div class="support-message ${
                  admin
                    ? 'admin-message'
                    : 'user-message'
                }">

                  <div class="support-message-label">
                    ${
                      admin
                        ? 'پشتیبانی QuizDuo'
                        : 'شما'
                    }
                  </div>

                  <div class="support-message-text">
                    ${escapeHTML(
                      item.text || ''
                    )}
                  </div>

                  <div class="support-message-date">
                    ${escapeHTML(
                      formatServerDate(
                        item.timestamp
                      )
                    )}
                  </div>

                </div>
              `;
            }
          );

          card.innerHTML = `
            <div class="support-card-header">

              <div>
                <strong>
                  ${escapeHTML(
                    conversation.subject ||
                    'درخواست پشتیبانی'
                  )}
                </strong>

                <div class="support-date">
                  ${escapeHTML(
                    formatServerDate(
                      conversation.timestamp
                    )
                  )}
                </div>
              </div>

              <span class="support-status">
                ${escapeHTML(
                  conversation.status ||
                  'جدید'
                )}
              </span>

            </div>

            <div class="support-thread">
              ${threadHTML}
            </div>

            ${
              conversation.status !==
              'بسته شد'
                ? `
                  <div class="support-reply-box">

                    <textarea
                      class="support-reply-input"
                      placeholder="پاسخ خود را بنویسید..."
                      data-conversation-id="${escapeHTML(
                        conversation.conversationId
                      )}"
                    ></textarea>

                    <button
                      type="button"
                      class="support-reply-button"
                      data-conversation-id="${escapeHTML(
                        conversation.conversationId
                      )}"
                    >
                      ارسال پاسخ
                    </button>

                  </div>
                `
                : `
                  <div class="support-closed">
                    این گفت‌وگو بسته شده است.
                  </div>
                `
            }
          `;

          container.appendChild(
            card
          );
        }
      );

      bindSupportReplyButtons();
    }
  );
}

function bindSupportReplyButtons() {

  document
    .querySelectorAll(
      '.support-reply-button'
    )
    .forEach(
      button => {

        if (
          button.dataset.bound ===
          'true'
        ) {
          return;
        }

        button.dataset.bound =
          'true';

        button.addEventListener(
          'click',
          async () => {

            const id =
              button.dataset
                .conversationId;

            const textarea =
              document.querySelector(
                `.support-reply-input[data-conversation-id="${CSS.escape(id)}"]`
              );

            if (!textarea) {
              return;
            }

            const message =
              textarea.value.trim();

            if (!message) {

              alert(
                'متن پاسخ را وارد کنید.'
              );

              return;
            }

            button.disabled =
              true;

            try {

              const response =
                await postToServer({
                  action:
                    'supportUserReply',

                  username:
                    getUsername(),

                  conversationId:
                    id,

                  message
                });

              if (
                response.success
              ) {

                textarea.value =
                  '';

                await syncServerUpdates();

                alert(
                  'پاسخ شما ارسال شد.'
                );

              } else {

                alert(
                  response.message ||
                  'ارسال پاسخ ناموفق بود.'
                );
              }

            } catch (error) {

              console.error(error);

              alert(
                'خطا در ارتباط با سرور.'
              );

            } finally {

              button.disabled =
                false;
            }
          }
        );
      }
    );
}

/* =========================================================
   SUBMIT PAYMENT
========================================================= */

async function submitPayment(paymentData) {

  if (!isLoggedIn()) {

    alert(
      'برای خرید اشتراک ابتدا ثبت‌نام یا ورود کنید.'
    );

    return {
      success: false
    };
  }

  if (!paymentData) {

    return {
      success: false,
      message:
        'اطلاعات پرداخت وجود ندارد.'
    };
  }

  try {

    const response =
      await postToServer({
        action: 'payment',

        username:
          getUsername(),

        phone:
          paymentData.phone ||
          getPhone(),

        plan:
          paymentData.plan,

        planName:
          paymentData.planName,

        amount:
          paymentData.amount,

        discountPercent:
          paymentData.discountPercent ||
          0,

        discountCode:
          paymentData.discountCode ||
          '',

        receiptBase64:
          paymentData.receiptBase64,

        mimeType:
          paymentData.mimeType ||
          'image/jpeg',

        fileName:
          paymentData.fileName ||
          'receipt.jpg'
      });

    if (
      response &&
      response.success
    ) {

      await syncServerUpdates();

      alert(
        response.message ||
        'فیش شما با موفقیت ارسال شد.'
      );
    }

    return response;

  } catch (error) {

    console.error(
      'submitPayment error:',
      error
    );

    alert(
      'خطا در ارسال پرداخت.'
    );

    return {
      success: false,
      message:
        error.message
    };
  }
}

/* =========================================================
   SUPPORT SUBMIT
========================================================= */

async function submitSupport(
  subject,
  message
) {

  if (!isLoggedIn()) {

    alert(
      'برای ارسال پیام پشتیبانی ابتدا وارد حساب شوید.'
    );

    return {
      success: false
    };
  }

  if (
    !String(subject || '').trim() ||
    !String(message || '').trim()
  ) {

    alert(
      'موضوع و متن پیام را وارد کنید.'
    );

    return {
      success: false
    };
  }

  try {

    const response =
      await postToServer({
        action: 'support',

        username:
          getUsername(),

        phone:
          getPhone(),

        subject:
          String(subject).trim(),

        message:
          String(message).trim()
      });

    if (
      response.success
    ) {

      await syncServerUpdates();

      alert(
        response.message ||
        'پیام شما ارسال شد.'
      );
    }

    return response;

  } catch (error) {

    console.error(error);

    alert(
      'خطا در ارسال پیام پشتیبانی.'
    );

    return {
      success: false,
      message:
        error.message
    };
  }
}

/* =========================================================
   SERVER SYNC
========================================================= */

async function syncServerUpdates() {

  if (!isLoggedIn()) {

    state.subscriptionInfo = {
      active: false,
      planId: '',
      planName: '',
      start: null,
      expiry: null
    };

    state.payments = [];
    state.support = [];

    saveState();

    renderUserPanels();

    return;
  }

  try {

    const data =
      await postToServer({
        action: 'userUpdates',

        username:
          getUsername()
      });

    if (
      !data ||
      data.success !== true
    ) {
      return;
    }

    /*
      وضعیت سرور منبع اصلی است.
    */

    if (
      data.subscription
    ) {

      state.subscriptionInfo =
        data.subscription;
    }

    if (
      Array.isArray(
        data.payments
      )
    ) {

      state.payments =
        data.payments;
    }

    if (
      Array.isArray(
        data.support
      )
    ) {

      state.support =
        data.support;
    }

    saveState();

    renderUserPanels();

  } catch (error) {

    console.warn(
      'Server sync failed:',
      error
    );
  }
}

/* =========================================================
   GENERIC SERVER REQUEST
========================================================= */

async function postToServer(payload) {

  const response =
    await fetch(
      API_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'text/plain;charset=utf-8'
        },

        body:
          JSON.stringify(payload)
      }
    );

  const text =
    await response.text();

  let data;

  try {

    data =
      JSON.parse(text);

  } catch (error) {

    throw new Error(
      'پاسخ سرور قابل خواندن نیست.'
    );
  }

  if (
    data &&
    data.success === false &&
    data.message
  ) {

    console.warn(
      'Server:',
      data.message
    );
  }

  return data;
}

/* =========================================================
   LOGIN / REGISTER HOOKS
========================================================= */

function setCurrentUser(user) {

  if (!user) {

    state.user =
      null;

    state.subscriptionInfo = {
      active: false,
      planId: '',
      planName: '',
      start: null,
      expiry: null
    };

    state.payments = [];
    state.support = [];

    saveState();

    renderUserPanels();

    return;
  }

  state.user = {
    username:
      user.username ||
      user.name ||
      '',

    name:
      user.name ||
      user.username ||
      '',

    phone:
      user.phone ||
      ''
  };

  saveState();

  syncServerUpdates();
}

function logoutQuizDuo() {

  state.user =
    null;

  state.subscriptionInfo = {
    active: false,
    planId: '',
    planName: '',
    start: null,
    expiry: null
  };

  state.payments = [];
  state.support = [];

  saveState();

  renderUserPanels();

  renderStages();
}

/* =========================================================
   DISCOUNT
========================================================= */

async function validateDiscountCode(
  code,
  plan
) {

  try {

    const response =
      await postToServer({
        action:
          'validateDiscount',

        code:
          String(code || '')
            .trim()
            .toUpperCase(),

        plan
      });

    return response;

  } catch (error) {

    console.error(error);

    return {
      success: false,
      message:
        'بررسی کد تخفیف ناموفق بود.'
    };
  }
}

/* =========================================================
   UTILITY
========================================================= */

function setText(
  selectors,
  value
) {

  selectors.forEach(
    selector => {

      document
        .querySelectorAll(selector)
        .forEach(
          element => {

            element.textContent =
              value;
          }
        );
    }
  );
}

function formatMoney(value) {

  const number =
    Number(value || 0);

  return number.toLocaleString(
    'fa-IR'
  );
}

function formatServerDate(value) {

  if (!value) {
    return '-';
  }

  const date =
    new Date(value);

  if (
    isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return formatDate(date);
}

function getStatusClass(status) {

  const value =
    String(status || '')
      .trim();

  if (
    value === 'تأیید شد'
  ) {
    return 'status-success';
  }

  if (
    value === 'رد شد'
  ) {
    return 'status-danger';
  }

  if (
    value === 'در انتظار بررسی'
  ) {
    return 'status-pending';
  }

  return 'status-default';
}

function escapeHTML(value) {

  return String(
    value ?? ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}

/* =========================================================
   FILE TO BASE64
========================================================= */

function fileToBase64(file) {

  return new Promise(
    (resolve, reject) => {

      if (!file) {

        reject(
          new Error(
            'فایلی انتخاب نشده است.'
          )
        );

        return;
      }

      const reader =
        new FileReader();

      reader.onload =
        () => {

          const result =
            String(
              reader.result
            );

          const comma =
            result.indexOf(',');

          resolve(
            comma >= 0
              ? result.slice(
                  comma + 1
                )
              : result
          );
        };

      reader.onerror =
        () => {

          reject(
            new Error(
              'خواندن فایل ناموفق بود.'
            )
          );
        };

      reader.readAsDataURL(
        file
      );
    }
  );
}

/* =========================================================
   DOM INITIALIZATION
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    loadState();

    renderUserPanels();

    renderStages();

    /*
      اگر کاربر قبلاً وارد شده،
      وضعیت واقعی سرور را دریافت کن.
    */

    if (isLoggedIn()) {
      await syncServerUpdates();
    }
  }
);

/* =========================================================
   GLOBAL API
========================================================= */

window.QuizDuo = {

  state,

  startStage,

  selectAnswer,

  submitPayment,

  submitSupport,

  syncServerUpdates,

  validateDiscountCode,

  setCurrentUser,

  logoutQuizDuo,

  hasActiveSubscription,

  requireStageAccess,

  renderStages,

  renderUserPanels,

  fileToBase64
};
