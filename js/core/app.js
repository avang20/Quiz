```javascript
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
    updateStreak,
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


const money =
    value =>
        Number(value || 0)
            .toLocaleString("fa-IR") +
        " تومان";


// =========================================================
// QUESTION NORMALIZATION
// =========================================================

function normalizeQuestionForUI(question) {

    if (!question) return null;


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


// =========================================================
// APP
// =========================================================

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


        this.authRegister = false;

        this.selectedPlan = null;

        this.discountPercent = 0;

        this.testFixedAmount = null;

        this.paymentFile = null;
    }


    // =====================================================
    // PERSIST
    // =====================================================

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


    // =====================================================
    // INIT
    // =====================================================

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


        // وضعیت پرداخت کاربر
        this.syncPaymentStatus();

        // پاسخ‌های پشتیبانی
        this.loadSupportTickets();
    }


    // =====================================================
    // NAVIGATION
    // =====================================================

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

            this.renderPaymentState();

            this.syncPaymentStatus();
        }


        if (page === "support") {

            this.loadSupportTickets();
        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    // =====================================================
    // THEME
    // =====================================================

    toggleTheme() {

        document.body.classList.toggle(
            "dark"
        );


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


        document.body.classList.toggle(
            "dark",
            theme === "dark"
        );
    }


    // =====================================================
    // AUTH
    // =====================================================

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
                u =>
                    String(u.username)
                        .toLowerCase() ===
                    name.toLowerCase()
            );


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
                createdAt: Date.now()
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

        } else {

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


    // =====================================================
    // QUIZ
    // =====================================================

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
                            .forEach(
                                b =>
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
                    i <= unlocked;


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


                card.innerHTML =
                    `<div class="stage-number">
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
                    </div>`;


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
                .getElementById("quizBox")
                .classList.add("hidden");


        } catch (error) {

            box.innerHTML =
                `<div class="panel error">
                    خطا در بارگذاری سوال‌ها:
                    ${escapeHTML(error.message)}
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
                    "شما قبلاً امتیاز این مرحله را کسب کرده‌اید. آیا مایلید دوباره این مرحله را بازی کنید؟\n\nبازی کردن در این مرحله نه از شما قلب کم می‌کند و نه XP اضافه می‌کند."
                );


            if (!replay) return;
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
                    String(option).trim() !== ""
            );


        box.classList.remove(
            "hidden"
        );


        box.innerHTML = `

            <div class="quiz-top">
                <span>
                    مرحله ${this.quiz.currentStage}
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
            .forEach(btn => {

                btn.addEventListener(
                    "click",
                    () =>
                        this.answer(
                            Number(
                                btn.dataset.i
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
                .getElementById(
                    "quizNext"
                )
                .onclick =
                    () =>
                        this.renderStages();


        } else {

            feedback.innerHTML +=
                `<button
                    id="quizNext"
                    class="primary full">
                    سوال بعدی
                </button>`;


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

        const el =
            document.getElementById(
                "quizStats"
            );


        if (el) {

            el.textContent =
                `XP ${this.state.xp} · ❤️ ${this.state.hearts}`;
        }
    }


    renderProfile() {

        const s =
            this.state;


        const name =
            document.getElementById(
                "profileName"
            );


        if (!name) return;


        name.textContent =
            s.username ||
            "بازیکن مهمان";


        document
            .getElementById(
                "profileScore"
            )
            .textContent =
                s.xp || 0;


        document
            .getElementById(
                "profileStreak"
            )
            .textContent =
                s.streak || 0;


        document
            .getElementById(
                "profileStage"
            )
            .textContent =
                Math.max(
                    1,
                    s.generalStage || 1,
                    s.funStage || 1
                ) - 1;


        document
            .getElementById(
                "subscriptionStatus"
            )
            .textContent =
                s.subscription === "premium"
                    ? "Premium 👑"
                    : s.subscription === "paid"
                        ? "اشتراکی"
                        : "رایگان";


        document
            .getElementById(
                "authButton"
            )
            .textContent =
                s.username === "بازیکن مهمان"
                    ? "ورود / ثبت‌نام"
                    : s.username;
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
                : [{
                    username:
                        "هنوز داده‌ای وجود ندارد",
                    xp: 0,
                    generalStage: 1,
                    funStage: 1
                }];


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


    // =====================================================
    // SUBSCRIPTION
    // =====================================================

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
                        .classList.add(
                            "hidden"
                        )
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

        if (!subscriptionPlans[id])
            return;


        this.selectedPlan = id;

        this.discountPercent = 0;

        this.testFixedAmount = null;


        document
            .getElementById(
                "discountCode"
            )
            .value = "";


        document
            .getElementById(
                "paymentPanel"
            )
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


        if (!this.selectedPlan)
            return;


        if (!code) {

            this.testFixedAmount = null;

            this.discountPercent = 0;

            msg.textContent =
                "کدی وارد نشده است.";

            this.updateFinalPrice();

            return;
        }


        if (discountCodes[code]) {

            this.testFixedAmount = null;

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
                    Number(data.amount);

                this.discountPercent = 0;


                msg.textContent =
                    "کد تست خصوصی تأیید شد؛ مبلغ نهایی ۱۰۰٬۰۰۰ تومان است.";

            } else {

                this.testFixedAmount = null;

                this.discountPercent = 0;


                msg.textContent =
                    "کد تخفیف معتبر نیست.";
            }


        } catch (error) {

            console.error(error);


            this.testFixedAmount = null;

            this.discountPercent = 0;


            msg.textContent =
                "بررسی کد انجام نشد؛ اتصال Google Apps Script را بررسی کنید.";
        }


        this.updateFinalPrice();
    }


    updateFinalPrice() {

        if (!this.selectedPlan)
            return;


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
                    this.discountPercent / 100
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


        this.syncPaymentStatus();
    }


    async submitPayment() {

        const msg =
            document.getElementById(
                "paymentMessage"
            );


        if (
            this.state.username ===
            "بازیکن مهمان"
        ) {

            msg.textContent =
                "ابتدا وارد حساب شوید یا ثبت‌نام کنید.";

            return;
        }


        if (!this.selectedPlan) {

            msg.textContent =
                "ابتدا یک پلن انتخاب کنید.";

            return;
        }


        if (!this.paymentFile) {

            msg.textContent =
                "لطفاً تصویر فیش پرداخت را انتخاب کنید.";

            return;
        }


        if (
            !this.paymentFile.type
                .startsWith("image/")
        ) {

            msg.textContent =
                "فقط فایل تصویری مجاز است.";

            return;
        }


        if (
            this.paymentFile.size >
            5 * 1024 * 1024
        ) {

            msg.textContent =
                "حجم تصویر باید کمتر از ۵ مگابایت باشد.";

            return;
        }


        msg.textContent =
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


            const normalAmount =
                this.testFixedAmount ??
                Math.round(
                    plan.price *
                    (
                        1 -
                        this.discountPercent / 100
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

                amount:
                    normalAmount,

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
            } catch {
                // پاسخ غیر JSON
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


            if (
                data?.testCodeApplied
            ) {

                this.testFixedAmount =
                    100000;

                this.discountPercent =
                    0;

                this.updateFinalPrice();


                document
                    .getElementById(
                        "discountMessage"
                    )
                    .textContent =
                        "کد تست خصوصی تأیید شد؛ مبلغ تست ۱۰۰٬۰۰۰ تومان است.";
            }


            msg.textContent =
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


            this.paymentFile = null;


            setTimeout(
                () =>
                    this.syncPaymentStatus(),
                1000
            );


        } catch (error) {

            console.error(error);


            msg.textContent =
                error.message ||
                "ارسال فیش انجام نشد.";
        }
    }


    getRegisteredPhone() {

        const user =
            getUsers().find(
                u =>
                    String(
                        u.username
                    ).toLowerCase() ===
                    String(
                        this.state.username
                    ).toLowerCase()
            );


        return user?.phone || "";
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
                            ).split(",")[1] ||
                            ""
                        );


                reader.onerror =
                    reject;


                reader.readAsDataURL(
                    file
                );
            }
        );
    }


    // =====================================================
    // PAYMENT STATUS SYNC
    // =====================================================

    async syncPaymentStatus() {

        if (
            !this.state.username ||
            this.state.username ===
            "بازیکن مهمان"
        ) {
            return;
        }


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
                                    "paymentStatus",

                                username:
                                    this.state.username
                            })
                    }
                );


            const text =
                await response.text();


            const data =
                JSON.parse(text);


            if (
                !data.success ||
                !data.found
            ) {
                return;
            }


            if (
                data.status ===
                "تأیید شد"
            ) {

                const plan =
                    subscriptionPlans[
                        data.planId
                    ];


                this.state.subscription =
                    plan?.premium
                        ? "premium"
                        : "paid";


                this.state.subscriptionPlan =
                    data.planId;


                this.state.subscriptionStatusText =
                    `اشتراک ${data.planName || ""} با موفقیت تأیید شد.`;


                this.persist();


                this.showPaymentStatusMessage(
                    `🎉 پرداخت شما تأیید شد و اشتراک ${escapeHTML(
                        data.planName || ""
                    )} برای حساب شما فعال شد.`
                );


            } else if (
                data.status ===
                "رد شد"
            ) {

                this.showPaymentStatusMessage(
                    "❌ پرداخت شما رد شد. در صورت بروز مشکل به آیدی @hv901 در بله پیام بدهید."
                );


            } else if (
                data.status ===
                "در انتظار بررسی"
            ) {

                this.showPaymentStatusMessage(
                    "⏳ فیش پرداخت شما دریافت شده و در انتظار بررسی است."
                );
            }


        } catch (error) {

            console.error(
                "Payment status error:",
                error
            );
        }
    }


    showPaymentStatusMessage(text) {

        const msg =
            document.getElementById(
                "paymentMessage"
            );


        if (!msg) return;


        msg.innerHTML =
            text;


        msg.style.display =
            "block";
    }


    // =====================================================
    // CHAT
    // =====================================================

    initChat() {

        this.loadChat();


        document
            .getElementById(
                "sendChat"
            )
            .addEventListener(
                "click",
                () => {

                    const input =
                        document.getElementById(
                            "chatInput"
                        );


                    const text =
                        input.value.trim();


                    if (!text) return;


                    const arr =
                        JSON.parse(
                            localStorage.getItem(
                                "quizduo_chat"
                            ) ||
                            "[]"
                        );


                    arr.push({
                        username:
                            this.state.username,

                        text,

                        date:
                            Date.now()
                    });


                    localStorage.setItem(
                        "quizduo_chat",
                        JSON.stringify(arr)
                    );


                    input.value = "";


                    this.loadChat();
                }
            );
    }


    loadChat() {

        const arr =
            JSON.parse(
                localStorage.getItem(
                    "quizduo_chat"
                ) ||
                "[]"
            );


        const messages =
            document.getElementById(
                "messages"
            );


        if (!messages) return;


        messages.innerHTML =
            arr
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


    // =====================================================
    // SUPPORT
    // =====================================================

    initSupport() {

        const button =
            document.getElementById(
                "supportSend"
            );


        if (!button) return;


        button.addEventListener(
            "click",
            () =>
                this.submitSupport()
        );


        this.ensureSupportRepliesBox();
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
            document
                .getElementById(
                    "supportMsg"
                );


        if (!subject || !text) {

            msg.textContent =
                "موضوع و پیام را وارد کنید.";

            return;
        }


        if (
            this.state.username ===
            "بازیکن مهمان"
        ) {

            msg.textContent =
                "برای ارسال درخواست پشتیبانی ابتدا وارد حساب شوید.";

            return;
        }


        msg.textContent =
            "در حال ارسال درخواست...";


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
                                    "support",

                                username:
                                    this.state.username,

                                phone:
                                    this.getRegisteredPhone(),

                                subject,

                                message:
                                    text
                            })
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok ||
                data.success === false
            ) {

                throw new Error(
                    data.message ||
                    "ارسال درخواست انجام نشد."
                );
            }


            msg.textContent =
                "درخواست شما با موفقیت برای پشتیبانی ارسال شد.";


            document
                .getElementById(
                    "supportSubject"
                )
                .value = "";


            document
                .getElementById(
                    "supportText"
                )
                .value = "";


            this.loadSupportTickets();


        } catch (error) {

            console.error(error);


            // fallback برای زمانی که code.gs هنوز نسخه قدیمی دارد
            const arr =
                JSON.parse(
                    localStorage.getItem(
                        "quizduo_support"
                    ) ||
                    "[]"
                );


            arr.push({
                username:
                    this.state.username,

                subject,

                text,

                date:
                    Date.now()
            });


            localStorage.setItem(
                "quizduo_support",
                JSON.stringify(arr)
            );


            msg.textContent =
                error.message ||
                "ارسال درخواست انجام نشد.";
        }
    }


    ensureSupportRepliesBox() {

        const panel =
            document.querySelector(
                "#support .panel"
            );


        if (!panel) return;


        if (
            document.getElementById(
                "supportReplies"
            )
        ) {
            return;
        }


        const box =
            document.createElement(
                "div"
            );


        box.id =
            "supportReplies";


        box.style.marginTop =
            "25px";


        box.innerHTML =
            `
            <div
                style="
                    border-top:1px solid #ddd;
                    padding-top:20px;
                ">

                <h3>
                    📩 پاسخ‌های پشتیبانی
                </h3>

                <div id="supportTicketsList">
                    در حال بررسی...
                </div>

            </div>
            `;


        panel.appendChild(
            box
        );
    }


    async loadSupportTickets() {

        this.ensureSupportRepliesBox();


        const list =
            document.getElementById(
                "supportTicketsList"
            );


        if (!list) return;


        if (
            this.state.username ===
            "بازیکن مهمان"
        ) {

            list.innerHTML =
                "<p>برای مشاهده درخواست‌ها وارد حساب شوید.</p>";

            return;
        }


        list.innerHTML =
            "<p>در حال دریافت پاسخ‌ها...</p>";


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
                                    "supportList",

                                username:
                                    this.state.username
                            })
                    }
                );


            const data =
                await response.json();


            if (
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "دریافت پاسخ‌ها انجام نشد."
                );
            }


            const tickets =
                data.tickets || [];


            if (!tickets.length) {

                list.innerHTML =
                    `
                    <div
                        style="
                            padding:15px;
                            opacity:.7;
                        ">
                        هنوز درخواست پشتیبانی ثبت نکرده‌اید.
                    </div>
                    `;

                return;
            }


            list.innerHTML =
                tickets
                    .slice()
                    .reverse()
                    .map(
                        ticket =>
                            `
                            <div
                                style="
                                    padding:16px;
                                    margin-bottom:12px;
                                    border:1px solid #ddd;
                                    border-radius:14px;
                                ">

                                <div
                                    style="
                                        display:flex;
                                        justify-content:space-between;
                                        gap:10px;
                                        flex-wrap:wrap;
                                    ">

                                    <strong>
                                        ${escapeHTML(
                                            ticket.subject
                                        )}
                                    </strong>

                                    <span>
                                        ${escapeHTML(
                                            ticket.status ||
                                            "جدید"
                                        )}
                                    </span>

                                </div>


                                <p>
                                    ${escapeHTML(
                                        ticket.message
                                    )}
                                </p>


                                ${
                                    ticket.reply
                                        ? `
                                            <div
                                                style="
                                                    margin-top:12px;
                                                    padding:12px;
                                                    border-radius:10px;
                                                    background:rgba(22,184,166,.10);
                                                ">

                                                <strong>
                                                    پاسخ پشتیبانی:
                                                </strong>

                                                <p>
                                                    ${escapeHTML(
                                                        ticket.reply
                                                    )}
                                                </p>

                                            </div>
                                          `
                                        : `
                                            <small>
                                                هنوز پاسخی ثبت نشده است.
                                            </small>
                                          `
                                }

                            </div>
                            `
                    )
                    .join("");


        } catch (error) {

            console.error(
                "Support list error:",
                error
            );


            list.innerHTML =
                `
                <div
                    style="
                        padding:12px;
                        color:#a32020;
                    ">
                    دریافت پاسخ‌ها انجام نشد.
                    بعداً دوباره امتحان کنید.
                </div>
                `;
        }
    }
}


// =========================================================
// START APP
// =========================================================

window.addEventListener(
    "DOMContentLoaded",
    () => new App().init()
);
```
