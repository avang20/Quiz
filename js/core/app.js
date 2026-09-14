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
    logoutUser,
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


/* =========================================================
   GOOGLE APPS SCRIPT
========================================================= */

const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbymfupUz1FrKfknPgF9c44vwKgq6tv-Nq4TaHVkfknvUthhXd3-8L27_6ZJHJeeRnUd7Q/exec";


/* =========================================================
   ACCOUNT
========================================================= */

const ACCOUNT_NUMBER =
    "5022291615132519";


/* =========================================================
   PRIVATE TEST CODE
========================================================= */

const PRIVATE_TEST_CODE =
    "QDZ-100K-HASTI";


/* =========================================================
   SUBSCRIPTION PLANS
========================================================= */

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


/* =========================================================
   DISCOUNT CODES
========================================================= */

const discountCodes = {

    QUIZDUO10: 10,

    WELCOME15: 15,

    STUDENT10: 10

};


/* =========================================================
   HELPERS
========================================================= */

const money = value =>
    Number(value || 0)
        .toLocaleString("fa-IR") +
    " تومان";


/* =========================================================
   QUESTION NORMALIZER
========================================================= */

function normalizeQuestionForUI(question) {

    if (
        !question ||
        typeof question !== "object"
    ) {

        return null;

    }


    const text =
        question.question ??
        question.questionText ??
        question.question_text ??
        question.q ??
        question.text ??
        question.title ??
        question.prompt ??
        question.description ??
        "";


    let options =
        question.options ??
        question.choices ??
        question.answers ??
        question.answerOptions ??
        question.answer_options ??
        question.o ??
        [];


    if (!Array.isArray(options)) {

        if (
            options &&
            typeof options === "object"
        ) {

            options =
                Object.values(options);

        }

        else {

            options = [];

        }

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
                    option.title ??
                    ""
                );

            }

            return option;

        });


    return {

        ...question,

        question:
            String(text ?? "").trim(),

        options:
            options
                .map(option =>
                    String(option ?? "").trim()
                )
                .filter(
                    option => option !== ""
                )

    };

}


/* =========================================================
   APP
========================================================= */

class App {

    constructor() {

        const defaultState =
            createDefaultState();


        const username =
            getCurrentUser() || "guest";


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

    }


    /* =====================================================
       PERSIST
    ===================================================== */

