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
    monthly: { name: "ماهانه", months: 1, price: 100000 },
    quarterly: { name: "سه‌ماهه", months: 3, price: 270000 },
    sixMonth: { name: "شش‌ماهه", months: 6, price: 480000 },
    nineMonth: { name: "نه‌ماهه", months: 9, price: 660000 }
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


function postServerForm(payload) {

    try {
        const iframeName =
            `quizduo_post_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        const iframe =
            document.createElement("iframe");

        iframe.name = iframeName;
        iframe.style.display = "none";
        document.body.appendChild(iframe);

        const form =
            document.createElement("form");

        form.method = "POST";
        form.action = APPS_SCRIPT_URL;
        form.target = iframeName;
        form.style.display = "none";

        const input =
            document.createElement("input");

        input.type = "hidden";
        input.name = "payload";
        input.value = JSON.stringify(payload);

        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();

        window.setTimeout(
            () => {
                iframe.remove();
                form.remove();
            },
            10000
        );
    } catch (error) {
        console.warn(
            "Background server update failed:",
            error
        );
    }
}


function serverJsonp(action, params = {}) {

    return new Promise(
        (resolve, reject) => {
            const callbackName =
                `quizDuoJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

            const script =
                document.createElement("script");

            const url =
                new URL(APPS_SCRIPT_URL);

            url.searchParams.set(
                "action",
                action
            );

            url.searchParams.set(
                "callback",
                callbackName
            );

            Object.entries(params).forEach(
                ([key, value]) => {
                    if (
                        value !== undefined &&
                        value !== null
                    ) {
                        url.searchParams.set(
                            key,
                            String(value)
                        );
                    }
                }
            );

            let finished = false;

            const cleanup = () => {
                delete window[callbackName];
                script.remove();
            };

            window[callbackName] =
                data => {
                    if (finished) return;
                    finished = true;
                    cleanup();
                    resolve(data);
                };

            script.onerror = () => {
                if (finished) return;
                finished = true;
                cleanup();
                reject(
                    new Error(
                        "پاسخ JSONP دریافت نشد."
                    )
                );
            };

            script.src = url.toString();
            document.head.appendChild(script);

            window.setTimeout(
                () => {
                    if (finished) return;
                    finished = true;
                    cleanup();
                    reject(
                        new Error(
                            "زمان دریافت لیدربورد تمام شد."
                        )
                    );
                },
                10000
            );
        }
    );
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

        this.questionTimer =
            null;

        this.questionTimeLeft =
            20;
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

            this.sendUserState();
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
                "themeToggle"
            )
            ?.addEventListener(
                "click",
                () => this.toggleTheme()
            );


        document
            .getElementById(
                "authButton"
            )
            ?.addEventListener(
                "click",
                () => this.go("auth")
            );


        this.initAuth();

        this.initQuiz();

        this.initSubscription();

        if (typeof this.initChat === "function") {
            this.initChat();
        }

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
                u =>
                    String(
                        u.username
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


    sendUserState() {

        if (
            this.state.username ===
            "بازیکن مهمان"
        ) {
            return;
        }

        let phone = "";
        try {
            const users = getUsers();
            const current =
                users.find(
                    user =>
                        String(
                            user.username || ""
                        ).toLowerCase() ===
                        String(
                            this.state.username
                        ).toLowerCase()
                );
            phone = current?.phone || "";
        } catch {
            phone = "";
        }

        postServerForm({
            action: "userState",
            username: this.state.username,
            phone,
            xp: Number(this.state.xp || 0),
            level: Number(this.state.level || 1),
            streak: Number(this.state.streak || 0),
            generalStage: Math.max(
                0,
                Number(this.state.generalStage || 1) - 1
            ),
            funStage: Math.max(
                0,
                Number(this.state.funStage || 1) - 1
            )
        });
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


    stopQuestionTimer() {

        if (this.questionTimer) {
            clearInterval(this.questionTimer);
            this.questionTimer = null;
        }
    }


    startQuestionTimer() {

        this.stopQuestionTimer();

        const limit = 20;
        this.questionTimeLeft = limit;

        const timer =
            document.getElementById("questionTimer");

        if (timer) {
            timer.textContent = `⏱ ${this.questionTimeLeft}`;
        }

        this.questionTimer =
            window.setInterval(
                () => {
                    this.questionTimeLeft -= 1;

                    const currentTimer =
                        document.getElementById("questionTimer");

                    if (currentTimer) {
                        currentTimer.textContent =
                            `⏱ ${Math.max(0, this.questionTimeLeft)}`;
                    }

                    if (this.questionTimeLeft <= 0) {
                        this.stopQuestionTimer();
                        this.answer(-1, true);
                    }
                },
                1000
            );
    }


    renderQuestion(question) {

        this.stopQuestionTimer();

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
                    سوال ${
                        this.quiz.currentQuestion + 1
                    }
                    از
                    ${this.quiz.getQuestionCount()}
                </span>

                <span id="questionTimer">⏱ 20</span>
            </div>

            <h3>
                ${escapeHTML(
                    normalized.question
                )}
            </h3>

            <div class="options">
                ${options.map(
                    (option, index) => `
                        <button
                            class="option"
                            data-i="${index}"
                        >
                            ${escapeHTML(
                                String(option)
                            )}
                        </button>
                    `
                ).join("")}
            </div>

            <div
                id="quizFeedback"
                class="quiz-feedback"
                aria-live="polite"
            ></div>
        `;

        box
            .querySelectorAll(
                ".option"
            )
            .forEach(btn => {
                btn.addEventListener(
                    "click",
                    () =>
                        this.answer(
                            Number(
                                btn.dataset.i
                            ),
                            false
                        )
                );
            });

        this.startQuestionTimer();

        box.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }


    answer(index, timedOut = false) {

        this.stopQuestionTimer();

        const result =
            this.quiz.answer(index, timedOut);

        const box =
            document.getElementById(
                "quizBox"
            );

        if (box) {
            box
                .querySelectorAll(
                    ".option"
                )
                .forEach(
                    button =>
                        button.disabled = true
                );
        }

        if (result.finished) {

            const feedback =
                document.getElementById(
                    "quizFeedback"
                );

            if (feedback) {
                feedback.innerHTML =
                    result.passed
                        ? `<div class="result-good">
                            🎉 مرحله با موفقیت تمام شد.
                            ${
                                result.earnedXP
                                    ? ` +${result.earnedXP} XP`
                                    : ""
                            }
                           </div>`
                        : `<div class="result-bad">
                            این مرحله را رد نکردی.
                            ${
                                result.heartLost
                                    ? " یک قلب کم شد."
                                    : ""
                            }
                           </div>`;

                feedback.innerHTML +=
                    `<button
                        id="quizNext"
                        class="primary full quiz-next"
                    >
                        ادامه
                    </button>`;

                document
                    .getElementById(
                        "quizNext"
                    )
                    .onclick =
                    () =>
                        this.renderStages();
            }

        } else {
            window.setTimeout(
                () =>
                    this.renderQuestion(
                        this.quiz.getCurrentQuestion()
                    ),
                150
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


        if (!name) {
            return;
        }


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


        const status =
            s.subscriptionStatus === "active" ||
            s.subscription === "paid"
                ? "اشتراکی"
                : "رایگان";


        document
            .getElementById(
                "subscriptionStatus"
            )
            .textContent =
            status;


        document
            .getElementById(
                "authButton"
            )
            .textContent =
            s.username ===
            "بازیکن مهمان"

                ? "ورود / ثبت‌نام"

                : s.username;
    }


    async renderLeaderboard() {

        const body =
            document.getElementById(
                "leaderBody"
            );

        if (!body) {
            return;
        }

        body.innerHTML = `
            <tr>
                <td colspan="4">در حال بارگذاری لیدربورد...</td>
            </tr>
        `;

        let rows = [];

        try {
            const data =
                await serverJsonp(
                    "leaderboard"
                );

            if (
                data &&
                data.success &&
                Array.isArray(data.entries)
            ) {
                rows = data.entries;
            }
        } catch (error) {
            console.warn(
                "Server leaderboard failed:",
                error
            );
        }

        if (!rows.length) {
            const local =
                getLeaderboard();

            rows = Array.isArray(local)
                ? local.map(item => ({
                    username:
                        item.username ||
                        item.name ||
                        "بازیکن",
                    xp:
                        Number(item.xp || 0),
                    generalStage:
                        Number(item.generalStage || item.stage || 1),
                    funStage:
                        Number(item.funStage || item.stage || 1)
                }))
                : [];
        }

        if (
            this.state.username !== "بازیکن مهمان" &&
            !rows.some(
                item =>
                    String(
                        item.username || item.name || ""
                    ).toLowerCase() ===
                    String(
                        this.state.username
                    ).toLowerCase()
            )
        ) {
            rows.push({
                username:
                    this.state.username,
                xp:
                    Number(this.state.xp || 0),
                generalStage:
                    Number(this.state.generalStage || 1),
                funStage:
                    Number(this.state.funStage || 1)
            });
        }

        rows.sort(
            (a, b) =>
                Number(b.xp || 0) -
                Number(a.xp || 0)
        );

        if (!rows.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="4">هنوز بازیکنی ثبت نشده است.</td>
                </tr>
            `;
            return;
        }

        body.innerHTML =
            rows.map(
                (item, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escapeHTML(
                            item.username || item.name || "بازیکن"
                        )}</td>
                        <td>${Number(item.xp || 0)}</td>
                        <td>${Math.max(
                            Number(item.generalStage || 1),
                            Number(item.funStage || 1)
                        ) - 1}</td>
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


    updateFinalPrice() {

        if (!this.selectedPlan) {
            return;
        }


        const base =
            subscriptionPlans[
                this.selectedPlan
            ].price;


        const final = base;


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


    async submitPayment() {

        const msg =
            document
                .getElementById(
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


            const normalAmount = plan.price;


            const data =
                await this.serverRequest({

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
                    "ارسال ناموفق بود."
                );
            }


            msg.textContent =
                "فیش با موفقیت ارسال شد و در انتظار بررسی است.";


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


            await this.syncServerUpdates();

        } catch (error) {

            console.error(
                "Payment error:",
                error
            );


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


                reader.onload = () =>
                    resolve(
                        String(
                            reader.result
                        )
                            .split(",")[1] ||
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
                        document
                            .getElementById(
                                "chatInput"
                            );


                    const text =
                        input.value.trim();


                    if (!text) {
                        return;
                    }


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


        if (!messages) {
            return;
        }


        messages.innerHTML =
            arr.map(
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
            ).join("");
    }


    initSupport() {

        const send =
            document.getElementById(
                "supportSend"
            );


        if (send) {

            send.addEventListener(
                "click",
                () =>
                    this.submitSupport()
            );
        }


        this.ensureUserPanels();


        document.addEventListener(
            "click",
            event => {

                const replyButton =
                    event.target.closest(
                        "[data-support-reply]"
                    );


                if (replyButton) {

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


                if (closeButton) {

                    this.closeSupport(
                        closeButton.dataset
                            .supportClose
                    );
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
                        در حال بررسی...
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
            document
                .getElementById(
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


        if (!subject || !text) {

            msg.textContent =
                "موضوع و پیام را وارد کنید.";

            return;
        }


        msg.textContent =
            "در حال ارسال درخواست...";


        try {

            const data =
                await this.serverRequest({

                    action:
                        "support",

                    username:
                        this.state.username,

                    phone:
                        this.getRegisteredPhone(),

                    subject,

                    message:
                        text
                });


            if (!data.success) {

                throw new Error(
                    data.message ||
                    "ارسال درخواست ناموفق بود."
                );
            }


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


            msg.textContent =
                data.message ||
                "گفت‌وگو ایجاد شد.";


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
                    conversationId
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

            const data =
                await this.serverRequest({

                    action:
                        "supportUserReply",

                    username:
                        this.state.username,

                    conversationId,

                    message
                });


            if (!data.success) {

                throw new Error(
                    data.message ||
                    "ارسال پیام ناموفق بود."
                );
            }


            textarea.value = "";


            await this.syncServerUpdates();

        } catch (error) {

            alert(
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

        const ok =
            confirm(
                "آیا مطمئن هستید که می‌خواهید این گفت‌وگو را به پایان برسانید؟ بعد از اتمام، امکان ارسال پیام جدید در همین گفت‌وگو وجود ندارد."
            );


        if (!ok) {
            return;
        }


        try {

            const data =
                await this.serverRequest({

                    action:
                        "closeSupport",

                    username:
                        this.state.username,

                    conversationId
                });


            if (!data.success) {

                throw new Error(
                    data.message ||
                    "اتمام گفت‌وگو ناموفق بود."
                );
            }


            await this.syncServerUpdates();

        } catch (error) {

            alert(
                error.message ||
                "اتمام گفت‌وگو ناموفق بود."
            );
        }
    }


    async serverRequest(payload) {

        let response;


        try {

            response =
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


            const approved =
                this.lastServerUpdates
                    .payments
                    .find(
                        p =>
                            p.status ===
                            "تأیید شد"
                    );


            if (approved) {

                const changed =
                    this.state.subscriptionPlan !==
                        approved.planId ||

                    this.state.subscriptionStatus !==
                        "active";


                this.state.subscriptionStatus =
                    "active";


                this.state.subscriptionPlan =
                    approved.planId;


                this.state.subscriptionName =
                    approved.planName;


                this.state.subscription = "paid";


                if (changed) {
                    this.persist();
                }
            }


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


    renderUserPanels(error = null) {

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

                paymentContent.innerHTML =
                    payments
                        .map(
                            item => {

                                let statusClass =
                                    "pending";


                                if (
                                    item.status ===
                                    "تأیید شد"
                                ) {

                                    statusClass =
                                        "success";
                                }


                                if (
                                    item.status ===
                                    "رد شد"
                                ) {

                                    statusClass =
                                        "danger";
                                }


                                const duration =
                                    item.planName ||
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
                                                    item.status
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
                        هنوز گفت‌وگوی پشتیبانی ندارید.
                    </p>`;

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
            "در حال بررسی";


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
                                    item.text || ""
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


        const shortText =
            conversation.message
                ? String(
                    conversation.message
                  ).slice(0, 120)
                : "";


        return `

            <article
                class="user-update-card support-conversation-card"
            >

                <div class="update-card-top">

                    <div>

                        <span class="eyebrow">
                            گفت‌وگوی پشتیبانی
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


                <p class="support-summary">

                    ${escapeHTML(
                        shortText
                    )}

                    ${
                        String(
                            conversation.message || ""
                        ).length > 120
                            ? "..."
                            : ""
                    }

                </p>


                <div class="support-thread">

                    ${
                        messagesHtml ||
                        `<p class="message">
                            هنوز پیامی ثبت نشده است.
                         </p>`
                    }

                </div>


                ${
                    closed

                        ? `

                            <div class="closed-conversation">

                                این گفت‌وگو توسط شما به پایان رسیده است.

                            </div>

                          `

                        : `

                            <div class="support-reply-box">

                                <textarea
                                    data-support-input="${escapeHTML(
                                        conversation.conversationId
                                    )}"
                                    placeholder="پیام بعدی خود را در همین گفت‌وگو بنویسید..."
                                ></textarea>


                                <div class="support-actions">

                                    <button
                                        class="primary"
                                        data-support-reply="${escapeHTML(
                                            conversation.conversationId
                                        )}"
                                    >
                                        ارسال پیام
                                    </button>


                                    <button
                                        class="secondary"
                                        data-support-close="${escapeHTML(
                                            conversation.conversationId
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


let quizDuoApp = null;

window.addEventListener(
    "DOMContentLoaded",
    () => {
        quizDuoApp = new App();
        quizDuoApp.init();
        window.QuizDuo = {
            state: quizDuoApp.state,
            navigate: page => quizDuoApp.go(page),
            showPage: page => quizDuoApp.go(page),
            logout: () => quizDuoApp.logout(),
            openAuth: () => quizDuoApp.go("auth"),
            selectPlan: id => quizDuoApp.selectPlan(id),
            startStage: (...args) => quizDuoApp.startStage(...args),
            syncUser: () => quizDuoApp.syncServerUpdates()
        };
    }
);
