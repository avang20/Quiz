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
    QuizEngine
} from "./quiz.js";


const APPS_SCRIPT_URL =
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
    Number(value || 0)
        .toLocaleString("fa-IR") +
    " تومان";


function normalizeQuestionForUI(question) {

    if (!question) {
        return null;
    }

    const text =
        question.question ??
        question.q ??
        question.text ??
        question.title ??
        question.prompt ??
        "";

    let options =
        question.options ??
        question.choices ??
        question.answers ??
        question.o ??
        [];

    if (!Array.isArray(options)) {

        options =
            options &&
            typeof options === "object"
                ? Object.values(options)
                : [];
    }

    options =
        options.map(option => {

            if (
                option &&
                typeof option === "object"
            ) {

                return (
                    option.text ??
                    option.label ??
                    option.value ??
                    option.answer ??
                    ""
                );
            }

            return option;
        });

    return {
        ...question,
        question: String(text),
        options
    };
}


class App {

    constructor() {

        const defaultState =
            createDefaultState();

        const username =
            getCurrentUser() ||
            "guest";

        this.state =
            loadState(
                defaultState,
                username
            );

        this.state.username =
            username === "guest"
                ? "بازیکن مهمان"
                : username;

        this.quiz =
            new QuizEngine(
                this.state,
                () => this.persist()
            );

        this.authRegister =
            false;

        this.selectedPlan =
            null;

        this.paymentFile =
            null;

        this.lastServerUpdates = {
            payments: [],
            support: []
        };

        this.serverSyncTimer =
            null;

        this._toastTimer =
            null;
    }


    persist() {

        saveState(
            this.state,

            this.state.username ===
            "بازیکن مهمان"
                ? "guest"
                : this.state.username
        );

        if (
            this.state.username !==
            "بازیکن مهمان"
        ) {

            updateLeaderboard(
                this.state
            );
        }

        this.renderProfile();

        this.renderQuizStats();
    }


