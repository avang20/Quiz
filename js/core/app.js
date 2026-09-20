import {
    createDefaultState,
    getUnlockedStage,
    isStageCompleted
} from "./state.js";

import {
    loadState,
    saveState,
    getCurrentUser,
    setCurrentUser,
    getUsers,
    saveUsers,
    getLeaderboard,
    updateLeaderboard
} from "./storage.js";

import {
    escapeHTML
} from "./utils.js";

import {
    QuizEngine,
    QUIZ_CONFIG
} from "./quiz.js";


const API_URL =
    "https://script.google.com/macros/s/AKfycbwQNOpTNYI6jD2obOFKk02eEjSZd2OzkPiwvBgN_xnDgsZ90B3a_FCmXkIvzVyuxzJiZQ/exec";


const ACCOUNT_NUMBER =
    "5022291615132519";


const subscriptionPlans = {

    monthly: {
        name: "ماهانه",
        months: 1,
        price: 100000
    },

    quarterly: {
        name: "سه‌ماهه",
        months: 3,
        price: 270000
    },

    sixMonth: {
        name: "شش‌ماهه",
        months: 6,
        price: 480000
    },

    nineMonth: {
        name: "نه‌ماهه",
        months: 9,
        price: 660000
    }

};


const money = value =>
    Number(
        value || 0
    )
        .toLocaleString(
            "fa-IR"
        ) +
    " تومان";


function normalizeQuestionForUI(
    question
) {

    if (!question) {
        return null;
    }


    return {

        ...question,

        question:
            String(
                question.question ??
                question.q ??
                question.text ??
                ""
            ),

        options:
            Array.isArray(
                question.options
            )
                ? question.options.map(
                    option =>
                        String(
                            option
                        )
                  )
                : []

    };

}


class App {

    constructor() {

        const username =
            getCurrentUser() ||
            "guest";


        this.state =
            loadState(
                createDefaultState(),
                username
            );


        this.state.username =
            username ===
            "guest"

                ? "بازیکن مهمان"

                : username;


        this.quiz =
            new QuizEngine(
                this.state,
                () =>
                    this.persist()
            );


        this.authRegister =
            false;


        this.selectedPlan =
            null;


        this.paymentFile =
            null;


        this.lastServerUpdates = {

            payments:
                [],

            support:
                []

        };


        this.serverLeaderboard =
            [];


        this.timerId =
            null;


        this.timeLeft =
            0;


        this.serverStateTimer =
            null;


        this.supportPanelReady =
            false;


        this.paymentPanelReady =
            false;


        this.leaderboardLoading =
            false;


        this.boundSupportEvents =
            false;

    }


    /* ======================================================
       INIT
    ====================================================== */


    init() {

        this.bindNavigation();

        this.initTheme();

        this.initAuth();

        this.initQuiz();

        this.initSubscription();

        this.initChat();

        this.initSupport();

        this.renderProfile();

        this.renderQuizStats();

        this.ensureSupportPanel();

        this.ensurePaymentStatusPanel();

        this.updateAuthButton();

        this.go(
            "home"
        );


        this.syncServerUpdates();

    }


    /* ======================================================
       NAVIGATION
    ====================================================== */


    bindNavigation() {

        document
            .querySelectorAll(
                "[data-page]"
            )
            .forEach(
                element => {

                    element.addEventListener(
                        "click",
                        event => {

                            event.preventDefault();

                            this.go(
                                element.dataset.page
                            );

                        }
                    );

                }
            );


        document
            .getElementById(
                "themeToggle"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.toggleTheme()
            );


        document
            .getElementById(
                "authButton"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.go(
                        this.isGuest()
                            ? "auth"
                            : "profile"
                    )
            );

    }


    go(page) {

        document
            .querySelectorAll(
                ".page"
            )
            .forEach(
                section =>
                    section.classList.remove(
                        "active"
                    )
            );


        document
            .getElementById(
                page
            )
            ?.classList.add(
                "active"
            );


        if (
            page ===
            "quiz"
        ) {

            this.renderStages();

        }


        if (
            page ===
            "leaderboard"
        ) {

            this.renderLeaderboard();

        }


        if (
            page ===
            "profile"
        ) {

            this.renderProfile();

        }


        if (
            page ===
            "subscription"
        ) {

            this.ensurePaymentStatusPanel();

            this.renderPaymentState();

            this.renderServerUpdates();

        }


        if (
            page ===
            "support"
        ) {

            this.ensureSupportPanel();

            this.renderServerUpdates();

        }


        window.scrollTo({

            top:
                0,

            behavior:
                "smooth"

        });

    }


    /* ======================================================
       THEME
    ====================================================== */


    toggleTheme() {

        document.body
            .classList
            .toggle(
                "dark"
            );


        const theme =
            document.body
                .classList
                .contains(
                    "dark"
                )

                ? "dark"

                : "light";


        this.state.theme =
            theme;


        localStorage.setItem(
            "quizduo_theme",
            theme
        );


        this.persist();

    }


    initTheme() {

        const saved =
            localStorage.getItem(
                "quizduo_theme"
            ) ||
            this.state.theme ||
            "light";


        document.body
            .classList
            .toggle(
                "dark",
                saved ===
                    "dark"
            );

    }


    /* ======================================================
       HELPERS
    ====================================================== */


    isGuest() {

        return (
            this.state.username ===
            "بازیکن مهمان"
        );

    }


    formatDate(
        value
    ) {

        if (!value) {
            return "";
        }


        try {

            return new Date(
                value
            )
                .toLocaleString(
                    "fa-IR"
                );

        } catch {

            return String(
                value
            );

        }

    }


    toast(
        text
    ) {

        let toast =
            document.getElementById(
                "quizduoToast"
            );


        if (!toast) {

            toast =
                document.createElement(
                    "div"
                );


            toast.id =
                "quizduoToast";


            Object.assign(
                toast.style,
                {

                    position:
                        "fixed",

                    right:
                        "20px",

                    bottom:
                        "20px",

                    zIndex:
                        "99999",

                    background:
                        "#17262d",

                    color:
                        "#fff",

                    padding:
                        "12px 16px",

                    borderRadius:
                        "13px",

                    boxShadow:
                        "0 12px 30px rgba(0,0,0,.2)"

                }
            );


            document.body.appendChild(
                toast
            );

        }


        toast.textContent =
            text;


        clearTimeout(
            this.toastTimer
        );


        this.toastTimer =
            setTimeout(
                () =>
                    toast.remove(),
                3000
            );

    }


    /* ======================================================
       STATE / SERVER USER SYNC
    ====================================================== */


    persist() {

        saveState(

            this.state,

            this.isGuest()
                ? "guest"
                : this.state.username

        );


        if (
            !this.isGuest()
        ) {

            updateLeaderboard(
                this.state
            );


            this.queueUserStateSync();

        }


        this.renderProfile();

        this.renderQuizStats();

    }


