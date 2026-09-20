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
    "https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhnTTPygTup97Ly5QULQCj25MfbDsxby2Iu-RL34y561E7jwaeeFPRgJsM60hVNmvKhrdCNwmonOHZw2R8MiAEPzfC-YJNFyfBNC6eTPB91lDvTyPCcKCh1jEI7FwaG7UjpwwxpUYPKp5f8OEgoXQ72G0MheF6cVFIKNiEExi0nt44CDV5tKdR2yRvXHk1w7WqKDoWrKzAY5D11ex0qVAwLZJjStLCIYBzOUdKFRpAIJTbcoewdhamknqXO79De_PFpuUMqViEOYYUIz3IWmjP0IZER9V_g&lib=MyfoiWnjfcjZBV58ESc7ClMexWo_aQZTj";


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
    Number(value || 0).toLocaleString("fa-IR") +
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
        "";

    const options = Array.isArray(question.options)
        ? question.options
        : [];

    return {
        ...question,
        question: String(text),
        options: options.map(option => String(option))
    };
}


class QuizDuoApp {

    constructor() {

        this.state =
            loadState() ||
            createDefaultState();

        this.currentUser =
            getCurrentUser();

        this.users =
            getUsers() || {};

        this.currentCategory =
            "general";

        this.selectedPlan =
            null;

        this.selectedReceipt =
            null;

        this.authMode =
            "login";

        this.quiz =
            new QuizEngine(
                this.state,
                () => {
                    saveState(this.state);
                    this.refreshUI();
                }
            );
    }


    init() {

        this.bindEvents();

        this.applyTheme();

        this.refreshUI();

        this.go("home");

        this.loadCategory("general");

        if (this.currentUser) {
            this.syncUser();
        }
    }


    bindEvents() {

        document.addEventListener(
            "click",
            event => {

                const pageButton =
                    event.target.closest("[data-page]");

                if (pageButton) {

                    event.preventDefault();

                    const page =
                        pageButton.dataset.page;

                    if (page) {
                        this.go(page);
                    }

                    return;
                }


                const categoryButton =
                    event.target.closest(
                        "[data-category-tab]"
                    );

                if (categoryButton) {

                    const category =
                        categoryButton.dataset.categoryTab;

                    if (category) {
                        this.loadCategory(category);
                    }

                    return;
                }


                const planButton =
                    event.target.closest(
                        ".select-plan"
                    );

                if (planButton) {

                    this.selectPlan(
                        planButton.dataset.plan
                    );

                    return;
                }


                const stageButton =
                    event.target.closest(
                        "[data-stage]"
                    );

                if (stageButton) {

                    this.startStage(
                        Number(stageButton.dataset.stage)
                    );

                    return;
                }


                const answerButton =
                    event.target.closest(
                        "[data-answer]"
                    );

                if (answerButton) {

                    this.answerQuestion(
                        Number(answerButton.dataset.answer)
                    );

                    return;
                }


                const dashboardButton =
                    event.target.closest(
                        "[data-dashboard-target]"
                    );

                if (dashboardButton) {

                    this.updateDashboardTab(
                        dashboardButton.dataset.dashboardTarget
                    );
                }
            }
        );


        const authButton =
            document.getElementById("authButton");

        if (authButton) {

            authButton.addEventListener(
                "click",
                () => this.openAuth()
            );
        }


        const authSubmit =
            document.getElementById("authSubmit");

        if (authSubmit) {

            authSubmit.addEventListener(
                "click",
                () => this.submitAuth()
            );
        }


        const toggleAuth =
            document.getElementById("toggleAuth");

        if (toggleAuth) {

            toggleAuth.addEventListener(
                "click",
                () => this.toggleAuthMode()
            );
        }


        const authBack =
            document.getElementById("authBack");

        if (authBack) {

            authBack.addEventListener(
                "click",
                () => this.go("home")
            );
        }


        const themeToggle =
            document.getElementById("themeToggle");

        if (themeToggle) {

            themeToggle.addEventListener(
                "click",
                () => this.toggleTheme()
            );
        }


        const closePayment =
            document.getElementById("closePayment");

        if (closePayment) {

            closePayment.addEventListener(
                "click",
                () => this.closePayment()
            );
        }


        const paymentFile =
            document.getElementById("paymentFile");

        if (paymentFile) {

            paymentFile.addEventListener(
                "change",
                event => {
                    this.handleReceipt(
                        event.target.files?.[0]
                    );
                }
            );
        }


        const submitPayment =
            document.getElementById("submitPayment");

        if (submitPayment) {

            submitPayment.addEventListener(
                "click",
                () => this.submitPayment()
            );
        }


        const supportSend =
            document.getElementById("supportSend");

        if (supportSend) {

            supportSend.addEventListener(
                "click",
                () => this.sendSupport()
            );
        }


        const sendChat =
            document.getElementById("sendChat");

        if (sendChat) {

            sendChat.addEventListener(
                "click",
                () => this.sendChatMessage()
            );
        }


        const chatInput =
            document.getElementById("chatInput");

        if (chatInput) {

            chatInput.addEventListener(
                "keydown",
                event => {

                    if (event.key === "Enter") {

                        event.preventDefault();

                        this.sendChatMessage();
                    }
                }
            );
        }
    }


