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


const API_URL =
    "https://script.google.com/macros/s/AKfycbwQNOpTNYI6jD2obOFkK02eEjSZd2OzkPiwvBgN_xnDgsZ90B3a_FCmXkIvzVyuxzJiZQ/exec";


/*
 * در فایل منبعی که در اختیارم بود، شماره حساب واقعی
 * وجود نداشت؛ بنابراین شماره‌ای را حدس نمی‌زنم.
 */
const ACCOUNT_NUMBER = "";


const PLANS = {

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


function normalizeQuestion(question) {

    if (!question) {
        return null;
    }


    const text =
        String(
            question.question ??
            question.q ??
            question.text ??
            question.title ??
            ""
        );


    let options =
        question.options ??
        question.choices ??
        question.answers ??
        [];


    if (!Array.isArray(options)) {

        options =
            Object.values(
                options || {}
            );

    }


    options =
        options.map(option => {

            if (
                option &&
                typeof option === "object"
            ) {

                return String(
                    option.text ??
                    option.label ??
                    option.value ??
                    option.answer ??
                    ""
                );

            }

            return String(
                option ?? ""
            );

        });


    return {
        ...question,
        question: text,
        options
    };

}


class QuizDuoApp {

    constructor() {

        const current =
            getCurrentUser() ||
            "guest";


        this.state =
            loadState(
                createDefaultState(),
                current
            );


        this.state.username =
            current === "guest"
                ? "بازیکن مهمان"
                : current;


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


        this.server = {

            payments: [],

            support: []

        };


        this.supportReady =
            false;

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


        this.initAuth();

        this.initQuiz();

        this.initSubscription();

        this.initChat();

        this.initSupport();

        this.loadTheme();

        this.renderProfile();

        this.renderQuizStats();

        this.setupPanels();

        this.syncServerUpdates();

        this.go("home");

    }


    isGuest() {

        return (
            this.state.username ===
            "بازیکن مهمان"
        );

    }


    go(page) {

        document
            .querySelectorAll(
                ".page"
            )
            .forEach(
                pageElement =>
                    pageElement.classList.remove(
                        "active"
                    )
            );


        document
            .getElementById(page)
            ?.classList.add(
                "active"
            );


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


        if (page === "support") {

            this.setupPanels();

            this.syncServerUpdates();

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


        this.state.theme =
            dark
                ? "dark"
                : "light";


        localStorage.setItem(
            "quizduo_theme",
            this.state.theme
        );

    }


    loadTheme() {

        const saved =
            localStorage.getItem(
                "quizduo_theme"
            ) ||
            this.state.theme;


        document.body
            .classList
            .toggle(
                "dark",
                saved === "dark"
            );

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
                        .classList
                        .toggle(
                            "hidden",
                            !this.authRegister
                        );


                    document
                        .getElementById(
                            "authMsg"
                        )
                        .textContent =
                        "";

                }
            );


        document
            .getElementById(
                "authBack"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.go("home")
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
            document
                .getElementById(
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

                username:
                    name,

                password,

                phone,

                createdAt:
                    Date.now()

            });


            saveUsers(users);

            setCurrentUser(name);

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

        }


        this.state =
            loadState(
                createDefaultState(),
                name
            );


        this.state.username =
            name;


        this.persist();


        message.textContent =
            this.authRegister
                ? "حساب با موفقیت ساخته شد."
                : "ورود موفق بود.";


        setTimeout(
            () =>
                this.go("home"),
            400
        );

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
                                button.dataset.categoryTab;


                            this.renderStages();

                        }
                    );

                }
            );

    }


    async renderStages() {

        const box =
            document.getElementById(
                "stages"
            );


        const category =
            this.quiz.currentCategory ||
            "general";


        if (!box) {
            return;
        }


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


            const stageNumbers =
                [
                    ...new Set(
                        this.quiz.questions.map(
                            question =>
                                Number(
                                    question.stage
                                ) || 1
                        )
                    )
                ]
                .sort(
                    (a, b) =>
                        a - b
                );


            const maxStage =
                Math.max(
                    8,
                    ...stageNumbers
                );


            const subscribed =
                this.hasActiveSubscription();


            box.innerHTML =
                "";


            for (
                let stage = 1;
                stage <= maxStage;
                stage++
            ) {

                const questions =
                    this.quiz.getStageQuestions(
                        stage
                    );


                const completed =
                    isStageCompleted(
                        this.state,
                        category,
                        stage
                    );


                const available =
                    stage === 1 ||
                    subscribed;


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
                                    ? `${questions.length} سوال چهارگزینه‌ای`
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

                } else if (!available) {

                    card.addEventListener(
                        "click",
                        () => {

                            this.go(
                                "subscription"
                            );


                            this.toast(
                                "برای مراحل بعد از مرحله ۱، اشتراک تأییدشده لازم است."
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
                "Quiz loading error:",
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


            this.toast(
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


        if (
            completed &&
            !confirm(
                "این مرحله قبلاً تکمیل شده است. دوباره بازی شود؟"
            )
        ) {

            return;

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
            !Array.isArray(questions) ||
            !questions.length
        ) {

            this.toast(
                `برای مرحله ${stage} سوال قابل استفاده پیدا نشد.`
            );


            console.error(
                "Empty stage",
                {
                    category,
                    stage,

                    loadedQuestions:
                        this.quiz.questions.length,

                    stageQuestions:
                        this.quiz
                            .getStageQuestions(
                                stage
                            )
                            .length
                }
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
            normalizeQuestion(
                question
            );


        if (
            !box ||
            !normalized ||
            !normalized.question.trim()
        ) {

            return;

        }


        box.classList.remove(
            "hidden"
        );


        box.innerHTML = `

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


            <h3>

                ${escapeHTML(
                    normalized.question
                )}

            </h3>


            <div class="answers quiz-options-grid">

                ${
                    normalized.options
                        .map(
                            (option, index) => `

                                <button
                                    type="button"
                                    class="answer quiz-option"
                                    data-answer="${index}"
                                >

                                    <span class="quiz-option-letter">

                                        ${String.fromCharCode(
                                            65 + index
                                        )}

                                    </span>

                                    <span>

                                        ${escapeHTML(
                                            option
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
                            this.answer(
                                Number(
                                    button.dataset.answer
                                )
                            )
                    );

                }
            );


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


        if (!box) {
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

                            🎉 مرحله با موفقیت تمام شد!

                            ${
                                result.earnedXP
                                    ? `+${result.earnedXP} XP`
                                    : ""
                            }

                        </div>
                      `

                    : `
                        <div class="result-bad">

                            مرحله رد نشد.

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
                    بازگشت به مراحل
                </button>
                `;


            document
                .getElementById(
                    "quizNext"
                )
                .onclick =
                () =>
                    this.renderStages();

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


        this.persist();

    }


    renderQuizStats() {

        const element =
            document.getElementById(
                "quizStats"
            );


        if (!element) {
            return;
        }


        element.textContent =
            `⭐ ${
                Number(
                    this.state.xp || 0
                ).toLocaleString(
                    "fa-IR"
                )
            }
             •
             ❤️ ${
                Number(
                    this.state.hearts ?? 5
                ).toLocaleString(
                    "fa-IR"
                )
             }`;

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


                    const fileName =
                        document
                            .getElementById(
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


        [
            ".premium-preview",
            ".premium-benefits",
            ".referral-panel",
            ".premium-plan",
            ".popular-badge",
            ".premium-crown"
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


    selectPlan(id) {

        const plan =
            PLANS[id];


        if (!plan) {
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


        if (
            account &&
            ACCOUNT_NUMBER
        ) {

            account.textContent =
                ACCOUNT_NUMBER;

        }

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


        if (this.isGuest()) {

            message.textContent =
                "ابتدا وارد حساب شوید.";

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
                PLANS[
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
                    this.getPhone(),

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
                "فیش ارسال شد و در انتظار بررسی است.";


            document
                .getElementById(
                    "paymentFile"
                )
                .value =
                "";


            this.paymentFile =
                null;


            setTimeout(
                () =>
                    this.syncServerUpdates(),
                1500
            );


        } catch (error) {

            console.error(
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


    getPhone() {

        const user =
            getUsers().find(
                item =>
                    String(
                        item.username
                    ).toLowerCase() ===
                    String(
                        this.state.username
                    ).toLowerCase()
            );


        return user?.phone || "";

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


        document.addEventListener(
            "click",
            event => {

                const reply =
                    event.target.closest(
                        "[data-support-reply]"
                    );


                const close =
                    event.target.closest(
                        "[data-support-close]"
                    );


                if (reply) {

                    this.sendSupportReply(
                        reply.dataset.supportReply
                    );

                }


                if (close) {

                    this.closeSupport(
                        close.dataset.supportClose
                    );

                }

            }
        );

    }


    setupPanels() {

        if (this.supportReady) {
            return;
        }


        this.supportReady =
            true;


        const style =
            document.createElement(
                "style"
            );


        style.textContent = `

            .qd-updates {
                margin-top: 18px;
            }

            .qd-card {
                border: 1px solid var(--border);
                border-radius: 16px;
                padding: 15px;
                margin-top: 10px;
                background: var(--surface);
            }

            .qd-top,
            .qd-actions {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }

            .qd-info {
                color: var(--muted);
                font-size: .85rem;
                margin-top: 7px;
            }

            .qd-thread {
                display: grid;
                gap: 8px;
                margin-top: 12px;
            }

            .qd-msg {
                padding: 10px 12px;
                border-radius: 13px;
                max-width: 88%;
                white-space: pre-wrap;
            }

            .qd-user {
                margin-right: auto;
                background: var(--surface2);
            }

            .qd-admin {
                margin-left: auto;
                background: rgba(19,170,164,.12);
            }

            .qd-reply {
                margin-top: 12px;
            }

            .qd-reply textarea {
                min-height: 80px;
            }

            .qd-status {
                padding: 5px 9px;
                border-radius: 999px;
                background: var(--surface2);
                font-size: .76rem;
            }

        `;


        document.head.appendChild(
            style
        );


        const support =
            document.getElementById(
                "support"
            );


        if (
            support &&
            !document.getElementById(
                "qdSupportList"
            )
        ) {

            const panel =
                document.createElement(
                    "div"
                );


            panel.className =
                "panel qd-updates";


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
                        id="qdRefresh"
                        class="secondary"
                        type="button"
                    >
                        به‌روزرسانی
                    </button>

                </div>

                <div id="qdSupportList">

                    <p class="message">
                        در حال دریافت...
                    </p>

                </div>

            `;


            support.appendChild(
                panel
            );


            panel
                .querySelector(
                    "#qdRefresh"
                )
                .addEventListener(
                    "click",
                    () =>
                        this.syncServerUpdates()
                );

        }


        const subscription =
            document.getElementById(
                "subscription"
            );


        if (
            subscription &&
            !document.getElementById(
                "qdPaymentList"
            )
        ) {

            const panel =
                document.createElement(
                    "div"
                );


            panel.className =
                "panel qd-updates";


            panel.innerHTML = `

                <div class="section-heading">

                    <div>

                        <span class="eyebrow">
                            وضعیت حساب
                        </span>

                        <h3>
                            پرداخت‌های من
                        </h3>

                    </div>

                </div>

                <div id="qdPaymentList">

                    <p class="message">
                        در حال دریافت...
                    </p>

                </div>

            `;


            subscription.appendChild(
                panel
            );

        }

    }


    async submitSupport() {

        const message =
            document.getElementById(
                "supportMsg"
            );


        if (this.isGuest()) {

            message.textContent =
                "ابتدا وارد حساب شوید.";

            this.go("auth");

            return;

        }


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


        if (
            !subject ||
            !text
        ) {

            message.textContent =
                "موضوع و پیام را وارد کنید.";

            return;

        }


        message.textContent =
            "در حال ارسال...";


        const conversationId =
            window.crypto &&
            crypto.randomUUID
                ? crypto.randomUUID()
                : `c-${Date.now()}`;


        try {

            await this.serverWrite({

                action:
                    "support",

                username:
                    this.state.username,

                phone:
                    this.getPhone(),

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


            message.textContent =
                "گفتگو ثبت شد.";


            setTimeout(
                () =>
                    this.syncServerUpdates(),
                1200
            );


        } catch (error) {

            console.error(
                error
            );


            message.textContent =
                error.message ||
                "ارسال ناموفق بود.";

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


        textarea.disabled =
            true;


        try {

            await this.serverWrite({

                action:
                    "supportUserReply",

                username:
                    this.state.username,

                conversationId,

                message:
                    textarea.value.trim()

            });


            textarea.value =
                "";


            setTimeout(
                () =>
                    this.syncServerUpdates(),
                1000
            );


        } catch (error) {

            this.toast(
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

        if (
            !confirm(
                "این گفتگو به پایان برسد؟"
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


        } catch (error) {

            this.toast(
                error.message ||
                "بستن گفتگو ناموفق بود."
            );

        }

    }


    /* ======================================================
       SERVER READ - JSONP
    ====================================================== */


    async serverRequest(
        action
    ) {

        if (
            this.isGuest()
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
                    `qd_${Date.now()}_${Math.random()
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


                const cleanup =
                    () => {

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


                window[
                    callbackName
                ] =
                    data => {

                        cleanup();


                        if (
                            data?.success ===
                            false
                        ) {

                            reject(
                                new Error(
                                    data.message ||
                                    "درخواست ناموفق بود."
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


    async serverWrite(
        payload
    ) {

        try {

            const response =
                await fetch(
                    API_URL,
                    {

                        method:
                            "POST",

                        mode:
                            "no-cors",

                        redirect:
                            "manual",

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


            if (
                response.type ===
                    "opaque" ||

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
                `HTTP ${response.status}`
            );


        } catch (error) {

            console.error(
                "serverWrite",
                error
            );


            throw new Error(
                "ارسال به سامانه انجام نشد."
            );

        }

    }


    async syncServerUpdates() {

        if (
            this.isGuest()
        ) {

            this.state.subscriptionInfo = {
                active:
                    false
            };


            this.renderUserPanels();

            return;

        }


        try {

            const data =
                await this.serverRequest(
                    "userUpdates"
                );


            this.server = {

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
                this.state.subscriptionInfo.active
                    ? "active"
                    : "inactive";


            this.state.subscription =
                this.state.subscriptionInfo.active
                    ? "paid"
                    : "free";


            this.persist();

            this.renderUserPanels();


            if (
                document
                    .getElementById(
                        "quiz"
                    )
                    ?.classList.contains(
                        "active"
                    )
            ) {

                this.renderStages();

            }


        } catch (error) {

            console.error(
                "syncServerUpdates",
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
            !info?.active
        ) {

            return false;

        }


        return (
            new Date(
                info.expiry ||
                0
            )
                .getTime() >
            Date.now()
        );

    }


    renderUserPanels(
        error = null
    ) {

        this.setupPanels();


        const paymentBox =
            document.getElementById(
                "qdPaymentList"
            );


        const supportBox =
            document.getElementById(
                "qdSupportList"
            );


        if (paymentBox) {

            if (
                error &&
                !this.server.payments.length
            ) {

                paymentBox.innerHTML =
                    `
                    <p class="message">
                        اتصال به سامانه برقرار نشد.
                    </p>
                    `;

            } else if (
                !this.server.payments.length
            ) {

                paymentBox.innerHTML =
                    `
                    <p class="message">
                        هنوز فیشی ثبت نشده است.
                    </p>
                    `;

            } else {

                paymentBox.innerHTML =
                    this.server.payments
                        .map(
                            payment =>
                                `

                                <div class="qd-card">

                                    <div class="qd-top">

                                        <b>

                                            ${escapeHTML(
                                                payment.planName ||
                                                this.planName(
                                                    payment.planId
                                                )
                                            )}

                                        </b>

                                        <span class="qd-status">

                                            ${escapeHTML(
                                                payment.status ||
                                                "در انتظار بررسی"
                                            )}

                                        </span>

                                    </div>

                                    <div class="qd-info">

                                        ${money(
                                            payment.amount
                                        )}

                                        ·

                                        ${escapeHTML(
                                            this.formatDate(
                                                payment.timestamp
                                            )
                                        )}

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


        if (supportBox) {

            if (
                error &&
                !this.server.support.length
            ) {

                supportBox.innerHTML =
                    `
                    <p class="message">
                        اتصال به سامانه برقرار نشد.
                    </p>
                    `;

            } else if (
                !this.server.support.length
            ) {

                supportBox.innerHTML =
                    `
                    <p class="message">
                        هنوز گفتگویی ندارید.
                    </p>
                    `;

            } else {

                supportBox.innerHTML =
                    this.server.support
                        .map(
                            conversation => {

                                const thread =
                                    (
                                        conversation.thread ||
                                        []
                                    )
                                        .map(
                                            message =>
                                                `
                                                <div class="qd-msg ${
                                                    message.sender ===
                                                    "admin"
                                                        ? "qd-admin"
                                                        : "qd-user"
                                                }">

                                                    <b>

                                                        ${
                                                            message.sender ===
                                                            "admin"
                                                                ? "پشتیبانی QuizDuo"
                                                                : "شما"
                                                        }

                                                    </b>

                                                    <div>

                                                        ${escapeHTML(
                                                            message.text ||
                                                            ""
                                                        )}

                                                    </div>

                                                    <small>

                                                        ${escapeHTML(
                                                            this.formatDate(
                                                                message.timestamp
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

                                    <div class="qd-card">

                                        <div class="qd-top">

                                            <b>

                                                ${escapeHTML(
                                                    conversation.subject ||
                                                    "بدون موضوع"
                                                )}

                                            </b>

                                            <span class="qd-status">

                                                ${escapeHTML(
                                                    conversation.status ||
                                                    "جدید"
                                                )}

                                            </span>

                                        </div>


                                        <div class="qd-thread">

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

                                                    <div class="qd-reply">

                                                        <textarea
                                                            data-support-input="${escapeHTML(
                                                                conversation.conversationId
                                                            )}"
                                                            placeholder="پیام بعدی در همین گفتگو..."
                                                        ></textarea>

                                                        <div class="qd-actions">

                                                            <button
                                                                class="primary"
                                                                type="button"
                                                                data-support-reply="${escapeHTML(
                                                                    conversation.conversationId
                                                                )}"
                                                            >
                                                                ارسال پیام
                                                            </button>

                                                            <button
                                                                class="secondary"
                                                                type="button"
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


    formatDate(value) {

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


    planName(
        id
    ) {

        return (
            PLANS[id]?.name ||
            "اشتراک"
        );

    }


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


        const badge =
            document.getElementById(
                "dashboardAccessBadge"
            );


        if (badge) {

            badge.textContent =
                active

                    ? "🔓 همه مراحل باز"

                    : "🔒 فقط ۱ مرحله رایگان";

        }


        const subscription =
            document.getElementById(
                "dashboardSubscription"
            );


        if (subscription) {

            subscription.textContent =
                active

                    ? "اشتراک فعال"

                    : "رایگان — ۱ مرحله";

        }


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


        const authButton =
            document.getElementById(
                "authButton"
            );


        if (authButton) {

            authButton.textContent =
                this.isGuest()

                    ? "ورود / ثبت‌نام"

                    : name;

        }

    }


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


        body.innerHTML =
            board.length

                ? board
                    .map(
                        (
                            item,
                            index
                        ) =>
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
                                    ${
                                        Number(
                                            item.xp ||
                                            0
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
                    .join("")

                : `
                    <tr>

                        <td colspan="4">
                            هنوز داده‌ای وجود ندارد.
                        </td>

                    </tr>
                  `;

    }


    initChat() {

        const send =
            () => {

                const input =
                    document.getElementById(
                        "chatInput"
                    );


                const text =
                    input?.value.trim();


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


        if (!box) {
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


    toast(text) {

        let element =
            document.getElementById(
                "quizduoToast"
            );


        if (!element) {

            element =
                document.createElement(
                    "div"
                );


            element.id =
                "quizduoToast";


            Object.assign(
                element.style,
                {

                    position:
                        "fixed",

                    bottom:
                        "20px",

                    right:
                        "20px",

                    zIndex:
                        99999,

                    padding:
                        "12px 16px",

                    borderRadius:
                        "12px",

                    background:
                        "#17262d",

                    color:
                        "#fff"

                }
            );


            document.body.appendChild(
                element
            );

        }


        element.textContent =
            text;


        clearTimeout(
            this.toastTimer
        );


        this.toastTimer =
            setTimeout(
                () =>
                    element.remove(),
                3000
            );

    }


    logout() {

        localStorage.removeItem(
            "quizduo_current_user"
        );


        location.reload();

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
