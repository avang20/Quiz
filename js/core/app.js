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
    "https://script.google.com/macros/s/AKfycbwQNOpTNYI6jD2obOFkK02eEjSZd2OzkPiwvBgN_xnDgsZ90B3a_FCmXkIvzVyuxzJiZQ/exec";


const ACCOUNT_NUMBER =
    "5022291615132519";


const subscriptionPlans = {

    monthly: {
        name: "ماهانه",
        months: 1,
        price: 100000,
        gift: 0,
        premium: false
    },

    quarterly: {
        name: "سه‌ماهه",
        months: 3,
        price: 270000,
        gift: 0,
        premium: false
    },

    sixMonth: {
        name: "شش‌ماهه",
        months: 6,
        price: 480000,
        gift: 1,
        premium: false
    },

    nineMonth: {
        name: "نه‌ماهه",
        months: 9,
        price: 660000,
        gift: 2,
        premium: true
    }
};


const discountCodes = {

    QUIZDUO10: 10,

    WELCOME15: 15,

    STUDENT10: 10
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


        this.discountPercent =
            0;


        this.testFixedAmount =
            null;


        this.paymentFile =
            null;


        this.lastServerUpdates = {

            payments: [],

            support: []
        };


        /*
         * وضعیت واقعی اشتراک از سرور می‌آید.
         * مقدار localStorage فقط برای نمایش موقت است
         * و نباید باعث باز شدن مراحل شود.
         */
        this.state.subscriptionInfo =
            this.state.subscriptionInfo ||
            null;


        this.serverSyncTimer =
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
            .querySelectorAll("[data-page]")
            .forEach(el => {

                el.addEventListener(
                    "click",
                    e => {

                        e.preventDefault();

                        this.go(
                            el.dataset.page
                        );
                    }
                );
            });


        document
            .getElementById(
                "authButton"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.go("auth")
            );


        this.initAuth();

        this.initQuiz();

        this.initSubscription();

        this.initChat();

        this.initSupport();

        this.loadTheme();

        this.renderProfile();

        this.renderQuizStats();

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
            .querySelectorAll(".page")
            .forEach(p =>
                p.classList.remove("active")
            );


        const target =
            document.getElementById(page);


        if (target) {
            target.classList.add("active");
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
            document.body.classList.contains("dark")
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


    initAuth() {

        document
            .getElementById(
                "toggleAuth"
            )
            .addEventListener(
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
                        .classList
                        .toggle(
                            "hidden",
                            !this.authRegister
                        );


                    document
                        .getElementById(
                            "authMsg"
                        )
                        .textContent = "";
                }
            );


        document
            .getElementById(
                "authBack"
            )
            .addEventListener(
                "click",
                () => this.go("home")
            );


        document
            .getElementById(
                "authSubmit"
            )
            .addEventListener(
                "click",
                () => this.submitAuth()
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


        const msg =
            document
                .getElementById(
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
                    "این نام کاربری قبلاً ثبت شده است.";

                return;
            }


            const user = {

                username:
                    name,

                password,

                phone,

                createdAt:
                    new Date().toISOString()
            };


            users.push(
                user
            );


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


            this.state.subscription =
                "free";


            this.state.subscriptionStatus =
                "inactive";


            this.state.subscriptionInfo =
                null;


            this.quiz =
                new QuizEngine(
                    this.state,
                    () => this.persist()
                );


            this.persist();

            this.renderProfile();

            this.renderQuizStats();

            this.go("home");

            this.syncServerUpdates();

            return;
        }


        if (!existing) {

            msg.textContent =
                "حسابی با این نام کاربری پیدا نشد.";

            return;
        }


        if (
            String(
                existing.password
            ) !==
            String(password)
        ) {

            msg.textContent =
                "رمز عبور اشتباه است.";

            return;
        }


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


        this.quiz =
            new QuizEngine(
                this.state,
                () => this.persist()
            );


        this.persist();

        this.renderProfile();

        this.renderQuizStats();

        this.go("home");

        this.syncServerUpdates();
    }


    initQuiz() {

        document
            .querySelectorAll(
                "[data-category-tab]"
            )
            .forEach(btn => {

                btn.addEventListener(
                    "click",
                    () => {

                        document
                            .querySelectorAll(
                                "[data-category-tab]"
                            )
                            .forEach(b =>
                                b.classList.remove(
                                    "active"
                                )
                            );


                        btn.classList.add(
                            "active"
                        );


                        this.quiz.currentCategory =
                            btn.dataset.categoryTab;


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


        const category =
            this.quiz.currentCategory;


        box.innerHTML =
            `<div class="panel loading">
                در حال بارگذاری سوال‌ها...
            </div>`;


        try {

            await this.quiz.loadCategory(
                category
            );


            const unlocked =
                getUnlockedStage(
                    this.state,
                    category
                );


            const hasActiveSubscription =
                this.hasActiveSubscription();


            /*
             * بدون اشتراک فقط مرحله ۱ باز است.
             *
             * حتی اگر مرحله ۱ قبلاً تمام شده باشد،
             * مقدار generalStage/funStage دیگر باعث
             * باز شدن مرحله ۲ نمی‌شود.
             */
            const accessibleStage =
                hasActiveSubscription
                    ? unlocked
                    : 1;


            const maxStage =
                Math.max(
                    5,
                    ...this.quiz.questions.map(
                        q =>
                            Number(q.stage) || 1
                    )
                );


            box.innerHTML = "";


            for (
                let i = 1;
                i <= maxStage;
                i++
            ) {

                const available =
                    i <= accessibleStage;


                const completed =
                    isStageCompleted(
                        this.state,
                        category,
                        i
                    );


                const questions =
                    this.quiz.getStageQuestions(
                        i
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
                        ${i}
                    </div>

                    <div>
                        <h3>
                            مرحله ${i}
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

                        ${
                            !available && i > 1
                                ? `
                                    <small>
                                        برای باز کردن این مرحله
                                        اشتراک فعال لازم است.
                                    </small>
                                  `
                                : ""
                        }
                    </div>
                `;


                if (
                    available &&
                    questions.length
                ) {

                    card.addEventListener(
                        "click",
                        () =>
                            this.startStage(i)
                    );
                }


                box.appendChild(card);
            }


            document
                .getElementById(
                    "quizBox"
                )
                .classList
                .add("hidden");

        } catch (error) {

            box.innerHTML =
                `<div class="panel error">
                    خطا در بارگذاری سوال‌ها:
                    ${escapeHTML(
                        error.message
                    )}
                </div>`;
        }
    }


    hasActiveSubscription() {

        const subscription =
            this.state.subscriptionInfo;


        if (
            !subscription ||
            subscription.active !== true
        ) {

            return false;
        }


        if (!subscription.expiry) {

            return false;
        }


        const expiry =
            new Date(
                subscription.expiry
            );


        return (
            !isNaN(
                expiry.getTime()
            ) &&
            expiry.getTime() >=
            Date.now()
        );
    }


    requireStageAccess(stage) {

        if (
            Number(stage) <= 1
        ) {

            return true;
        }


        if (
            this.hasActiveSubscription()
        ) {

            return true;
        }


        alert(
            "برای ورود به مراحل بعدی ابتدا ثبت‌نام کنید و یک اشتراک فعال داشته باشید."
        );


        this.go(
            "subscription"
        );


        return false;
    }


    async startStage(stage) {

        /*
         * این بررسی علاوه بر UI انجام می‌شود
         * تا حتی اگر کاربر از کنسول مرورگر هم
         * بخواهد مرحله ۲ به بعد را اجرا کند،
         * تا زمانی که اشتراک فعال ندارد اجازه ورود نداشته باشد.
         */
        if (
            !this.requireStageAccess(
                stage
            )
        ) {

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


        if (completed) {

            const replay =
                confirm(
                    "شما قبلاً امتیاز این مرحله را کسب کرده‌اید. آیا مایلید دوباره این مرحله را بازی کنید؟\n\nبازی کردن در این مرحله نه از شما قلب کم می‌کند و نه XP اضافه می‌کند."
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


        if (!normalized) {

            box.innerHTML =
                `<div class="panel error">
                    سوالی برای نمایش وجود ندارد.
                </div>`;

            return;
        }


        box.classList.remove(
            "hidden"
        );


        box.innerHTML = `
            <div class="panel quiz-question">

                <div class="quiz-question-title">

                    ${escapeHTML(
                        normalized.question
                    )}

                </div>

                <div class="quiz-options">

                    ${
                        normalized.options
                            .map(
                                (option, index) => `

                                    <button
                                        class="quiz-option"
                                        data-answer-index="${index}"
                                    >
                                        ${escapeHTML(
                                            String(option)
                                        )}
                                    </button>

                                `
                            )
                            .join("")
                    }

                </div>

            </div>
        `;


        box
            .querySelectorAll(
                "[data-answer-index]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const index =
                                Number(
                                    button.dataset.answerIndex
                                );

                            this.answerQuestion(
                                index
                            );
                        }
                    );
                }
            );


        box.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }


    answerQuestion(
        answerIndex
    ) {

        const result =
            this.quiz.answer(
                answerIndex
            );


        if (
            result &&
            result.finished
        ) {

            this.renderQuizResult(
                result
            );

            return;
        }


        const nextQuestion =
            this.quiz.currentQuestion();


        if (nextQuestion) {

            this.renderQuestion(
                nextQuestion
            );

        } else {

            this.renderQuizResult(
                result
            );
        }
    }


    renderQuizResult(
        result
    ) {

        const box =
            document.getElementById(
                "quizBox"
            );


        if (!result) {

            box.innerHTML =
                `<div class="panel">
                    آزمون به پایان رسید.
                </div>`;

            return;
        }


        const percentage =
            Math.round(
                Number(
                    result.percentage || 0
                ) * 100
            );


        box.innerHTML = `

            <div class="panel quiz-result">

                <h2>
                    ${
                        result.passed
                            ? "🎉 مرحله با موفقیت تمام شد!"
                            : "آزمون تمام شد"
                    }
                </h2>

                <p>
                    پاسخ صحیح:
                    ${result.correctAnswers || 0}
                    از
                    ${result.total || 0}
                </p>

                <p>
                    درصد:
                    ${percentage}٪
                </p>

                ${
                    result.earnedXP
                        ? `
                            <p>
                                XP دریافتی:
                                ${result.earnedXP}
                            </p>
                          `
                        : ""
                }

                ${
                    result.newlyCompleted
                        ? `
                            <p>
                                مرحله بعدی ثبت شد.
                            </p>
                          `
                        : ""
                }

                <div class="actions">

                    <button
                        class="primary"
                        id="backToStages"
                    >
                        بازگشت به مراحل
                    </button>

                </div>

            </div>
        `;


        document
            .getElementById(
                "backToStages"
            )
            .addEventListener(
                "click",
                () => {

                    this.go(
                        "quiz"
                    );

                    this.renderStages();
                }
            );


        this.persist();
    }


    renderQuizStats() {

        const s =
            this.state;


        const xp =
            document.getElementById(
                "quizXP"
            );

        const level =
            document.getElementById(
                "quizLevel"
            );

        const hearts =
            document.getElementById(
                "quizHearts"
            );


        if (xp) {

            xp.textContent =
                s.xp || 0;
        }


        if (level) {

            level.textContent =
                s.level || 1;
        }


        if (hearts) {

            hearts.textContent =
                s.hearts ?? 0;
        }
    }


    renderProfile() {

        const s =
            this.state;


        const profileName =
            document.getElementById(
                "profileName"
            );

        const profileScore =
            document.getElementById(
                "profileScore"
            );

        const profileStreak =
            document.getElementById(
                "profileStreak"
            );

        const profileStage =
            document.getElementById(
                "profileStage"
            );

        const subscriptionStatus =
            document.getElementById(
                "subscriptionStatus"
            );

        const authButton =
            document.getElementById(
                "authButton"
            );


        if (profileName) {

            profileName.textContent =
                s.username;
        }


        if (profileScore) {

            profileScore.textContent =
                s.xp || 0;
        }


        if (profileStreak) {

            profileStreak.textContent =
                s.streak || 0;
        }


        if (profileStage) {

            profileStage.textContent =
                Math.max(
                    1,
                    s.generalStage || 1,
                    s.funStage || 1
                ) - 1;
        }


        if (subscriptionStatus) {

            const active =
                this.hasActiveSubscription();


            const status =
                active

                    ? (
                        s.subscriptionPlan ===
                        "nineMonth"

                            ? "Premium 👑"

                            : "اشتراکی"
                      )

                    : "رایگان";


            subscriptionStatus.textContent =
                status;
        }


        if (authButton) {

            authButton.textContent =
                s.username ===
                "بازیکن مهمان"

                    ? "ورود / ثبت‌نام"

                    : s.username;
        }
    }


    renderLeaderboard() {

        const board =
            getLeaderboard();


        const body =
            document.getElementById(
                "leaderBody"
            );


        const rows =
            board.length

                ? board

                : [
                    {
                        username:
                            "هنوز داده‌ای وجود ندارد",

                        xp: 0,

                        generalStage: 1,

                        funStage: 1
                    }
                  ];


        body.innerHTML =
            rows.map(
                (item, index) => `

                    <tr>

                        <td>
                            ${index + 1}
                        </td>

                        <td>
                            ${escapeHTML(
                                item.username
                            )}
                        </td>

                        <td>
                            ${item.xp || 0}
                        </td>

                        <td>
                            ${
                                Math.max(
                                    item.generalStage || 1,
                                    item.funStage || 1
                                ) - 1
                            }
                        </td>

                    </tr>
                `
            ).join("");
    }


    initSubscription() {

        document
            .querySelectorAll(
                ".select-plan"
            )
            .forEach(btn => {

                btn.addEventListener(
                    "click",
                    () =>
                        this.selectPlan(
                            btn.dataset.plan
                        )
                );
            });


        document
            .getElementById(
                "applyDiscount"
            )
            .addEventListener(
                "click",
                () =>
                    this.applyDiscount()
            );


        document
            .getElementById(
                "closePayment"
            )
            .addEventListener(
                "click",
                () =>
                    document
                        .getElementById(
                            "paymentPanel"
                        )
                        .classList
                        .add("hidden")
            );


        document
            .getElementById(
                "paymentFile"
            )
            .addEventListener(
                "change",
                event => {

                    this.paymentFile =
                        event.target.files[0] ||
                        null;


                    document
                        .getElementById(
                            "fileName"
                        )
                        .textContent =
                        this.paymentFile

                            ? this.paymentFile.name

                            : "فایلی انتخاب نشده است";
                }
            );


        document
            .getElementById(
                "submitPayment"
            )
            .addEventListener(
                "click",
                () =>
                    this.submitPayment()
            );
    }


    selectPlan(id) {

        if (!subscriptionPlans[id]) {
            return;
        }


        this.selectedPlan =
            id;


        this.discountPercent =
            0;


        this.testFixedAmount =
            null;


        document
            .getElementById(
                "discountCode"
            )
            .value = "";


        document
            .getElementById(
                "paymentPanel"
            )
            .classList
            .remove("hidden");


        document
            .getElementById(
                "selectedPlanTitle"
            )
            .textContent =
            subscriptionPlans[id]
                .name;


        document
            .getElementById(
                "selectedAmount"
            )
            .textContent =
            money(
                subscriptionPlans[id]
                    .price
            );


        document
            .getElementById(
                "accountNumber"
            )
            .textContent =
            ACCOUNT_NUMBER;


        document
            .getElementById(
                "discountMessage"
            )
            .textContent = "";


        document
            .getElementById(
                "paymentMessage"
            )
            .textContent = "";


        this.updateFinalPrice();


        document
            .getElementById(
                "paymentPanel"
            )
            .scrollIntoView({
                behavior: "smooth"
            });
    }


    async applyDiscount() {

        const code =
            document
                .getElementById(
                    "discountCode"
                )
                .value
                .trim()
                .toUpperCase();


        const msg =
            document
                .getElementById(
                    "discountMessage"
                );


        if (!this.selectedPlan) {
            return;
        }


        if (!code) {

            this.testFixedAmount =
                null;

            this.discountPercent =
                0;

            msg.textContent =
                "کدی وارد نشده است.";

            this.updateFinalPrice();

            return;
        }


        if (discountCodes[code]) {

            this.testFixedAmount =
                null;

            this.discountPercent =
                discountCodes[code];


            msg.textContent =
                `کد با ${this.discountPercent}٪ تخفیف اعمال شد.`;


            this.updateFinalPrice();

            return;
        }


        msg.textContent =
            "در حال بررسی کد...";


        try {

            const data =
                await this.serverRequest({

                    action:
                        "validateDiscount",

                    code,

                    plan:
                        this.selectedPlan
                });


            if (
                data.success &&
                data.testCodeApplied
            ) {

                this.testFixedAmount =
                    Number(
                        data.amount
                    );


                this.discountPercent =
                    0;


                msg.textContent =
                    "کد تخفیف با موفقیت اعمال شد.";


                this.updateFinalPrice();

                return;
            }


            this.testFixedAmount =
                null;

            this.discountPercent =
                0;


            msg.textContent =
                "کد تخفیف معتبر نیست.";


            this.updateFinalPrice();

        } catch (error) {

            console.error(
                error
            );


            msg.textContent =
                "بررسی کد تخفیف انجام نشد.";
        }
    }


    updateFinalPrice() {

        if (!this.selectedPlan) {
            return;
        }


        const plan =
            subscriptionPlans[
                this.selectedPlan
            ];


        let finalAmount =
            Number(
                plan.price
            );


        if (
            this.testFixedAmount !==
            null
        ) {

            finalAmount =
                Number(
                    this.testFixedAmount
                );

        } else if (
            this.discountPercent
        ) {

            finalAmount =
                Math.round(
                    finalAmount *
                    (
                        1 -
                        (
                            this.discountPercent /
                            100
                        )
                    )
                );
        }


        const element =
            document.getElementById(
                "finalPrice"
            );


        if (element) {

            element.textContent =
                money(
                    finalAmount
                );
        }


        return finalAmount;
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
                "برای خرید اشتراک ابتدا ثبت‌نام یا وارد حساب شوید.";

            this.go(
                "auth"
            );

            return;
        }


        if (!this.selectedPlan) {

            message.textContent =
                "ابتدا یک پلن انتخاب کنید.";

            return;
        }


        if (!this.paymentFile) {

            message.textContent =
                "لطفاً تصویر فیش را انتخاب کنید.";

            return;
        }


        if (
            this.paymentFile.size >
            5 * 1024 * 1024
        ) {

            message.textContent =
                "حجم فایل نباید بیشتر از ۵ مگابایت باشد.";

            return;
        }


        message.textContent =
            "در حال ارسال فیش...";


        try {

            const base64 =
                await this.fileToBase64(
                    this.paymentFile
                );


            const amount =
                this.updateFinalPrice();


            const data =
                await this.serverRequest({

                    action:
                        "payment",

                    username:
                        this.state.username,

                    phone:
                        this.getCurrentPhone(),

                    plan:
                        this.selectedPlan,

                    planName:
                        subscriptionPlans[
                            this.selectedPlan
                        ].name,

                    amount,

                    discountPercent:
                        this.discountPercent,

                    discountCode:
                        document
                            .getElementById(
                                "discountCode"
                            )
                            .value
                            .trim()
                            .toUpperCase(),

                    fileName:
                        this.paymentFile.name,

                    mimeType:
                        this.paymentFile.type,

                    receiptBase64:
                        base64
                });


            if (!data.success) {

                throw new Error(
                    data.message ||
                    "ارسال فیش ناموفق بود."
                );
            }


            message.textContent =
                data.message ||
                "فیش با موفقیت ارسال شد.";


            this.paymentFile =
                null;


            document
                .getElementById(
                    "paymentFile"
                )
                .value = "";


            document
                .getElementById(
                    "fileName"
                )
                .textContent =
                "فایلی انتخاب نشده است";


            await this.syncServerUpdates();

        } catch (error) {

            console.error(
                error
            );


            message.textContent =
                error.message ||
                "ارسال فیش ناموفق بود.";
        }
    }


    getCurrentPhone() {

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


        return current
            ? current.phone || ""
            : "";
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
                    () => {

                        const result =
                            String(
                                reader.result ||
                                ""
                            );


                        const comma =
                            result.indexOf(
                                ","
                            );


                        resolve(
                            comma >= 0
                                ? result.slice(
                                    comma + 1
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


    initChat() {

        const input =
            document.getElementById(
                "chatInput"
            );


        const button =
            document.getElementById(
                "chatSend"
            );


        if (!input || !button) {
            return;
        }


        button.addEventListener(
            "click",
            () =>
                this.sendChatMessage()
        );


        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    this.sendChatMessage();
                }
            }
        );
    }


    sendChatMessage() {

        const input =
            document.getElementById(
                "chatInput"
            );


        const messages =
            document.getElementById(
                "messages"
            );


        if (!input || !messages) {
            return;
        }


        const text =
            input.value.trim();


        if (!text) {
            return;
        }


        const item =
            document.createElement(
                "div"
            );


        item.className =
            "chat-message";


        item.innerHTML = `
            <b>
                شما
            </b>

            <span>
                ${escapeHTML(text)}
            </span>
        `;


        messages.appendChild(
            item
        );


        input.value =
            "";


        messages.scrollTop =
            messages.scrollHeight;
    }


    initSupport() {

        const form =
            document.getElementById(
                "supportForm"
            );


        if (!form) {
            return;
        }


        const submit =
            document.getElementById(
                "supportSubmit"
            );


        if (submit) {

            submit.addEventListener(
                "click",
                () =>
                    this.submitSupport()
            );
        }


        document.addEventListener(
            "click",
            event => {

                const replyButton =
                    event.target.closest(
                        "[data-support-reply]"
                    );


                if (replyButton) {

                    const id =
                        replyButton.dataset.supportReply;


                    this.sendSupportReply(
                        id
                    );

                    return;
                }


                const closeButton =
                    event.target.closest(
                        "[data-support-close]"
                    );


                if (closeButton) {

                    const id =
                        closeButton.dataset.supportClose;


                    this.closeSupportConversation(
                        id
                    );
                }
            }
        );
    }


    async submitSupport() {

        if (
            this.state.username ===
            "بازیکن مهمان"
        ) {

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
                ?.value
                .trim() ||
            "";


        const message =
            document
                .getElementById(
                    "supportMessage"
                )
                ?.value
                .trim() ||
            "";


        const msg =
            document.getElementById(
                "supportMsg"
            );


        if (
            !subject ||
            !message
        ) {

            if (msg) {

                msg.textContent =
                    "موضوع و پیام را وارد کنید.";
            }

            return;
        }


        if (msg) {

            msg.textContent =
                "در حال ارسال...";
        }


        try {

            const data =
                await this.serverRequest({

                    action:
                        "support",

                    username:
                        this.state.username,

                    phone:
                        this.getCurrentPhone(),

                    subject,

                    message
                });


            if (!data.success) {

                throw new Error(
                    data.message ||
                    "ارسال پیام ناموفق بود."
                );
            }


            if (msg) {

                msg.textContent =
                    data.message ||
                    "پیام شما ثبت شد.";
            }


            const subjectInput =
                document.getElementById(
                    "supportSubject"
                );


            const messageInput =
                document.getElementById(
                    "supportMessage"
                );


            if (subjectInput) {
                subjectInput.value =
                    "";
            }


            if (messageInput) {
                messageInput.value =
                    "";
            }


            await this.syncServerUpdates();

        } catch (error) {

            console.error(
                error
            );


            if (msg) {

                msg.textContent =
                    error.message ||
                    "ارسال پیام ناموفق بود.";
            }
        }
    }


    async sendSupportReply(
        conversationId
    ) {

        /*
         * نسخه فعلی Code.gs هر پیام را یک رکورد مستقل
         * ذخیره می‌کند.
         *
         * بنابراین اگر نسخه جدید سرور thread/conversationId
         * نداشت، این قابلیت عمداً غیرفعال می‌ماند تا
         * داده اشتباه به سرور ارسال نشود.
         */

        console.warn(
            "Reply conversations are managed by the admin panel."
        );
    }


    async closeSupportConversation(
        conversationId
    ) {

        console.warn(
            "Conversation closing is managed by the admin panel."
        );
    }


    async serverRequest(
        payload
    ) {

        let response;


        try {

            response =
                await fetch(
                    APPS_SCRIPT_URL,
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

        } catch (networkError) {

            console.error(
                "Network error:",
                networkError
            );


            throw new Error(
                "ارتباط با سامانه برقرار نشد. مطمئن شوید Web App در Apps Script با دسترسی «Anyone» منتشر شده و لینک /exec صحیح است."
            );
        }


        const text =
            await response.text();


        let data;


        try {

            data =
                JSON.parse(text);

        } catch {

            throw new Error(
                "پاسخ نامعتبر از سامانه دریافت شد."
            );
        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                "خطای ارتباط با سامانه."
            );
        }


        return data;
    }


    async syncServerUpdates() {

        if (
            this.state.username ===
            "بازیکن مهمان"
        ) {

            /*
             * مهمان هیچ اشتراک فعالی ندارد.
             * بنابراین حتی اگر localStorage قبلاً
             * مقدار دیگری داشته باشد، دسترسی فقط
             * مرحله ۱ خواهد بود.
             */
            this.state.subscriptionInfo =
                null;

            this.state.subscriptionStatus =
                "inactive";

            this.state.subscriptionPlan =
                null;

            this.state.subscription =
                "free";


            this.renderStagesIfVisible();

            this.renderUserPanels();

            this.renderProfile();

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


            if (!data.success) {

                throw new Error(
                    data.message ||
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


            /*
             * وضعیت اشتراک مستقیماً از سرور گرفته می‌شود.
             *
             * اگر اشتراک منقضی شده باشد:
             * active = false
             *
             * اگر هنوز فعال باشد:
             * active = true
             */
            const serverSubscription =
                data.subscription ||
                null;


            const active =
                Boolean(
                    serverSubscription &&
                    serverSubscription.active &&
                    serverSubscription.expiry &&
                    new Date(
                        serverSubscription.expiry
                    ).getTime() >=
                    Date.now()
                );


            this.state.subscriptionInfo =
                serverSubscription
                    ? {
                        ...serverSubscription,
                        active
                    }
                    : null;


            this.state.subscriptionStatus =
                active
                    ? "active"
                    : "inactive";


            this.state.subscriptionPlan =
                active
                    ? serverSubscription.planId
                    : null;


            this.state.subscriptionName =
                active
                    ? serverSubscription.planName
                    : null;


            this.state.subscription =
                active
                    ? (
                        serverSubscription.planId ===
                        "nineMonth"

                            ? "premium"

                            : "paid"
                      )
                    : "free";


            /*
             * وضعیت سرور را در localStorage هم ذخیره می‌کنیم.
             * اما دسترسی مراحل همیشه با hasActiveSubscription()
             * و expiry واقعی بررسی می‌شود.
             */
            this.persist();


            /*
             * اگر کاربر در صفحه مراحل باشد،
             * بعد از تأیید پرداخت همان لحظه مراحل
             * دوباره render می‌شوند.
             */
            this.renderStagesIfVisible();


            this.renderUserPanels();

            this.renderProfile();

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


    renderStagesIfVisible() {

        const quizPage =
            document.getElementById(
                "quiz"
            );


        if (
            quizPage &&
            quizPage.classList.contains(
                "active"
            )
        ) {

            this.renderStages();
        }
    }


    ensureUserPanels() {

        const subscriptionPage =
            document.getElementById(
                "subscription"
            );


        const supportPage =
            document.getElementById(
                "support"
            );


        if (
            subscriptionPage &&
            !document.getElementById(
                "subscriptionPaymentsContent"
            )
        ) {

            const panel =
                document.createElement(
                    "div"
                );


            panel.className =
                "panel user-updates-panel";


            panel.innerHTML = `

                <div class="section-heading">

                    <div>

                        <span class="eyebrow">
                            وضعیت پرداخت‌ها
                        </span>

                        <h2>
                            اشتراک‌های من
                        </h2>

                    </div>

                </div>

                <div
                    id="subscriptionPaymentsContent"
                ></div>

            `;


            subscriptionPage.appendChild(
                panel
            );
        }


        if (
            supportPage &&
            !document.getElementById(
                "supportConversationsContent"
            )
        ) {

            const panel =
                document.createElement(
                    "div"
                );


            panel.className =
                "panel user-updates-panel";


            panel.innerHTML = `

                <div class="section-heading">

                    <div>

                        <span class="eyebrow">
                            پیام‌ها
                        </span>

                        <h2>
                            پیام‌های پشتیبانی
                        </h2>

                    </div>

                </div>

                <div
                    id="supportConversationsContent"
                ></div>

            `;


            supportPage.appendChild(
                panel
            );
        }
    }


    renderPaymentState() {

        const content =
            document.getElementById(
                "subscriptionPaymentsContent"
            );


        if (!content) {
            return;
        }


        const active =
            this.hasActiveSubscription();


        const subscription =
            this.state.subscriptionInfo;


        if (active && subscription) {

            content.insertAdjacentHTML(
                "afterbegin",
                `
                    <div
                        class="panel subscription-active-box"
                        data-active-subscription="true"
                    >
                        <strong>
                            اشتراک فعال است 👑
                        </strong>

                        <p>
                            ${escapeHTML(
                                subscription.planName ||
                                "اشتراک"
                            )}
                        </p>

                        ${
                            subscription.expiry
                                ? `
                                    <p>
                                        تاریخ پایان:
                                        ${escapeHTML(
                                            new Date(
                                                subscription.expiry
                                            ).toLocaleString(
                                                "fa-IR"
                                            )
                                        )}
                                    </p>
                                  `
                                : ""
                        }
                    </div>
                `
            );
        }
    }


    renderUserPanels(
        error = null
    ) {

        this.ensureUserPanels();


        const payments =
            this.lastServerUpdates
                ?.payments || [];


        const support =
            this.lastServerUpdates
                ?.support || [];


        const formatDate =
            value => {

                if (!value) {
                    return "";
                }


                try {

                    return new Date(
                        value
                    ).toLocaleString(
                        "fa-IR"
                    );

                } catch {

                    return String(value);
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
                    `<p class="message">
                        اتصال به سامانه برقرار نشد.
                    </p>`;

            } else if (
                !payments.length
            ) {

                paymentContent.innerHTML =
                    `<p class="message">
                        هنوز فیشی برای این حساب ثبت نشده است.
                    </p>`;

            } else {

                /*
                 * هر اشتراک / پرداخت دقیقاً یک کارت مستقل دارد.
                 */
                paymentContent.innerHTML =
                    payments
                        .map(
                            item => {

                                const statusClass =
                                    item.status ===
                                    "تأیید شد"

                                        ? "approved"

                                        : item.status ===
                                          "رد شد"

                                            ? "rejected"

                                            : "pending";


                                const duration =
                                    this.getPlanDuration(
                                        item.planId
                                    );


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
                                                        duration
                                                    )}
                                                </h3>

                                            </div>

                                            <span class="status-badge">
                                                ${escapeHTML(
                                                    item.status ||
                                                    "در انتظار بررسی"
                                                )}
                                            </span>

                                        </div>


                                        <div class="update-card-info">

                                            <span>
                                                💰
                                                ${money(
                                                    item.amount
                                                )}
                                            </span>

                                            <span>
                                                🕒
                                                ${escapeHTML(
                                                    formatDate(
                                                        item.timestamp
                                                    )
                                                )}
                                            </span>

                                            ${
                                                item.subscriptionStart
                                                    ? `
                                                        <span>
                                                            ▶️ شروع:
                                                            ${escapeHTML(
                                                                formatDate(
                                                                    item.subscriptionStart
                                                                )
                                                            )}
                                                        </span>
                                                      `
                                                    : ""
                                            }

                                            ${
                                                item.subscriptionExpiry
                                                    ? `
                                                        <span>
                                                            ⏳ پایان:
                                                            ${escapeHTML(
                                                                formatDate(
                                                                    item.subscriptionExpiry
                                                                )
                                                            )}
                                                        </span>
                                                      `
                                                    : ""
                                            }

                                        </div>


                                        ${
                                            item.userMessage
                                                ? `
                                                    <div class="update-card-message">
                                                        ${escapeHTML(
                                                            item.userMessage
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
                    `<p class="message">
                        اتصال به سامانه برقرار نشد.
                    </p>`;

            } else if (
                !support.length
            ) {

                supportContent.innerHTML =
                    `<p class="message">
                        هنوز پیام پشتیبانی ندارید.
                    </p>`;

            } else {

                /*
                 * Code.gs جدید هر پیام را به‌صورت یک رکورد
                 * مستقل برمی‌گرداند؛ بنابراین هر پیام یک کارت
                 * جداگانه دارد و پاسخ ادمین داخل همان کارت
                 * نمایش داده می‌شود.
                 */
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
    }


    renderSupportConversation(
        conversation,
        formatDate
    ) {

        const status =
            conversation.status ||
            "جدید";


        const closed =
            status ===
            "بسته شد";


        const reply =
            conversation.adminReply ||
            "";


        return `

            <article
                class="user-update-card support-conversation-card"
            >

                <div class="update-card-top">

                    <div>

                        <span class="eyebrow">
                            پیام پشتیبانی
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


                <div class="update-card-info">

                    <span>
                        🕒
                        ${escapeHTML(
                            formatDate(
                                conversation.timestamp
                            )
                        )}
                    </span>

                </div>


                <div class="support-thread">

                    <div
                        class="support-message user-message"
                    >

                        <div
                            class="support-message-author"
                        >
                            شما
                        </div>

                        <div
                            class="support-message-text"
                        >
                            ${escapeHTML(
                                conversation.message ||
                                ""
                            )}
                        </div>

                    </div>


                    ${
                        reply

                            ? `
                                <div
                                    class="support-message admin-message"
                                >

                                    <div
                                        class="support-message-author"
                                    >
                                        پشتیبانی QuizDuo
                                    </div>

                                    <div
                                        class="support-message-text"
                                    >
                                        ${escapeHTML(
                                            reply
                                        )}
                                    </div>

                                    ${
                                        conversation.replyTimestamp
                                            ? `
                                                <small>
                                                    ${escapeHTML(
                                                        formatDate(
                                                            conversation.replyTimestamp
                                                        )
                                                    )}
                                                </small>
                                              `
                                            : ""
                                    }

                                </div>
                              `

                            : `
                                <p class="message">
                                    هنوز پاسخی از پشتیبانی دریافت نشده است.
                                </p>
                              `
                    }

                </div>


                ${
                    closed

                        ? `
                            <div class="closed-conversation">

                                این پیام توسط پشتیبانی بسته شده است.

                            </div>
                          `

                        : ""
                }

            </article>
        `;
    }


    getPlanDuration(planId) {

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


        return names[planId] ||
            "اشتراک";
    }
}


window.addEventListener(
    "DOMContentLoaded",
    () =>
        new App().init()
);