    go(pageId) {

        document
            .querySelectorAll(".page")
            .forEach(page => {

                page.classList.toggle(
                    "active",
                    page.id === pageId
                );
            });


        document
            .querySelectorAll("[data-page]")
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.page === pageId
                );
            });


        if (pageId === "quiz") {
            this.renderStages();
        }

        if (pageId === "leaderboard") {
            this.renderLeaderboard();
        }

        if (pageId === "profile") {
            this.renderProfile();
        }

        if (pageId === "subscription") {
            this.renderSubscription();
        }

        if (pageId === "chat") {
            this.loadChat();
        }

        if (pageId === "support") {
            this.loadSupport();
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }


    navigate(pageId) {
        this.go(pageId);
    }


    openAuth() {

        if (this.currentUser) {

            this.logout();

            return;
        }

        this.authMode = "login";

        this.go("auth");

        this.updateAuthUI();
    }


    toggleAuthMode() {

        this.authMode =
            this.authMode === "login"
                ? "register"
                : "login";

        this.updateAuthUI();
    }


    updateAuthUI() {

        const title =
            document.getElementById("authTitle");

        const submit =
            document.getElementById("authSubmit");

        const toggle =
            document.getElementById("toggleAuth");

        const phoneField =
            document.getElementById("phoneField");

        if (!title ||
            !submit ||
            !toggle ||
            !phoneField) {
            return;
        }


        const register =
            this.authMode === "register";


        title.textContent =
            register
                ? "ثبت‌نام"
                : "ورود";


        submit.textContent =
            register
                ? "ساخت حساب"
                : "ورود";


        toggle.textContent =
            register
                ? "قبلاً حساب دارم"
                : "ساخت حساب جدید";


        phoneField.classList.toggle(
            "hidden",
            !register
        );


        const message =
            document.getElementById("authMsg");

        if (message) {
            message.textContent = "";
        }
    }


    submitAuth() {

        const nameInput =
            document.getElementById("authName");

        const phoneInput =
            document.getElementById("authPhone");

        const passwordInput =
            document.getElementById("authPassword");

        const message =
            document.getElementById("authMsg");


        const username =
            nameInput?.value.trim() || "";

        const phone =
            phoneInput?.value.trim() || "";

        const password =
            passwordInput?.value || "";


        if (!username) {

            message.textContent =
                "نام کاربری را وارد کنید.";

            return;
        }


        if (!password) {

            message.textContent =
                "رمز عبور را وارد کنید.";

            return;
        }


        if (this.authMode === "register") {

            if (!/^09\d{9}$/.test(phone)) {

                message.textContent =
                    "شماره تماس را به شکل 09123456789 وارد کنید.";

                return;
            }


            if (this.users[username]) {

                message.textContent =
                    "این نام کاربری قبلاً ثبت شده است.";

                return;
            }


            const state =
                createDefaultState();


            state.username =
                username;

            state.phone =
                phone;

            state.userId =
                "u_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .slice(2, 8);


            this.users[username] = {

                username,

                phone,

                password,

                userId:
                    state.userId,

                subscription:
                    "free",

                state
            };


            saveUsers(this.users);

            setCurrentUser(username);

            this.currentUser =
                username;

            this.state =
                state;

            saveState(this.state);

            this.authMode =
                "login";

            this.syncUser();

            this.toast(
                "حساب با موفقیت ساخته شد."
            );

            this.go("profile");

            this.refreshUI();

            return;
        }


        const user =
            this.users[username];


        if (!user) {

            message.textContent =
                "حسابی با این نام کاربری پیدا نشد.";

            return;
        }


        if (user.password !== password) {

            message.textContent =
                "نام کاربری یا رمز عبور اشتباه است.";

            return;
        }


        setCurrentUser(username);

        this.currentUser =
            username;

        this.state =
            loadState(username) ||
            user.state ||
            createDefaultState();


        this.state.username =
            username;

        this.state.phone =
            user.phone || "";


        saveState(this.state);

        this.syncUser();

        this.toast(
            "با موفقیت وارد شدید."
        );

        this.go("profile");

        this.refreshUI();
    }


    logout() {

        logoutUser();

        this.currentUser =
            null;

        this.state =
            createDefaultState();

        this.go("home");

        this.refreshUI();

        this.toast(
            "از حساب خارج شدید."
        );
    }


    refreshUI() {

        this.updateAuthButton();

        this.renderProfile();

        this.renderSubscription();

        this.renderStages();

        this.renderQuizStats();
    }


    updateAuthButton() {

        const button =
            document.getElementById("authButton");

        if (!button) {
            return;
        }


        button.textContent =
            this.currentUser
                ? "خروج"
                : "ورود / ثبت‌نام";
    }


    applyTheme() {

        const theme =
            this.state.theme || "light";

        document.documentElement.dataset.theme =
            theme;
    }


    toggleTheme() {

        this.state.theme =
            this.state.theme === "dark"
                ? "light"
                : "dark";

        saveState(this.state);

        this.applyTheme();
    }


    async loadCategory(category) {

        this.currentCategory =
            category;


        document
            .querySelectorAll(
                "[data-category-tab]"
            )
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.categoryTab ===
                    category
                );
            });


        try {

            await this.quiz.loadCategory(
                category
            );

            this.renderStages();

        } catch (error) {

            console.error(
                "Quiz loading failed:",
                error
            );

            this.toast(
                "سوالات این بخش بارگذاری نشدند."
            );
        }
    }


    getCurrentStage(category) {

        return category === "fun"
            ? Number(this.state.funStage || 1)
            : Number(this.state.generalStage || 1);
    }


    canAccessStage(stage) {

        stage =
            Number(stage);


        if (stage <= 1) {
            return true;
        }


        return this.isSubscriptionActive();
    }


    isSubscriptionActive() {

        const subscription =
            this.state.subscription;


        if (!subscription) {
            return false;
        }


        if (subscription === "active") {
            return true;
        }


        if (typeof subscription === "string") {

            return subscription !== "free";
        }


        if (typeof subscription !== "object") {
            return false;
        }


        if (
            subscription.active === true
        ) {
            return true;
        }


        if (
            subscription.status === "active"
        ) {
            return true;
        }


        if (subscription.expiry) {

            const expiry =
                new Date(
                    subscription.expiry
                );

            if (
                !Number.isNaN(
                    expiry.getTime()
                ) &&
                expiry > new Date()
            ) {
                return true;
            }
        }


        return false;
    }


    hasFullAccess() {

        return this.isSubscriptionActive();
    }


    renderStages() {

        const container =
            document.getElementById("stages");

        if (!container) {
            return;
        }


        const category =
            this.currentCategory;


        const questions =
            this.quiz.questions || [];


        const stageNumbers =
            [
                ...new Set(
                    questions
                        .map(
                            question =>
                                Number(
                                    question.stage || 1
                                )
                        )
                )
            ]
                .filter(
                    stage =>
                        Number.isFinite(stage)
                )
                .sort(
                    (a, b) =>
                        a - b
                );


        if (!stageNumbers.length) {

            container.innerHTML =
                `
                <div class="panel">
                    هنوز سوالی برای این بخش بارگذاری نشده است.
                </div>
                `;

            return;
        }


        container.innerHTML =
            stageNumbers
                .map(stage => {

                    const unlocked =
                        this.canAccessStage(stage);

                    const completed =
                        isStageCompleted(
                            this.state,
                            category,
                            stage
                        );


                    const lockedClass =
                        unlocked
                            ? ""
                            : "locked";


                    const completedClass =
                        completed
                            ? "completed"
                            : "";


                    const icon =
                        completed
                            ? "✓"
                            : unlocked
                                ? stage
                                : "🔒";


                    return `
                    <article
                        class="stage-card
                        ${lockedClass}
                        ${completedClass}"
                    >

                        <div class="stage-number">
                            ${icon}
                        </div>

                        <h3>
                            مرحله ${stage}
                        </h3>

                        <p>
                            ${
                                completed
                                    ? "تکمیل شده"
                                    : unlocked
                                        ? "شروع مرحله"
                                        : "برای این مرحله اشتراک لازم است"
                            }
                        </p>

                        <button
                            class="${
                                unlocked
                                    ? "primary"
                                    : "secondary"
                            } full"
                            data-stage="${stage}"
                            ${
                                unlocked
                                    ? ""
                                    : "disabled"
                            }
                        >
                            ${
                                completed
                                    ? "دوباره بازی کن"
                                    : unlocked
                                        ? "شروع"
                                        : "قفل"
                            }
                        </button>

                    </article>
                    `;
                })
                .join("");
    }


    startStage(stage) {

        stage =
            Number(stage);


        if (!this.canAccessStage(stage)) {

            this.toast(
                "برای باز کردن این مرحله باید اشتراک فعال داشته باشید."
            );

            this.go("subscription");

            return;
        }


        const questions =
            this.quiz.getStageQuestions(
                stage
            );


        if (!questions.length) {

            this.toast(
                "برای این مرحله سوالی وجود ندارد."
            );

            return;
        }


        const replay =
            isStageCompleted(
                this.state,
                this.currentCategory,
                stage
            );


        this.quiz.startStage(
            this.currentCategory,
            stage,
            replay
        );


        this.renderQuestion();

        this.go("quiz");
    }


    renderQuestion() {

        const box =
            document.getElementById("quizBox");

        if (!box) {
            return;
        }


        const question =
            this.quiz.selectedQuestions[
                this.quiz.currentQuestion
            ];


        if (!question) {

            this.finishQuiz();

            return;
        }


        const normalized =
            normalizeQuestionForUI(
                question
            );


        const total =
            this.quiz.selectedQuestions.length;


        const current =
            this.quiz.currentQuestion + 1;


        box.classList.remove(
            "hidden"
        );


        box.innerHTML =
            `
            <div class="quiz-progress">
                <span>
                    سوال ${current}
                    از ${total}
                </span>

                <span>
                    ❤️ ${this.state.hearts}
                </span>
            </div>

            <h2 class="quiz-question">
                ${escapeHTML(
                    normalized.question
                )}
            </h2>

            <div class="options">
                ${
                    normalized.options
                        .map(
                            (option, index) => `
                            <button
                                class="option-button"
                                data-answer="${index}"
                            >
                                ${escapeHTML(option)}
                            </button>
                            `
                        )
                        .join("")
                }
            </div>
            `;


        this.renderQuizStats();
    }


    answerQuestion(index) {

        const result =
            this.quiz.answer(index);


        if (!result) {
            return;
        }


        const buttons =
            document.querySelectorAll(
                ".option-button"
            );


        buttons.forEach(
            button => {

                button.disabled =
                    true;
            }
        );


        if (
            typeof result.correctIndex ===
            "number"
        ) {

            buttons[
                result.correctIndex
            ]?.classList.add(
                "correct"
            );
        }


        if (
            typeof result.selectedIndex ===
            "number" &&
            result.selectedIndex !==
            result.correctIndex
        ) {

            buttons[
                result.selectedIndex
            ]?.classList.add(
                "wrong"
            );
        }


        setTimeout(
            () => {

                if (
                    this.quiz.finished
                ) {

                    this.finishQuiz();

                } else {

                    this.renderQuestion();
                }
            },
            500
        );
    }


    finishQuiz() {

        const result =
            this.quiz.finish();


        if (!result) {
            return;
        }


        const box =
            document.getElementById("quizBox");


        if (!box) {
            return;
        }


        box.classList.remove(
            "hidden"
        );


        box.innerHTML =
            `
            <div class="quiz-result">

                <div class="result-icon">
                    ${
                        result.passed
                            ? "🎉"
                            : "😕"
                    }
                </div>

                <h2>
                    ${
                        result.passed
                            ? "مرحله را با موفقیت گذراندی!"
                            : "این بار موفق نشدی."
                    }
                </h2>

                <p>
                    پاسخ درست:
                    <strong>
                        ${result.correct}
                    </strong>
                    از
                    <strong>
                        ${result.total}
                    </strong>
                </p>

                <p>
                    درصد:
                    <strong>
                        ${Math.round(
                            result.percentage
                        )}٪
                    </strong>
                </p>

                ${
                    result.passed
                        ? `
                            <p>
                                +${result.xpGained || 0}
                                XP
                            </p>
                        `
                        : ""
                }

                <button
                    class="primary"
                    data-page="quiz"
                >
                    بازگشت به مراحل
                </button>

            </div>
            `;


        this.renderStages();

        this.refreshUI();

        this.syncUser();
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
            `XP: ${this.state.xp || 0} · قلب: ${this.state.hearts || 0}`;
    }


    renderProfile() {

        const name =
            this.state.username ||
            "بازیکن مهمان";


        const elements = {

            dashboardName:
                name,

            dashboardXP:
                this.state.xp || 0,

            dashboardHearts:
                this.state.hearts || 0,

            dashboardStreak:
                this.state.streak || 0,

            profileName:
                name,

            profileScore:
                this.state.xp || 0,

            profileStreak:
                this.state.streak || 0
        };


        Object.entries(elements)
            .forEach(
                ([id, value]) => {

                    const element =
                        document.getElementById(id);

                    if (element) {
                        element.textContent =
                            value;
                    }
                }
            );


        const status =
            this.isSubscriptionActive()
                ? "فعال"
                : "رایگان";


        const statusElement =
            document.getElementById(
                "subscriptionStatus"
            );

        if (statusElement) {
            statusElement.textContent =
                status;
        }


        const dashboardSubscription =
            document.getElementById(
                "dashboardSubscription"
            );

        if (dashboardSubscription) {

            dashboardSubscription.textContent =
                this.isSubscriptionActive()
                    ? "اشتراک فعال"
                    : "رایگان — ۱ مرحله";
        }


        const badge =
            document.getElementById(
                "dashboardAccessBadge"
            );

        if (badge) {

            badge.textContent =
                this.isSubscriptionActive()
                    ? "🔓 همه مراحل باز"
                    : "🔒 فقط ۱ مرحله رایگان";

            badge.classList.toggle(
                "free",
                !this.isSubscriptionActive()
            );
        }


        const generalStage =
            document.getElementById(
                "dashboardGeneralStage"
            );

        if (generalStage) {

            generalStage.textContent =
                getUnlockedStage(
                    this.state,
                    "general"
                );
        }


        const funStage =
            document.getElementById(
                "dashboardFunStage"
            );

        if (funStage) {

            funStage.textContent =
                getUnlockedStage(
                    this.state,
                    "fun"
                );
        }


        const subscriptionTitle =
            document.getElementById(
                "dashboardSubscriptionTitle"
            );

        const subscriptionText =
            document.getElementById(
                "dashboardSubscriptionText"
            );


        if (this.isSubscriptionActive()) {

            if (subscriptionTitle) {
                subscriptionTitle.textContent =
                    "اشتراک فعال است";
            }

            if (subscriptionText) {
                subscriptionText.textContent =
                    "همه مراحل QuizDuo برای شما باز است.";
            }

        } else {

            if (subscriptionTitle) {
                subscriptionTitle.textContent =
                    "اشتراک و دسترسی مراحل";
            }

            if (subscriptionText) {
                subscriptionText.textContent =
                    "حساب رایگان: فقط مرحله ۱ باز است.";
            }
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


        const leaderboard =
            getLeaderboard() || [];


        if (!leaderboard.length) {

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
            leaderboard
                .slice(0, 50)
                .map(
                    (player, index) => `
                    <tr>
                        <td>
                            ${index + 1}
                        </td>

                        <td>
                            ${escapeHTML(
                                player.username ||
                                "بازیکن"
                            )}
                        </td>

                        <td>
                            ${Number(
                                player.xp || 0
                            ).toLocaleString("fa-IR")}
                        </td>

                        <td>
                            ${Number(
                                player.stage || 1
                            ).toLocaleString("fa-IR")}
                        </td>
                    </tr>
                    `
                )
                .join("");
    }


    renderSubscription() {

        const account =
            document.getElementById(
                "accountNumber"
            );

        if (account) {
            account.textContent =
                ACCOUNT_NUMBER;
        }


        const status =
            document.getElementById(
                "subscriptionStatus"
            );

        if (status) {

            status.textContent =
                this.isSubscriptionActive()
                    ? "فعال"
                    : "رایگان";
        }
    }


    selectPlan(id) {

        if (!subscriptionPlans[id]) {
            return;
        }


        this.selectedPlan =
            id;


        const plan =
            subscriptionPlans[id];


        const panel =
            document.getElementById(
                "paymentPanel"
            );


        if (panel) {
            panel.classList.remove(
                "hidden"
            );
        }


        const title =
            document.getElementById(
                "selectedPlanTitle"
            );

        if (title) {
            title.textContent =
                `اشتراک ${plan.name}`;
        }


        const amount =
            document.getElementById(
                "selectedAmount"
            );

        if (amount) {
            amount.textContent =
                money(plan.price);
        }


        const account =
            document.getElementById(
                "accountNumber"
            );

        if (account) {
            account.textContent =
                ACCOUNT_NUMBER;
        }


        const finalPrice =
            document.getElementById(
                "finalPrice"
            );

        if (finalPrice) {
            finalPrice.textContent =
                money(plan.price);
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
            behavior: "smooth"
        });
    }


    closePayment() {

        const panel =
            document.getElementById(
                "paymentPanel"
            );

        if (panel) {
            panel.classList.add(
                "hidden"
            );
        }


        this.selectedPlan =
            null;

        this.selectedReceipt =
            null;


        const input =
            document.getElementById(
                "paymentFile"
            );

        if (input) {
            input.value = "";
        }


        const fileName =
            document.getElementById(
                "fileName"
            );

        if (fileName) {
            fileName.textContent =
                "فایلی انتخاب نشده است";
        }
    }


    handleReceipt(file) {

        this.selectedReceipt =
            file || null;


        const fileName =
            document.getElementById(
                "fileName"
            );


        if (!file) {

            if (fileName) {
                fileName.textContent =
                    "فایلی انتخاب نشده است";
            }

            return;
        }


        if (!file.type.startsWith("image/")) {

            this.selectedReceipt =
                null;

            fileName.textContent =
                "لطفاً فقط تصویر فیش را انتخاب کنید.";

            return;
        }


        if (
            file.size >
            5 * 1024 * 1024
        ) {

            this.selectedReceipt =
                null;

            fileName.textContent =
                "حجم تصویر نباید بیشتر از ۵ مگابایت باشد.";

            return;
        }


        fileName.textContent =
            file.name;
    }


    async submitPayment() {

        const message =
            document.getElementById(
                "paymentMessage"
            );


        if (!this.currentUser) {

            if (message) {
                message.textContent =
                    "ابتدا وارد حساب خود شوید.";
            }

            this.go("auth");

            return;
        }


        if (!this.selectedPlan) {

            if (message) {
                message.textContent =
                    "ابتدا یک اشتراک انتخاب کنید.";
            }

            return;
        }


        if (!this.selectedReceipt) {

            if (message) {
                message.textContent =
                    "تصویر فیش پرداخت را آپلود کنید.";
            }

            return;
        }


        const plan =
            subscriptionPlans[
                this.selectedPlan
            ];


        try {

            if (message) {
                message.textContent =
                    "در حال ارسال فیش...";
            }


            const receipt =
                await this.fileToBase64(
                    this.selectedReceipt
                );


            const response =
                await this.postJSON({

                    action: "payment",

                    username:
                        this.currentUser,

                    userId:
                        this.state.userId || "",

                    phone:
                        this.state.phone || "",

                    planId:
                        this.selectedPlan,

                    planName:
                        plan.name,

                    months:
                        plan.months,

                    amount:
                        plan.price,

                    accountNumber:
                        ACCOUNT_NUMBER,

                    receiptName:
                        this.selectedReceipt.name,

                    receiptType:
                        this.selectedReceipt.type,

                    receiptBase64:
                        receipt
                });


            if (
                response &&
                response.ok === false
            ) {

                throw new Error(
                    response.message ||
                    "ارسال فیش ناموفق بود."
                );
            }


            if (message) {
                message.textContent =
                    "فیش با موفقیت ارسال شد و پس از بررسی، اشتراک فعال می‌شود.";
            }


            this.toast(
                "فیش پرداخت ارسال شد."
            );


            this.closePayment();

        } catch (error) {

            console.error(
                "Payment failed:",
                error
            );


            if (message) {
                message.textContent =
                    error.message ||
                    "ارسال فیش ناموفق بود.";
            }
        }
    }


    fileToBase64(file) {

        return new Promise(
            (resolve, reject) => {

                const reader =
                    new FileReader();


                reader.onload = () => {

                    const result =
                        String(
                            reader.result || ""
                        );


                    const comma =
                        result.indexOf(",");


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


    async sendSupport() {

        const subject =
            document.getElementById(
                "supportSubject"
            )?.value.trim() || "";


        const text =
            document.getElementById(
                "supportText"
            )?.value.trim() || "";


        const message =
            document.getElementById(
                "supportMsg"
            );


        if (!text) {

            if (message) {
                message.textContent =
                    "متن پیام را وارد کنید.";
            }

            return;
        }


        try {

            if (message) {
                message.textContent =
                    "در حال ارسال...";
            }


            await this.postJSON({

                action: "support",

                username:
                    this.currentUser ||
                    this.state.username,

                userId:
                    this.state.userId || "",

                phone:
                    this.state.phone || "",

                subject,

                message:
                    text
            });


            if (message) {
                message.textContent =
                    "پیام شما برای پشتیبانی ارسال شد.";
            }


            const subjectInput =
                document.getElementById(
                    "supportSubject"
                );

            const textInput =
                document.getElementById(
                    "supportText"
                );


            if (subjectInput) {
                subjectInput.value = "";
            }

            if (textInput) {
                textInput.value = "";
            }


            this.toast(
                "پیام پشتیبانی ارسال شد."
            );

        } catch (error) {

            console.error(
                "Support failed:",
                error
            );


            if (message) {
                message.textContent =
                    "ارسال پیام ناموفق بود.";
            }
        }
    }


    async sendChatMessage() {

        const input =
            document.getElementById(
                "chatInput"
            );


        const text =
            input?.value.trim() || "";


        if (!text) {
            return;
        }


        try {

            await this.postJSON({

                action:
                    "supportUserReply",

                username:
                    this.currentUser ||
                    this.state.username,

                userId:
                    this.state.userId || "",

                phone:
                    this.state.phone || "",

                message:
                    text
            });


            if (input) {
                input.value = "";
            }


            this.addChatMessage(
                text,
                "user"
            );

        } catch (error) {

            console.error(
                "Chat failed:",
                error
            );

            this.toast(
                "ارسال پیام ناموفق بود."
            );
        }
    }


    addChatMessage(
        text,
        sender = "user"
    ) {

        const messages =
            document.getElementById(
                "messages"
            );


        if (!messages) {
            return;
        }


        const item =
            document.createElement(
                "div"
            );


        item.className =
            `chat-message ${sender}`;


        item.innerHTML =
            escapeHTML(text);


        messages.appendChild(
            item
        );


        messages.scrollTop =
            messages.scrollHeight;
    }


    loadChat() {

        const messages =
            document.getElementById(
                "messages"
            );


        if (!messages) {
            return;
        }


        messages.innerHTML = "";


        if (!this.currentUser) {

            this.addChatMessage(
                "برای استفاده از چت ابتدا وارد حساب خود شوید.",
                "system"
            );

            return;
        }
    }


    loadSupport() {

        const message =
            document.getElementById(
                "supportMsg"
            );


        if (
            message &&
            !this.currentUser
        ) {

            message.textContent =
                "برای ارسال پیام پشتیبانی بهتر است وارد حساب خود شوید.";
        }
    }


    async syncUser() {

        if (!this.currentUser) {
            return;
        }


        try {

            const response =
                await this.postJSON({

                    action:
                        "userUpdates",

                    username:
                        this.currentUser,

                    userId:
                        this.state.userId || "",

                    phone:
                        this.state.phone || "",

                    state:
                        this.state,

                    subscription:
                        this.state.subscription
                });


            if (
                response &&
                response.subscription
            ) {

                this.state.subscription =
                    response.subscription;

                saveState(
                    this.state
                );

                this.refreshUI();
            }

        } catch (error) {

            console.error(
                "Server sync failed:",
                error
            );
        }
    }


    async postJSON(payload) {

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


        if (!response.ok) {

            throw new Error(
                `Server error: ${response.status}`
            );
        }


        const text =
            await response.text();


        if (!text) {
            return {};
        }


        try {

            return JSON.parse(text);

        } catch {

            return {
                ok: true,
                raw: text
            };
        }
    }


    updateDashboardTab(target) {

        document
            .querySelectorAll(
                "[data-dashboard-target]"
            )
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.dashboardTarget ===
                    target
                );
            });
    }


    toast(message) {

        let toast =
            document.getElementById(
                "quizToast"
            );


        if (!toast) {

            toast =
                document.createElement(
                    "div"
                );

            toast.id =
                "quizToast";

            toast.className =
                "quiz-toast";

            document.body.appendChild(
                toast
            );
        }


        toast.textContent =
            message;


        toast.classList.add(
            "show"
        );


        clearTimeout(
            this.toastTimer
        );


        this.toastTimer =
            setTimeout(
                () => {

                    toast.classList.remove(
                        "show"
                    );

                },
                3000
            );
    }
}


const quizDuoApp =
    new QuizDuoApp();


document.addEventListener(
    "DOMContentLoaded",
    () => {
        quizDuoApp.init();
    }
);


function showPage(page) {
    quizDuoApp.go(page);
}


window.QuizDuo = {

    state:
        quizDuoApp.state,

    navigate:
        page => quizDuoApp.go(page),

    logout:
        () => quizDuoApp.logout(),

    openAuth:
        () => quizDuoApp.openAuth(),

    selectPlan:
        plan => quizDuoApp.selectPlan(plan),

    startStage:
        stage => quizDuoApp.startStage(stage),

    syncUser:
        () => quizDuoApp.syncUser(),

    isSubscriptionActive:
        () =>
            quizDuoApp.isSubscriptionActive(),

    hasFullAccess:
        () =>
            quizDuoApp.hasFullAccess(),

    canAccessStage:
        stage =>
            quizDuoApp.canAccessStage(stage),

    toast:
        message =>
            quizDuoApp.toast(message),

    showPage
};
