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
    QuizEngine,
    QUIZ_CONFIG
} from "./quiz.js";


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


// فقط برای تست شخصی.
// این کد در رابط سایت نمایش داده نمی‌شود.
//
// نکته:
// چون سایت سمت کاربر اجرا می‌شود، این کد محرمانه واقعی نیست
// و برای سیستم پرداخت واقعی نباید از چنین روشی استفاده شود.
const PRIVATE_TEST_CODE = "QDZ-100K-HASTI";


class QuizDuoApp {

    constructor() {

        this.currentUser = getCurrentUser();

        this.state = loadState(
            createDefaultState(),
            this.currentUser || "guest"
        );

        this.isRegisterMode = false;

        this.quizCategory = "general";

        this.quiz = new QuizEngine(
            this.state,
            () => this.persist()
        );

        this.selectedPlan = "nineMonth";

        this.discountPercent = 0;

        this.testFixedAmount = null;

        this.bindGlobal();
        this.bindAuth();
        this.bindQuiz();
        this.bindChat();
        this.bindSupport();
        this.bindSubscription();

        this.renderAll();

        this.showPage("home");
    }


    persist() {

        saveState(
            this.state,
            this.currentUser || "guest"
        );

        if (this.currentUser) {
            updateLeaderboard(this.state);
        }

        this.renderAll();

    }