    init() {

        document
            .querySelectorAll(
                "[data-page]"
            )
            .forEach(element => {

                element.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        this.go(
                            element.dataset.page
                        );
                    }
                );
            });


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
                () => {

                    if (
                        this.state.username ===
                        "بازیکن مهمان"
                    ) {

                        this.go("auth");

                    } else {

                        this.go("profile");

                    }

                }
            );


        this.initAuth();

        this.initQuiz();

        this.initSubscription();

        this.initChat();

        this.initSupport();

        this.loadTheme();

        this.renderProfile();

        this.renderQuizStats();

        this.ensureUserPanels();

        this.go("home");

        this.syncServerUpdates();


        this.serverSyncTimer =
            window.setInterval(
                () =>
                    this.syncServerUpdates(),
                20000
            );
    }


    go(page) {

        document
            .querySelectorAll(
                ".page"
            )
            .forEach(p =>
                p.classList.remove(
                    "active"
                )
            );


        const target =
            document.getElementById(
                page
            );


        if (target) {

            target.classList.add(
                "active"
            );

        }


        if (page === "quiz") {

            this.renderStages();

        }


        if (page === "leaderboard") {

            this.renderLeaderboard();

        }


        if (page === "profile") {

            this.renderProfile();

        }


        if (page === "subscription") {

            this.ensureUserPanels();

            this.renderPaymentState();

            this.syncServerUpdates();

        }


        if (page === "support") {

            this.ensureUserPanels();

            this.syncServerUpdates();

        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    toggleTheme() {

        document.body
            .classList
            .toggle("dark");


        const theme =
            document.body.classList.contains(
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


    loadTheme() {

        const theme =
            this.state.theme ||
            localStorage.getItem(
                "quizduo_theme"
            ) ||
            "light";


        document.body
            .classList
            .toggle(
                "dark",
                theme === "dark"
            );
    }


    /* ======================================================
       AUTH
    ====================================================== */

    initAuth() {

        const toggle =
            document.getElementById(
                "toggleAuth"
            );

        const submit =
            document.getElementById(
                "authSubmit"
            );

        const back =
            document.getElementById(
                "authBack"
            );


        toggle?.addEventListener(
            "click",
            () =>
                this.toggleAuthMode()
        );


        submit?.addEventListener(
            "click",
            () =>
                this.submitAuth()
        );


        back?.addEventListener(
            "click",
            () =>
                this.go("home")
        );
    }


    toggleAuthMode() {

        this.authRegister =
            !this.authRegister;


        const title =
            document.getElementById(
                "authTitle"
            );

        const submit =
            document.getElementById(
                "authSubmit"
            );

        const toggle =
            document.getElementById(
                "toggleAuth"
            );

        const phoneField =
            document.getElementById(
                "phoneField"
            );


        if (title) {

            title.textContent =
                this.authRegister
                    ? "ساخت حساب جدید"
                    : "ورود";
        }


        if (submit) {

            submit.textContent =
                this.authRegister
                    ? "ثبت‌نام"
                    : "ورود";
        }


        if (toggle) {

            toggle.textContent =
                this.authRegister
                    ? "ورود به حساب"
                    : "ساخت حساب جدید";
        }


        phoneField?.classList.toggle(
            "hidden",
            !this.authRegister
        );


        const msg =
            document.getElementById(
                "authMsg"
            );

        if (msg) {
            msg.textContent = "";
        }
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


        const msg =
            document.getElementById(
                "authMsg"
            );


        if (
            name.length < 2 ||
            password.length < 4
        ) {

            msg.textContent =
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


        if (this.authRegister) {

            if (existing) {

                msg.textContent =
                    "این نام کاربری قبلاً استفاده شده است.";

                return;
            }


            if (
                !/^09\d{9}$/.test(phone)
            ) {

                msg.textContent =
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


            saveUsers(users);

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

            msg.textContent =
                "حساب با موفقیت ساخته شد.";

        } else {

            if (
                !existing ||
                existing.password !==
                password
            ) {

                msg.textContent =
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

            msg.textContent =
                "ورود موفق بود.";
        }


        this.updateAuthButton();


        setTimeout(
            () =>
                this.go("home"),
            450
        );
    }


    updateAuthButton() {

        const button =
            document.getElementById(
                "authButton"
            );


        if (!button) {
            return;
        }


        button.textContent =
            this.state.username ===
            "بازیکن مهمان"

                ? "ورود / ثبت‌نام"

                : "پروفایل";
    }


    /* ======================================================
       QUIZ
    ====================================================== */

    initQuiz() {

        document
            .querySelectorAll(
                "[data-category-tab]"
            )
            .forEach(button => {

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
                            button.dataset.categoryTab;


                        this.renderStages();
                    }
                );
            });
    }


    async renderStages() {

        const box =
            document.getElementById(
                "stages"
            );


        if (!box) {
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


            const subscriptionActive =
                this.hasActiveSubscription();


            const maxStage =
                Math.max(
                    1,
                    ...this.quiz.questions.map(
                        question =>
                            Number(
                                question.stage
                            ) || 1
                    )
                );


            box.innerHTML = "";


            for (
                let stage = 1;
                stage <= maxStage;
                stage++
            ) {

                /*
                 * مرحله ۱ همیشه رایگان و باز است.
                 * مراحل بعدی فقط با اشتراک تأییدشده باز هستند.
                 */
                const available =
                    stage === 1 ||
                    subscriptionActive;


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

                    <div>

                        <h3>

                            مرحله ${stage}

                            ${
                                completed
                                    ? "✓"
                                    : available
                                        ? "🔓"
                                        : "🔒"
                            }

                        </h3>

                        <p>

                            ${
                                questions.length
                                    ? `${questions.length} سوال`
                                    : "این مرحله هنوز سوالی ندارد."
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

                } else if (!available) {

                    card.addEventListener(
                        "click",
                        () => {

                            this.go(
                                "subscription"
                            );

                            this.showToast(
                                "برای باز شدن این مرحله، اشتراک تأییدشده لازم است."
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
                ?.classList.add(
                    "hidden"
                );


        } catch (error) {

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


    async startStage(stage) {

        const category =
            this.quiz.currentCategory ||
            "general";


        if (
            Number(stage) > 1 &&
            !this.hasActiveSubscription()
        ) {

            this.go(
                "subscription"
            );


            this.showToast(
                "برای مراحل بعد از مرحله ۱، اشتراک تأییدشده لازم است."
            );


            return;
        }


        const completed =
            isStageCompleted(
                this.state,
                category,
                stage
            );


        if (completed) {

            const replay =
                confirm(
                    "شما قبلاً امتیاز این مرحله را کسب کرده‌اید. آیا مایلید دوباره این مرحله را بازی کنید؟\n\nبازی کردن دوباره امتیاز و قلب جدیدی اضافه نمی‌کند."
                );


            if (!replay) {
                return;
            }
        }


        if (
            !this.quiz.questions.length ||
            this.quiz.currentCategory !==
            category
        ) {

            await this.quiz.loadCategory(
                category
            );
        }


        const questions =
            this.quiz.startStage(
                category,
                stage,
                completed
            );


        if (
            !questions ||
            !questions.length
        ) {

            this.showToast(
                "برای این مرحله سوال قابل استفاده پیدا نشد."
            );

            return;
        }


        this.renderQuestion(
            questions[0]
        );
    }


    renderQuestion(question) {

        const box =
            document.getElementById(
                "quizBox"
            );


        const normalized =
            normalizeQuestionForUI(
                question
            );


        if (
            !normalized ||
            !normalized.question.trim()
        ) {

            box.innerHTML =
                "<p>برای این مرحله سوال معتبری پیدا نشد.</p>";

            box.classList.remove(
                "hidden"
            );

            return;
        }


        const options =
            normalized.options.filter(
                option =>
                    option !== null &&
                    option !== undefined &&
                    String(
                        option
                    ).trim() !== ""
            );


        box.classList.remove(
            "hidden"
        );


        box.innerHTML = `

            <div class="quiz-card">

                <div class="quiz-top">

                    <span>
                        مرحله ${this.quiz.currentStage}
                    </span>

                    <span>
                        سوال ${
                            this.quiz.currentQuestion + 1
                        }
                        از
                        ${this.quiz.getQuestionCount()}
                    </span>

                </div>


                <div class="quiz-progress-wrap">

                    <div
                        class="quiz-progress"
                        style="width:${
                            this.quiz.getQuestionCount()
                                ? (
                                    (
                                        this.quiz.currentQuestion + 1
                                    ) /
                                    this.quiz.getQuestionCount()
                                ) * 100
                                : 0
                        }%"
                    ></div>

                </div>


                <h3 class="quiz-question">

                    ${escapeHTML(
                        normalized.question
                    )}

                </h3>


                <div class="quiz-options-grid">

                    ${
                        options
                            .map(
                                (option, index) => `

                                    <button
                                        type="button"
                                        class="quiz-option"
                                        data-i="${index}"
                                    >

                                        <span class="quiz-option-letter">

                                            ${String.fromCharCode(
                                                65 + index
                                            )}

                                        </span>

                                        <span>

                                            ${escapeHTML(
                                                String(option)
                                            )}

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
                ".quiz-option"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () =>
                        this.answer(
                            Number(
                                button.dataset.i
                            )
                        )
                );

            });


        box.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }


    answer(index) {

        const result =
            this.quiz.answer(
                index
            );


        const box =
            document.getElementById(
                "quizBox"
            );


        box
            .querySelectorAll(
                ".quiz-option"
            )
            .forEach(
                button =>
                    button.disabled =
                        true
            );


        const clicked =
            box.querySelector(
                `.quiz-option[data-i="${index}"]`
            );


        if (clicked) {

            clicked.classList.add(
                result.correct
                    ? "correct"
                    : "wrong"
            );
        }


        const feedback =
            document.getElementById(
                "quizFeedback"
            );


        if (!feedback) {
            return;
        }


        feedback.innerHTML =
            result.correct

                ? `
                    <div class="success">
                        ✓ پاسخ درست بود!
                    </div>
                  `

                : `
                    <div class="error">
                        ✗ پاسخ درست نبود.
                    </div>
                  `;


        if (result.explanation) {

            feedback.innerHTML +=
                `
                <div class="explanation">

                    ${escapeHTML(
                        result.explanation
                    )}

                </div>
                `;
        }


        if (result.finished) {

            feedback.innerHTML +=

                result.passed

                    ? `
                        <div class="result-good">

                            🎉 مرحله را با موفقیت تمام کردی!

                            ${
                                result.earnedXP
                                    ? `+${result.earnedXP} XP`
                                    : ""
                            }

                        </div>
                      `

                    : `
                        <div class="result-bad">

                            این مرحله را رد نکردی.

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
                    class="primary full"
                    type="button"
                >
                    ادامه
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
                    class="primary full"
                    type="button"
                >
                    سوال بعدی
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


        this.renderQuizStats();

        this.renderProfile();
    }


    renderQuizStats() {

        const element =
            document.getElementById(
                "quizStats"
            );


        if (!element) {
            return;
        }


        const hearts =
            Number(
                this.state.hearts ?? 5
            );


        const xp =
            Number(
                this.state.xp ?? 0
            );


        element.textContent =
            `❤️ ${
                hearts
            }  •  ⭐ ${
                xp.toLocaleString("fa-IR")
            } XP`;
    }


    /* ======================================================
       PROFILE
    ====================================================== */

    renderProfile() {

        const s =
            this.state;


        const name =
            document.getElementById(
                "dashboardName"
            );


        if (name) {

            name.textContent =
                s.username ||
                "بازیکن مهمان";
        }


        const dashboardXP =
            document.getElementById(
                "dashboardXP"
            );


        if (dashboardXP) {

            dashboardXP.textContent =
                Number(
                    s.xp || 0
                )
                    .toLocaleString(
                        "fa-IR"
                    );
        }


        const hearts =
            document.getElementById(
                "dashboardHearts"
            );


        if (hearts) {

            hearts.textContent =
                Number(
                    s.hearts ?? 5
                )
                    .toLocaleString(
                        "fa-IR"
                    );
        }


        const streak =
            document.getElementById(
                "dashboardStreak"
            );


        if (streak) {

            streak.textContent =
                Number(
                    s.streak || 0
                )
                    .toLocaleString(
                        "fa-IR"
                    );
        }


        const generalStage =
            document.getElementById(
                "dashboardGeneralStage"
            );


        if (generalStage) {

            generalStage.textContent =
                Math.max(
                    1,
                    Number(
                        s.generalStage || 1
                    )
                );
        }


        const funStage =
            document.getElementById(
                "dashboardFunStage"
            );


        if (funStage) {

            funStage.textContent =
                Math.max(
                    1,
                    Number(
                        s.funStage || 1
                    )
                );
        }


        const activeSubscription =
            this.hasActiveSubscription();


        const accessBadge =
            document.getElementById(
                "dashboardAccessBadge"
            );


        if (accessBadge) {

            accessBadge.textContent =
                activeSubscription
                    ? "🔓 همه مراحل باز"
                    : "🔒 فقط مرحله ۱ رایگان";
        }


        const dashboardSubscription =
            document.getElementById(
                "dashboardSubscription"
            );


        if (dashboardSubscription) {

            dashboardSubscription.textContent =
                activeSubscription
                    ? "اشتراک فعال"
                    : "رایگان — مرحله ۱";
        }


        const dashboardTitle =
            document.getElementById(
                "dashboardSubscriptionTitle"
            );


        const dashboardText =
            document.getElementById(
                "dashboardSubscriptionText"
            );


        if (activeSubscription) {

            dashboardTitle &&
                (
                    dashboardTitle.textContent =
                        "اشتراک فعال"
                );


            dashboardText &&
                (
                    dashboardText.textContent =
                        "مراحل بعدی برای این حساب باز هستند."
                );

        } else {

            dashboardTitle &&
                (
                    dashboardTitle.textContent =
                        "اشتراک و دسترسی مراحل"
                );


            dashboardText &&
                (
                    dashboardText.textContent =
                        "حساب رایگان: فقط مرحله ۱ باز است."
                );
        }


        const profileName =
            document.getElementById(
                "profileName"
            );


        if (profileName) {

            profileName.textContent =
                s.username ||
                "بازیکن مهمان";
        }


        const profileScore =
            document.getElementById(
                "profileScore"
            );


        if (profileScore) {

            profileScore.textContent =
                Number(
                    s.xp || 0
                );
        }


        const profileStreak =
            document.getElementById(
                "profileStreak"
            );


        if (profileStreak) {

            profileStreak.textContent =
                Number(
                    s.streak || 0
                );
        }


        const profileStage =
            document.getElementById(
                "profileStage"
            );


        if (profileStage) {

            profileStage.textContent =
                Math.max(
                    0,
                    Number(
                        s.generalStage || 1
                    ) - 1
                );
        }


        const status =
            activeSubscription
                ? "اشتراکی"
                : "رایگان";


        const subscriptionStatus =
            document.getElementById(
                "subscriptionStatus"
            );


        if (subscriptionStatus) {

            subscriptionStatus.textContent =
                status;
        }


        this.updateAuthButton();
    }


    /* ======================================================
       LEADERBOARD
    ====================================================== */

    renderLeaderboard() {

        const body =
            document.getElementById(
                "leaderBody"
            );


        if (!body) {
            return;
        }


        const board =
            getLeaderboard();


        if (!board.length) {

            body.innerHTML =
                `
                <tr>
                    <td colspan="4">
                        هنوز بازیکنی ثبت نشده است.
                    </td>
                </tr>
                `;

            return;
        }


        body.innerHTML =
            board
                .map(
                    (item, index) => `

                        <tr>

                            <td>
                                ${
                                    Number(
                                        index + 1
                                    )
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
                                        item.xp || 0
                                    )
                                        .toLocaleString(
                                            "fa-IR"
                                        )
                                }
                            </td>

                            <td>
                                ${
                                    Number(
                                        item.generalStage || 1
                                    )
                                        .toLocaleString(
                                            "fa-IR"
                                        )
                                }
                            </td>

                        </tr>
                    `
                )
                .join("");
    }


    /* ======================================================
       SUBSCRIPTION
    ====================================================== */

    initSubscription() {

        document
            .querySelectorAll(
                ".select-plan"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () =>
                        this.selectPlan(
                            button.dataset.plan
                        )
                );
            });


        const close =
            document.getElementById(
                "closePayment"
            );


        close?.addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "paymentPanel"
                    )
                    ?.classList.add(
                        "hidden"
                    );
            }
        );


        const file =
            document.getElementById(
                "paymentFile"
            );


        file?.addEventListener(
            "change",
            event => {

                this.paymentFile =
                    event.target.files[0] ||
                    null;


                const fileName =
                    document.getElementById(
                        "fileName"
                    );


                if (fileName) {

                    fileName.textContent =
                        this.paymentFile
                            ? this.paymentFile.name
                            : "فایلی انتخاب نشده است";
                }
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
         * حذف عناصر قدیمی Premium و هدیه
         * بدون نیاز به تغییر دوباره‌ی index.html.
         */

        [
            ".premium-preview",
            ".premium-benefits",
            ".referral-panel",
            ".premium-plan",
            ".popular-badge",
            ".premium-crown"
        ]
            .forEach(selector => {

                document
                    .querySelectorAll(
                        selector
                    )
                    .forEach(
                        element =>
                            element.remove()
                    );
            });


        document
            .querySelector(
                ".discount-row"
            )
            ?.remove();


        document
            .getElementById(
                "discountMessage"
            )
            ?.remove();


        document
            .getElementById(
                "finalPrice"
            )
            ?.closest(
                ".final-price"
            )
            ?.remove();
    }


    selectPlan(id) {

        const plan =
            subscriptionPlans[id];


        if (!plan) {
            return;
        }


        this.selectedPlan =
            id;


        const panel =
            document.getElementById(
                "paymentPanel"
            );


        panel?.classList.remove(
            "hidden"
        );


        const title =
            document.getElementById(
                "selectedPlanTitle"
            );


        if (title) {

            title.textContent =
                plan.name;
        }


        const amount =
            document.getElementById(
                "selectedAmount"
            );


        if (amount) {

            amount.textContent =
                money(
                    plan.price
                );
        }


        const account =
            document.getElementById(
                "accountNumber"
            );


        if (account) {

            account.textContent =
                ACCOUNT_NUMBER;
        }


        const message =
            document.getElementById(
                "paymentMessage"
            );


        if (message) {

            message.textContent =
                "";
        }


        panel?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }


    renderPaymentState() {

        if (!this.selectedPlan) {
            return;
        }


        const plan =
            subscriptionPlans[
                this.selectedPlan
            ];


        if (!plan) {
            return;
        }


        const title =
            document.getElementById(
                "selectedPlanTitle"
            );


        if (title) {

            title.textContent =
                plan.name;
        }


        const amount =
            document.getElementById(
                "selectedAmount"
            );


        if (amount) {

            amount.textContent =
                money(
                    plan.price
                );
        }


        const account =
            document.getElementById(
                "accountNumber"
            );


        if (account) {

            account.textContent =
                ACCOUNT_NUMBER;
        }
    }


    async submitPayment() {

        const message =
            document.getElementById(
                "paymentMessage"
            );


        if (
            this.state.username ===
            "بازیکن مهمان"
        ) {

            message.textContent =
                "ابتدا وارد حساب شوید یا ثبت‌نام کنید.";

            return;
        }


        if (!this.selectedPlan) {

            message.textContent =
                "ابتدا یک پلن انتخاب کنید.";

            return;
        }


        if (!this.paymentFile) {

            message.textContent =
                "لطفاً تصویر فیش پرداخت را انتخاب کنید.";

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
                "حجم تصویر باید کمتر از ۵ مگابایت باشد.";

            return;
        }


        message.textContent =
            "در حال ارسال فیش...";


        try {

            const base64 =
                await this.fileToBase64(
                    this.paymentFile
                );


            const plan =
                subscriptionPlans[
                    this.selectedPlan
                ];


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

                months:
                    plan.months,

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
                "فیش با موفقیت ارسال شد و در انتظار بررسی است.";


            const input =
                document.getElementById(
                    "paymentFile"
                );


            if (input) {

                input.value =
                    "";

            }


            document
                .getElementById(
                    "fileName"
                )
                ?.replaceChildren();


            this.paymentFile =
                null;


            await this.syncServerUpdates();


        } catch (error) {

            console.error(
                "Payment error:",
                error
            );


            message.textContent =
                error.message ||
                "ارسال فیش ناموفق بود.";
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


        return current?.phone || "";
    }


    fileToBase64(file) {

        return new Promise(
            (resolve, reject) => {

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
       CHAT
    ====================================================== */

    initChat() {

        this.loadChat();


        document
            .getElementById(
                "sendChat"
            )
            ?.addEventListener(
                "click",
                () => {

                    const input =
                        document.getElementById(
                            "chatInput"
                        );


                    const text =
                        input
                            .value
                            .trim();


                    if (!text) {
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

                        date:
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


                    this.loadChat();
                }
            );
    }


    loadChat() {

        const messages =
            JSON.parse(
                localStorage.getItem(
                    "quizduo_chat"
                ) ||
                "[]"
            );


        const box =
            document.getElementById(
                "messages"
            );


        if (!box) {
            return;
        }


        if (!messages.length) {

            box.innerHTML =
                `
                <p class="muted">
                    هنوز پیامی ارسال نشده است.
                </p>
                `;

            return;
        }


        box.innerHTML =
            messages
                .map(
                    message => `

                        <div class="chat-message">

                            <b>
                                ${escapeHTML(
                                    message.username
                                )}
                            </b>

                            <p>
                                ${escapeHTML(
                                    message.text
                                )}
                            </p>

                        </div>
                    `
                )
                .join("");
    }


    /* ======================================================
       SUPPORT
    ====================================================== */

    initSupport() {

        document
            .getElementById(
                "supportSend"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.submitSupport()
            );


        this.ensureUserPanels();


        document.addEventListener(
            "click",
            event => {

                const reply =
                    event.target.closest(
                        "[data-support-reply]"
                    );


                if (reply) {

                    this.sendSupportReply(
                        reply.dataset
                            .supportReply
                    );

                    return;
                }


                const close =
                    event.target.closest(
                        "[data-support-close]"
                    );


                if (close) {

                    this.closeSupport(
                        close.dataset
                            .supportClose
                    );

                    return;
                }


                const refresh =
                    event.target.closest(
                        "#refreshUserUpdates"
                    );


                if (refresh) {

                    this.syncServerUpdates();

                }
            }
        );
    }


    ensureUserPanels() {

        if (
            !document.getElementById(
                "quizduoUserPanelStyles"
            )
        ) {

            const style =
                document.createElement(
                    "style"
                );


            style.id =
                "quizduoUserPanelStyles";


            style.textContent = `

                .user-updates-panel {
                    margin-top: 18px;
                }

                .user-update-card {
                    padding: 16px;
                    margin-top: 12px;

                    border:
                        1px solid var(--border);

                    border-radius: 16px;

                    background:
                        var(--surface);
                }

                .update-card-top,
                .update-card-info,
                .support-actions {

                    display: flex;
                    align-items: center;
                    justify-content: space-between;

                    gap: 10px;

                    flex-wrap: wrap;
                }

                .update-card-info {

                    justify-content: flex-start;

                    color:
                        var(--muted);

                    font-size: .88rem;

                    margin-top: 8px;
                }

                .status-badge {

                    padding: 5px 9px;

                    border-radius: 999px;

                    background:
                        var(--surface2);

                    font-size: .76rem;

                    font-weight: 800;
                }

                .update-card-message {

                    margin-top: 12px;

                    padding: 11px 12px;

                    border-radius: 12px;

                    background:
                        var(--surface2);

                    color:
                        var(--text);
                }

                .support-thread {

                    display: grid;

                    gap: 8px;

                    margin-top: 12px;
                }

                .support-message {

                    padding: 10px 12px;

                    border-radius: 13px;

                    max-width: 88%;
                }

                .user-message {

                    margin-right: auto;

                    background:
                        var(--surface2);
                }

                .admin-message {

                    margin-left: auto;

                    background:
                        rgba(19,170,164,.10);

                    border:
                        1px solid rgba(19,170,164,.18);
                }

                .support-message-author {

                    font-size: .76rem;

                    font-weight: 900;

                    color:
                        var(--primary-dark);

                    margin-bottom: 3px;
                }

                .support-message-text {

                    white-space: pre-wrap;
                }

                .support-reply-box {

                    margin-top: 14px;
                }

                .support-reply-box textarea {

                    min-height: 90px;
                }

                .closed-conversation {

                    margin-top: 12px;

                    padding: 10px 12px;

                    border-radius: 12px;

                    background:
                        var(--surface2);

                    color:
                        var(--muted);
                }

            `;


            document.head.appendChild(
                style
            );
        }


        const support =
            document.getElementById(
                "support"
            );


        const subscription =
            document.getElementById(
                "subscription"
            );


        if (
            support &&
            !document.getElementById(
                "supportConversationsPanel"
            )
        ) {

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
                            وضعیت پشتیبانی
                        </h3>

                    </div>

                    <button
                        id="refreshUserUpdates"
                        class="secondary"
                        type="button"
                    >
                        به‌روزرسانی
                    </button>

                </div>

                <div
                    id="supportConversationsContent"
                >
                    <p class="message">
                        برای مشاهده گفتگوها وارد حساب شوید.
                    </p>
                </div>
            `;


            support.insertBefore(
                panel,
                support.querySelector(
                    ".panel"
                )
            );
        }


        if (
            subscription &&
            !document.getElementById(
                "subscriptionPaymentsPanel"
            )
        ) {

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
                            گزارش اشتراک
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
                        در حال دریافت وضعیت...
                    </p>
                </div>
            `;


            subscription.insertBefore(
                panel,
                subscription.querySelector(
                    ".subscription-hero"
                )?.nextSibling ||
                subscription.firstChild
            );
        }
    }


    async submitSupport() {

        const subject =
            document
                .getElementById(
                    "supportSubject"
                )
                .value
                .trim();


        const text =
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
            this.state.username ===
            "بازیکن مهمان"
        ) {

            msg.textContent =
                "ابتدا وارد حساب شوید یا ثبت‌نام کنید.";

            return;
        }


        if (
            !subject ||
            !text
        ) {

            msg.textContent =
                "موضوع و پیام را وارد کنید.";

            return;
        }


        msg.textContent =
            "در حال ارسال درخواست...";


        try {

            const conversationId =
                (
                    window.crypto &&
                    crypto.randomUUID
                )
                    ? crypto.randomUUID()
                    : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;


            await this.serverWrite({

                action:
                    "support",

                username:
                    this.state.username,

                phone:
                    this.getRegisteredPhone(),

                subject,

                message:
                    text,

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
                "گفت‌وگو با موفقیت ثبت شد.";


            await this.syncServerUpdates();

        } catch (error) {

            console.error(
                "Support error:",
                error
            );


            msg.textContent =
                error.message ||
                "ارسال درخواست پشتیبانی ناموفق بود.";
        }
    }


    async sendSupportReply(
        conversationId
    ) {

        const textarea =
            document.querySelector(
                `[data-support-input="${CSS.escape(
                    String(
                        conversationId
                    )
                )}"]`
            );


        if (!textarea) {
            return;
        }


        const message =
            textarea.value.trim();


        if (!message) {
            return;
        }


        textarea.disabled =
            true;


        try {

            await this.serverWrite({

                action:
                    "supportUserReply",

                username:
                    this.state.username,

                conversationId:
                    String(
                        conversationId
                    ),

                message

            });


            textarea.value =
                "";


            await this.syncServerUpdates();

        } catch (error) {

            this.showToast(
                error.message ||
                "ارسال پیام ناموفق بود."
            );

        } finally {

            textarea.disabled =
                false;
        }
    }


    async closeSupport(
        conversationId
    ) {

        const confirmed =
            confirm(
                "آیا مطمئن هستید که می‌خواهید این گفت‌وگو را به پایان برسانید؟"
            );


        if (!confirmed) {
            return;
        }


        try {

            await this.serverWrite({

                action:
                    "closeSupport",

                username:
                    this.state.username,

                conversationId:
                    String(
                        conversationId
                    )

            });


            await this.syncServerUpdates();

        } catch (error) {

            this.showToast(
                error.message ||
                "اتمام گفت‌وگو ناموفق بود."
            );
        }
    }


    /* ======================================================
       SERVER READ — JSONP
    ====================================================== */

    async serverRequest(payload) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const username =
                    String(
                        payload?.username ||
                        this.state.username ||
                        ""
                    )
                        .trim();


                if (
                    !username ||
                    username ===
                    "بازیکن مهمان"
                ) {

                    resolve({

                        success:
                            true,

                        payments:
                            [],

                        support:
                            [],

                        subscription: {

                            active:
                                false,

                            planId:
                                "",

                            planName:
                                "",

                            start:
                                null,

                            expiry:
                                null
                        }

                    });

                    return;
                }


                const callbackName =
                    `__quizDuoUpdates_${Date.now()}_${Math.random().toString(36).slice(2)}`;


                const script =
                    document.createElement(
                        "script"
                    );


                let timer =
                    null;


                const cleanup =
                    () => {

                        if (timer) {

                            window.clearTimeout(
                                timer
                            );
                        }


                        delete window[
                            callbackName
                        ];


                        script.remove();
                    };


                window[
                    callbackName
                ] =
                    data => {

                        cleanup();

                        resolve(
                            data
                        );
                    };


                script.onerror =
                    () => {

                        cleanup();

                        reject(
                            new Error(
                                "ارتباط با سامانه برقرار نشد."
                            )
                        );
                    };


                timer =
                    window.setTimeout(
                        () => {

                            cleanup();

                            reject(
                                new Error(
                                    "دریافت وضعیت حساب از سامانه ناموفق بود."
                                )
                            );

                        },
                        15000
                    );


                const params =
                    new URLSearchParams({

                        action:
                            String(
                                payload.action ||
                                "userUpdates"
                            ),

                        username,

                        callback:
                            callbackName

                    });


                script.src =
                    `${APPS_SCRIPT_URL}?${params.toString()}`;


                document
                    .body
                    .appendChild(
                        script
                    );
            }
        );
    }


    /* ======================================================
       SERVER WRITE
    ====================================================== */

    async serverWrite(
        payload
    ) {

        try {

            const response =
                await fetch(
                    APPS_SCRIPT_URL,
                    {

                        method:
                            "POST",

                        redirect:
                            "manual",

                        mode:
                            "cors",

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


            /*
             * Google Apps Script ContentService
             * پاسخ را به googleusercontent ریدایرکت می‌کند.
             *
             * ما عمداً redirect را دنبال نمی‌کنیم.
             * خود درخواست POST به Web App فرستاده شده است.
             */

            if (
                response.type ===
                    "opaqueredirect" ||

                response.status ===
                    0 ||

                response.ok
            ) {

                return {
                    success:
                        true
                };
            }


            throw new Error(
                `ارسال درخواست با کد ${response.status} ناموفق بود.`
            );


        } catch (error) {

            console.error(
                "Server write error:",
                error
            );


            throw new Error(
                "ارسال به سامانه انجام نشد. لینک /exec و انتشار Web App را بررسی کنید."
            );
        }
    }


    async syncServerUpdates() {

        if (
            this.state.username ===
            "بازیکن مهمان"
        ) {

            this.renderUserPanels();

            return;
        }


        try {

            const data =
                await this.serverRequest({

                    action:
                        "userUpdates",

                    username:
                        this.state.username

                });


            if (
                !data ||
                !data.success
            ) {

                throw new Error(
                    data?.message ||
                    "دریافت وضعیت ناموفق بود."
                );
            }


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


            const subscription =
                data.subscription &&
                typeof data.subscription ===
                    "object"

                    ? data.subscription

                    : {

                        active:
                            false,

                        planId:
                            "",

                        planName:
                            "",

                        start:
                            null,

                        expiry:
                            null

                    };


            this.state.subscriptionInfo =
                subscription;


            this.state.subscriptionStatus =
                subscription.active
                    ? "active"
                    : "inactive";


            this.state.subscriptionPlan =
                subscription.planId ||
                "";


            this.state.subscriptionName =
                subscription.planName ||
                "";


            this.state.subscription =
                subscription.active
                    ? "paid"
                    : "free";


            this.persist();


            this.renderUserPanels();

            this.renderProfile();


            if (
                document
                    .getElementById(
                        "quiz"
                    )
                    ?.classList.contains(
                        "active"
                    )
            ) {

                await this.renderStages();
            }


        } catch (error) {

            console.error(
                "User update sync failed:",
                error
            );


            this.renderUserPanels(
                error
            );
        }
    }


    hasActiveSubscription() {

        const info =
            this.state.subscriptionInfo;


        if (
            !info ||
            info.active !== true
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
       USER UPDATE RENDERING
    ====================================================== */

    renderUserPanels(
        error = null
    ) {

        this.ensureUserPanels();


        const payments =
            this.lastServerUpdates
                ?.payments ||
            [];


        const support =
            this.lastServerUpdates
                ?.support ||
            [];


        const formatDate =
            value => {

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
            };


        const paymentContent =
            document.getElementById(
                "subscriptionPaymentsContent"
            );


        if (paymentContent) {

            if (
                error &&
                !payments.length
            ) {

                paymentContent.innerHTML =
                    `
                    <p class="message">
                        اتصال به سامانه برقرار نشد.
                    </p>
                    `;

            } else if (
                !payments.length
            ) {

                paymentContent.innerHTML =
                    `
                    <p class="message">
                        هنوز فیشی برای این حساب ثبت نشده است.
                    </p>
                    `;

            } else {

                paymentContent.innerHTML =
                    payments
                        .map(
                            payment => {

                                let statusClass =
                                    "pending";


                                if (
                                    payment.status ===
                                    "تأیید شد"
                                ) {

                                    statusClass =
                                        "success";
                                }


                                if (
                                    payment.status ===
                                    "رد شد"
                                ) {

                                    statusClass =
                                        "danger";
                                }


                                return `

                                    <article
                                        class="user-update-card payment-update-card ${statusClass}"
                                    >

                                        <div class="update-card-top">

                                            <div>

                                                <span class="eyebrow">
                                                    اشتراک
                                                </span>

                                                <h3>

                                                    ${escapeHTML(
                                                        payment.planName ||
                                                        this.getPlanDuration(
                                                            payment.planId
                                                        )
                                                    )}

                                                </h3>

                                            </div>

                                            <span class="status-badge">

                                                ${escapeHTML(
                                                    payment.status ||
                                                    "در انتظار بررسی"
                                                )}

                                            </span>

                                        </div>


                                        <div class="update-card-info">

                                            <span>

                                                💰

                                                ${
                                                    money(
                                                        payment.amount
                                                    )
                                                }

                                            </span>


                                            <span>

                                                🕒

                                                ${
                                                    escapeHTML(
                                                        formatDate(
                                                            payment.timestamp
                                                        )
                                                    )
                                                }

                                            </span>

                                        </div>


                                        ${
                                            payment.userMessage
                                                ? `
                                                    <div class="update-card-message">

                                                        ${escapeHTML(
                                                            payment.userMessage
                                                        )}

                                                    </div>
                                                  `
                                                : ""
                                        }

                                    </article>

                                `;
                            }
                        )
                        .join("");
            }
        }


        const supportContent =
            document.getElementById(
                "supportConversationsContent"
            );


        if (supportContent) {

            if (
                error &&
                !support.length
            ) {

                supportContent.innerHTML =
                    `
                    <p class="message">

                        اتصال به سامانه برقرار نشد.

                    </p>
                    `;

            } else if (
                !support.length
            ) {

                supportContent.innerHTML =
                    `
                    <p class="message">

                        هنوز گفت‌وگوی پشتیبانی ندارید.

                    </p>
                    `;

            } else {

                supportContent.innerHTML =
                    support
                        .map(
                            conversation =>
                                this.renderSupportConversation(
                                    conversation,
                                    formatDate
                                )
                        )
                        .join("");
            }
        }


        const unread =
            support.filter(
                conversation =>
                    conversation.status ===
                    "پاسخ داده شد"
            ).length;


        const notice =
            document.getElementById(
                "dashboardNoticeCount"
            );


        if (notice) {

            notice.textContent =
                unread
                    ? `${unread.toLocaleString("fa-IR")} پاسخ جدید`
                    : "بدون پاسخ جدید";
        }
    }


    renderSupportConversation(
        conversation,
        formatDate
    ) {

        const thread =
            Array.isArray(
                conversation.thread
            )
                ? conversation.thread
                : [];


        const status =
            conversation.status ||
            "جدید";


        const closed =
            status === "بسته شد";


        const messagesHtml =
            thread
                .map(
                    item => `

                        <div
                            class="support-message ${
                                item.sender ===
                                "admin"
                                    ? "admin-message"
                                    : "user-message"
                            }"
                        >

                            <div
                                class="support-message-author"
                            >

                                ${
                                    item.sender ===
                                    "admin"
                                        ? "پشتیبانی QuizDuo"
                                        : "شما"
                                }

                            </div>


                            <div
                                class="support-message-text"
                            >

                                ${escapeHTML(
                                    item.text ||
                                    ""
                                )}

                            </div>


                            <small>

                                ${escapeHTML(
                                    formatDate(
                                        item.timestamp
                                    )
                                )}

                            </small>

                        </div>

                    `
                )
                .join("");


        const conversationId =
            String(
                conversation.conversationId ||
                ""
            );


        return `

            <article
                class="user-update-card support-conversation-card"
            >

                <div
                    class="update-card-top"
                >

                    <div>

                        <span class="eyebrow">
                            گفت‌وگو
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
                            status
                        )}

                    </span>

                </div>


                <div class="support-thread">

                    ${
                        messagesHtml ||
                        `
                        <p class="muted">
                            هنوز پیامی ثبت نشده است.
                        </p>
                        `
                    }

                </div>


                ${
                    closed

                        ? `

                            <div class="closed-conversation">

                                این گفت‌وگو توسط شما
                                به پایان رسیده است.

                            </div>

                          `

                        : `

                            <div class="support-reply-box">

                                <textarea
                                    data-support-input="${escapeHTML(
                                        conversationId
                                    )}"
                                    placeholder="پیام بعدی خود را در همین گفت‌وگو بنویسید..."
                                ></textarea>


                                <div class="support-actions">

                                    <button
                                        type="button"
                                        class="primary"
                                        data-support-reply="${escapeHTML(
                                            conversationId
                                        )}"
                                    >
                                        ارسال پیام
                                    </button>


                                    <button
                                        type="button"
                                        class="secondary"
                                        data-support-close="${escapeHTML(
                                            conversationId
                                        )}"
                                    >
                                        اتمام گفت‌وگو
                                    </button>

                                </div>

                            </div>

                          `
                }

            </article>
        `;
    }


    showToast(text) {

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


            toast.style.position =
                "fixed";


            toast.style.bottom =
                "22px";


            toast.style.right =
                "22px";


            toast.style.zIndex =
                "99999";


            toast.style.padding =
                "12px 16px";


            toast.style.borderRadius =
                "14px";


            toast.style.background =
                "#17262d";


            toast.style.color =
                "#fff";


            toast.style.boxShadow =
                "0 12px 30px rgba(0,0,0,.2)";


            document.body.appendChild(
                toast
            );
        }


        toast.textContent =
            text;


        window.clearTimeout(
            this._toastTimer
        );


        this._toastTimer =
            window.setTimeout(
                () =>
                    toast.remove(),
                3200
            );
    }


    getPlanDuration(
        planId
    ) {

        const names = {

            monthly:
                "۱ ماهه",

            quarterly:
                "۳ ماهه",

            sixMonth:
                "۶ ماهه",

            nineMonth:
                "۹ ماهه"
        };


        return (
            names[planId] ||
            "اشتراک"
        );
    }
}


const quizDuoApp =
    new App();


window.addEventListener(
    "DOMContentLoaded",
    () => {

        quizDuoApp.init();


        window.QuizDuo = {

            state:
                quizDuoApp.state,

            navigate:
                page =>
                    quizDuoApp.go(
                        page
                    ),

            showPage:
                page =>
                    quizDuoApp.go(
                        page
                    ),

            startStage:
                stage =>
                    quizDuoApp.startStage(
                        stage
                    ),

            selectPlan:
                plan =>
                    quizDuoApp.selectPlan(
                        plan
                    ),

            syncUser:
                () =>
                    quizDuoApp.syncServerUpdates(),

            isSubscriptionActive:
                () =>
                    quizDuoApp.hasActiveSubscription(),

            logout:
                () => {

                    localStorage.removeItem(
                        "quizduo_current_user"
                    );

                    location.reload();
                }
        };
    }
);
