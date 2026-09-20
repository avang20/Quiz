import {
    createDefaultState,
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


/*
 * Google Apps Script
 *
 * این آدرس همان Deployment جدید است.
 */
const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwQNOpTNYI6jD2obOFKk02eEjSZd2OzkPiwvBgN_xnDgsZ90B3a_FCmXkIvzVyuxzJiZQ/exec";


/*
 * شماره حساب را در پروژه واقعی خودت قرار بده.
 *
 * برای جلوگیری از قرار دادن اطلاعات مالی حساس در کد این نسخه،
 * مقدار پیش‌فرض جایگزین شده است.
 */
const ACCOUNT_NUMBER =
    "شماره حساب را اینجا وارد کنید";


const PLANS = {

    monthly: {
        id: "monthly",
        name: "یک‌ماهه",
        months: 1,
        price: 100000
    },

    quarterly: {
        id: "quarterly",
        name: "سه‌ماهه",
        months: 3,
        price: 270000
    },

    sixMonth: {
        id: "sixMonth",
        name: "شش‌ماهه",
        months: 6,
        price: 480000
    },

    nineMonth: {
        id: "nineMonth",
        name: "نه‌ماهه",
        months: 9,
        price: 660000
    }

};


function money(value) {

    return (
        Number(value || 0)
            .toLocaleString("fa-IR")
        + " تومان"
    );

}


function normalizeQuestion(question) {

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

    options = options.map(option => {

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


class QuizDuoApp {

    constructor() {

        const currentUser =
            getCurrentUser();

        const username =
            currentUser || "guest";

        this.state =
            loadState(
                createDefaultState(),
                username
            );

        if (username === "guest") {

            this.state.username =
                "بازیکن مهمان";

        } else {

            this.state.username =
                username;

        }

        this.quiz =
            new QuizEngine(
                this.state,
                () => this.persist()
            );

        this.authRegister = false;

        this.currentCategory =
            "general";

        this.selectedPlan = null;

        this.paymentFile = null;

        this.messages = [];

        this.serverAvailable = false;

    }


    /* ================= BASIC ================= */

    persist() {

        const key =
            this.state.username === "بازیکن مهمان"
                ? "guest"
                : this.state.username;

        saveState(
            this.state,
            key
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

        this.bindNavigation();

        this.initTheme();

        this.initAuth();

        this.initQuiz();

        this.initSubscription();

        this.initChat();

        this.initSupport();

        this.renderProfile();

        this.renderQuizStats();

        this.go("home");

        /*
         * مهم:
         *
         * دیگر هنگام باز شدن سایت، fetch به Apps Script
         * اجرا نمی‌شود.
         *
         * بنابراین خطای CORS/405 سرور باعث خراب شدن
         * دکمه‌ها و رابط سایت نمی‌شود.
         */

    }


    bindNavigation() {

        document
            .querySelectorAll("[data-page]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        const page =
                            button.dataset.page;

                        this.go(page);

                    }
                );

            });

        const themeButton =
            document.getElementById(
                "themeToggle"
            );

        if (themeButton) {

            themeButton.addEventListener(
                "click",
                () => this.toggleTheme()
            );

        }

        const authButton =
            document.getElementById(
                "authButton"
            );

        if (authButton) {

            authButton.addEventListener(
                "click",
                () => {

                    if (
                        this.state.username !==
                        "بازیکن مهمان"
                    ) {

                        this.go("profile");

                    } else {

                        this.go("auth");

                    }

                }
            );

        }

    }


    go(page) {

        const target =
            document.getElementById(page);

        if (!target) {
            return;
        }

        document
            .querySelectorAll(".page")
            .forEach(section => {

                section.classList.remove(
                    "active"
                );

            });

        target.classList.add("active");

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

            this.renderPaymentState();

        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }


    toggleTheme() {

        const dark =
            document.body.classList.toggle(
                "dark"
            );

        localStorage.setItem(
            "quizduo_theme",
            dark ? "dark" : "light"
        );

    }


    initTheme() {

        const theme =
            localStorage.getItem(
                "quizduo_theme"
            );

        if (theme === "dark") {

            document.body.classList.add(
                "dark"
            );

        }

    }


    /* ================= AUTH ================= */

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

        if (toggle) {

            toggle.addEventListener(
                "click",
                () => this.toggleAuthMode()
            );

        }

        if (submit) {

            submit.addEventListener(
                "click",
                () => this.submitAuth()
            );

        }

        if (back) {

            back.addEventListener(
                "click",
                () => this.go("home")
            );

        }

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

        if (phoneField) {

            phoneField.classList.toggle(
                "hidden",
                !this.authRegister
            );

        }

        const message =
            document.getElementById(
                "authMsg"
            );

        if (message) {
            message.textContent = "";
        }

    }


    submitAuth() {

        const name =
            document
                .getElementById("authName")
                .value
                .trim();

        const password =
            document
                .getElementById("authPassword")
                .value;

        const phone =
            document
                .getElementById("authPhone")
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


        if (this.authRegister) {

            if (existing) {

                message.textContent =
                    "این نام کاربری قبلاً استفاده شده است.";

                return;

            }


            if (
                !/^09\d{9}$/.test(phone)
            ) {

                message.textContent =
                    "شماره تماس را به شکل 09123456789 وارد کنید.";

                return;

            }


            users.push({

                username: name,

                password,

                phone,

                createdAt:
                    Date.now()

            });


            saveUsers(users);

            setCurrentUser(name);


            this.state =
                loadState(
                    createDefaultState(),
                    name
                );


            this.state.username =
                name;


            this.persist();


            message.textContent =
                "حساب با موفقیت ساخته شد.";

        } else {

            if (
                !existing ||
                existing.password !== password
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


            message.textContent =
                "ورود موفق بود.";

        }


        this.updateAuthButton();

        setTimeout(
            () => this.go("home"),
            500
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


    /* ================= QUIZ ================= */

    initQuiz() {

        document
            .querySelectorAll(
                "[data-category-tab]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        document
                            .querySelectorAll(
                                "[data-category-tab]"
                            )
                            .forEach(item =>
                                item.classList.remove(
                                    "active"
                                )
                            );

                        button.classList.add(
                            "active"
                        );

                        this.currentCategory =
                            button.dataset.categoryTab;

                        await this.renderStages();

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

        box.innerHTML =
            `<div class="panel loading">
                در حال بارگذاری سوال‌ها...
            </div>`;


        try {

            await this.quiz.loadCategory(
                this.currentCategory
            );


            const questions =
                this.quiz.questions || [];


            if (!questions.length) {

                box.innerHTML =
                    `<div class="panel error">
                        برای این بخش هنوز سوالی وجود ندارد.
                    </div>`;

                return;

            }


            const stageNumbers =
                [
                    ...new Set(
                        questions.map(
                            question =>
                                Number(
                                    question.stage
                                ) || 1
                        )
                    )
                ]
                .sort(
                    (a, b) => a - b
                );


            box.innerHTML = "";


            stageNumbers.forEach(
                stage => {

                    const stageQuestions =
                        this.quiz.getStageQuestions(
                            stage
                        );

                    const completed =
                        isStageCompleted(
                            this.state,
                            this.currentCategory,
                            stage
                        );


                    const free =
                        stage === 1;


                    const subscribed =
                        this.hasActiveSubscription();


                    const available =
                        free ||
                        subscribed;


                    const card =
                        document.createElement(
                            "article"
                        );


                    card.className =
                        "stage-card" +
                        (completed
                            ? " completed"
                            : "") +
                        (!available
                            ? " locked"
                            : "");


                    const status =
                        completed
                            ? "تکمیل شده"
                            : !available
                                ? "قفل"
                                : "باز";


                    card.innerHTML = `

                        <div class="stage-number">
                            ${stage}
                        </div>

                        <div class="stage-content">

                            <div class="stage-topline">

                                <span class="stage-badge">
                                    مرحله ${stage}
                                </span>

                                <span>
                                    ${completed ? "✓" : "🎯"}
                                </span>

                            </div>

                            <h3>
                                مرحله ${stage}
                            </h3>

                            <p>
                                ${stageQuestions.length}
                                سوال
                            </p>

                            <div class="stage-footer">

                                <span>
                                    ${status}
                                </span>

                                <span>
                                    ${available ? "شروع ←" : "🔒"}
                                </span>

                            </div>

                        </div>
                    `;


                    if (available) {

                        card.addEventListener(
                            "click",
                            () =>
                                this.startStage(
                                    stage
                                )
                        );

                    } else {

                        card.addEventListener(
                            "click",
                            () =>
                                this.showMessage(
                                    "برای باز شدن مراحل بعدی، اشتراک فعال لازم است."
                                )
                        );

                    }


                    box.appendChild(card);

                }
            );

        } catch (error) {

            console.error(
                "Quiz loading failed:",
                error
            );

            box.innerHTML = `
                <div class="panel">
                    خطا در بارگذاری سوال‌ها.
                    <br>
                    <small>
                        ${escapeHTML(
                            error.message
                        )}
                    </small>
                </div>
            `;

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
                info.expiry || 0
            ).getTime();

        return (
            Number.isFinite(expiry) &&
            expiry > Date.now()
        );

    }


    async startStage(stage) {

        if (
            Number(stage) > 1 &&
            !this.hasActiveSubscription()
        ) {

            this.go("subscription");

            this.showMessage(
                "مرحله اول رایگان است. برای مراحل بعدی اشتراک لازم است."
            );

            return;

        }


        if (
            this.state.hearts !== undefined &&
            this.state.hearts <= 0
        ) {

            this.showMessage(
                "قلبی باقی نمانده است."
            );

            return;

        }


        const completed =
            isStageCompleted(
                this.state,
                this.currentCategory,
                stage
            );


        if (completed) {

            const replay =
                confirm(
                    "این مرحله قبلاً تکمیل شده است. دوباره بازی شود؟"
                );

            if (!replay) {
                return;
            }

        }


        if (
            this.quiz.currentCategory !==
            this.currentCategory
        ) {

            await this.quiz.loadCategory(
                this.currentCategory
            );

        }


        const questions =
            this.quiz.startStage(
                this.currentCategory,
                stage,
                completed
            );


        if (!questions.length) {

            this.showMessage(
                "برای این مرحله سوال قابل استفاده وجود ندارد."
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

        if (!box) {
            return;
        }


        const normalized =
            normalizeQuestion(
                question
            );


        if (
            !normalized ||
            !normalized.question.trim()
        ) {

            return;

        }


        const options =
            normalized.options
                .filter(
                    option =>
                        option !== null &&
                        option !== undefined &&
                        String(option).trim() !== ""
                );


        const current =
            this.quiz.currentQuestion + 1;

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


        box.classList.remove(
            "hidden"
        );


        box.innerHTML = `

            <div class="quiz-card">

                <div class="quiz-top">

                    <span>
                        سوال ${current} از ${total}
                    </span>

                    <span class="quiz-stage-pill">
                        مرحله ${this.quiz.currentStage}
                    </span>

                </div>


                <div class="quiz-progress-wrap">

                    <div
                        class="quiz-progress"
                        style="width:${progress}%">
                    </div>

                </div>


                <div class="quiz-question">
                    ${escapeHTML(
                        normalized.question
                    )}
                </div>


                <div class="quiz-options-grid">

                    ${options
                        .map(
                            (option, index) => `

                                <button
                                    type="button"
                                    class="quiz-option"
                                    data-answer="${index}">

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
                        .join("")}

                </div>


                <div
                    id="quizFeedback"
                    class="quiz-feedback">
                </div>

            </div>
        `;


        box
            .querySelectorAll(
                "[data-answer]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () =>
                        this.answer(
                            Number(
                                button.dataset.answer
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
            this.quiz.answer(index);


        const box =
            document.getElementById(
                "quizBox"
            );


        if (!box) {
            return;
        }


        box
            .querySelectorAll(
                ".quiz-option"
            )
            .forEach(button => {

                button.disabled =
                    true;

            });


        const selected =
            box.querySelector(
                `[data-answer="${index}"]`
            );


        if (selected) {

            selected.classList.add(
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
                        ✅ پاسخ درست بود!
                    </div>
                `

                : `
                    <div class="error">
                        ❌ پاسخ اشتباه بود.
                    </div>
                `;


        if (
            result.explanation
        ) {

            feedback.innerHTML += `
                <div class="explanation">
                    ${escapeHTML(
                        result.explanation
                    )}
                </div>
            `;

        }


        if (!result.finished) {

            feedback.innerHTML += `
                <button
                    type="button"
                    class="primary quiz-next">
                    سوال بعدی
                </button>
            `;


            feedback
                .querySelector(
                    ".quiz-next"
                )
                .addEventListener(
                    "click",
                    () =>
                        this.renderQuestion(
                            this.quiz.getCurrentQuestion()
                        )
                );

        } else {

            const percent =
                Math.round(
                    result.percentage * 100
                );


            feedback.innerHTML += `

                <div class="${
                    result.passed
                        ? "result-good"
                        : "result-bad"
                }">

                    ${
                        result.passed
                            ? `🎉 مرحله را با ${percent}٪ موفقیت تمام کردی!`
                            : `مرحله تمام شد؛ نتیجه ${percent}٪ بود.`
                    }

                </div>

                <button
                    type="button"
                    class="primary quiz-next">
                    بازگشت به مراحل
                </button>
            `;


            feedback
                .querySelector(
                    ".quiz-next"
                )
                .addEventListener(
                    "click",
                    () => {

                        box.classList.add(
                            "hidden"
                        );

                        this.persist();

                        this.renderStages();

                    }
                );

        }


        this.persist();

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
            `❤️ ${hearts}  •  ⭐ ${xp} XP`;

    }


    /* ================= PROFILE ================= */

    renderProfile() {

        const name =
            this.state.username ||
            "بازیکن مهمان";

        const xp =
            Number(
                this.state.xp ?? 0
            );

        const hearts =
            Number(
                this.state.hearts ?? 5
            );

        const streak =
            Number(
                this.state.streak ?? 0
            );


        const nameElement =
            document.getElementById(
                "dashboardName"
            );

        if (nameElement) {
            nameElement.textContent =
                name;
        }


        const xpElement =
            document.getElementById(
                "dashboardXP"
            );

        if (xpElement) {
            xpElement.textContent =
                xp.toLocaleString("fa-IR");
        }


        const heartsElement =
            document.getElementById(
                "dashboardHearts"
            );

        if (heartsElement) {
            heartsElement.textContent =
                hearts;
        }


        const streakElement =
            document.getElementById(
                "dashboardStreak"
            );

        if (streakElement) {
            streakElement.textContent =
                streak;
        }


        const subscriptionText =
            document.getElementById(
                "dashboardSubscription"
            );

        const subscriptionActive =
            this.hasActiveSubscription();


        if (subscriptionText) {

            subscriptionText.textContent =
                subscriptionActive
                    ? "اشتراک فعال"
                    : "رایگان — مرحله ۱";

        }


        const badge =
            document.getElementById(
                "dashboardAccessBadge"
            );

        if (badge) {

            badge.textContent =
                subscriptionActive
                    ? "🔓 همه مراحل باز"
                    : "🔒 فقط مرحله ۱ رایگان";

            badge.className =
                "dashboard-badge " +
                (
                    subscriptionActive
                        ? "active"
                        : "free"
                );

        }


        const generalStage =
            document.getElementById(
                "dashboardGeneralStage"
            );

        if (generalStage) {

            generalStage.textContent =
                this.state.generalStage || 1;

        }


        const funStage =
            document.getElementById(
                "dashboardFunStage"
            );

        if (funStage) {

            funStage.textContent =
                this.state.funStage || 1;

        }


        const subscriptionTitle =
            document.getElementById(
                "dashboardSubscriptionTitle"
            );

        const subscriptionDescription =
            document.getElementById(
                "dashboardSubscriptionText"
            );


        if (subscriptionActive) {

            if (subscriptionTitle) {
                subscriptionTitle.textContent =
                    "اشتراک فعال";
            }

            if (subscriptionDescription) {
                subscriptionDescription.textContent =
                    "مراحل بعدی برای حساب شما باز هستند.";
            }

        } else {

            if (subscriptionTitle) {
                subscriptionTitle.textContent =
                    "اشتراک و دسترسی مراحل";
            }

            if (subscriptionDescription) {
                subscriptionDescription.textContent =
                    "حساب رایگان: فقط مرحله ۱ باز است.";
            }

        }


        this.updateAuthButton();

    }


    /* ================= LEADERBOARD ================= */

    renderLeaderboard() {

        const body =
            document.getElementById(
                "leaderBody"
            );

        if (!body) {
            return;
        }


        const rows =
            getLeaderboard();


        if (!rows.length) {

            body.innerHTML = `
                <tr>
                    <td colspan="4">
                        هنوز بازیکنی ثبت نشده است.
                    </td>
                </tr>
            `;

            return;

        }


        const sorted =
            [...rows]
                .sort(
                    (a, b) =>
                        Number(b.xp || 0) -
                        Number(a.xp || 0)
                );


        body.innerHTML =
            sorted
                .map(
                    (item, index) => `

                        <tr>

                            <td>
                                ${index + 1}
                            </td>

                            <td>
                                ${escapeHTML(
                                    item.username ||
                                    "بازیکن"
                                )}
                            </td>

                            <td>
                                ${Number(
                                    item.xp || 0
                                ).toLocaleString("fa-IR")}
                            </td>

                            <td>
                                ${Number(
                                    item.generalStage || 1
                                ).toLocaleString("fa-IR")}
                            </td>

                        </tr>
                    `
                )
                .join("");

    }


    /* ================= SUBSCRIPTION ================= */

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

        if (close) {

            close.addEventListener(
                "click",
                () => {

                    document
                        .getElementById(
                            "paymentPanel"
                        )
                        .classList.add(
                            "hidden"
                        );

                }
            );

        }


        const file =
            document.getElementById(
                "paymentFile"
            );

        if (file) {

            file.addEventListener(
                "change",
                event => {

                    const selected =
                        event.target.files[0] ||
                        null;

                    this.paymentFile =
                        selected;


                    const fileName =
                        document.getElementById(
                            "fileName"
                        );


                    if (fileName) {

                        fileName.textContent =
                            selected
                                ? selected.name
                                : "فایلی انتخاب نشده است";

                    }

                }
            );

        }


        const submit =
            document.getElementById(
                "submitPayment"
            );

        if (submit) {

            submit.addEventListener(
                "click",
                () =>
                    this.submitPayment()
            );

        }

    }


    selectPlan(id) {

        const plan =
            PLANS[id];

        if (!plan) {
            return;
        }


        this.selectedPlan =
            id;


        const panel =
            document.getElementById(
                "paymentPanel"
            );

        const title =
            document.getElementById(
                "selectedPlanTitle"
            );

        const amount =
            document.getElementById(
                "selectedAmount"
            );

        const account =
            document.getElementById(
                "accountNumber"
            );


        if (title) {
            title.textContent =
                `اشتراک ${plan.name}`;
        }


        if (amount) {
            amount.textContent =
                money(plan.price);
        }


        if (account) {
            account.textContent =
                ACCOUNT_NUMBER;
        }


        document.getElementById(
            "paymentMessage"
        ).textContent = "";


        panel.classList.remove(
            "hidden"
        );


        panel.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

    }


    renderPaymentState() {

        if (
            this.selectedPlan
        ) {

            const plan =
                PLANS[
                    this.selectedPlan
                ];

            if (!plan) {
                return;
            }

            const amount =
                document.getElementById(
                    "selectedAmount"
                );

            if (amount) {
                amount.textContent =
                    money(plan.price);
            }

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
                "برای ارسال فیش ابتدا وارد حساب شوید.";

            this.go("auth");

            return;

        }


        if (!this.selectedPlan) {

            message.textContent =
                "ابتدا یک پلن انتخاب کنید.";

            return;

        }


        if (!this.paymentFile) {

            message.textContent =
                "تصویر فیش پرداخت را انتخاب کنید.";

            return;

        }


        if (
            !this.paymentFile.type.startsWith(
                "image/"
            )
        ) {

            message.textContent =
                "فقط تصویر فیش قابل ارسال است.";

            return;

        }


        if (
            this.paymentFile.size >
            5 * 1024 * 1024
        ) {

            message.textContent =
                "حجم تصویر نباید بیشتر از ۵ مگابایت باشد.";

            return;

        }


        message.textContent =
            "در حال آماده‌سازی فیش...";


        try {

            const base64 =
                await this.fileToBase64(
                    this.paymentFile
                );


            const plan =
                PLANS[
                    this.selectedPlan
                ];


            const payload = {

                action: "payment",

                username:
                    this.state.username,

                phone:
                    this.getPhone(),

                plan:
                    this.selectedPlan,

                planName:
                    plan.name,

                months:
                    plan.months,

                amount:
                    plan.price,

                receiptBase64:
                    base64,

                receiptName:
                    this.paymentFile.name,

                receiptMimeType:
                    this.paymentFile.type

            };


            /*
             * از sendBeacon استفاده می‌کنیم تا
             * ریدایرکت Apps Script و CORS رابط سایت
             * را خراب نکند.
             */

            const sent =
                this.sendToServer(
                    payload
                );


            if (!sent) {

                throw new Error(
                    "ارسال درخواست توسط مرورگر پذیرفته نشد."
                );

            }


            message.textContent =
                "فیش برای بررسی ارسال شد. نتیجه پس از بررسی اعلام می‌شود.";

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


    fileToBase64(file) {

        return new Promise(
            (resolve, reject) => {

                const reader =
                    new FileReader();


                reader.onload = () =>
                    resolve(
                        String(
                            reader.result
                        ).split(",")[1] || ""
                    );


                reader.onerror =
                    () =>
                        reject(
                            new Error(
                                "خواندن فایل ناموفق بود."
                            )
                        );


                reader.readAsDataURL(
                    file
                );

            }
        );

    }


    getPhone() {

        const users =
            getUsers();


        const current =
            users.find(
                user =>
                    user.username ===
                    this.state.username
            );


        return current?.phone || "";

    }


    /* ================= CHAT ================= */

    initChat() {

        const send =
            document.getElementById(
                "sendChat"
            );

        const input =
            document.getElementById(
                "chatInput"
            );


        if (send) {

            send.addEventListener(
                "click",
                () => this.sendChat()
            );

        }


        if (input) {

            input.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter"
                    ) {

                        event.preventDefault();

                        this.sendChat();

                    }

                }
            );

        }


        this.renderMessages();

    }


    sendChat() {

        const input =
            document.getElementById(
                "chatInput"
            );


        if (!input) {
            return;
        }


        const text =
            input.value.trim();


        if (!text) {
            return;
        }


        this.messages.push({

            sender:
                this.state.username,

            text,

            time:
                Date.now()

        });


        input.value = "";

        this.renderMessages();

    }


    renderMessages() {

        const box =
            document.getElementById(
                "messages"
            );


        if (!box) {
            return;
        }


        if (!this.messages.length) {

            box.innerHTML = `
                <p class="muted">
                    هنوز پیامی ارسال نشده است.
                </p>
            `;

            return;

        }


        box.innerHTML =
            this.messages
                .map(
                    message => `

                        <div class="chat-message">

                            <b>
                                ${escapeHTML(
                                    message.sender
                                )}
                            </b>

                            <span>
                                ${escapeHTML(
                                    message.text
                                )}
                            </span>

                        </div>
                    `
                )
                .join("");

        box.scrollTop =
            box.scrollHeight;

    }


    /* ================= SUPPORT ================= */

    initSupport() {

        const send =
            document.getElementById(
                "supportSend"
            );

        if (send) {

            send.addEventListener(
                "click",
                () => this.sendSupport()
            );

        }

    }


    sendSupport() {

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


        const message =
            document.getElementById(
                "supportMsg"
            );


        if (
            !subject ||
            !text
        ) {

            message.textContent =
                "موضوع و پیام را وارد کنید.";

            return;

        }


        const payload = {

            action: "support",

            username:
                this.state.username,

            phone:
                this.getPhone(),

            subject,

            message: text

        };


        const sent =
            this.sendToServer(
                payload
            );


        if (sent) {

            message.textContent =
                "درخواست پشتیبانی برای ارسال ثبت شد.";

            document.getElementById(
                "supportSubject"
            ).value = "";

            document.getElementById(
                "supportText"
            ).value = "";

        } else {

            message.textContent =
                "ارسال درخواست انجام نشد.";

        }

    }


    /* ================= SERVER ================= */

    sendToServer(payload) {

        try {

            if (
                navigator.sendBeacon
            ) {

                const blob =
                    new Blob(
                        [
                            JSON.stringify(
                                payload
                            )
                        ],
                        {
                            type:
                                "text/plain;charset=utf-8"
                        }
                    );


                return navigator.sendBeacon(
                    APPS_SCRIPT_URL,
                    blob
                );

            }

        } catch (error) {

            console.error(
                "Beacon error:",
                error
            );

        }


        return false;

    }


    /* ================= HELPERS ================= */

    showMessage(text) {

        /*
         * پیام کوتاه بدون alert اجباری.
         */

        const activePage =
            document.querySelector(
                ".page.active"
            );

        if (!activePage) {
            return;
        }


        const old =
            activePage.querySelector(
                ".temporary-message"
            );


        if (old) {
            old.remove();
        }


        const element =
            document.createElement(
                "div"
            );


        element.className =
            "message temporary-message";


        element.textContent =
            text;


        activePage.prepend(
            element
        );


        setTimeout(
            () => element.remove(),
            3500
        );

    }

}


const app =
    new QuizDuoApp();


document.addEventListener(
    "DOMContentLoaded",
    () => {

        app.init();

        window.QuizDuo = {

            state:
                app.state,

            navigate:
                page => app.go(page),

            showPage:
                page => app.go(page),

            startStage:
                stage => app.startStage(stage),

            selectPlan:
                plan => app.selectPlan(plan),

            logout: () => {

                localStorage.removeItem(
                    "quizduo_current_user"
                );

                location.reload();

            }

        };

    }
);