    persist() {

        saveState(
            this.state,
            this.state.username === "بازیکن مهمان"
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


    /* =====================================================
       INIT
    ===================================================== */

    init() {

        document
            .querySelectorAll("[data-page]")
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
            .getElementById("themeToggle")
            ?.addEventListener(
                "click",
                () => this.toggleTheme()
            );


        document
            .getElementById("authButton")
            ?.addEventListener(
                "click",
                () => this.go("auth")
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

    }


    /* =====================================================
       NAVIGATION
    ===================================================== */

    go(page) {

        document
            .querySelectorAll(".page")
            .forEach(element =>
                element.classList.remove("active")
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

            this.renderPaymentState();

        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }


    /* =====================================================
       THEME
    ===================================================== */

    toggleTheme() {

        document.body.classList.toggle(
            "dark"
        );


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
            localStorage.getItem(
                "quizduo_theme"
            ) ||
            this.state.theme ||
            "light";


        document.body.classList.toggle(
            "dark",
            theme === "dark"
        );

    }


    /* =====================================================
       AUTH
    ===================================================== */

    initAuth() {

        document
            .getElementById("toggleAuth")
            .addEventListener(
                "click",
                () => {

                    this.authRegister =
                        !this.authRegister;


                    document
                        .getElementById("authTitle")
                        .textContent =
                            this.authRegister
                                ? "ساخت حساب جدید"
                                : "ورود";


                    document
                        .getElementById("authSubmit")
                        .textContent =
                            this.authRegister
                                ? "ثبت‌نام"
                                : "ورود";


                    document
                        .getElementById("toggleAuth")
                        .textContent =
                            this.authRegister
                                ? "ورود به حساب"
                                : "ساخت حساب جدید";


                    document
                        .getElementById("phoneField")
                        .classList.toggle(
                            "hidden",
                            !this.authRegister
                        );


                    document
                        .getElementById("authMsg")
                        .textContent = "";

                }
            );


        document
            .getElementById("authBack")
            .addEventListener(
                "click",
                () => this.go("home")
            );


        document
            .getElementById("authSubmit")
            .addEventListener(
                "click",
                () => this.submitAuth()
            );


        document
            .getElementById("logoutButton")
            ?.addEventListener(
                "click",
                () => this.logout()
            );

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


        const msg =
            document
                .getElementById("authMsg");


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
                    String(user.username)
                        .toLowerCase() ===
                    name.toLowerCase()
            );


        /* -------------------------
           REGISTER
        ------------------------- */

        if (this.authRegister) {

            if (existing) {

                msg.textContent =
                    "این نام کاربری قبلاً استفاده شده است.";

                return;

            }


            if (!/^09\d{9}$/.test(phone)) {

                msg.textContent =
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


            msg.textContent =
                "حساب با موفقیت ساخته شد.";

        }


        /* -------------------------
           LOGIN
        ------------------------- */

        else {

            if (
                !existing ||
                existing.password !== password
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


        setTimeout(
            () => this.go("home"),
            450
        );

    }


    logout() {

        logoutUser();

        this.state =
            createDefaultState();

        this.state.username =
            "بازیکن مهمان";


        this.quiz =
            new QuizEngine(
                this.state,
                () => this.persist()
            );


        this.persist();

        this.go("home");

    }


    /* =====================================================
       QUIZ
    ===================================================== */

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


            const stagesWithQuestions =
                this.quiz.questions
                    .map(
                        question =>
                            Number(question.stage)
                    )
                    .filter(
                        stage =>
                            Number.isFinite(stage)
                    );


            const maxStage =
                Math.max(
                    5,
                    stagesWithQuestions.length
                        ? Math.max(
                            ...stagesWithQuestions
                        )
                        : 1
                );


            box.innerHTML = "";


            for (
                let stage = 1;
                stage <= maxStage;
                stage++
            ) {

                const available =
                    stage <= unlocked;


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
                    `stage-card panel
                    ${available ? "" : "locked"}
                    ${completed ? "completed" : ""}`;


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
                            this.startStage(stage)
                    );

                }


                box.appendChild(card);

            }


            document
                .getElementById("quizBox")
                .classList.add("hidden");

        }


        catch (error) {

            box.innerHTML =
                `<div class="panel error">
                    خطا در بارگذاری سوال‌ها:
                    ${escapeHTML(
                        error.message
                    )}
                </div>`;

        }

    }


    async startStage(stage) {

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
                    "شما قبلاً امتیاز این مرحله را کسب کرده‌اید." +
                    "\n\n" +
                    "آیا مایلید دوباره این مرحله را بازی کنید؟" +
                    "\n\n" +
                    "بازی کردن در این مرحله نه از شما قلب کم می‌کند و نه XP اضافه می‌کند."
                );


            if (!replay) {
                return;
            }

        }


        if (
            !this.quiz.questions.length ||
            this.quiz.currentCategory !== category
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

            const box =
                document.getElementById(
                    "quizBox"
                );


            box.classList.remove(
                "hidden"
            );


            box.innerHTML =
                `<div class="error">
                    این مرحله سؤال قابل بازی ندارد.
                    لطفاً ساختار فایل JSON را بررسی کنید.
                </div>`;


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
            !normalized.question
        ) {

            box.innerHTML =
                `<p>
                    متن سؤال پیدا نشد.
                </p>`;


            box.classList.remove(
                "hidden"
            );


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


        if (!options.length) {

            box.innerHTML =
                `<p>
                    گزینه‌های این سؤال پیدا نشدند.
                </p>`;


            box.classList.remove(
                "hidden"
            );


            return;

        }


        box.classList.remove(
            "hidden"
        );


        box.innerHTML = `

            <div class="quiz-top">

                <span>
                    مرحله
                    ${this.quiz.currentStage}
                </span>

                <span>
                    سوال
                    ${this.quiz.currentQuestion + 1}
                    از
                    ${this.quiz.getQuestionCount()}
                </span>

            </div>


            <h3>
                ${escapeHTML(
                    normalized.question
                )}
            </h3>


            <div class="options">

                ${
                    options
                        .map(
                            (option, index) =>
                                `<button
                                    class="option"
                                    data-i="${index}">
                                    ${escapeHTML(
                                        String(option)
                                    )}
                                </button>`
                        )
                        .join("")
                }

            </div>


            <div
                id="quizFeedback"
                class="quiz-feedback">
            </div>

        `;


        box
            .querySelectorAll(".option")
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
            this.quiz.answer(index);


        const box =
            document.getElementById(
                "quizBox"
            );


        box
            .querySelectorAll(".option")
            .forEach(
                button =>
                    button.disabled = true
            );


        const feedback =
            document.getElementById(
                "quizFeedback"
            );


        feedback.innerHTML =
            result.correct
                ? `<div class="success">
                    ✓ پاسخ درست بود!
                   </div>`
                : `<div class="error">
                    ✗ پاسخ درست نبود.
                   </div>`;


        if (result.explanation) {

            feedback.innerHTML +=
                `<div class="explanation">
                    ${escapeHTML(
                        result.explanation
                    )}
                </div>`;

        }


        if (result.finished) {

            feedback.innerHTML +=
                result.passed

                    ? `<div class="result-good">
                        🎉 مرحله را با موفقیت تمام کردی!
                        ${
                            result.earnedXP
                                ? `+${result.earnedXP} XP`
                                : ""
                        }
                       </div>`

                    : `<div class="result-bad">
                        این مرحله را رد نکردی.
                        ${
                            result.heartLost
                                ? "یک قلب کم شد."
                                : ""
                        }
                       </div>`;


            feedback.innerHTML +=
                `<button
                    id="quizNext"
                    class="primary full">
                    ادامه
                </button>`;


            document
                .getElementById("quizNext")
                .onclick =
                    () => this.renderStages();

        }


        else {

            feedback.innerHTML +=
                `<button
                    id="quizNext"
                    class="primary full">
                    سوال بعدی
                </button>`;


            document
                .getElementById("quizNext")
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


        if (element) {

            element.textContent =
                `XP ${this.state.xp} · ❤️ ${this.state.hearts}`;

        }

    }


    /* =====================================================
       PROFILE
    ===================================================== */

    renderProfile() {

        const state =
            this.state;


        const name =
            document.getElementById(
                "profileName"
            );


        if (!name) {
            return;
        }


        name.textContent =
            state.username ||
            "بازیکن مهمان";


        document
            .getElementById("profileScore")
            .textContent =
                state.xp || 0;


        document
            .getElementById("profileStreak")
            .textContent =
                state.streak || 0;


        document
            .getElementById("profileStage")
            .textContent =
                Math.max(
                    1,
                    state.generalStage || 1,
                    state.funStage || 1
                ) - 1;


        document
            .getElementById("subscriptionStatus")
            .textContent =
                state.subscription === "premium"
                    ? "Premium 👑"
                    : state.subscription === "paid"
                        ? "اشتراکی"
                        : "رایگان";


        const authButton =
            document.getElementById(
                "authButton"
            );


        if (authButton) {

            authButton.textContent =
                state.username ===
                "بازیکن مهمان"
                    ? "ورود / ثبت‌نام"
                    : state.username;

        }

    }


    /* =====================================================
       LEADERBOARD
    ===================================================== */

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
            rows
                .map(
                    (item, index) =>
                        `
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
                )
                .join("");

    }


    /* =====================================================
       SUBSCRIPTION
    ===================================================== */

    initSubscription() {

        document
            .querySelectorAll(".select-plan")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () =>
                        this.selectPlan(
                            button.dataset.plan
                        )
                );

            });


        document
            .getElementById("applyDiscount")
            .addEventListener(
                "click",
                () => this.applyDiscount()
            );


        document
            .getElementById("closePayment")
            .addEventListener(
                "click",
                () =>
                    document
                        .getElementById(
                            "paymentPanel"
                        )
                        .classList.add(
                            "hidden"
                        )
            );


        document
            .getElementById("paymentFile")
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
            .getElementById("submitPayment")
            .addEventListener(
                "click",
                () => this.submitPayment()
            );

    }


    selectPlan(id) {

        if (
            !subscriptionPlans[id]
        ) {

            return;

        }


        this.selectedPlan =
            id;


        this.discountPercent =
            0;


        this.testFixedAmount =
            null;


        document
            .getElementById("discountCode")
            .value = "";


        document
            .getElementById("paymentPanel")
            .classList.remove(
                "hidden"
            );


        document
            .getElementById(
                "selectedPlanTitle"
            )
            .textContent =
                subscriptionPlans[id].name;


        document
            .getElementById(
                "selectedAmount"
            )
            .textContent =
                money(
                    subscriptionPlans[id].price
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


    /* =====================================================
       DISCOUNT
    ===================================================== */

    async applyDiscount() {

        const code =
            document
                .getElementById(
                    "discountCode"
                )
                .value
                .trim()
                .toUpperCase();


        const message =
            document
                .getElementById(
                    "discountMessage"
                );


        if (!this.selectedPlan) {

            return;

        }


        /* -------------------------
           PRIVATE TEST CODE
        ------------------------- */

        if (
            code === PRIVATE_TEST_CODE
        ) {

            if (
                this.selectedPlan !==
                "nineMonth"
            ) {

                message.textContent =
                    "این کد تست فقط برای پلن ۹ ماهه Premium فعال است.";

                this.testFixedAmount =
                    null;

                this.discountPercent =
                    0;

                this.updateFinalPrice();

                return;

            }


            this.testFixedAmount =
                100000;


            this.discountPercent =
                0;


            message.textContent =
                "کد تست خصوصی اعمال شد. مبلغ تست: ۱۰۰٬۰۰۰ تومان.";


            this.updateFinalPrice();

            return;

        }


        /* -------------------------
           NORMAL DISCOUNT
        ------------------------- */

        this.testFixedAmount =
            null;


        if (!code) {

            this.discountPercent =
                0;


            message.textContent =
                "کدی وارد نشده است.";


            this.updateFinalPrice();

            return;

        }


        if (
            discountCodes[code]
        ) {

            this.discountPercent =
                discountCodes[code];


            message.textContent =
                `کد با ${this.discountPercent}٪ تخفیف اعمال شد.`;


            this.updateFinalPrice();

            return;

        }


        /* -------------------------
           SERVER TEST CODE
        ------------------------- */

        message.textContent =
            "در حال بررسی کد...";


        try {

            const response =
                await fetch(
                    APPS_SCRIPT_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "text/plain;charset=utf-8"
                        },

                        body:
                            JSON.stringify({

                                action:
                                    "validateDiscount",

                                code,

                                plan:
                                    this.selectedPlan

                            })

                    }
                );


            const text =
                await response.text();


            const data =
                JSON.parse(text);


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


                message.textContent =
                    "کد تست خصوصی تأیید شد؛ مبلغ نهایی ۱۰۰٬۰۰۰ تومان است.";

            }

            else {

                this.testFixedAmount =
                    null;

                this.discountPercent =
                    0;


                message.textContent =
                    "کد تخفیف معتبر نیست.";

            }

        }

        catch (error) {

            console.error(error);


            this.testFixedAmount =
                null;


            this.discountPercent =
                0;


            message.textContent =
                "بررسی کد انجام نشد؛ اتصال Google Apps Script را بررسی کنید.";

        }


        this.updateFinalPrice();

    }


    updateFinalPrice() {

        if (!this.selectedPlan) {
            return;
        }


        const base =
            subscriptionPlans[
                this.selectedPlan
            ].price;


        const final =
            this.testFixedAmount ??
            Math.round(
                base *
                (
                    1 -
                    this.discountPercent /
                    100
                )
            );


        document
            .getElementById(
                "finalPrice"
            )
            .textContent =
                money(final);

    }


    renderPaymentState() {

        if (this.selectedPlan) {

            this.updateFinalPrice();

        }

    }


    /* =====================================================
       PAYMENT
    ===================================================== */

    async submitPayment() {

        const message =
            document
                .getElementById(
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
            !this.paymentFile.type
                .startsWith("image/")
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


            const enteredCode =
                document
                    .getElementById(
                        "discountCode"
                    )
                    .value
                    .trim()
                    .toUpperCase();


            const amount =
                this.testFixedAmount ??
                Math.round(
                    plan.price *
                    (
                        1 -
                        this.discountPercent /
                        100
                    )
                );


            const payload = {

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

                amount,

                originalAmount:
                    plan.price,

                discountPercent:
                    this.discountPercent,

                discountCode:
                    enteredCode,

                fileName:
                    this.paymentFile.name,

                mimeType:
                    this.paymentFile.type,

                receiptBase64:
                    base64

            };


            const response =
                await fetch(
                    APPS_SCRIPT_URL,
                    {

                        method: "POST",

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


            let data = null;


            try {

                data =
                    JSON.parse(text);

            }

            catch {

                data = null;

            }


            if (
                !response.ok ||
                (
                    data &&
                    data.success === false
                )
            ) {

                throw new Error(
                    data?.message ||
                    "ارسال ناموفق بود."
                );

            }


            message.textContent =
                data?.message ||
                "فیش با موفقیت برای بررسی ارسال شد.";


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


            this.paymentFile =
                null;

        }


        catch (error) {

            console.error(error);


            message.textContent =
                "ارسال فیش انجام نشد. اتصال Google Apps Script یا code.gs را بررسی کنید.";

        }

    }


    getRegisteredPhone() {

        const user =
            getUsers().find(
                user =>
                    String(user.username)
                        .toLowerCase() ===
                    String(this.state.username)
                        .toLowerCase()
            );


        return user?.phone || "";

    }


    fileToBase64(file) {

        return new Promise(
            (resolve, reject) => {

                const reader =
                    new FileReader();


                reader.onload =
                    () => {

                        resolve(
                            String(
                                reader.result
                            )
                                .split(",")[1] ||
                            ""
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


    /* =====================================================
       CHAT
    ===================================================== */

    initChat() {

        this.loadChat();


        document
            .getElementById("sendChat")
            .addEventListener(
                "click",
                () => {

                    const input =
                        document.getElementById(
                            "chatInput"
                        );


                    const text =
                        input.value.trim();


                    if (!text) {
                        return;
                    }


                    const messages =
                        JSON.parse(
                            localStorage.getItem(
                                "quizduo_chat"
                            ) || "[]"
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


                    input.value = "";


                    this.loadChat();

                }
            );

    }


    loadChat() {

        let messages = [];


        try {

            messages =
                JSON.parse(
                    localStorage.getItem(
                        "quizduo_chat"
                    ) || "[]"
                );

        }

        catch {

            messages = [];

        }


        document
            .getElementById(
                "messages"
            )
            .innerHTML =
                messages
                    .map(
                        message =>
                            `
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


    /* =====================================================
       SUPPORT
    ===================================================== */

    initSupport() {

        document
            .getElementById(
                "supportSend"
            )
            .addEventListener(
                "click",
                () => {

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
                        document
                            .getElementById(
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


                    const support =
                        JSON.parse(
                            localStorage.getItem(
                                "quizduo_support"
                            ) || "[]"
                        );


                    support.push({

                        username:
                            this.state.username,

                        subject,

                        text,

                        date:
                            Date.now()

                    });


                    localStorage.setItem(
                        "quizduo_support",
                        JSON.stringify(
                            support
                        )
                    );


                    message.textContent =
                        "درخواست در این نسخه ذخیره شد.";

                }
            );

    }

}


/* =========================================================
   START
========================================================= */

window.addEventListener(
    "DOMContentLoaded",
    () => {

        const app =
            new App();

        app.init();

    }
);