    queueUserStateSync() {

        clearTimeout(
            this.serverStateTimer
        );


        this.serverStateTimer =
            setTimeout(
                () =>
                    this.sendUserState(),
                700
            );

    }


    async sendUserState() {

        if (
            this.isGuest()
        ) {

            return;

        }


        try {

            await this.serverWrite({

                action:
                    "userState",

                username:
                    this.state.username,

                phone:
                    this.getRegisteredPhone(),

                xp:
                    Number(
                        this.state.xp ||
                        0
                    ),

                level:
                    Number(
                        this.state.level ||
                        1
                    ),

                streak:
                    Number(
                        this.state.streak ||
                        0
                    ),

                generalStage:
                    Number(
                        this.state.generalStage ||
                        1
                    ),

                funStage:
                    Number(
                        this.state.funStage ||
                        1
                    )

            });

        } catch (
            error
        ) {

            console.error(
                "User state sync failed:",
                error
            );

        }

    }


    getRegisteredPhone() {

        const users =
            getUsers();


        const current =
            users.find(
                user =>
                    String(
                        user.username
                    ).toLowerCase() ===
                    String(
                        this.state.username
                    ).toLowerCase()
            );


        return current?.phone ||
            "";

    }


    /* ======================================================
       AUTH
    ====================================================== */


    initAuth() {

        document
            .getElementById(
                "toggleAuth"
            )
            ?.addEventListener(
                "click",
                () => {

                    this.authRegister =
                        !this.authRegister;


                    document
                        .getElementById(
                            "authTitle"
                        )
                        .textContent =
                        this.authRegister
                            ? "ساخت حساب جدید"
                            : "ورود";


                    document
                        .getElementById(
                            "authSubmit"
                        )
                        .textContent =
                        this.authRegister
                            ? "ثبت‌نام"
                            : "ورود";


                    document
                        .getElementById(
                            "toggleAuth"
                        )
                        .textContent =
                        this.authRegister
                            ? "ورود به حساب"
                            : "ساخت حساب جدید";


                    document
                        .getElementById(
                            "phoneField"
                        )
                        ?.classList
                        .toggle(
                            "hidden",
                            !this.authRegister
                        );

                }
            );


        document
            .getElementById(
                "authBack"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.go(
                        "home"
                    )
            );


        document
            .getElementById(
                "authSubmit"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.submitAuth()
            );

    }


    submitAuth() {

        const name =
            document
                .getElementById(
                    "authName"
                )
                .value
                .trim();


        const password =
            document
                .getElementById(
                    "authPassword"
                )
                .value;


        const phone =
            document
                .getElementById(
                    "authPhone"
                )
                .value
                .trim();


        const message =
            document.getElementById(
                "authMsg"
            );


        if (
            name.length < 2 ||
            password.length < 4
        ) {

            message.textContent =
                "نام کاربری و رمز عبور معتبر وارد کنید.";

            return;

        }


        const users =
            getUsers();


        const existing =
            users.find(
                user =>
                    String(
                        user.username
                    ).toLowerCase() ===
                    name.toLowerCase()
            );


        if (
            this.authRegister
        ) {

            if (
                existing
            ) {

                message.textContent =
                    "این نام کاربری قبلاً استفاده شده است.";

                return;

            }


            if (
                !/^09\d{9}$/.test(
                    phone
                )
            ) {

                message.textContent =
                    "شماره تماس را به شکل 09123456789 وارد کنید.";

                return;

            }


            users.push({

                username:
                    name,

                password,

                phone,

                createdAt:
                    Date.now()

            });


            saveUsers(
                users
            );


            setCurrentUser(
                name
            );


            this.state =
                loadState(
                    createDefaultState(),
                    name
                );


            this.state.username =
                name;


            this.persist();


            this.sendUserState();


            message.textContent =
                "حساب با موفقیت ساخته شد.";


        } else {

            if (
                !existing ||
                existing.password !==
                    password
            ) {

                message.textContent =
                    "نام کاربری یا رمز عبور اشتباه است.";

                return;

            }


            setCurrentUser(
                existing.username
            );


            this.state =
                loadState(
                    createDefaultState(),
                    existing.username
                );


            this.state.username =
                existing.username;


            this.persist();


            this.sendUserState();


            message.textContent =
                "ورود موفق بود.";

        }


        this.updateAuthButton();


        setTimeout(
            () =>
                this.go(
                    "home"
                ),
            450
        );

    }


    updateAuthButton() {

        const button =
            document.getElementById(
                "authButton"
            );


        if (
            !button
        ) {

            return;

        }


        button.textContent =
            this.isGuest()
                ? "ورود / ثبت‌نام"
                : this.state.username;

    }


    /* ======================================================
       QUIZ
    ====================================================== */


