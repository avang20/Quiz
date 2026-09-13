import {
    DEFAULT_STATE,
    createDefaultState,
    calculateLevel,
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
    saveUsers,
    getLeaderboard,
    updateLeaderboard
} from "./storage.js";

import {
    todayKey,
    updateStreak,
    escapeHTML
} from "./utils.js";

import {
    QuizEngine,
    QUIZ_CONFIG
} from "./quiz.js";


/* =========================================================
   CONFIG
========================================================= */

const BACKEND_URL =
    "https://script.google.com/macros/s/AKfycbxbioqGAQ4cMTG4UDnKJSBkBGBgakRnTf7oU0fh5sCeU_ICdNqadod3HNTiJX5ycoZYyg/exec";


const MAX_RECEIPT_SIZE =
    5 * 1024 * 1024;


const DAILY_XP =
    10;


/* =========================================================
   SUBSCRIPTION PLANS
========================================================= */

const subscriptionPlans = {

    monthly: {

        name: "ماهانه",

        months: 1,

        gift: 0,

        price: 100000

    },


    quarterly: {

        name: "سه‌ماهه",

        months: 3,

        gift: 0,

        price: 270000

    },


    sixMonth: {

        name: "شش‌ماهه",

        months: 6,

        gift: 1,

        price: 480000

    },


    nineMonth: {

        name: "نه‌ماهه",

        months: 9,

        gift: 2,

        price: 660000

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
   APP
========================================================= */

class QuizDuoApp {

    constructor() {

        this.currentUser =
            getCurrentUser();


        this.state =
            this.currentUser

                ? loadState(
                    createDefaultState(),
                    this.currentUser
                )

                : loadState(
                    createDefaultState(),
                    "guest"
                );


        if (
            !this.state.username
        ) {

            this.state.username =
                this.currentUser ||
                "بازیکن مهمان";
        }


        this.currentCategory =
            "general";


        this.quiz =
            new QuizEngine(
                this.state,
                () => this.persist()
            );


        this.currentQuestionTimer =
            null;


        this.selectedPlan =
            "monthly";


        this.discountPercent =
            0;


        this.paymentRequestId =
            null;


        this.paymentStatusTimer =
            null;


        this.authMode =
            "login";


        this.categoryData = {

            general: [],

            fun: []

        };


        this.init();
    }


    /* =====================================================
       INIT
    ===================================================== */

    async init() {

        this.bindNavigation();

        this.bindTheme();

        this.bindAuth();

        this.bindQuiz();

        this.bindSubscription();

        this.bindProfile();

        this.bindChat();

        this.bindSupport();

        this.loadSavedPaymentRequest();

        this.updateUI();

        await this.loadQuizData();

        this.renderStages();

        this.updateUI();
    }


    /* =====================================================
       STORAGE
    ===================================================== */

    persist() {

        if (
            this.currentUser
        ) {

            this.state.username =
                this.currentUser;

            saveState(
                this.state,
                this.currentUser
            );

            updateLeaderboard(
                this.state
            );

        } else {

            saveState(
                this.state,
                "guest"
            );
        }
    }


    /* =====================================================
       NAVIGATION
    ===================================================== */

    bindNavigation() {

        document
            .querySelectorAll(
                "[data-page]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            this.showPage(
                                button.dataset.page
                            );
                        }
                    );
                }
            );
    }


    showPage(pageId) {

        document
            .querySelectorAll(
                ".page"
            )
            .forEach(
                page => {

                    page.classList.toggle(
                        "active",
                        page.id === pageId
                    );
                }
            );


        document
            .querySelectorAll(
                ".main-nav button"
            )
            .forEach(
                button => {

                    button.classList.toggle(
                        "active",
                        button.dataset.page ===
                        pageId
                    );
                }
            );


        if (
            pageId === "profile"
        ) {

            this.renderProfile();
        }


        if (
            pageId === "leaderboard"
        ) {

            this.renderLeaderboard();
        }


        if (
            pageId === "subscription"
        ) {

            this.renderSubscription();

            this.checkSavedPaymentStatus();
        }


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    /* =====================================================
       THEME
    ===================================================== */

    bindTheme() {

        const button =
            document.getElementById(
                "themeToggle"
            );


        const savedTheme =
            localStorage.getItem(
                "quizduo_theme"
            ) ||
            this.state.theme ||
            "light";


        this.applyTheme(
            savedTheme
        );


        button?.addEventListener(
            "click",
            () => {

                const next =
                    document.body.classList.contains(
                        "dark"
                    )
                        ? "light"
                        : "dark";


                this.applyTheme(
                    next
                );
            }
        );
    }


    applyTheme(theme) {

        document.body.classList.toggle(
            "dark",
            theme === "dark"
        );


        localStorage.setItem(
            "quizduo_theme",
            theme
        );


        this.state.theme =
            theme;


        this.persist();


        const button =
            document.getElementById(
                "themeToggle"
            );


        if (button) {

            button.textContent =
                theme === "dark"
                    ? "☀️"
                    : "🌙";
        }
    }


    /* =====================================================
       AUTH
    ===================================================== */

    bindAuth() {

        document
            .getElementById(
                "authButton"
            )
            ?.addEventListener(
                "click",
                () => {

                    this.showPage(
                        "auth"
                    );
                }
            );


        document
            .getElementById(
                "logoutButton"
            )
            ?.addEventListener(
                "click",
                () => {

                    logoutUser();

                    this.currentUser =
                        null;

                    this.state =
                        loadState(
                            createDefaultState(),
                            "guest"
                        );

                    this.quiz.state =
                        this.state;

                    this.updateUI();

                    this.showPage(
                        "home"
                    );
                }
            );


        document
            .getElementById(
                "toggleAuth"
            )
            ?.addEventListener(
                "click",
                () => {

                    this.authMode =
                        this.authMode === "login"
                            ? "register"
                            : "login";


                    this.updateAuthForm();
                }
            );


        document
            .getElementById(
                "authSubmit"
            )
            ?.addEventListener(
                "click",
                () => {

                    this.submitAuth();
                }
            );
    }


    updateAuthForm() {

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


        const confirmWrap =
            document.getElementById(
                "confirmPasswordWrap"
            );


        if (
            this.authMode === "login"
        ) {

            title.textContent =
                "ورود";


            submit.textContent =
                "ورود";


            toggle.textContent =
                "ساخت حساب جدید";


            confirmWrap
                .classList
                .add("hidden");

        } else {

            title.textContent =
                "ساخت حساب";


            submit.textContent =
                "ثبت‌نام";


            toggle.textContent =
                "قبلاً حساب دارم";


            confirmWrap
                .classList
                .remove("hidden");
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


        const confirm =
            document
                .getElementById(
                    "authConfirmPassword"
                )
                .value;


        const message =
            document.getElementById(
                "authMsg"
            );


        message.textContent =
            "";


        if (
            name.length < 3
        ) {

            message.textContent =
                "نام کاربری باید حداقل ۳ کاراکتر باشد.";

            return;
        }


        if (
            password.length < 6
        ) {

            message.textContent =
                "رمز عبور باید حداقل ۶ کاراکتر باشد.";

            return;
        }


        const users =
            getUsers();


        if (
            this.authMode ===
            "register"
        ) {

            const duplicate =
                users.some(
                    user =>
                        String(
                            user.username
                        )
                            .toLowerCase() ===
                        name.toLowerCase()
                );


            if (
                duplicate
            ) {

                message.textContent =
                    "این نام کاربری قبلاً ثبت شده است.";

                return;
            }


            if (
                password !==
                confirm
            ) {

                message.textContent =
                    "تکرار رمز عبور درست نیست.";

                return;
            }


            users.push({

                username:
                    name,

                password:
                    password,

                createdAt:
                    Date.now()

            });


            saveUsers(
                users
            );


            this.currentUser =
                name;


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


            message.textContent =
                "حساب با موفقیت ساخته شد.";


            this.quiz.state =
                this.state;


            this.updateUI();

            this.showPage(
                "home"
            );

            return;
        }


        const user =
            users.find(
                item =>
                    String(
                        item.username
                    )
                        .toLowerCase() ===
                    name.toLowerCase()
            );


        if (
            !user ||
            user.password !==
            password
        ) {

            message.textContent =
                "نام کاربری یا رمز عبور اشتباه است.";

            return;
        }


        this.currentUser =
            user.username;


        setCurrentUser(
            this.currentUser
        );


        this.state =
            loadState(
                createDefaultState(),
                this.currentUser
            );


        this.state.username =
            this.currentUser;


        this.quiz.state =
            this.state;


        this.updateUI();

        this.checkSavedPaymentStatus();

        this.showPage(
            "home"
        );
    }


    /* =====================================================
       QUIZ DATA
    ===================================================== */

    async loadQuizData() {

        try {

            for (
                const category of [
                    "general",
                    "fun"
                ]
            ) {

                const response =
                    await fetch(
                        `data/${category}.json`,
                        {
                            cache:
                                "no-store"
                        }
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        `خطا در دریافت ${category}.json`
                    );
                }


                const data =
                    await response.json();


                let questions =
                    [];


                if (
                    Array.isArray(
                        data.questions
                    )
                ) {

                    questions =
                        data.questions;

                } else if (
                    Array.isArray(
                        data.stages
                    )
                ) {

                    questions =
                        data.stages.flatMap(
                            stage =>

                                (
                                    stage.questions ||
                                    []
                                ).map(
                                    question => ({
                                        ...question,
                                        stage:
                                            stage.stage
                                    })
                                )
                        );
                }


                this.categoryData[
                    category
                ] =
                    questions;
            }

        } catch (error) {

            console.error(
                error
            );
        }
    }


    /* =====================================================
       QUIZ
    ===================================================== */

    bindQuiz() {

        document
            .querySelectorAll(
                "[data-category-tab]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            this.currentCategory =
                                button.dataset.categoryTab;


                            document
                                .querySelectorAll(
                                    "[data-category-tab]"
                                )
                                .forEach(
                                    item =>
                                        item.classList.toggle(
                                            "active",
                                            item ===
                                            button
                                        )
                                );


                            this.renderStages();
                        }
                    );
                }
            );


        document
            .getElementById(
                "nextQuestionBtn"
            )
            ?.addEventListener(
                "click",
                () => {

                    this.renderCurrentQuestion();
                }
            );
    }


    renderStages() {

        const container =
            document.getElementById(
                "stageList"
            );


        if (
            !container
        ) {
            return;
        }


        const questions =
            this.categoryData[
                this.currentCategory
            ] || [];


        const stages =
            [
                ...new Set(
                    questions
                        .map(
                            q =>
                                Number(
                                    q.stage
                                )
                        )
                        .filter(
                            Number.isFinite
                        )
                )
            ].sort(
                (a, b) =>
                    a - b
            );


        if (
            !stages.length
        ) {

            container.innerHTML = `

                <div class="panel">

                    هنوز مرحله‌ای برای این بخش
                    تعریف نشده است.

                </div>

            `;

            return;
        }


        const unlocked =
            getUnlockedStage(
                this.state,
                this.currentCategory
            );


        container.innerHTML =
            stages
                .map(
                    stage => {

                        const completed =
                            isStageCompleted(
                                this.state,
                                this.currentCategory,
                                stage
                            );


                        const locked =
                            stage >
                            unlocked;


                        return `

                            <article
                                class="
                                    stage-card
                                    ${
                                        locked
                                            ? "locked"
                                            : ""
                                    }
                                    ${
                                        completed
                                            ? "completed"
                                            : ""
                                    }
                                "
                            >

                                <div class="stage-number">
                                    ${stage}
                                </div>

                                <h3>
                                    مرحله ${stage}
                                </h3>

                                <small>

                                    ${
                                        completed
                                            ? "✓ تکمیل شده"
                                            : locked
                                                ? "🔒 قفل"
                                                : "۱۰ XP"
                                    }

                                </small>


                                <button
                                    type="button"
                                    class="
                                        primary-btn
                                        stage-action
                                    "
                                    data-stage="${stage}"
                                    ${
                                        locked
                                            ? "disabled"
                                            : ""
                                    }
                                >

                                    ${
                                        completed
                                            ? "بازی دوباره"
                                            : "شروع مرحله"
                                    }

                                </button>

                            </article>

                        `;
                    }
                )
                .join("");


        container
            .querySelectorAll(
                "[data-stage]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            this.startStage(
                                Number(
                                    button.dataset.stage
                                )
                            );
                        }
                    );
                }
            );
    }


    async startStage(
        stage
    ) {

        if (
            !this.currentUser &&
            stage > 3
        ) {

            alert(
                "برای ادامه بازی بعد از مرحله ۳ باید ثبت‌نام یا وارد حساب شوی."
            );

            this.showPage(
                "auth"
            );

            return;
        }


        const completed =
            isStageCompleted(
                this.state,
                this.currentCategory,
                stage
            );


        let replay =
            false;


        if (
            completed
        ) {

            replay =
                confirm(
                    "شما قبلاً امتیاز این مرحله را کسب کرده‌اید.\n\n" +
                    "آیا مایلید دوباره این مرحله را بازی کنید؟\n\n" +
                    "بازی کردن در این مرحله نه از شما قلب کم می‌کند " +
                    "و نه XP اضافه می‌کند."
                );


            if (
                !replay
            ) {
                return;
            }
        }


        try {

            await this.quiz.loadCategory(
                this.currentCategory
            );


            const questions =
                this.quiz.startStage(
                    this.currentCategory,
                    stage,
                    replay
                );


            if (
                !questions.length
            ) {

                alert(
                    "برای این مرحله سؤال کافی وجود ندارد."
                );

                return;
            }


            this.showPage(
                "quiz"
            );


            document
                .getElementById(
                    "quizBox"
                )
                .classList
                .remove("hidden");


            this.renderCurrentQuestion();

        } catch (error) {

            console.error(
                error
            );


            alert(
                "در بارگذاری مرحله مشکلی پیش آمد."
            );
        }
    }


    renderCurrentQuestion() {

        clearInterval(
            this.currentQuestionTimer
        );


        const question =
            this.quiz.getCurrentQuestion();


        const total =
            this.quiz.getQuestionCount();


        const index =
            this.quiz.currentQuestion;


        if (
            !question
        ) {

            return;
        }


        document
            .getElementById(
                "quizCategory"
            )
            .textContent =
            this.currentCategory ===
            "general"

                ? "🧠 اطلاعات عمومی"

                : "🎮 تفریحی";


        document
            .getElementById(
                "questionNumber"
            )
            .textContent =
            `سؤال ${index + 1} از ${total}`;


        document
            .getElementById(
                "questionText"
            )
            .textContent =
            question.q ||
            question.question ||
            "";


        const progress =
            total
                ? (
                    index /
                    total
                ) *
                100
                : 0;


        document
            .getElementById(
                "quizProgress"
            )
            .style.width =
            `${progress}%`;


        const answers =
            document.getElementById(
                "answers"
            );


        answers.innerHTML =
            (
                question.options ||
                []
            )
                .map(
                    (
                        option,
                        optionIndex
                    ) => `

                        <button
                            type="button"
                            class="answer-btn"
                            data-answer="${optionIndex}"
                        >
                            ${escapeHTML(
                                option
                            )}
                        </button>

                    `
                )
                .join("");


        document
            .getElementById(
                "quizResult"
            )
            .innerHTML =
            "";


        document
            .getElementById(
                "nextQuestionBtn"
            )
            .classList
            .add("hidden");


        answers
            .querySelectorAll(
                "[data-answer]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            this.answerQuestion(
                                Number(
                                    button.dataset.answer
                                )
                            );
                        }
                    );
                }
            );


        this.startTimer();
    }


    startTimer() {

        const duration =
            QUIZ_CONFIG.questionTime;


        let remaining =
            duration;


        const timerText =
            document.getElementById(
                "questionTimer"
            );


        const timerProgress =
            document.getElementById(
                "timerProgress"
            );


        timerText.textContent =
            `${remaining}s`;


        timerProgress.style.width =
            "100%";


        this.currentQuestionTimer =
            setInterval(
                () => {

                    remaining--;

                    timerText.textContent =
                        `${Math.max(
                            remaining,
                            0
                        )}s`;


                    timerProgress.style.width =
                        `${(
                            Math.max(
                                remaining,
                                0
                            ) /
                            duration
                        ) * 100}%`;


                    if (
                        remaining <= 0
                    ) {

                        clearInterval(
                            this.currentQuestionTimer
                        );


                        this.answerQuestion(
                            null
                        );
                    }

                },
                1000
            );
    }


    answerQuestion(
        answerIndex
    ) {

        clearInterval(
            this.currentQuestionTimer
        );


        const result =
            this.quiz.answer(
                answerIndex
            );


        document
            .querySelectorAll(
                ".answer-btn"
            )
            .forEach(
                button => {

                    button.disabled =
                        true;
                }
            );


        const resultBox =
            document.getElementById(
                "quizResult"
            );


        resultBox.innerHTML = `

            <div class="notice">

                ${
                    result.correct
                        ? "✅ پاسخ درست بود!"
                        : "❌ پاسخ درست نبود."
                }

                ${
                    result.explanation
                        ? `<br>${escapeHTML(
                            result.explanation
                        )}`
                        : ""
                }

            </div>

        `;


        document
            .getElementById(
                "comboValue"
            )
            .textContent =
            result.combo;


        if (
            result.finished
        ) {

            this.finishStage(
                result
            );

        } else {

            document
                .getElementById(
                    "nextQuestionBtn"
                )
                .classList
                .remove("hidden");
        }


        this.updateUI();
    }


    finishStage(
        result
    ) {

        const percentage =
            Math.round(
                result.percentage *
                100
            );


        let message = "";


        if (
            result.passed
        ) {

            if (
                result.newlyCompleted
            ) {

                message = `

                    <div class="notice">

                        🎉 مرحله با موفقیت کامل شد!

                        <br>

                        ⭐
                        ${result.earnedXP}
                        XP گرفتی.

                        <br>

                        نتیجه:
                        ${percentage}٪

                    </div>

                `;

            } else {

                message = `

                    <div class="notice">

                        🎉 مرحله را دوباره تمام کردی!

                        <br>

                        نتیجه:
                        ${percentage}٪

                        <br>

                        این بار
                        <b>
                            XP و قلبی تغییر نمی‌کند.
                        </b>

                    </div>

                `;
            }

        } else {

            message = `

                <div class="notice">

                    ❌ این مرحله را پاس نکردی.

                    <br>

                    نتیجه:
                    ${percentage}٪

                    ${
                        result.heartLost
                            ? "<br>❤️ یک قلب کم شد."
                            : ""
                    }

                </div>

            `;
        }


        document
            .getElementById(
                "quizResult"
            )
            .innerHTML =
            message;


        document
            .getElementById(
                "quizProgress"
            )
            .style.width =
            "100%";


        document
            .getElementById(
                "nextQuestionBtn"
            )
            .classList
            .add("hidden");


        this.renderStages();

        this.updateUI();


        setTimeout(
            () => {

                document
                    .getElementById(
                        "quizBox"
                    )
                    .scrollIntoView({
                        behavior:
                            "smooth",
                        block:
                            "start"
                    });

            },
            100
        );
    }


    /* =====================================================
       SUBSCRIPTION
    ===================================================== */

    bindSubscription() {

        document
            .querySelectorAll(
                "[data-plan]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            this.selectPlan(
                                button.dataset.plan
                            );
                        }
                    );
                }
            );


        document
            .getElementById(
                "applyDiscount"
            )
            ?.addEventListener(
                "click",
                () => {

                    this.applyDiscount();
                }
            );


        document
            .getElementById(
                "paymentButton"
            )
            ?.addEventListener(
                "click",
                () => {

                    this.submitPaymentRequest();
                }
            );


        document
            .getElementById(
                "receiptFile"
            )
            ?.addEventListener(
                "change",
                event => {

                    const file =
                        event.target.files?.[0];


                    const message =
                        document.getElementById(
                            "receiptMsg"
                        );


                    if (
                        !file
                    ) {

                        message.textContent =
                            "فیشی انتخاب نشده است.";

                        return;
                    }


                    if (
                        !file.type.startsWith(
                            "image/"
                        )
                    ) {

                        event.target.value =
                            "";


                        message.textContent =
                            "لطفاً فقط تصویر فیش را انتخاب کن.";

                        return;
                    }


                    if (
                        file.size >
                        MAX_RECEIPT_SIZE
                    ) {

                        event.target.value =
                            "";


                        message.textContent =
                            "حجم تصویر نباید بیشتر از ۵ مگابایت باشد.";

                        return;
                    }


                    message.textContent =
                        `فایل «${file.name}» آماده ارسال است.`;
                }
            );
    }


    selectPlan(
        planKey
    ) {

        if (
            !subscriptionPlans[
                planKey
            ]
        ) {
            return;
        }


        this.selectedPlan =
            planKey;


        document
            .querySelectorAll(
                "[data-plan-card]"
            )
            .forEach(
                card => {

                    card.classList.toggle(
                        "selected",
                        card.dataset.planCard ===
                        planKey
                    );
                }
            );


        this.discountPercent =
            0;


        const discountInput =
            document.getElementById(
                "discountCode"
            );


        const discountMsg =
            document.getElementById(
                "discountMsg"
            );


        if (
            discountInput
        ) {
            discountInput.value =
                "";
        }


        if (
            discountMsg
        ) {
            discountMsg.textContent =
                "";
        }


        this.updatePaymentSummary();
    }


    applyDiscount() {

        const input =
            document.getElementById(
                "discountCode"
            );


        const message =
            document.getElementById(
                "discountMsg"
            );


        const code =
            input.value
                .trim()
                .toUpperCase();


        if (
            !code
        ) {

            this.discountPercent =
                0;


            message.textContent =
                "کد تخفیف وارد نشده است.";

            this.updatePaymentSummary();

            return;
        }


        const percent =
            discountCodes[
                code
            ];


        if (
            !percent
        ) {

            this.discountPercent =
                0;


            message.textContent =
                "کد تخفیف معتبر نیست.";

            this.updatePaymentSummary();

            return;
        }


        this.discountPercent =
            percent;


        message.textContent =
            `${percent}٪ تخفیف اعمال شد.`;

        this.updatePaymentSummary();
    }


    updatePaymentSummary() {

        const plan =
            subscriptionPlans[
                this.selectedPlan
            ];


        if (
            !plan
        ) {
            return;
        }


        const discountAmount =
            Math.round(
                plan.price *
                this.discountPercent /
                100
            );


        const finalPrice =
            Math.max(
                0,
                plan.price -
                discountAmount
            );


        const planName =
            document.getElementById(
                "selectedPlanName"
            );


        const planAmount =
            document.getElementById(
                "selectedPlanAmount"
            );


        const basePrice =
            document.getElementById(
                "basePrice"
            );


        const discount =
            document.getElementById(
                "discountAmount"
            );


        const final =
            document.getElementById(
                "finalPrice"
            );


        const bankAmount =
            document.getElementById(
                "bankAmount"
            );


        if (
            planName
        ) {

            planName.textContent =
                plan.name;
        }


        if (
            planAmount
        ) {

            planAmount.textContent =
                this.formatPrice(
                    plan.price
                );
        }


        if (
            basePrice
        ) {

            basePrice.textContent =
                this.formatPrice(
                    plan.price
                );
        }


        if (
            discount
        ) {

            discount.textContent =
                this.formatPrice(
                    discountAmount
                );
        }


        if (
            final
        ) {

            final.textContent =
                this.formatPrice(
                    finalPrice
                );
        }


        if (
            bankAmount
        ) {

            bankAmount.textContent =
                this.formatPrice(
                    finalPrice
                );
        }
    }


    renderSubscription() {

        this.selectPlan(
            this.selectedPlan
        );


        const premium =
            this.isPremium();


        document
            .querySelectorAll(
                "[data-plan-card]"
            )
            .forEach(
                card => {

                    const key =
                        card.dataset.planCard;


                    const button =
                        card.querySelector(
                            "[data-plan]"
                        );


                    if (
                        premium
                    ) {

                        button.textContent =
                            "Premium فعال است";

                    } else {

                        button.textContent =
                            "انتخاب پلن";
                    }
                }
            );
    }


    formatPrice(
        value
    ) {

        return (
            Number(
                value || 0
            )
                .toLocaleString(
                    "fa-IR"
                ) +
            " تومان"
        );
    }


    /* =====================================================
       PAYMENT REQUEST
    ===================================================== */

    async submitPaymentRequest() {

        const message =
            document.getElementById(
                "paymentMsg"
            );


        message.textContent =
            "";


        if (
            !this.currentUser
        ) {

            message.textContent =
                "برای خرید اشتراک ابتدا وارد حساب خودت شو.";

            this.showPage(
                "auth"
            );

            return;
        }


        const phone =
            String(
                this.state.phone || ""
            )
                .trim();


        if (
            phone.length < 7
        ) {

            message.textContent =
                "قبل از ارسال فیش، شماره تلفن خودت را در بخش پروفایل ثبت کن.";

            this.showPage(
                "profile"
            );

            return;
        }


        const fileInput =
            document.getElementById(
                "receiptFile"
            );


        const file =
            fileInput?.files?.[0];


        if (
            !file
        ) {

            message.textContent =
                "لطفاً تصویر فیش واریزی را انتخاب کن.";

            return;
        }


        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            message.textContent =
                "فایل انتخاب‌شده تصویر نیست.";

            return;
        }


        if (
            file.size >
            MAX_RECEIPT_SIZE
        ) {

            message.textContent =
                "حجم فیش نباید بیشتر از ۵ مگابایت باشد.";

            return;
        }


        const plan =
            subscriptionPlans[
                this.selectedPlan
            ];


        if (
            !plan
        ) {

            message.textContent =
                "لطفاً یک پلن انتخاب کن.";

            return;
        }


        const discountAmount =
            Math.round(
                plan.price *
                this.discountPercent /
                100
            );


        const finalPrice =
            Math.max(
                0,
                plan.price -
                discountAmount
            );


        const requestId =
            this.generateRequestId();


        const button =
            document.getElementById(
                "paymentButton"
            );


        button.disabled =
            true;


        button.textContent =
            "در حال ارسال فیش...";


        try {

            const base64 =
                await this.fileToBase64(
                    file
                );


            const payload = {

                action:
                    "create_request",

                requestId,

                username:
                    this.currentUser,

                phone,

                plan:
                    this.selectedPlan,

                planName:
                    plan.name,

                amount:
                    finalPrice,

                receiptName:
                    file.name,

                receiptType:
                    file.type,

                receiptBase64:
                    base64

            };


            /*
             * text/plain باعث می‌شود
             * درخواست ساده باشد و در GitHub Pages
             * درگیر preflight پیچیده نشویم.
             */

            const response =
                await fetch(
                    BACKEND_URL,
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


            const result =
                await response.json();


            if (
                !result.ok
            ) {

                throw new Error(
                    result.error ||
                    "ثبت درخواست ناموفق بود."
                );
            }


            this.paymentRequestId =
                result.requestId ||
                requestId;


            this.savePaymentRequest({

                requestId:
                    this.paymentRequestId,

                username:
                    this.currentUser,

                plan:
                    this.selectedPlan,

                planName:
                    plan.name,

                amount:
                    finalPrice,

                createdAt:
                    Date.now(),

                status:
                    "pending"

            });


            message.textContent =
                "فیش با موفقیت ارسال شد.";


            fileInput.value =
                "";


            document
                .getElementById(
                    "receiptMsg"
                )
                .textContent =
                "فیش ارسال شد.";


            this.showPaymentStatus(
                "pending"
            );


            this.startPaymentStatusPolling();


        } catch (error) {

            console.error(
                "Payment request error:",
                error
            );


            message.textContent =
                "ارسال فیش انجام نشد. اتصال اینترنت و تنظیمات Backend را بررسی کن.";

        } finally {

            button.disabled =
                false;


            button.textContent =
                "ارسال فیش و ثبت درخواست";
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
                    () => {

                        const result =
                            String(
                                reader.result ||
                                ""
                            );


                        resolve(
                            result.includes(
                                ","
                            )

                                ? result.split(
                                    ","
                                )[1]

                                : result
                        );
                    };


                reader.onerror =
                    () => {

                        reject(
                            new Error(
                                "خواندن تصویر فیش ناموفق بود."
                            )
                        );
                    };


                reader.readAsDataURL(
                    file
                );
            }
        );
    }


    generateRequestId() {

        return (

            "QD-" +

            Date.now()
                .toString(36)
                .toUpperCase() +

            "-" +

            Math.random()
                .toString(36)
                .slice(
                    2,
                    7
                )
                .toUpperCase()

        );
    }


    /* =====================================================
       PAYMENT STATUS
    ===================================================== */

    savePaymentRequest(
        request
    ) {

        localStorage.setItem(
            "quizduo_payment_request_" +
            String(
                request.username
            )
                .toLowerCase(),

            JSON.stringify(
                request
            )
        );
    }


    loadSavedPaymentRequest() {

        if (
            !this.currentUser
        ) {
            return;
        }


        try {

            const saved =
                localStorage.getItem(
                    "quizduo_payment_request_" +
                    this.currentUser
                        .toLowerCase()
                );


            if (
                !saved
            ) {
                return;
            }


            const request =
                JSON.parse(
                    saved
                );


            this.paymentRequestId =
                request.requestId;


        } catch (error) {

            console.error(
                error
            );
        }
    }


    async checkSavedPaymentStatus() {

        if (
            !this.currentUser
        ) {
            return;
        }


        try {

            const saved =
                localStorage.getItem(
                    "quizduo_payment_request_" +
                    this.currentUser
                        .toLowerCase()
                );


            if (
                !saved
            ) {
                return;
            }


            const request =
                JSON.parse(
                    saved
                );


            if (
                !request.requestId
            ) {
                return;
            }


            this.paymentRequestId =
                request.requestId;


            this.showPaymentStatus(
                request.status ||
                "pending"
            );


            await this.fetchPaymentStatus();


        } catch (error) {

            console.error(
                "Payment status error:",
                error
            );
        }
    }


    fetchPaymentStatus() {

        return new Promise(
            resolve => {

                if (
                    !this.currentUser ||
                    !this.paymentRequestId
                ) {

                    resolve(
                        null
                    );

                    return;
                }


                const callbackName =
                    "quizduoStatus_" +
                    Date.now();


                let finished =
                    false;


                const script =
                    document.createElement(
                        "script"
                    );


                const cleanup =
                    () => {

                        if (
                            script.parentNode
                        ) {

                            script.parentNode
                                .removeChild(
                                    script
                                );
                        }


                        try {

                            delete window[
                                callbackName
                            ];

                        } catch (_) {}
                    };


                const timeout =
                    setTimeout(
                        () => {

                            if (
                                finished
                            ) {
                                return;
                            }


                            finished =
                                true;


                            cleanup();

                            resolve(
                                null
                            );

                        },
                        15000
                    );


                window[
                    callbackName
                ] =
                    result => {

                        if (
                            finished
                        ) {
                            return;
                        }


                        finished =
                            true;


                        clearTimeout(
                            timeout
                        );


                        cleanup();


                        if (
                            result &&
                            result.ok
                        ) {

                            this.handlePaymentStatus(
                                result
                            );
                        }


                        resolve(
                            result
                        );
                    };


                const url =
                    new URL(
                        BACKEND_URL
                    );


                url.searchParams.set(
                    "action",
                    "status"
                );


                url.searchParams.set(
                    "requestId",
                    this.paymentRequestId
                );


                url.searchParams.set(
                    "username",
                    this.currentUser
                );


                url.searchParams.set(
                    "callback",
                    callbackName
                );


                script.src =
                    url.toString();


                script.onerror =
                    () => {

                        if (
                            finished
                        ) {
                            return;
                        }


                        finished =
                            true;


                        clearTimeout(
                            timeout
                        );


                        cleanup();


                        resolve(
                            null
                        );
                    };


                document
                    .body
                    .appendChild(
                        script
                    );
            }
        );
    }


    handlePaymentStatus(
        result
    ) {

        if (
            !result ||
            !result.status
        ) {
            return;
        }


        const savedKey =
            this.currentUser

                ? "quizduo_payment_request_" +
                    this.currentUser
                        .toLowerCase()

                : null;


        if (
            savedKey
        ) {

            try {

                const old =
                    JSON.parse(
                        localStorage.getItem(
                            savedKey
                        ) ||
                        "{}"
                    );


                old.status =
                    result.status;


                old.plan =
                    result.plan ||
                    old.plan;


                old.amount =
                    result.amount ||
                    old.amount;


                localStorage.setItem(
                    savedKey,
                    JSON.stringify(
                        old
                    )
                );

            } catch (_) {}
        }


        if (
            result.status ===
            "approved"
        ) {

            this.activatePremium(
                result
            );

        } else if (
            result.status ===
            "rejected"
        ) {

            this.showPaymentStatus(
                "rejected"
            );

        } else {

            this.showPaymentStatus(
                "pending"
            );
        }
    }


    startPaymentStatusPolling() {

        clearInterval(
            this.paymentStatusTimer
        );


        this.paymentStatusTimer =
            setInterval(
                () => {

                    this.fetchPaymentStatus();

                },
                30000
            );
    }


    activatePremium(
        result
    ) {

        const saved =
            localStorage.getItem(
                "quizduo_payment_request_" +
                this.currentUser
                    .toLowerCase()
            );


        let request =
            {};


        try {

            request =
                saved
                    ? JSON.parse(
                        saved
                    )
                    : {};

        } catch (_) {}


        const planKey =
            request.plan ||
            this.selectedPlan;


        const plan =
            subscriptionPlans[
                planKey
            ] ||
            subscriptionPlans.monthly;


        const totalMonths =
            plan.months +
            plan.gift;


        const now =
            new Date();


        const expires =
            new Date(
                now
            );


        expires.setMonth(
            expires.getMonth() +
            totalMonths
        );


        this.state.subscription =
            "premium";


        this.state.subscriptionPlan =
            planKey;


        this.state.subscriptionPlanName =
            plan.name;


        this.state.subscriptionMonths =
            totalMonths;


        this.state.subscriptionActivatedAt =
            now.toISOString();


        this.state.subscriptionExpiresAt =
            expires.toISOString();


        /*
         * Premium = حداکثر ۸ قلب
         */

        this.state.maxHearts =
            8;


        this.state.hearts =
            Math.min(
                8,
                Math.max(
                    Number(
                        this.state.hearts ||
                        0
                    ),
                    5
                )
            );


        this.persist();


        this.quiz.state =
            this.state;


        this.showPaymentStatus(
            "approved"
        );


        this.updateUI();
    }


    isPremium() {

        if (
            this.state.subscription !==
            "premium"
        ) {

            return false;
        }


        if (
            !this.state.subscriptionExpiresAt
        ) {

            return true;
        }


        const expires =
            new Date(
                this.state
                    .subscriptionExpiresAt
            );


        if (
            Date.now() >=
            expires.getTime()
        ) {

            this.state.subscription =
                "free";


            this.state.maxHearts =
                5;


            this.state.hearts =
                Math.min(
                    Number(
                        this.state.hearts ||
                        0
                    ),
                    5
                );


            this.persist();


            return false;
        }


        return true;
    }


    showPaymentStatus(
        status
    ) {

        const box =
            document.getElementById(
                "paymentStatusBox"
            );


        const icon =
            document.getElementById(
                "paymentStatusIcon"
            );


        const title =
            document.getElementById(
                "paymentStatusTitle"
            );


        const text =
            document.getElementById(
                "paymentStatusText"
            );


        const id =
            document.getElementById(
                "paymentRequestId"
            );


        if (
            !box
        ) {
            return;
        }


        box.classList.remove(
            "hidden",
            "status-pending",
            "status-approved",
            "status-rejected"
        );


        if (
            id
        ) {

            id.textContent =
                this.paymentRequestId ||
                "";
        }


        if (
            status ===
            "approved"
        ) {

            box.classList.add(
                "status-approved"
            );


            if (
                icon
            ) {
                icon.textContent =
                    "🎉";
            }


            if (
                title
            ) {

                title.textContent =
                    "اشتراک شما فعال شد!";
            }


            if (
                text
            ) {

                text.textContent =
                    "پرداخت شما توسط مدیر تأیید شد و Premium برای حساب شما فعال است.";
            }


        } else if (
            status ===
            "rejected"
        ) {

            box.classList.add(
                "status-rejected"
            );


            if (
                icon
            ) {

                icon.textContent =
                    "❌";
            }


            if (
                title
            ) {

                title.textContent =
                    "درخواست پرداخت رد شد";
            }


            if (
                text
            ) {

                text.textContent =
                    "فیش ارسالی تأیید نشده است. در صورت نیاز، فیش صحیح را دوباره ارسال کن.";
            }


        } else {

            box.classList.add(
                "status-pending"
            );


            if (
                icon
            ) {

                icon.textContent =
                    "🕐";
            }


            if (
                title
            ) {

                title.textContent =
                    "درخواست در حال بررسی است";
            }


            if (
                text
            ) {

                text.textContent =
                    "فیش شما ارسال شده و منتظر بررسی مدیر است. حداکثر زمان فعال‌سازی ۲۴ ساعت است.";
            }
        }
    }


    /* =====================================================
       PROFILE
    ===================================================== */

    bindProfile() {

        document
            .getElementById(
                "saveProfilePhone"
            )
            ?.addEventListener(
                "click",
                () => {

                    this.saveProfilePhone();
                }
            );
    }


    saveProfilePhone() {

        if (
            !this.currentUser
        ) {

            const message =
                document.getElementById(
                    "profilePhoneMsg"
                );


            message.textContent =
                "برای ذخیره شماره تلفن ابتدا وارد حساب شو.";

            return;
        }


        const input =
            document.getElementById(
                "profilePhone"
            );


        const message =
            document.getElementById(
                "profilePhoneMsg"
            );


        const phone =
            input.value.trim();


        if (
            phone.length < 7
        ) {

            message.textContent =
                "شماره تلفن معتبر وارد کن.";

            return;
        }


        this.state.phone =
            phone;


        this.persist();


        message.textContent =
            "شماره تلفن با موفقیت ذخیره شد.";
    }


    renderProfile() {

        const name =
            this.state.username ||
            "بازیکن مهمان";


        const avatar =
            document.getElementById(
                "profileAvatar"
            );


        const nameElement =
            document.getElementById(
                "profileName"
            );


        const phone =
            document.getElementById(
                "profilePhone"
            );


        const premiumBadge =
            document.getElementById(
                "premiumBadge"
            );


        if (
            avatar
        ) {

            avatar.textContent =
                name.charAt(0)
                    .toUpperCase();
        }


        if (
            nameElement
        ) {

            nameElement.textContent =
                name;
        }


        if (
            phone
        ) {

            phone.value =
                this.state.phone ||
                "";
        }


        if (
            premiumBadge
        ) {

            premiumBadge.classList.toggle(
                "hidden",
                !this.isPremium()
            );
        }


        document
            .getElementById(
                "profileLevel"
            )
            .textContent =
            this.state.level;


        document
            .getElementById(
                "profileXP"
            )
            .textContent =
            this.state.xp;


        document
            .getElementById(
                "profileStreak"
            )
            .textContent =
            this.state.streak;


        document
            .getElementById(
                "profileHearts"
            )
            .textContent =
            this.state.hearts;


        document
            .getElementById(
                "profileGeneral"
            )
            .textContent =
            Math.max(
                0,
                this.state.generalStage -
                1
            );


        document
            .getElementById(
                "profileFun"
            )
            .textContent =
            Math.max(
                0,
                this.state.funStage -
                1
            );
    }


    /* =====================================================
       UI
    ===================================================== */

    updateUI() {

        updateStreak(
            this.state
        );


        this.state.level =
            calculateLevel(
                this.state.xp
            );


        this.persist();


        const premium =
            this.isPremium();


        if (
            premium
        ) {

            this.state.maxHearts =
                8;

        } else {

            this.state.maxHearts =
                5;
        }


        const values = {

            homeXP:
                this.state.xp,

            homeLevel:
                this.state.level,

            homeStreak:
                this.state.streak,

            quizXP:
                this.state.xp,

            quizStreak:
                this.state.streak,

            heartValue:
                this.state.hearts,

            profileXP:
                this.state.xp,

            profileLevel:
                this.state.level,

            profileStreak:
                this.state.streak,

            profileHearts:
                this.state.hearts,

            profileGeneral:
                Math.max(
                    0,
                    this.state.generalStage -
                    1
                ),

            profileFun:
                Math.max(
                    0,
                    this.state.funStage -
                    1
                )

        };


        Object.entries(
            values
        )
            .forEach(
                (
                    [
                        id,
                        value
                    ]
                ) => {

                    const element =
                        document.getElementById(
                            id
                        );


                    if (
                        element
                    ) {

                        element.textContent =
                            value;
                    }
                }
            );


        const authButton =
            document.getElementById(
                "authButton"
            );


        const logoutButton =
            document.getElementById(
                "logoutButton"
            );


        if (
            this.currentUser
        ) {

            if (
                authButton
            ) {

                authButton.textContent =
                    this.currentUser;
            }


            logoutButton
                ?.classList
                .remove(
                    "hidden"
                );

        } else {

            if (
                authButton
            ) {

                authButton.textContent =
                    "ورود / ثبت‌نام";
            }


            logoutButton
                ?.classList
                .add(
                    "hidden"
                );
        }


        const premiumBadge =
            document.getElementById(
                "premiumBadge"
            );


        if (
            premiumBadge
        ) {

            premiumBadge.classList.toggle(
                "hidden",
                !premium
            );
        }


        this.renderDailyReward();

        this.renderProfile();
    }


    /* =====================================================
       DAILY XP
    ===================================================== */

    renderDailyReward() {

        const card =
            document.getElementById(
                "dailyRewardCard"
            );


        if (
            !card
        ) {
            return;
        }


        const key =
            "quizduo_daily_xp_" +
            todayKey();


        const claimed =
            localStorage.getItem(
                key
            ) === "1";


        if (
            claimed
        ) {

            card.innerHTML = `

                <div>

                    <strong>
                        🎁 پاداش روزانه دریافت شد
                    </strong>

                    <span>
                        امروز ${DAILY_XP} XP روزانه‌ات را گرفتی.
                    </span>

                </div>

            `;

            return;
        }


        card.innerHTML = `

            <div>

                <strong>
                    🎁 پاداش روزانه
                </strong>

                <span>
                    با فعالیت امروز، ${DAILY_XP} XP پاداش بگیر.
                </span>

            </div>

            <button
                id="dailyRewardButton"
                class="primary-btn"
                type="button"
            >
                دریافت ${DAILY_XP} XP
            </button>

        `;


        document
            .getElementById(
                "dailyRewardButton"
            )
            ?.addEventListener(
                "click",
                () => {

                    this.claimDailyReward();
                }
            );
    }


    claimDailyReward() {

        const key =
            "quizduo_daily_xp_" +
            todayKey();


        if (
            localStorage.getItem(
                key
            ) === "1"
        ) {
            return;
        }


        addXP(
            this.state,
            DAILY_XP
        );


        localStorage.setItem(
            key,
            "1"
        );


        this.persist();

        this.updateUI();
    }


    /* =====================================================
       LEADERBOARD
    ===================================================== */

    renderLeaderboard() {

        const body =
            document.getElementById(
                "leaderboardBody"
            );


        if (
            !body
        ) {
            return;
        }


        const board =
            getLeaderboard();


        if (
            !board.length
        ) {

            body.innerHTML = `

                <tr>

                    <td
                        colspan="5"
                        class="muted"
                    >
                        هنوز بازیکنی ثبت نشده است.
                    </td>

                </tr>

            `;

            return;
        }


        body.innerHTML =
            board
                .map(
                    (
                        item,
                        index
                    ) => `

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
                                ${item.xp}
                            </td>

                            <td>
                                ${item.level}
                            </td>

                            <td>
                                ${Math.max(
                                    item.generalStage,
                                    item.funStage
                                )}
                            </td>

                        </tr>

                    `
                )
                .join("");
    }


    /* =====================================================
       CHAT
    ===================================================== */

    bindChat() {

        document
            .getElementById(
                "sendChat"
            )
            ?.addEventListener(
                "click",
                () => {

                    this.sendChat();
                }
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

                        this.sendChat();
                    }
                }
            );


        this.renderChat();
    }


    sendChat() {

        const input =
            document.getElementById(
                "chatInput"
            );


        const text =
            input.value.trim();


        if (
            !text
        ) {
            return;
        }


        const messages =
            this.getChatMessages();


        messages.push({

            username:
                this.state.username ||
                "مهمان",

            text,

            createdAt:
                Date.now()

        });


        localStorage.setItem(
            "quizduo_chat",
            JSON.stringify(
                messages.slice(
                    -100
                )
            )
        );


        input.value =
            "";


        this.renderChat();
    }


    getChatMessages() {

        try {

            const messages =
                JSON.parse(
                    localStorage.getItem(
                        "quizduo_chat"
                    ) ||
                    "[]"
                );


            return Array.isArray(
                messages
            )
                ? messages
                : [];

        } catch {

            return [];
        }
    }


    renderChat() {

        const container =
            document.getElementById(
                "messages"
            );


        if (
            !container
        ) {
            return;
        }


        const messages =
            this.getChatMessages();


        container.innerHTML =
            messages
                .map(
                    message => `

                        <div class="message">

                            <b>
                                ${escapeHTML(
                                    message.username
                                )}
                            </b>

                            <div>
                                ${escapeHTML(
                                    message.text
                                )}
                            </div>

                        </div>

                    `
                )
                .join("");


        container.scrollTop =
            container.scrollHeight;
    }


    /* =====================================================
       SUPPORT
    ===================================================== */

    bindSupport() {

        document
            .getElementById(
                "supportSend"
            )
            ?.addEventListener(
                "click",
                () => {

                    this.sendSupport();
                }
            );
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
                "موضوع و پیام را کامل کن.";

            return;
        }


        const requests =
            JSON.parse(
                localStorage.getItem(
                    "quizduo_support"
                ) ||
                "[]"
            );


        requests.push({

            username:
                this.state.username,

            subject,

            text,

            createdAt:
                Date.now()

        });


        localStorage.setItem(
            "quizduo_support",
            JSON.stringify(
                requests
            )
        );


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
            "درخواست پشتیبانی ثبت شد.";
    }
}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        window.quizDuo =
            new QuizDuoApp();

    }
);