    bindGlobal() {

        document
            .querySelectorAll("[data-page]")
            .forEach(button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        this.showPage(
                            button.dataset.page
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
                () => {

                    this.showPage(
                        this.currentUser
                            ? "profile"
                            : "auth"
                    );

                }
            );


        document
            .getElementById("logoutButton")
            ?.addEventListener(
                "click",
                () => this.logout()
            );


        document
            .getElementById("authBack")
            ?.addEventListener(
                "click",
                () => this.showPage("home")
            );

    }


    showPage(pageId) {

        if (!document.getElementById(pageId)) {
            pageId = "home";
        }


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


        if (pageId === "leaderboard") {
            this.renderLeaderboard();
        }


        if (pageId === "profile") {
            this.renderProfile();
        }


        if (pageId === "quiz") {
            this.renderStages();
        }

    }


    toggleTheme() {

        const next =
            document.body.classList.contains("dark")
                ? "light"
                : "dark";

        document.body.classList.toggle(
            "dark",
            next === "dark"
        );

        localStorage.setItem(
            "quizduo_theme",
            next
        );

    }


    loadTheme() {

        const saved =
            localStorage.getItem("quizduo_theme")
            || "light";

        document.body.classList.toggle(
            "dark",
            saved === "dark"
        );

    }


    bindAuth() {

        document
            .getElementById("authSubmit")
            ?.addEventListener(
                "click",
                () => this.submitAuth()
            );


        document
            .getElementById("toggleAuth")
            ?.addEventListener(
                "click",
                () => {

                    this.isRegisterMode =
                        !this.isRegisterMode;

                    this.renderAuthMode();

                }
            );

    }


    renderAuthMode() {

        document.getElementById(
            "authTitle"
        ).textContent =
            this.isRegisterMode
                ? "ساخت حساب"
                : "ورود";


        document.getElementById(
            "authSubmit"
        ).textContent =
            this.isRegisterMode
                ? "ثبت‌نام"
                : "ورود";


        document.getElementById(
            "toggleAuth"
        ).textContent =
            this.isRegisterMode
                ? "قبلاً حساب دارم"
                : "ساخت حساب جدید";


        document.getElementById(
            "authPassword"
        ).autocomplete =
            this.isRegisterMode
                ? "new-password"
                : "current-password";


        document.getElementById(
            "authMsg"
        ).textContent = "";

    }


    submitAuth() {

        const name =
            document.getElementById(
                "authName"
            ).value.trim();


        const password =
            document.getElementById(
                "authPassword"
            ).value;


        const message =
            document.getElementById(
                "authMsg"
            );


        if (!name || !password) {

            message.textContent =
                "نام کاربری و رمز عبور را وارد کنید.";

            return;

        }


        if (
            name.toLowerCase()
            === "بازیکن مهمان"
        ) {

            message.textContent =
                "این نام کاربری قابل استفاده نیست.";

            return;

        }


        const users = getUsers();


        const existingIndex =
            users.findIndex(
                user =>
                    user.username.toLowerCase()
                    === name.toLowerCase()
            );


        if (this.isRegisterMode) {

            if (existingIndex !== -1) {

                message.textContent =
                    "این نام کاربری قبلاً ثبت شده است.";

                return;

            }


            users.push({
                username: name,
                password
            });


            saveUsers(users);

            setCurrentUser(name);

            this.currentUser = name;

            this.state =
                loadState(
                    createDefaultState(),
                    name
                );

            this.state.username = name;

            this.persist();

            message.textContent =
                "حساب با موفقیت ساخته شد.";

            this.showPage("profile");

            return;

        }


        if (
            existingIndex === -1
            ||
            users[existingIndex].password
                !== password
        ) {

            message.textContent =
                "نام کاربری یا رمز عبور نادرست است.";

            return;

        }


        setCurrentUser(
            users[existingIndex].username
        );


        this.currentUser =
            users[existingIndex].username;


        this.state =
            loadState(
                createDefaultState(),
                this.currentUser
            );


        this.state.username =
            this.currentUser;


        this.persist();

        message.textContent =
            "ورود موفق بود.";

        this.showPage("profile");

    }


    logout() {

        logoutUser();

        this.currentUser = null;

        this.state =
            loadState(
                createDefaultState(),
                "guest"
            );

        this.quiz.state =
            this.state;

        this.showPage("home");

        this.renderAll();

    }


    bindQuiz() {

        document
            .querySelectorAll(
                "[data-category-tab]"
            )
            .forEach(tab => {

                tab.addEventListener(
                    "click",
                    () => {

                        this.quizCategory =
                            tab.dataset.categoryTab;

                        document
                            .querySelectorAll(
                                "[data-category-tab]"
                            )
                            .forEach(item =>
                                item.classList.toggle(
                                    "active",
                                    item === tab
                                )
                            );

                        this.renderStages();

                    }
                );

            });

    }


    async renderStages() {

        const container =
            document.getElementById(
                "stages"
            );


        if (!container) return;


        container.innerHTML =
            "<div class='panel loading'>در حال بارگذاری مرحله‌ها...</div>";


        try {

            await this.quiz.loadCategory(
                this.quizCategory
            );


            const maxStage =
                Math.max(
                    1,
                    ...this.quiz.questions.map(
                        q => Number(q.stage) || 1
                    )
                );


            const unlocked =
                getUnlockedStage(
                    this.state,
                    this.quizCategory
                );


            container.innerHTML = "";


            for (
                let stage = 1;
                stage <= maxStage;
                stage++
            ) {

                const completed =
                    isStageCompleted(
                        this.state,
                        this.quizCategory,
                        stage
                    );


                const locked =
                    stage > unlocked;


                const card =
                    document.createElement(
                        "article"
                    );


                card.className =
                    `stage-card
                    ${completed ? "completed" : ""}
                    ${locked ? "locked" : ""}`;


                card.innerHTML = `

                    <div class="stage-number">
                        ${stage}
                    </div>

                    <div>

                        <h3>
                            مرحله ${stage}
                        </h3>

                        <p>
                            ${
                                completed
                                    ? "✓ قبلاً تکمیل شده"
                                    : locked
                                        ? "🔒 قفل"
                                        : `${QUIZ_CONFIG.stageXP} XP`
                            }
                        </p>

                    </div>

                    <button
                        class="${
                            completed
                                ? "secondary"
                                : "primary"
                        }"
                        ${locked ? "disabled" : ""}
                    >
                        ${
                            completed
                                ? "بازی دوباره"
                                : locked
                                    ? "قفل"
                                    : "شروع"
                        }
                    </button>

                `;


                const button =
                    card.querySelector(
                        "button"
                    );


                if (!locked) {

                    button.addEventListener(
                        "click",
                        () =>
                            this.startStage(
                                stage,
                                completed
                            )
                    );

                }


                container.appendChild(card);

            }


        } catch (error) {

            console.error(error);

            container.innerHTML =
                "<div class='panel error'>بارگذاری سوال‌ها انجام نشد. فایل داده را بررسی کنید.</div>";

        }

    }


    async startStage(
        stage,
        replay = false
    ) {

        if (
            !this.currentUser
            &&
            stage > 3
        ) {

            alert(
                "برای ادامه بازی باید ثبت‌نام یا وارد حساب شوید."
            );

            this.isRegisterMode = true;

            this.renderAuthMode();

            this.showPage("auth");

            return;

        }


        if (replay) {

            const ok =
                confirm(
                    "شما قبلاً امتیاز این مرحله را کسب کرده‌اید. آیا مایلید دوباره این مرحله را بازی کنید؟\n\nبازی کردن در این مرحله نه از شما قلب کم می‌کند و نه XP اضافه می‌کند."
                );


            if (!ok) return;

        }


        const questions =
            this.quiz.startStage(
                this.quizCategory,
                stage,
                replay
            );


        if (!questions.length) {

            alert(
                "برای این مرحله هنوز سوالی ثبت نشده است."
            );

            return;

        }


        this.renderQuestion();

        this.showPage("quiz");

    }


    renderQuestion() {

        const box =
            document.getElementById(
                "quizBox"
            );


        const question =
            this.quiz.getCurrentQuestion();


        if (!question) return;


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

                <span>
                    🔥 ${this.quiz.combo}
                </span>

            </div>


            <h3>
                ${escapeHTML(question.q)}
            </h3>


            <div class="answers">

                ${question.options
                    .map(
                        (option, index) => `
                            <button
                                class="answer"
                                data-answer="${index}"
                            >
                                ${escapeHTML(option)}
                            </button>
                        `
                    )
                    .join("")}

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
                        this.answerQuestion(
                            Number(
                                button.dataset.answer
                            )
                        )
                );

            });

    }


    answerQuestion(index) {

        const result =
            this.quiz.answer(index);


        if (!result.finished) {

            this.renderQuestion();

            return;

        }


        const box =
            document.getElementById(
                "quizBox"
            );


        const title =
            result.passed
                ? "🎉 مرحله را با موفقیت گذراندی!"
                : "مرحله کامل نشد";


        let details =
            `امتیاز: ${Math.round(
                result.percentage * 100
            )}٪`;


        if (result.earnedXP) {

            details +=
                `\n+${result.earnedXP} XP`;

        }


        if (result.heartLost) {

            details +=
                "\n❤️ یک قلب کم شد.";

        }


        if (result.replay) {

            details +=
                "\nاین بازی دوباره بود؛ XP و قلب تغییر نکردند.";

        }


        box.innerHTML = `

            <div class="result-card">

                <h3>
                    ${title}
                </h3>

                <p>
                    ${escapeHTML(
                        details
                    ).replaceAll(
                        "\n",
                        "<br>"
                    )}
                </p>

                <button
                    id="nextStageButton"
                    class="primary"
                >
                    ${
                        result.passed
                            ? "بازگشت به مرحله‌ها"
                            : "تلاش دوباره"
                    }
                </button>

            </div>

        `;


        document
            .getElementById(
                "nextStageButton"
            )
            .addEventListener(
                "click",
                () => {

                    box.classList.add(
                        "hidden"
                    );

                    this.renderStages();

                }
            );


        this.renderAll();

    }


    bindChat() {

        document
            .getElementById("sendChat")
            ?.addEventListener(
                "click",
                () => this.sendChat()
            );


        document
            .getElementById("chatInput")
            ?.addEventListener(
                "keydown",
                event => {

                    if (event.key === "Enter") {
                        this.sendChat();
                    }

                }
            );

    }


    sendChat() {

        const input =
            document.getElementById(
                "chatInput"
            );


        const text =
            input.value.trim();


        if (!text) return;


        const messages =
            JSON.parse(
                localStorage.getItem(
                    "quizduo_chat"
                ) || "[]"
            );


        messages.push({

            username:
                this.currentUser
                || "بازیکن مهمان",

            text,

            createdAt:
                Date.now()

        });


        localStorage.setItem(
            "quizduo_chat",
            JSON.stringify(
                messages.slice(-100)
            )
        );


        input.value = "";

        this.renderChat();

    }


    renderChat() {

        const box =
            document.getElementById(
                "messages"
            );


        if (!box) return;


        const messages =
            JSON.parse(
                localStorage.getItem(
                    "quizduo_chat"
                ) || "[]"
            );


        box.innerHTML =
            messages.length

                ? messages
                    .map(
                        item => `

                            <div class="chat-message">

                                <b>
                                    ${escapeHTML(
                                        item.username
                                    )}
                                </b>

                                <span>
                                    ${escapeHTML(
                                        item.text
                                    )}
                                </span>

                            </div>

                        `
                    )
                    .join("")

                : "<p class='muted'>هنوز پیامی وجود ندارد.</p>";


        box.scrollTop =
            box.scrollHeight;

    }


    bindSupport() {

        document
            .getElementById(
                "supportSend"
            )
            ?.addEventListener(
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


                    const msg =
                        document
                            .getElementById(
                                "supportMsg"
                            );


                    if (!subject || !text) {

                        msg.textContent =
                            "موضوع و متن پیام را وارد کنید.";

                        return;

                    }


                    const tickets =
                        JSON.parse(
                            localStorage.getItem(
                                "quizduo_support"
                            ) || "[]"
                        );


                    tickets.push({

                        username:
                            this.currentUser
                            || "بازیکن مهمان",

                        subject,

                        text,

                        createdAt:
                            Date.now()

                    });


                    localStorage.setItem(
                        "quizduo_support",
                        JSON.stringify(
                            tickets
                        )
                    );


                    document.getElementById(
                        "supportSubject"
                    ).value = "";


                    document.getElementById(
                        "supportText"
                    ).value = "";


                    msg.textContent =
                        "درخواست شما ثبت شد.";

                }
            );

    }


    bindSubscription() {

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


        document
            .getElementById(
                "applyDiscount"
            )
            ?.addEventListener(
                "click",
                () => this.applyDiscount()
            );


        document
            .getElementById(
                "submitPayment"
            )
            ?.addEventListener(
                "click",
                () =>
                    this.submitPaymentRequest()
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
                        .classList.add(
                            "hidden"
                        )
            );

    }


    selectPlan(planKey) {

        if (!subscriptionPlans[planKey]) {
            return;
        }


        this.selectedPlan =
            planKey;


        this.discountPercent = 0;

        this.testFixedAmount = null;


        document.getElementById(
            "discountCode"
        ).value = "";


        document.getElementById(
            "discountMessage"
        ).textContent = "";


        document.getElementById(
            "paymentMessage"
        ).textContent = "";


        document.getElementById(
            "paymentPanel"
        ).classList.remove(
            "hidden"
        );


        this.updateFinalPrice();


        document
            .getElementById(
                "paymentPanel"
            )
            .scrollIntoView({
                behavior: "smooth",
                block: "start"
            });

    }


    applyDiscount() {

        const code =
            document
                .getElementById(
                    "discountCode"
                )
                .value
                .trim()
                .toUpperCase();


        const message =
            document.getElementById(
                "discountMessage"
            );


        /*
         * کد تست شخصی ۱۰۰ هزار تومانی
         *
         * فقط برای پلن ۹ ماهه Premium
         *
         * این کد در رابط عمومی سایت معرفی نشده است.
         */

        if (code === PRIVATE_TEST_CODE) {

            if (
                this.selectedPlan
                !== "nineMonth"
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


            this.discountPercent = 0;

            this.testFixedAmount =
                100000;


            message.textContent =
                "کد تست اعمال شد. مبلغ تست: ۱۰۰٬۰۰۰ تومان.";


            this.updateFinalPrice();

            return;

        }


        this.testFixedAmount =
            null;


        if (!code) {

            this.discountPercent = 0;

            message.textContent =
                "کدی وارد نشده است.";

            this.updateFinalPrice();

            return;

        }


        if (discountCodes[code]) {

            this.discountPercent =
                discountCodes[code];


            message.textContent =
                `کد با ${this.discountPercent}٪ تخفیف اعمال شد.`;

        } else {

            this.discountPercent = 0;

            message.textContent =
                "کد تخفیف معتبر نیست.";

        }


        this.updateFinalPrice();

    }


    getFinalPrice() {

        const plan =
            subscriptionPlans[
                this.selectedPlan
            ];


        if (!plan) return 0;


        if (
            this.testFixedAmount !== null
            &&
            this.testFixedAmount !== undefined
        ) {

            return this.testFixedAmount;

        }


        return Math.round(
            plan.price
            *
            (
                1 -
                this.discountPercent / 100
            )
        );

    }


    updateFinalPrice() {

        const plan =
            subscriptionPlans[
                this.selectedPlan
            ];


        if (!plan) return;


        document.getElementById(
            "selectedPlanTitle"
        ).textContent =
            `${plan.name}${
                plan.premium
                    ? " · Premium 👑"
                    : ""
            }`;


        document.getElementById(
            "selectedAmount"
        ).textContent =
            this.formatPrice(
                plan.price
            );


        document.getElementById(
            "finalPrice"
        ).textContent =
            this.formatPrice(
                this.getFinalPrice()
            );

    }


    submitPaymentRequest() {

        if (!this.currentUser) {

            alert(
                "برای ثبت درخواست پرداخت ابتدا وارد حساب شوید."
            );

            this.showPage("auth");

            return;

        }


        const plan =
            subscriptionPlans[
                this.selectedPlan
            ];


        const requests =
            JSON.parse(
                localStorage.getItem(
                    "quizduo_payment_requests"
                ) || "[]"
            );


        requests.push({

            username:
                this.currentUser,

            plan:
                this.selectedPlan,

            planName:
                plan.name,

            amount:
                this.getFinalPrice(),

            discount:
                this.discountPercent,

            status:
                "pending",

            createdAt:
                Date.now()

        });


        localStorage.setItem(
            "quizduo_payment_requests",
            JSON.stringify(
                requests
            )
        );


        document.getElementById(
            "paymentMessage"
        ).textContent =
            "درخواست پرداخت شما ثبت شد و در وضعیت انتظار تأیید قرار گرفت.";

    }


    formatPrice(price) {

        return `${
            Number(
                price || 0
            ).toLocaleString("fa-IR")
        } تومان`;

    }


    renderProfile() {

        document.getElementById(
            "profileName"
        ).textContent =
            this.state.username
            || "بازیکن مهمان";


        document.getElementById(
            "profileScore"
        ).textContent =
            Number(
                this.state.xp || 0
            ).toLocaleString(
                "fa-IR"
            );


        document.getElementById(
            "profileStreak"
        ).textContent =
            Number(
                this.state.streak || 0
            ).toLocaleString(
                "fa-IR"
            );


        document.getElementById(
            "profileStage"
        ).textContent =
            Math.max(
                this.state.generalStage || 1,
                this.state.funStage || 1
            );


        document.getElementById(
            "subscription"
        ).textContent =
            this.state.subscription === "premium"
                ? "Premium 👑"
                : this.state.subscription === "paid"
                    ? "اشتراکی"
                    : "رایگان";

    }


    renderLeaderboard() {

        const body =
            document.getElementById(
                "leaderBody"
            );


        if (!body) return;


        const board =
            getLeaderboard();


        body.innerHTML =
            board.length

                ? board
                    .map(
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
                                    ${Number(
                                        item.xp || 0
                                    ).toLocaleString(
                                        "fa-IR"
                                    )}
                                </td>

                                <td>
                                    ${Math.max(
                                        item.generalStage || 1,
                                        item.funStage || 1
                                    )}
                                </td>

                            </tr>

                        `
                    )
                    .join("")

                : `
                    <tr>
                        <td colspan="4">
                            هنوز بازیکن ثبت‌شده‌ای وجود ندارد.
                        </td>
                    </tr>
                `;

    }


    renderAll() {

        this.loadTheme();


        this.quiz.state =
            this.state;


        this.renderProfile();

        this.renderLeaderboard();

        this.renderChat();


        const authButton =
            document.getElementById(
                "authButton"
            );


        if (authButton) {

            authButton.textContent =
                this.currentUser
                    ? `👤 ${this.currentUser}`
                    : "ورود / ثبت‌نام";

        }


        const stats =
            document.getElementById(
                "quizStats"
            );


        if (stats) {

            stats.textContent =
                `❤️ ${this.state.hearts}/${this.state.maxHearts} · XP ${this.state.xp} · 🔥 ${this.state.streak}`;

        }

    }

}


const app =
    new QuizDuoApp();


window.quizDuo =
    app;