    initQuiz() {

        document
            .querySelectorAll(
                "[data-category-tab]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            document
                                .querySelectorAll(
                                    "[data-category-tab]"
                                )
                                .forEach(
                                    item =>
                                        item.classList.remove(
                                            "active"
                                        )
                                );


                            button.classList.add(
                                "active"
                            );


                            this.quiz.currentCategory =
                                button.dataset
                                    .categoryTab;


                            this.renderStages();

                        }
                    );

                }
            );


        this.injectQuizTimerStyle();

    }


    injectQuizTimerStyle() {

        if (
            document.getElementById(
                "quizTimerStyle"
            )
        ) {

            return;

        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "quizTimerStyle";


        style.textContent = `

            .quiz-question-header {
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:12px;
                margin-bottom:15px;
            }

            .quiz-timer {
                min-width:86px;
                text-align:center;
                padding:8px 12px;
                border-radius:999px;
                background:var(--surface2);
                color:var(--primary-dark);
                font-weight:900;
            }

            .quiz-timer.warning {
                background:#fff0d6;
                color:#9a6715;
            }

            .quiz-timer.danger {
                background:#ffe1e4;
                color:#a33b44;
            }

            .quiz-option.correct {
                border-color:#2b9d76 !important;
                background:rgba(43,157,118,.09) !important;
            }

            .quiz-option.wrong {
                border-color:#cf5963 !important;
                background:rgba(207,89,99,.09) !important;
            }

        `;


        document.head.appendChild(
            style
        );

    }


    async renderStages() {

        const box =
            document.getElementById(
                "stages"
            );


        if (
            !box
        ) {

            return;

        }


        const category =
            this.quiz.currentCategory ||
            "general";


        box.innerHTML =
            `
            <div class="panel loading">
                در حال بارگذاری سوال‌ها...
            </div>
            `;


        try {

            await this.quiz.loadCategory(
                category
            );


            const subscribed =
                this.hasActiveSubscription();


            const maxStage =
                Math.max(

                    8,

                    ...this.quiz.questions.map(
                        question =>
                            Number(
                                question.stage
                            ) ||
                            1
                    )

                );


            box.innerHTML =
                "";


            for (
                let stage = 1;
                stage <=
                maxStage;
                stage++
            ) {

                const available =
                    stage ===
                        1 ||
                    subscribed;


                const completed =
                    isStageCompleted(
                        this.state,
                        category,
                        stage
                    );


                const questions =
                    this.quiz.getStageQuestions(
                        stage
                    );


                const card =
                    document.createElement(
                        "article"
                    );


                card.className =
                    `stage-card panel ${
                        available
                            ? ""
                            : "locked"
                    } ${
                        completed
                            ? "completed"
                            : ""
                    }`;


                card.innerHTML = `

                    <div class="stage-number">

                        ${stage}

                    </div>

                    <div class="stage-content">

                        <h3>

                            مرحله ${stage}

                            ${
                                completed
                                    ? " ✓"
                                    : available
                                        ? " 🔓"
                                        : " 🔒"
                            }

                        </h3>

                        <p>

                            ${
                                questions.length
                                    ? `${questions.length} سوال در این مرحله`
                                    : "این مرحله سوالی ندارد."
                            }

                        </p>

                    </div>

                `;


                if (
                    available &&
                    questions.length
                ) {

                    card.addEventListener(
                        "click",
                        () =>
                            this.startStage(
                                stage
                            )
                    );

                } else if (
                    !available
                ) {

                    card.addEventListener(
                        "click",
                        () => {

                            this.go(
                                "subscription"
                            );


                            this.toast(
                                "برای باز شدن مراحل بعد از مرحله ۱، اشتراک تأییدشده لازم است."
                            );

                        }
                    );

                }


                box.appendChild(
                    card
                );

            }


            document
                .getElementById(
                    "quizBox"
                )
                ?.classList
                .add(
                    "hidden"
                );


        } catch (
            error
        ) {

            console.error(
                "Quiz loading failed:",
                error
            );


            box.innerHTML =
                `
                <div class="panel error">

                    خطا در بارگذاری سوال‌ها:

                    <br>

                    ${escapeHTML(
                        error.message
                    )}

                </div>
                `;

        }

    }


    async startStage(
        stage
    ) {

        if (
            Number(stage) >
                1 &&
            !this.hasActiveSubscription()
        ) {

            this.go(
                "subscription"
            );


            this.toast(
                "برای مراحل بعد از مرحله ۱، اشتراک تأییدشده لازم است."
            );


            return;

        }


        const category =
            this.quiz.currentCategory;


        const completed =
            isStageCompleted(
                this.state,
                category,
                stage
            );


        if (
            completed
        ) {

            if (
                !confirm(
                    "این مرحله قبلاً تکمیل شده است. دوباره بازی شود؟"
                )
            ) {

                return;

            }

        }


        if (
            !this.quiz.questions.length
        ) {

            await this.quiz.loadCategory(
                category
            );

        }


        const selected =
            this.quiz.startStage(
                category,
                stage,
                completed
            );


        if (
            !selected.length
        ) {

            this.toast(
                "برای این مرحله سؤال قابل استفاده پیدا نشد."
            );


            return;

        }


        this.renderQuestion(
            selected[0]
        );

    }


    renderQuestion(
        question
    ) {

        this.stopTimer();


        const box =
            document.getElementById(
                "quizBox"
            );


        const normalized =
            normalizeQuestionForUI(
                question
            );


        if (
            !box ||
            !normalized ||
            !normalized.question.trim()
        ) {

            return;

        }


        const current =
            this.quiz.currentQuestion +
            1;


        const total =
            this.quiz.getQuestionCount();


        const progress =
            total
                ? Math.round(
                    (
                        current /
                        total
                    ) * 100
                  )
                : 0;


        const letters =
            ["الف","ب","ج","د"];


        box.classList.remove(
            "hidden"
        );


        box.innerHTML = `

            <div class="quiz-card">

                <div class="quiz-question-header">

                    <div>

                        <div class="quiz-top">

                            <span>
                                مرحله ${
                                    this.quiz.currentStage
                                }
                            </span>

                            <span>

                                سوال ${
                                    current
                                }
                                از
                                ${
                                    total
                                }

                            </span>

                        </div>

                    </div>


                    <div
                        id="quizTimer"
                        class="quiz-timer"
                    >

                        ${
                            QUIZ_CONFIG.questionTime
                        }

                        ثانیه

                    </div>

                </div>


                <div class="quiz-progress-wrap">

                    <div
                        class="quiz-progress"
                        style="width:${progress}%"
                    ></div>

                </div>


                <h3 class="quiz-question">

                    ${escapeHTML(
                        normalized.question
                    )}

                </h3>


                <div class="answers quiz-options-grid">

                    ${
                        normalized.options
                            .map(
                                (
                                    option,
                                    index
                                ) => `

                                    <button
                                        type="button"
                                        class="answer quiz-option"
                                        data-answer="${index}"
                                    >

                                        <span class="quiz-option-letter">

                                            ${
                                                letters[index] ||
                                                index + 1
                                            }

                                        </span>

                                        <span>

                                            ${
                                                escapeHTML(
                                                    option
                                                )
                                            }

                                        </span>

                                    </button>

                                `
                            )
                            .join("")
                    }

                </div>


                <div
                    id="quizFeedback"
                    class="quiz-feedback"
                ></div>

            </div>

        `;


        box
            .querySelectorAll(
                "[data-answer]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            this.answerQuestion(
                                Number(
                                    button.dataset.answer
                                )
                            );

                }
            );


        this.startTimer();


        box.scrollIntoView({

            behavior:
                "smooth",

            block:
                "center"

        });

    }


    startTimer() {

        this.stopTimer();


        this.timeLeft =
            Number(
                QUIZ_CONFIG.questionTime
            );


        const timerElement =
            document.getElementById(
                "quizTimer"
            );


        if (
            !timerElement
        ) {

            return;

        }


        this.timerId =
            window.setInterval(
                () => {

                    this.timeLeft--;

                    this.updateTimerDisplay();


                    if (
                        this.timeLeft <=
                        0
                    ) {

                        this.stopTimer();


                        this.answerQuestion(
                            -1,
                            true
                        );

                    }

                },
                1000
            );


        this.updateTimerDisplay();

    }


    stopTimer() {

        if (
            this.timerId
        ) {

            clearInterval(
                this.timerId
            );

            this.timerId =
                null;

        }

    }


    updateTimerDisplay() {

        const timerElement =
            document.getElementById(
                "quizTimer"
            );


        if (
            !timerElement
        ) {

            return;

        }


        timerElement.textContent =
            `${Math.max(
                0,
                this.timeLeft
            )} ثانیه`;


        timerElement.classList.remove(
            "warning",
            "danger"
        );


        if (
            this.timeLeft <=
            5
        ) {

            timerElement.classList.add(
                "danger"
            );

        } else if (
            this.timeLeft <=
            10
        ) {

            timerElement.classList.add(
                "warning"
            );

        }

    }


    answerQuestion(
        index,
        timedOut = false
    ) {

        this.stopTimer();


        const result =
            this.quiz.answer(
                index,
                timedOut
            );


        const box =
            document.getElementById(
                "quizBox"
            );


        if (
            !box
        ) {

            return;

        }


        box
            .querySelectorAll(
                "[data-answer]"
            )
            .forEach(
                button =>
                    button.disabled =
                        true
            );


        const clicked =
            box.querySelector(
                `[data-answer="${index}"]`
            );


        if (
            clicked &&
            !timedOut
        ) {

            clicked.classList.add(

                result.correct
                    ? "correct"
                    : "wrong"

            );

        }


        /*
         * پاسخ صحیح را بعد از جواب نشان می‌دهیم.
         */

        const correctIndex =
            this.quiz
                .selectedQuestions[
                    Math.max(
                        0,
                        this.quiz.currentQuestion -
                        1
                    )
                ]
                ?.answer;


        const correctButton =
            box.querySelector(
                `[data-answer="${correctIndex}"]`
            );


        if (
            correctButton
        ) {

            correctButton.classList.add(
                "correct"
            );

        }


        const feedback =
            document.getElementById(
                "quizFeedback"
            );


        if (
            !feedback
        ) {

            return;

        }


        if (
            timedOut
        ) {

            feedback.innerHTML =
                `
                <div class="error">

                    ⏰ زمان این سؤال تمام شد.

                </div>
                `;

        } else if (
            result.correct
        ) {

            feedback.innerHTML =
                `
                <div class="success">

                    ✓ پاسخ درست بود!

                </div>
                `;

        } else {

            feedback.innerHTML =
                `
                <div class="error">

                    ✗ پاسخ اشتباه بود.

                </div>
                `;

        }


        if (
            result.explanation
        ) {

            feedback.innerHTML +=
                `
                <div class="explanation">

                    ${escapeHTML(
                        result.explanation
                    )}

                </div>
                `;

        }


        if (
            result.finished
        ) {

            feedback.innerHTML +=

                result.passed

                    ? `
                        <div class="result-good">

                            🎉 مرحله را با موفقیت تمام کردی!

                            ${
                                result.earnedXP
                                    ? ` +${result.earnedXP} XP`
                                    : ""
                            }

                        </div>
                      `

                    : `
                        <div class="result-bad">

                            مرحله با موفقیت رد نشد.

                            ${
                                result.heartLost
                                    ? " یک قلب کم شد."
                                    : ""
                            }

                        </div>
                      `;


            feedback.innerHTML +=
                `
                <button
                    id="quizNext"
                    type="button"
                    class="primary full"
                >

                    بازگشت به مراحل

                </button>
                `;


            document
                .getElementById(
                    "quizNext"
                )
                .onclick =
                () => {

                    this.renderStages();

                };


        } else {

            feedback.innerHTML +=
                `
                <button
                    id="quizNext"
                    type="button"
                    class="primary full"
                >

                    سؤال بعدی

                </button>
                `;


            document
                .getElementById(
                    "quizNext"
                )
                .onclick =
                () =>
                    this.renderQuestion(
                        this.quiz.getCurrentQuestion()
                    );

        }


        this.persist();

    }


    /* ======================================================
       SUBSCRIPTION
    ====================================================== */


    initSubscription() {

        document
            .querySelectorAll(
                ".select-plan"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            this.selectPlan(
                                button.dataset.plan
                            )
                    );

                }
            );


        document
            .getElementById(
                "closePayment"
            )
            ?.addEventListener(
                "click",
                () =>
                    document
                        .getElementById(
                            "paymentPanel"
                        )
                        ?.classList.add(
                            "hidden"
                        )
            );


        document
            .getElementById(
                "paymentFile"
            )
            ?.addEventListener(
                "change",
                event => {

                    this.paymentFile =
                        event.target.files?.[0] ||
                        null;


                    document
                        .getElementById(
                            "fileName"
                        )
                        ?.replaceChildren(
                            document.createTextNode(
                                this.paymentFile
                                    ? this.paymentFile.name
                                    : "فایلی انتخاب نشده است"
                            )
                        );

                }
            );


        document
            .getElementById(
                "submitPayment"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.submitPayment()
            );


        /*
         * Premium و هدیه‌های قبلی از نسخه فعلی حذف می‌شوند.
         */

        [
            ".premium-preview",
            ".premium-benefits",
            ".referral-panel",
            ".popular-badge",
            ".premium-crown",
            ".premium-plan"
        ]
            .forEach(
                selector =>
                    document
                        .querySelectorAll(
                            selector
                        )
                        .forEach(
                            element =>
                                element.remove()
                        )
            );


        document
            .querySelector(
                ".discount-row"
            )
            ?.remove();


        document
            .querySelector(
                ".final-price"
            )
            ?.remove();


        document
            .getElementById(
                "discountMessage"
            )
            ?.remove();

    }


    selectPlan(
        id
    ) {

        const plan =
            subscriptionPlans[
                id
            ];


        if (
            !plan
        ) {

            return;

        }


        this.selectedPlan =
            id;


        document
            .getElementById(
                "paymentPanel"
            )
            ?.classList.remove(
                "hidden"
            );


        document
            .getElementById(
                "selectedPlanTitle"
            )
            ?.replaceChildren(
                document.createTextNode(
                    plan.name
                )
            );


        document
            .getElementById(
                "selectedAmount"
            )
            ?.replaceChildren(
                document.createTextNode(
                    money(
                        plan.price
                    )
                )
            );


        document
            .getElementById(
                "accountNumber"
            )
            ?.replaceChildren(
                document.createTextNode(
                    ACCOUNT_NUMBER
                )
            );

    }


    renderPaymentState() {

        if (
            this.selectedPlan
        ) {

            this.selectPlan(
                this.selectedPlan
            );

        }

    }


    async submitPayment() {

        const message =
            document.getElementById(
                "paymentMessage"
            );


        if (
            this.isGuest()
        ) {

            message.textContent =
                "ابتدا وارد حساب شوید.";


            this.go(
                "auth"
            );


            return;

        }


        if (
            !this.selectedPlan
        ) {

            message.textContent =
                "ابتدا یک پلن انتخاب کنید.";

            return;

        }


        if (
            !this.paymentFile
        ) {

            message.textContent =
                "تصویر فیش را انتخاب کنید.";

            return;

        }


        if (
            !this.paymentFile.type.startsWith(
                "image/"
            )
        ) {

            message.textContent =
                "فقط فایل تصویری مجاز است.";

            return;

        }


        if (
            this.paymentFile.size >
            5 * 1024 * 1024
        ) {

            message.textContent =
                "حجم فیش نباید بیشتر از ۵ مگابایت باشد.";

            return;

        }


        message.textContent =
            "در حال ارسال فیش...";


        try {

            const plan =
                subscriptionPlans[
                    this.selectedPlan
                ];


            const base64 =
                await this.fileToBase64(
                    this.paymentFile
                );


            await this.serverWrite({

                action:
                    "payment",

                username:
                    this.state.username,

                phone:
                    this.getRegisteredPhone(),

                plan:
                    this.selectedPlan,

                planName:
                    plan.name,

                amount:
                    plan.price,

                fileName:
                    this.paymentFile.name,

                mimeType:
                    this.paymentFile.type,

                receiptBase64:
                    base64

            });


            message.textContent =
                "فیش برای بررسی ارسال شد.";


            document
                .getElementById(
                    "paymentFile"
                )
                .value =
                "";


            document
                .getElementById(
                    "fileName"
                )
                ?.replaceChildren(
                    document.createTextNode(
                        "فایلی انتخاب نشده است"
                    )
                );


            this.paymentFile =
                null;


            setTimeout(
                () =>
                    this.syncServerUpdates(),
                1800
            );


        } catch (
            error
        ) {

            console.error(
                "payment",
                error
            );


            message.textContent =
                "ارسال فیش ناموفق بود.";

        }

    }


    fileToBase64(
        file
    ) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const reader =
                    new FileReader();


                reader.onload =
                    () =>
                        resolve(
                            String(
                                reader.result
                            )
                                .split(",")[1] ||
                            ""
                        );


                reader.onerror =
                    () =>
                        reject(
                            new Error(
                                "خواندن فیش ناموفق بود."
                            )
                        );


                reader.readAsDataURL(
                    file
                );

            }
        );

    }


    /* ======================================================
       SUPPORT
    ====================================================== */


    initSupport() {

        this.ensureSupportPanel();


        document
            .getElementById(
                "supportSend"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.submitSupport()
            );


        if (
            this.boundSupportEvents
        ) {

            return;

        }


        this.boundSupportEvents =
            true;


        document.addEventListener(
            "click",
            event => {

                const replyButton =
                    event.target.closest(
                        "[data-support-reply]"
                    );


                if (
                    replyButton
                ) {

                    this.sendSupportReply(
                        replyButton.dataset
                            .supportReply
                    );


                    return;

                }


                const closeButton =
                    event.target.closest(
                        "[data-support-close]"
                    );


                if (
                    closeButton
                ) {

                    this.closeSupport(
                        closeButton.dataset
                            .supportClose
                    );


                    return;

                }


                const refresh =
                    event.target.closest(
                        "#refreshUserUpdates"
                    );


                if (
                    refresh
                ) {

                    this.syncServerUpdates();

                }

            }
        );

    }


    ensureSupportPanel() {

        if (
            this.supportPanelReady
        ) {

            return;

        }


        this.supportPanelReady =
            true;


        const support =
            document.getElementById(
                "support"
            );


        if (
            !support
        ) {

            return;

        }


        const panel =
            document.createElement(
                "div"
            );


        panel.id =
            "supportConversationsPanel";


        panel.className =
            "panel user-updates-panel";


        panel.innerHTML = `

            <div class="section-heading">

                <div>

                    <span class="eyebrow">
                        گفتگوهای من
                    </span>

                    <h3>
                        پشتیبانی
                    </h3>

                </div>

                <button
                    id="refreshUserUpdates"
                    type="button"
                    class="secondary"
                >
                    به‌روزرسانی
                </button>

            </div>

            <div id="supportConversationsContent">

                <p class="message">
                    برای مشاهده گفتگوها وارد حساب شوید.
                </p>

            </div>

        `;


        support.appendChild(
            panel
        );

    }


    ensurePaymentStatusPanel() {

        if (
            this.paymentPanelReady
        ) {

            return;

        }


        this.paymentPanelReady =
            true;


        const subscription =
            document.getElementById(
                "subscription"
            );


        if (
            !subscription
        ) {

            return;

        }


        const panel =
            document.createElement(
                "div"
            );


        panel.id =
            "subscriptionPaymentsPanel";


        panel.className =
            "panel user-updates-panel";


        panel.innerHTML = `

            <div class="section-heading">

                <div>

                    <span class="eyebrow">
                        وضعیت پرداخت
                    </span>

                    <h3>
                        پرداخت‌های من
                    </h3>

                </div>

            </div>

            <div
                id="subscriptionPaymentsContent"
            >

                <p class="message">
                    در حال دریافت...
                </p>

            </div>

        `;


        subscription.appendChild(
            panel
        );

    }


    async submitSupport() {

        if (
            this.isGuest()
        ) {

            document
                .getElementById(
                    "supportMsg"
                )
                .textContent =
                "ابتدا وارد حساب شوید.";


            this.go(
                "auth"
            );


            return;

        }


        const subject =
            document
                .getElementById(
                    "supportSubject"
                )
                .value
                .trim();


        const messageText =
            document
                .getElementById(
                    "supportText"
                )
                .value
                .trim();


        const msg =
            document.getElementById(
                "supportMsg"
            );


        if (
            !subject ||
            !messageText
        ) {

            msg.textContent =
                "موضوع و پیام را وارد کنید.";


            return;

        }


        msg.textContent =
            "در حال ارسال...";


        const conversationId =
            window.crypto &&
            crypto.randomUUID

                ? crypto.randomUUID()

                : `conversation-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2)}`;


        try {

            await this.serverWrite({

                action:
                    "support",

                username:
                    this.state.username,

                phone:
                    this.getRegisteredPhone(),

                subject,

                message:
                    messageText,

                conversationId

            });


            document
                .getElementById(
                    "supportSubject"
                )
                .value =
                "";


            document
                .getElementById(
                    "supportText"
                )
                .value =
                "";


            msg.textContent =
                "گفتگو برای شما ثبت شد.";


            setTimeout(
                () =>
                    this.syncServerUpdates(),
                1500
            );


        } catch (
            error
        ) {

            console.error(
                "support",
                error
            );


            msg.textContent =
                "ارسال به سامانه ناموفق بود.";

        }

    }


    async sendSupportReply(
        conversationId
    ) {

        const textarea =
            document.querySelector(
                `[data-support-input="${CSS.escape(
                    conversationId
                )}"]`
            );


        if (
            !textarea ||
            !textarea.value.trim()
        ) {

            return;

        }


        const message =
            textarea.value.trim();


        textarea.disabled =
            true;


        try {

            await this.serverWrite({

                action:
                    "supportUserReply",

                username:
                    this.state.username,

                conversationId,

                message

            });


            textarea.value =
                "";


            setTimeout(
                () =>
                    this.syncServerUpdates(),
                1000
            );


        } catch (
            error
        ) {

            this.toast(
                "ارسال پیام به سامانه ناموفق بود."
            );

        } finally {

            textarea.disabled =
                false;

        }

    }


    async closeSupport(
        conversationId
    ) {

        if (
            !confirm(
                "این گفت‌وگو بسته شود؟"
            )
        ) {

            return;

        }


        try {

            await this.serverWrite({

                action:
                    "closeSupport",

                username:
                    this.state.username,

                conversationId

            });


            setTimeout(
                () =>
                    this.syncServerUpdates(),
                1000
            );


        } catch (
            error
        ) {

            this.toast(
                "بستن گفت‌وگو ناموفق بود."
            );

        }

    }


    /* ======================================================
       CHAT
    ====================================================== */


    initChat() {

        const send =
            () => {

                const input =
                    document.getElementById(
                        "chatInput"
                    );


                const text =
                    input?.value.trim();


                if (
                    !text
                ) {

                    return;

                }


                const messages =
                    JSON.parse(
                        localStorage.getItem(
                            "quizduo_chat"
                        ) ||
                        "[]"
                    );


                messages.push({

                    username:
                        this.state.username,

                    text,

                    time:
                        Date.now()

                });


                localStorage.setItem(

                    "quizduo_chat",

                    JSON.stringify(
                        messages
                    )

                );


                input.value =
                    "";


                this.renderChat();

            };


        document
            .getElementById(
                "sendChat"
            )
            ?.addEventListener(
                "click",
                send
            );


        document
            .getElementById(
                "chatInput"
            )
            ?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        send();

                    }

                }
            );


        this.renderChat();

    }


    renderChat() {

        const box =
            document.getElementById(
                "messages"
            );


        if (
            !box
        ) {

            return;

        }


        const messages =
            JSON.parse(
                localStorage.getItem(
                    "quizduo_chat"
                ) ||
                "[]"
            );


        box.innerHTML =
            messages.length

                ? messages
                    .map(
                        item =>
                            `
                            <div class="chat-message">

                                <b>
                                    ${escapeHTML(
                                        item.username
                                    )}
                                </b>

                                <p>
                                    ${escapeHTML(
                                        item.text
                                    )}
                                </p>

                            </div>
                            `
                    )
                    .join("")

                : `
                    <p class="muted">
                        هنوز پیامی وجود ندارد.
                    </p>
                  `;

    }


    /* ======================================================
       SERVER READ
    ====================================================== */


    async serverGet(
        action
    ) {

        if (
            this.isGuest() &&
            action ===
                "userUpdates"
        ) {

            return {

                success:
                    true,

                payments:
                    [],

                support:
                    [],

                subscription: {

                    active:
                        false

                }

            };

        }


        return new Promise(
            (
                resolve,
                reject
            ) => {

                const callbackName =
                    `quizduo_${Date.now()}_${Math.random()
                        .toString(36)
                        .slice(2)}`;


                const script =
                    document.createElement(
                        "script"
                    );


                const params =
                    new URLSearchParams({

                        action,

                        username:
                            this.state.username,

                        callback:
                            callbackName

                    });


                let finished =
                    false;


                const cleanup =
                    () => {

                        if (
                            finished
                        ) {

                            return;

                        }


                        finished =
                            true;


                        clearTimeout(
                            timer
                        );


                        try {

                            delete window[
                                callbackName
                            ];

                        } catch (_) {}


                        script.remove();

                    };


                const timer =
                    setTimeout(
                        () => {

                            cleanup();


                            reject(
                                new Error(
                                    "اتصال به سامانه برقرار نشد."
                                )
                            );

                        },
                        15000
                    );


                window[
                    callbackName
                ] =
                    data => {

                        cleanup();


                        if (
                            data &&
                            data.success ===
                                false
                        ) {

                            reject(
                                new Error(
                                    data.message ||
                                    "دریافت اطلاعات ناموفق بود."
                                )
                            );


                            return;

                        }


                        resolve(
                            data
                        );

                    };


                script.onerror =
                    () => {

                        cleanup();


                        reject(
                            new Error(
                                "اتصال به سامانه برقرار نشد."
                            )
                        );

                    };


                script.src =
                    `${API_URL}?${params.toString()}`;


                document.body.appendChild(
                    script
                );

            }
        );

    }


    /* ======================================================
       SERVER WRITE
    ====================================================== */


    serverWrite(
        payload
    ) {

        /*
         * به جای fetch مستقیم، از یک فرم مخفی استفاده می‌کنیم.
         *
         * فرم Cross-Origin تحت قوانین CORS برای navigation
         * محدودیت fetch را ندارد و Google Apps Script
         * می‌تواند آن را با doPost دریافت کند.
         */

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const iframeName =
                    `quizduo_post_${Date.now()}_${Math.random()
                        .toString(36)
                        .slice(2)}`;


                const iframe =
                    document.createElement(
                        "iframe"
                    );


                iframe.name =
                    iframeName;


                iframe.style.display =
                    "none";


                document.body.appendChild(
                    iframe
                );


                const form =
                    document.createElement(
                        "form"
                    );


                form.method =
                    "POST";


                form.action =
                    API_URL;


                form.target =
                    iframeName;


                form.style.display =
                    "none";


                const field =
                    document.createElement(
                        "input"
                    );


                field.type =
                    "hidden";


                field.name =
                    "payload";


                field.value =
                    JSON.stringify(
                        payload
                    );


                form.appendChild(
                    field
                );


                document.body.appendChild(
                    form
                );


                let done =
                    false;


                const cleanup =
                    () => {

                        if (
                            done
                        ) {

                            return;

                        }


                        done =
                            true;


                        iframe.remove();

                        form.remove();

                    };


                /*
                 * Apps Script ممکن است ابتدا کمی زمان برای
                 * ذخیره اطلاعات نیاز داشته باشد.
                 */

                const timer =
                    setTimeout(
                        () => {

                            cleanup();

                            resolve({
                                success:
                                    true
                            });

                        },
                        1400
                    );


                iframe.onload =
                    () => {

                        /*
                         * load فقط یعنی درخواست navigation
                         * انجام شده است.
                         */

                        clearTimeout(
                            timer
                        );


                        setTimeout(
                            () => {

                                cleanup();


                                resolve({

                                    success:
                                        true

                                });

                            },
                            300
                        );

                    };


                iframe.onerror =
                    () => {

                        clearTimeout(
                            timer
                        );


                        cleanup();


                        reject(
                            new Error(
                                "ارسال به سامانه ناموفق بود."
                            )
                        );

                    };


                try {

                    form.submit();

                } catch (
                    error
                ) {

                    clearTimeout(
                        timer
                    );


                    cleanup();


                    reject(
                        error
                    );

                }

            }
        );

    }


    /* ======================================================
       SERVER SYNC
    ====================================================== */


    async syncServerUpdates() {

        if (
            !this.isGuest()
        ) {

            try {

                const data =
                    await this.serverGet(
                        "userUpdates"
                    );


                this.lastServerUpdates = {

                    payments:
                        Array.isArray(
                            data.payments
                        )
                            ? data.payments
                            : [],

                    support:
                        Array.isArray(
                            data.support
                        )
                            ? data.support
                            : []

                };


                this.state.subscriptionInfo =
                    data.subscription ||
                    {
                        active:
                            false
                    };


                this.state.subscriptionStatus =
                    this.state
                        .subscriptionInfo
                        .active

                        ? "active"

                        : "inactive";


                this.state.subscription =
                    this.state
                        .subscriptionInfo
                        .active

                        ? "paid"

                        : "free";


                this.persist();


            } catch (
                error
            ) {

                console.error(
                    "Server sync failed:",
                    error
                );

            }

        }


        this.renderServerUpdates();


        if (
            document
                .getElementById(
                    "leaderboard"
                )
                ?.classList
                .contains(
                    "active"
                )
        ) {

            this.renderLeaderboard();

        }

    }


    /* ======================================================
       LEADERBOARD
    ====================================================== */


    async renderLeaderboard() {

        const body =
            document.getElementById(
                "leaderBody"
            );


        if (
            !body
        ) {

            return;

        }


        if (
            this.leaderboardLoading
        ) {

            return;

        }


        this.leaderboardLoading =
            true;


        body.innerHTML =
            `
            <tr>
                <td colspan="4">
                    در حال دریافت لیدربورد...
                </td>
            </tr>
            `;


        try {

            const data =
                await this.serverGet(
                    "leaderboard"
                );


            this.serverLeaderboard =
                Array.isArray(
                    data.users
                )
                    ? data.users
                    : [];


            if (
                !this.serverLeaderboard.length
            ) {

                body.innerHTML =
                    `
                    <tr>
                        <td colspan="4">
                            هنوز کاربری در لیدربورد ثبت نشده است.
                        </td>
                    </tr>
                    `;


                return;

            }


            body.innerHTML =
                this.serverLeaderboard
                    .map(
                        (
                            item,
                            index
                        ) =>
                            `

                            <tr>

                                <td>

                                    ${
                                        index + 1
                                    }

                                </td>

                                <td>

                                    ${escapeHTML(
                                        item.username ||
                                        "بازیکن"
                                    )}

                                </td>

                                <td>

                                    ${
                                        Number(
                                            item.xp ||
                                            0
                                        )
                                            .toLocaleString(
                                                "fa-IR"
                                            )
                                    }

                                </td>

                                <td>

                                    ${
                                        Math.max(
                                            Number(
                                                item.generalStage ||
                                                1
                                            ),
                                            Number(
                                                item.funStage ||
                                                1
                                            )
                                        ) - 1
                                    }

                                </td>

                            </tr>

                            `
                    )
                    .join("");


        } catch (
            error
        ) {

            console.error(
                "Leaderboard error:",
                error
            );


            body.innerHTML =
                `
                <tr>
                    <td colspan="4">
                        دریافت لیدربورد ناموفق بود.
                    </td>
                </tr>
                `;

        } finally {

            this.leaderboardLoading =
                false;

        }

    }


    /* ======================================================
       SERVER UI
    ====================================================== */


    renderServerUpdates() {

        this.ensureSupportPanel();

        this.ensurePaymentStatusPanel();


        const paymentBox =
            document.getElementById(
                "subscriptionPaymentsContent"
            );


        const supportBox =
            document.getElementById(
                "supportConversationsContent"
            );


        if (
            paymentBox
        ) {

            const payments =
                this.lastServerUpdates
                    .payments || [];


            if (
                this.isGuest()
            ) {

                paymentBox.innerHTML =
                    `
                    <p class="message">
                        برای مشاهده پرداخت‌ها وارد حساب شوید.
                    </p>
                    `;

            } else if (
                !payments.length
            ) {

                paymentBox.innerHTML =
                    `
                    <p class="message">
                        هنوز فیشی ثبت نشده است.
                    </p>
                    `;

            } else {

                paymentBox.innerHTML =
                    payments
                        .map(
                            payment =>
                                `

                                <div class="user-update-card">

                                    <div class="section-heading">

                                        <strong>

                                            ${escapeHTML(
                                                payment.planName ||
                                                this.planName(
                                                    payment.planId
                                                )
                                            )}

                                        </strong>

                                        <span class="status-badge">

                                            ${escapeHTML(
                                                payment.status ||
                                                "در انتظار بررسی"
                                            )}

                                        </span>

                                    </div>

                                    <div class="muted">

                                        ${
                                            money(
                                                payment.amount
                                            )
                                        }

                                        ·

                                        ${
                                            escapeHTML(
                                                this.formatDate(
                                                    payment.timestamp
                                                )
                                            )
                                        }

                                    </div>

                                    ${
                                        payment.userMessage

                                            ? `
                                                <p>
                                                    ${escapeHTML(
                                                        payment.userMessage
                                                    )}
                                                </p>
                                              `

                                            : ""
                                    }

                                </div>

                                `
                        )
                        .join("");

            }

        }


        if (
            supportBox
        ) {

            const support =
                this.lastServerUpdates
                    .support || [];


            if (
                this.isGuest()
            ) {

                supportBox.innerHTML =
                    `
                    <p class="message">
                        برای مشاهده گفتگوها وارد حساب شوید.
                    </p>
                    `;

            } else if (
                !support.length
            ) {

                supportBox.innerHTML =
                    `
                    <p class="message">
                        هنوز گفتگویی ندارید.
                    </p>
                    `;

            } else {

                supportBox.innerHTML =
                    support
                        .map(
                            conversation => {

                                const thread =
                                    (
                                        conversation.thread ||
                                        []
                                    )
                                        .map(
                                            item =>
                                                `
                                                <div class="support-message ${
                                                    item.sender ===
                                                    "admin"
                                                        ? "admin-message"
                                                        : "user-message"
                                                }">

                                                    <div class="support-message-author">

                                                        ${
                                                            item.sender ===
                                                            "admin"

                                                                ? "پشتیبانی QuizDuo"

                                                                : "شما"
                                                        }

                                                    </div>

                                                    <div class="support-message-text">

                                                        ${escapeHTML(
                                                            item.text ||
                                                            ""
                                                        )}

                                                    </div>

                                                    <small>

                                                        ${escapeHTML(
                                                            this.formatDate(
                                                                item.timestamp
                                                            )
                                                        )}

                                                    </small>

                                                </div>

                                                `
                                        )
                                        .join("");


                                const closed =
                                    conversation.status ===
                                    "بسته شد";


                                return `

                                    <div class="user-update-card">

                                        <div class="section-heading">

                                            <div>

                                                <span class="eyebrow">
                                                    گفتگو
                                                </span>

                                                <h3>

                                                    ${escapeHTML(
                                                        conversation.subject ||
                                                        "بدون موضوع"
                                                    )}

                                                </h3>

                                            </div>

                                            <span class="status-badge">

                                                ${escapeHTML(
                                                    conversation.status ||
                                                    "جدید"
                                                )}

                                            </span>

                                        </div>


                                        <div class="support-thread">

                                            ${thread}

                                        </div>


                                        ${
                                            closed

                                                ? `
                                                    <p class="muted">
                                                        این گفتگو بسته شده است.
                                                    </p>
                                                  `

                                                : `

                                                    <div class="support-reply-box">

                                                        <textarea
                                                            data-support-input="${escapeHTML(
                                                                conversation.conversationId
                                                            )}"
                                                            placeholder="پیام بعدی را در همین گفتگو بنویسید..."
                                                        ></textarea>

                                                        <div class="support-actions">

                                                            <button
                                                                type="button"
                                                                class="primary"
                                                                data-support-reply="${escapeHTML(
                                                                    conversation.conversationId
                                                                )}"
                                                            >
                                                                ارسال پیام
                                                            </button>

                                                            <button
                                                                type="button"
                                                                class="secondary"
                                                                data-support-close="${escapeHTML(
                                                                    conversation.conversationId
                                                                )}"
                                                            >
                                                                اتمام گفتگو
                                                            </button>

                                                        </div>

                                                    </div>

                                                  `
                                        }

                                    </div>

                                `;

                            }
                        )
                        .join("");

            }

        }

    }


    planName(
        id
    ) {

        return (
            subscriptionPlans[
                id
            ]?.name ||
            "اشتراک"
        );

    }


    hasActiveSubscription() {

        const info =
            this.state
                .subscriptionInfo ||
            {};


        if (
            info.active !==
            true
        ) {

            return false;

        }


        const expiry =
            new Date(
                info.expiry ||
                0
            )
                .getTime();


        return (
            Number.isFinite(
                expiry
            ) &&
            expiry >
                Date.now()
        );

    }


    /* ======================================================
       PROFILE
    ====================================================== */


    renderProfile() {

        const name =
            this.state.username ||
            "بازیکن مهمان";


        document
            .getElementById(
                "dashboardName"
            )
            ?.replaceChildren(
                document.createTextNode(
                    name
                )
            );


        document
            .getElementById(
                "dashboardXP"
            )
            ?.replaceChildren(
                document.createTextNode(
                    Number(
                        this.state.xp ||
                        0
                    )
                        .toLocaleString(
                            "fa-IR"
                        )
                )
            );


        document
            .getElementById(
                "dashboardHearts"
            )
            ?.replaceChildren(
                document.createTextNode(
                    Number(
                        this.state.hearts ??
                        5
                    )
                        .toLocaleString(
                            "fa-IR"
                        )
                )
            );


        document
            .getElementById(
                "dashboardStreak"
            )
            ?.replaceChildren(
                document.createTextNode(
                    Number(
                        this.state.streak ||
                        0
                    )
                        .toLocaleString(
                            "fa-IR"
                        )
                )
            );


        document
            .getElementById(
                "dashboardGeneralStage"
            )
            ?.replaceChildren(
                document.createTextNode(
                    String(
                        this.state.generalStage ||
                        1
                    )
                )
            );


        document
            .getElementById(
                "dashboardFunStage"
            )
            ?.replaceChildren(
                document.createTextNode(
                    String(
                        this.state.funStage ||
                        1
                    )
                )
            );


        const active =
            this.hasActiveSubscription();


        document
            .getElementById(
                "dashboardAccessBadge"
            )
            ?.replaceChildren(
                document.createTextNode(
                    active
                        ? "🔓 همه مراحل باز"
                        : "🔒 فقط ۱ مرحله رایگان"
                )
            );


        document
            .getElementById(
                "dashboardSubscription"
            )
            ?.replaceChildren(
                document.createTextNode(
                    active
                        ? "اشتراک فعال"
                        : "رایگان — مرحله ۱"
                )
            );


        document
            .getElementById(
                "dashboardSubscriptionTitle"
            )
            ?.replaceChildren(
                document.createTextNode(
                    active
                        ? "اشتراک فعال"
                        : "اشتراک و دسترسی مراحل"
                )
            );


        document
            .getElementById(
                "dashboardSubscriptionText"
            )
            ?.replaceChildren(
                document.createTextNode(
                    active
                        ? "مراحل بعدی برای حساب شما باز هستند."
                        : "حساب رایگان: فقط مرحله ۱ باز است."
                )
            );


        document
            .getElementById(
                "subscriptionStatus"
            )
            ?.replaceChildren(
                document.createTextNode(
                    active
                        ? "اشتراکی"
                        : "رایگان"
                )
            );


        this.updateAuthButton();

    }


    renderQuizStats() {

        document
            .getElementById(
                "quizStats"
            )
            ?.replaceChildren(
                document.createTextNode(

                    `⭐ ${
                        Number(
                            this.state.xp ||
                            0
                        )
                            .toLocaleString(
                                "fa-IR"
                            )
                    }
                    •
                    ❤️ ${
                        Number(
                            this.state.hearts ??
                            5
                        )
                            .toLocaleString(
                                "fa-IR"
                            )
                    }`

                )
            );

    }


    /* ======================================================
       LEADERBOARD / LOCAL
    ====================================================== */


    logout() {

        localStorage.removeItem(
            "quizduo_current_user"
        );


        location.reload();

    }

}


const app =
    new App();


document.addEventListener(
    "DOMContentLoaded",
    () => {

        app.init();


        window.QuizDuo = {

            state:
                app.state,

            navigate:
                page =>
                    app.go(
                        page
                    ),

            showPage:
                page =>
                    app.go(
                        page
                    ),

            startStage:
                stage =>
                    app.startStage(
                        stage
                    ),

            selectPlan:
                plan =>
                    app.selectPlan(
                        plan
                    ),

            syncUser:
                () =>
                    app.syncServerUpdates(),

            isSubscriptionActive:
                () =>
                    app.hasActiveSubscription(),

            logout:
                () =>
                    app.logout()

        };

    }
);
