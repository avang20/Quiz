import {
    createDefaultState,
    addXP,
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
    escapeHTML,
    todayKey,
    updateStreak
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

        this.state.subscriptionInfo =
            this.state.subscriptionInfo &&
            typeof this.state.subscriptionInfo === "object"
                ? this.state.subscriptionInfo
                : {
                    active:
                        this.state.subscriptionStatus === "active",
                    planId:
                        this.state.subscriptionPlan || "",
                    planName:
                        this.state.subscriptionName || "",
                    start: null,
                    expiry:
                        this.state.subscriptionExpiry || null
                };


        this.serverSyncTimer =
            null;

        this.questionTimer =
            null;

        this.questionTimeLeft =
            20;

        this.answerLocked =
            false;

        this.quizModalOpen =
            false;

        this.leaderboardPeriod =
            "week";
    }


    getDailyLoginRewardAmount(day) {

        const rewards = [3, 5, 7, 10, 13, 16, 20];
        const safeDay = Math.max(1, Number(day || 1));

        return rewards[Math.min(safeDay, 7) - 1];
    }


    applyDailyLoginReward() {

        if (this.state.username === "بازیکن مهمان") {
            return null;
        }

        const today = todayKey();

        if (this.state.dailyLoginRewardDate === today) {
            return null;
        }

        updateStreak(this.state);

        const day = Math.max(1, Number(this.state.streak || 1));
        const reward = this.getDailyLoginRewardAmount(day);

        addXP(this.state, reward);

        this.state.dailyLoginRewardDate = today;
        this.state.dailyLoginRewardDay = Math.min(day, 7);
        this.state.dailyLoginRewardXP = reward;

        return {
            day: Math.min(day, 7),
            reward,
            streak: Number(this.state.streak || 1)
        };
    }


    showDailyLoginReward(reward) {

        if (!reward) return;

        const dayText =
            reward.day >= 7
                ? "روز هفتم و بعد از آن"
                : `روز ${Number(reward.day).toLocaleString("fa-IR")}`;

        const message =
            `🔥 ${dayText}: +${Number(reward.reward).toLocaleString("fa-IR")} XP دریافت کردی!`;

        let toast = document.getElementById("quizduoDailyRewardToast");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "quizduoDailyRewardToast";
            toast.className = "daily-reward-toast";
            document.body.appendChild(toast);
        }

        toast.innerHTML = `
            <span class="daily-reward-icon">🔥</span>
            <span>
                <b>پاداش ورود روزانه</b>
                <small>${escapeHTML(message)}</small>
            </span>
        `;

        toast.classList.remove("show");
        void toast.offsetWidth;
        toast.classList.add("show");

        window.setTimeout(() => {
            toast?.classList.remove("show");
        }, 4200);
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

        this.initLeaderboard();

        this.go("home");

        const dailyReward = this.applyDailyLoginReward();
        if (dailyReward) {
            this.persist();
            window.setTimeout(
                () => this.showDailyLoginReward(dailyReward),
                900
            );
        }

        window.setTimeout(
            () => this.showFirstSiteWelcomeOnce(),
            650
        );

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

            const dailyReward =
                this.applyDailyLoginReward();

            this.persist();

            if (dailyReward) {
                window.setTimeout(
                    () => this.showDailyLoginReward(dailyReward),
                    700
                );
            }

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

            const dailyReward =
                this.applyDailyLoginReward();

            this.persist();

            if (dailyReward) {
                window.setTimeout(
                    () => this.showDailyLoginReward(dailyReward),
                    700
                );
            }

            msg.textContent =
                "ورود موفق بود.";
        }


        const registeredNow =
            this.authRegister === true;

        setTimeout(
            () => {
                this.go("home");

                if (registeredNow && !this.state.registrationCelebrationSeen) {
                    this.showCelebration("registration");
                }
            },
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
            bestCombo: Number(this.state.bestCombo || 0),
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


    getStageBestScore(category, stage) {

        const key =
            category === "general"
                ? "stageScoresGeneral"
                : "stageScoresFun";

        const scores =
            this.state[key] &&
            typeof this.state[key] === "object"
                ? this.state[key]
                : {};

        const score =
            Number(scores[String(Number(stage))]);

        return Number.isFinite(score)
            ? score
            : 0;
    }


    getHighestPassedStage(category) {

        let highest = 0;

        for (let stage = 1; stage <= 100; stage++) {
            if (
                this.getStageBestScore(category, stage) >=
                0.75
            ) {
                highest = stage;
                continue;
            }

            break;
        }

        return highest;
    }


    canAccessStage(category, stage) {

        const numericStage =
            Number(stage) || 1;

        if (numericStage <= 1) {
            return {
                allowed: true,
                reason: "stage1"
            };
        }

        if (!this.hasActiveSubscription()) {
            return {
                allowed: false,
                reason: "subscription"
            };
        }

        const previousScore =
            this.getStageBestScore(
                category,
                numericStage - 1
            );

        if (previousScore < 0.75) {
            return {
                allowed: false,
                reason: "previous"
            };
        }

        return {
            allowed: true,
            reason: "ok"
        };
    }


    openQuizModal() {

        const modal =
            document.getElementById("quizModal");

        if (!modal) return;

        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
        this.quizModalOpen = true;
    }


    closeQuizModal(renderStages = false) {

        this.stopQuestionTimer();
        this.answerLocked = false;
        this.quizModalOpen = false;

        const modal =
            document.getElementById("quizModal");

        if (modal) {
            modal.classList.add("hidden");
            modal.setAttribute("aria-hidden", "true");
        }

        document.body.classList.remove("modal-open");

        if (renderStages) {
            this.renderStages();
        }
    }


    showFirstSiteWelcomeOnce() {

        try {
            if (localStorage.getItem("quizduo_first_site_visit_seen") === "1") {
                return;
            }
        } catch {
            // Continue even if localStorage is unavailable.
        }

        this.showCelebration("site");
    }


    showCelebration(type) {

        const modal =
            document.getElementById("welcomeModal");

        if (!modal) return;

        const presets = {
            site: {
                icon: "🎓✨",
                kicker: "به خانواده QuizDuo خوش اومدی",
                title: "سلام دوست عزیز! 👋",
                text: "اینجا جاییه که دانشت، سرعت عملت و پشتکارت با هم تبدیل به پیشرفت می‌شن. آماده‌ای اولین چالش رو شروع کنی؟",
                points: [
                    ["🧠", "سؤال‌های متنوع"],
                    ["⚡", "رقابت و هیجان"],
                    ["🏆", "XP و مرحله‌های بیشتر"]
                ],
                note: "مرحله ۱ رایگانه؛ اما برای مرحله‌های بعدی باید اشتراک فعال داشته باشی.",
                button: "شروع ماجرا 🚀"
            },
            registration: {
                icon: "🎉🪪",
                kicker: "حساب تو آماده‌ست",
                title: `تبریک! <span id="welcomeUserName">دوست QuizDuo</span> ثبت‌نامت انجام شد 🎊`,
                text: "از اینجا به بعد امتیازها، پیشرفت مرحله‌ها و رکوردت برای حسابت ذخیره می‌شن. اولین قدمت رو با قدرت بردار!",
                points: [
                    ["✅", "حساب ساخته شد"],
                    ["⭐", "امتیاز و XP"],
                    ["🔥", "Streak و پیشرفت"]
                ],
                note: "یادت نره: هر روز به اینجا سر بزنی تا زود امتیازت زیاد بشه.",
                button: "بزن بریم! 🎮"
            },
            subscription: {
                icon: "👑🎉",
                kicker: "اولین اشتراک فعال شد",
                title: "تبریک! حالا اشتراکی شدی! 👑",
                text: "اولین اشتراک QuizDuo با موفقیت تأیید شد. از اینجا به بعد درهای مراحل بیشتر به روت بازه؛ برای شروع چالش‌ها آماده‌ای؟",
                points: [
                    ["🔓", "مراحل بیشتر"],
                    ["👑", "اشتراک فعال"],
                    ["🚀", "ادامه مسیر"]
                ],
                note: "مدت باقی‌مانده اشتراکت همین حالا در پروفایلت نمایش داده می‌شه.",
                button: "مشاهده مراحل 🔓"
            }
        };
        const preset =
            presets[type] || presets.site;

        modal.dataset.celebrationType = type;

        const icon = document.getElementById("welcomeIcon");
        const kicker = document.getElementById("welcomeKicker");
        const title = document.getElementById("welcomeTitle");
        const text = document.getElementById("welcomeText");
        const note = document.getElementById("welcomeNote");
        const button = document.getElementById("welcomeClose");

        if (icon) icon.textContent = preset.icon;
        if (kicker) kicker.textContent = preset.kicker;
        if (title) title.innerHTML = preset.title;
        if (text) text.textContent = preset.text;
        if (note) note.textContent = preset.note;
        if (button) button.textContent = preset.button;

        if (type === "registration") {
            const titleName = document.getElementById("welcomeUserName");
            if (titleName) titleName.textContent = this.state.username || "دوست QuizDuo";
        }

        preset.points.forEach((point, index) => {
            const iconEl = document.getElementById(`welcomePoint${index + 1}Icon`);
            const textEl = document.getElementById(`welcomePoint${index + 1}Text`);
            if (iconEl) iconEl.textContent = point[0];
            if (textEl) textEl.textContent = point[1];
        });

        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");

        const close =
            document.getElementById("welcomeClose");

        if (close && !close.dataset.bound) {
            close.dataset.bound = "1";
            close.addEventListener(
                "click",
                () => this.closeCelebration()
            );
        }

        this.launchConfetti();
    }


    launchConfetti() {

        const container =
            document.getElementById("celebrationConfetti");

        if (!container) return;

        container.innerHTML = "";

        const count = window.innerWidth < 600 ? 26 : 38;

        for (let i = 0; i < count; i++) {
            const piece = document.createElement("span");
            piece.className = `confetti-piece confetti-${i % 6}`;
            piece.style.setProperty("--x", `${Math.random() * 100}%`);
            piece.style.setProperty("--delay", `${Math.random() * 0.45}s`);
            piece.style.setProperty("--duration", `${2.5 + Math.random() * 1.3}s`);
            piece.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
            piece.style.setProperty("--spin", `${240 + Math.random() * 500}deg`);
            container.appendChild(piece);
        }

        window.setTimeout(
            () => {
                if (container) container.innerHTML = "";
            },
            4300
        );
    }


    closeCelebration() {

        const modal =
            document.getElementById("welcomeModal");

        const type =
            modal?.dataset.celebrationType || "site";

        if (type === "site") {
            try {
                localStorage.setItem("quizduo_first_site_visit_seen", "1");
            } catch {}
        } else if (type === "registration") {
            this.state.registrationCelebrationSeen = true;
            this.persist();
        } else if (type === "subscription") {
            this.state.subscriptionCelebrationSeen = true;
            this.persist();
        }

        this.state.welcomeSeen = true;
        saveState(
            this.state,
            this.state.username === "بازیکن مهمان" ? "guest" : this.state.username
        );

        if (modal) {
            modal.classList.add("hidden");
            modal.setAttribute("aria-hidden", "true");
            delete modal.dataset.celebrationType;
        }

        const confetti =
            document.getElementById("celebrationConfetti");
        if (confetti) confetti.innerHTML = "";

        if (!this.quizModalOpen) {
            document.body.classList.remove("modal-open");
        }
    }


    async renderStages() {

        this.closeQuizModal(false);

        const box =
            document.getElementById("stages");

        const category =
            this.quiz.currentCategory;

        if (!box) return;

        box.innerHTML =
            `<div class="panel loading">
                در حال بارگذاری مرحله‌ها...
            </div>`;

        try {
            await this.quiz.loadCategory(category);

            const maxStage =
                Math.max(
                    5,
                    ...this.quiz.questions.map(
                        q => Number(q.stage) || 1
                    )
                );

            box.innerHTML = "";

            for (let i = 1; i <= maxStage; i++) {
                const access =
                    this.canAccessStage(
                        category,
                        i
                    );

                const completed =
                    this.getStageBestScore(
                        category,
                        i
                    ) >= 0.75;

                const questions =
                    this.quiz.getStageQuestions(i);

                const previousScore =
                    i > 1
                        ? this.getStageBestScore(
                            category,
                            i - 1
                        )
                        : 0;

                const card =
                    document.createElement("article");

                card.className =
                    `stage-card panel ${
                        access.allowed ? "" : "locked"
                    } ${completed ? "completed" : ""}`;

                let badge = "شروع";
                let footerLeft = "رایگان";
                let footerRight = "ورود ←";

                if (i > 1) {
                    if (!this.hasActiveSubscription()) {
                        badge = "🔒 اشتراک لازم";
                        footerLeft = "نیازمند اشتراک";
                        footerRight = "🔒";
                    } else if (previousScore < 0.75) {
                        badge = "🔒 مرحله قبلی";
                        footerLeft = "نیازمند حداقل ۷۵٪ در مرحله قبلی";
                        footerRight = "🔒";
                    } else {
                        badge = "🔓 باز";
                        footerLeft = "آماده بازی";
                    }
                } else if (completed) {
                    badge = "✓ گذرانده شده";
                }

                card.innerHTML = `
                    <div class="stage-glow"></div>

                    <div class="stage-number">
                        ${i}
                    </div>

                    <div class="stage-content">
                        <div class="stage-topline">
                            <span class="stage-badge">
                                ${badge}
                            </span>
                            <span class="stage-icon">
                                ${completed ? "✓" : access.allowed ? "✨" : "🔒"}
                            </span>
                        </div>

                        <h3>مرحله ${i}</h3>

                        <p>
                            ${
                                questions.length
                                    ? `${questions.length} سوال چهارگزینه‌ای`
                                    : "این مرحله هنوز سوالی ندارد."
                            }
                        </p>

                        ${
                            i > 1 &&
                            this.hasActiveSubscription() &&
                            previousScore < 0.75
                                ? `<small class="stage-lock-reason">
                                    بهترین امتیاز مرحله ${i - 1}:
                                    ${Math.round(previousScore * 100).toLocaleString("fa-IR")}٪
                                    · حداقل لازم: ۷۵٪
                                  </small>`
                                : ""
                        }

                        <div class="stage-footer">
                            <span>${footerLeft}</span>
                            <span>${access.allowed && questions.length ? footerRight : "🔒"}</span>
                        </div>
                    </div>
                `;

                if (access.allowed && questions.length) {
                    card.addEventListener(
                        "click",
                        () => this.startStage(i)
                    );
                }

                box.appendChild(card);
            }

        } catch (error) {
            box.innerHTML =
                `<div class="panel error">
                    خطا در بارگذاری مرحله‌ها:
                    ${escapeHTML(error.message)}
                    <button
                        id="retryStages"
                        class="primary full"
                        type="button"
                        style="margin-top:12px"
                    >
                        تلاش دوباره
                    </button>
                </div>`;

            document
                .getElementById("retryStages")
                ?.addEventListener(
                    "click",
                    () => this.renderStages()
                );
        }
    }


    async startStage(stage) {

        const category =
            this.quiz.currentCategory;

        const access =
            this.canAccessStage(
                category,
                stage
            );

        if (!access.allowed) {
            if (access.reason === "subscription") {
                alert(
                    "برای باز شدن این مرحله، اشتراک فعال لازم است."
                );
                this.go("subscription");
            } else if (access.reason === "previous") {
                alert(
                    `ابتدا باید مرحله ${Number(stage) - 1} را با حداقل ۷۵٪ امتیاز رد کنی.`
                );
            }
            return;
        }

        const completed =
            this.getStageBestScore(
                category,
                stage
            ) >= 0.75;

        if (completed) {
            const replay =
                confirm(
                    "این مرحله را قبلاً با حداقل ۷۵٪ رد کرده‌ای. می‌خواهی دوباره بازی کنی؟\n\nبازی دوباره XP جدیدی برای قبولی قبلی اضافه نمی‌کند."
                );

            if (!replay) {
                return;
            }
        }

        try {
            if (
                !this.quiz.questions.length ||
                this.quiz.currentCategory !== category
            ) {
                await this.quiz.loadCategory(category);
            }

            const questions =
                this.quiz.startStage(
                    category,
                    stage,
                    completed
                );

            if (!questions.length) {
                alert(
                    "برای این مرحله سؤال قابل نمایش پیدا نشد. دوباره تلاش کن."
                );
                return;
            }

            this.renderQuestion(
                questions[0]
            );

        } catch (error) {
            console.error(
                "Stage start failed:",
                error
            );

            alert(
                "بارگذاری سؤال‌ها ناموفق بود. لطفاً دوباره تلاش کن."
            );
        }
    }


    stopQuestionTimer() {

        if (this.questionTimer) {
            clearInterval(this.questionTimer);
            this.questionTimer = null;
        }
    }


    startQuestionTimer() {

        this.stopQuestionTimer();

        const limit =
            20;

        this.questionTimeLeft =
            limit;

        const timer =
            document.getElementById("questionTimer");

        const timerFill =
            document.getElementById("questionTimerFill");

        const update = () => {
            const left =
                Math.max(
                    0,
                    this.questionTimeLeft
                );

            if (timer) {
                timer.textContent =
                    `⏱ ${left.toLocaleString("fa-IR")} ثانیه`;
            }

            if (timerFill) {
                timerFill.style.width =
                    `${Math.max(
                        0,
                        Math.min(
                            100,
                            (left / limit) * 100
                        )
                    )}%`;
            }
        };

        update();

        this.questionTimer =
            window.setInterval(() => {
                if (this.answerLocked) {
                    return;
                }

                this.questionTimeLeft -= 1;
                update();

                if (this.questionTimeLeft <= 0) {
                    this.stopQuestionTimer();
                    this.answer(-1, true);
                }
            }, 1000);
    }


    renderQuestion(question) {

        this.stopQuestionTimer();
        this.answerLocked = false;

        const box =
            document.getElementById("quizBox");

        const normalized =
            normalizeQuestionForUI(question);

        if (
            !normalized ||
            !normalized.question.trim()
        ) {
            if (box) {
                box.innerHTML =
                    `<div class="quiz-box empty-question">
                        <p>برای این مرحله سؤال معتبری پیدا نشد.</p>
                        <button id="closeQuizEmpty" class="primary full" type="button">بازگشت به مراحل</button>
                    </div>`;
            }
            this.openQuizModal();
            document
                .getElementById("closeQuizEmpty")
                ?.addEventListener(
                    "click",
                    () => this.closeQuizModal(true)
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

        const current =
            this.quiz.currentQuestion + 1;

        const total =
            this.quiz.getQuestionCount();

        const progress =
            total
                ? Math.round(
                    (current / total) * 100
                )
                : 0;

        this.openQuizModal();

        box.innerHTML = `
            <div class="quiz-box">
                <div class="quiz-modal-head">
                    <div class="quiz-topline">
                        <span>مرحله ${this.quiz.currentStage}</span>
                        <span>سؤال ${current} از ${total}</span>
                    </div>

                    <button
                        id="closeQuizQuestion"
                        class="quiz-close-btn"
                        type="button"
                        aria-label="خروج از مرحله"
                    >×</button>
                </div>

                <div class="progress-track">
                    <div
                        class="progress-fill"
                        style="width:${progress}%"
                    ></div>
                </div>

                <div class="timer-row">
                    <strong id="questionTimer">⏱ ۲۰ ثانیه</strong>
                    <span>زمان پاسخ‌گویی</span>
                </div>

                <div class="timer-track">
                    <div
                        id="questionTimerFill"
                        class="timer-fill"
                        style="width:100%"
                    ></div>
                </div>

                <h2>
                    ${escapeHTML(
                        normalized.question
                    )}
                </h2>

                <div class="answers">
                    ${options.map(
                        (option, index) => `
                            <button
                                class="answer-btn"
                                data-i="${index}"
                                type="button"
                            >
                                ${escapeHTML(String(option))}
                            </button>
                        `
                    ).join("")}
                </div>

                <div
                    id="quizFeedback"
                    class="quiz-feedback"
                    aria-live="polite"
                ></div>
            </div>
        `;

        document
            .getElementById("closeQuizQuestion")
            ?.addEventListener(
                "click",
                () => {
                    if (confirm("از این مرحله خارج می‌شوی و این دور نیمه‌کاره می‌ماند. ادامه می‌دهی؟")) {
                        this.closeQuizModal(true);
                    }
                }
            );

        box
            .querySelectorAll(".answer-btn")
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () =>
                        this.answer(
                            Number(button.dataset.i),
                            false
                        )
                );
            });

        this.startQuestionTimer();
    }


    answer(index, timedOut = false) {

        if (this.answerLocked) {
            return;
        }

        this.answerLocked = true;
        this.stopQuestionTimer();

        const result =
            this.quiz.answer(
                index,
                timedOut
            );

        const box =
            document.getElementById("quizBox");

        if (box) {
            box
                .querySelectorAll(".answer-btn")
                .forEach(
                    button =>
                        button.disabled = true
                );
        }

        const selectedButton =
            box && index >= 0
                ? box.querySelector(
                    `.answer-btn[data-i="${index}"]`
                  )
                : null;

        if (selectedButton) {
            selectedButton.classList.add(
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

        if (result.timedOut) {
            feedback.innerHTML = `
                <div class="error">
                    ⏰ زمان تمام شد؛ این سؤال را از دست دادی.
                </div>
            `;
        } else if (result.correct) {
            feedback.innerHTML = `
                <div class="success">
                    ✓ پاسخ درست بود!
                </div>
            `;
        } else {
            feedback.innerHTML = `
                <div class="error">
                    ✗ پاسخ اشتباه بود.
                </div>
            `;
        }

        if (result.finished) {
            const percent =
                Math.round(
                    Number(result.percentage || 0) * 100
                );

            feedback.innerHTML +=
                result.passed
                    ? `
                        <div class="result-good">
                            🎉 مرحله با موفقیت تمام شد.
                            <br>امتیاز این دور: <b>${percent.toLocaleString("fa-IR")}٪</b>
                            ${
                                result.earnedXP
                                    ? ` · +${result.earnedXP} XP`
                                    : ""
                            }
                        </div>
                      `
                    : `
                        <div class="result-bad">
                            این مرحله را رد نکردی.
                            <br>امتیاز این دور: <b>${percent.toLocaleString("fa-IR")}٪</b> · حداقل لازم: <b>۷۵٪</b>
                            ${
                                result.heartLost
                                    ? "<br>یک قلب کم شد."
                                    : ""
                            }
                        </div>
                      `;

            feedback.innerHTML += `
                <button
                    id="quizNext"
                    class="primary full next-btn"
                    type="button"
                >
                    بازگشت به مراحل
                </button>
            `;

            document
                .getElementById("quizNext")
                .onclick =
                () => this.closeQuizModal(true);

        } else {
            feedback.innerHTML += `
                <button
                    id="quizNext"
                    class="primary full next-btn"
                    type="button"
                >
                    سؤال بعدی
                </button>
            `;

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

        const el =
            document.getElementById(
                "quizStats"
            );


        if (el) {

            el.textContent =
                `XP ${this.state.xp} · ❤️ ${this.state.hearts}`;
        }
    }


    getSubscriptionInfo() {

        return (
            this.state.subscriptionInfo &&
            typeof this.state.subscriptionInfo === "object"
        )
            ? this.state.subscriptionInfo
            : {
                active: false,
                planId: "",
                planName: "",
                start: null,
                expiry: null
            };
    }


    hasActiveSubscription() {

        const info =
            this.getSubscriptionInfo();

        if (info.active !== true) {
            return false;
        }

        const expiry =
            new Date(
                info.expiry || 0
            ).getTime();

        return Number.isFinite(expiry) &&
            expiry > Date.now();
    }


    getRemainingSubscriptionDays() {

        const info =
            this.getSubscriptionInfo();

        const expiry =
            new Date(
                info.expiry || 0
            ).getTime();

        if (
            !Number.isFinite(expiry) ||
            expiry <= Date.now()
        ) {
            return 0;
        }

        return Math.max(
            0,
            Math.ceil(
                (expiry - Date.now()) /
                86400000
            )
        );
    }


    getRemainingSubscriptionText() {

        if (!this.hasActiveSubscription()) {
            return "رایگان — فقط مرحله ۱";
        }

        const days =
            this.getRemainingSubscriptionDays();

        if (days <= 0) {
            return "اشتراک منقضی شده است";
        }

        const info =
            this.getSubscriptionInfo();

        const plan =
            info.planName ||
            this.getPlanDuration(
                info.planId
            );

        return `اشتراک فعال · ${plan} · ${days.toLocaleString("fa-IR")} روز باقی مانده`;
    }


    renderProfile() {

        const s =
            this.state;

        const username =
            s.username ||
            "بازیکن مهمان";

        const active =
            this.hasActiveSubscription();

        const remainingText =
            this.getRemainingSubscriptionText();

        const dashboardName =
            document.getElementById("dashboardName");

        const dashboardXP =
            document.getElementById("dashboardXP");

        const dashboardHearts =
            document.getElementById("dashboardHearts");

        const dashboardStreak =
            document.getElementById("dashboardStreak");

        const dashboardGeneral =
            document.getElementById("dashboardGeneralStage");

        const dashboardFun =
            document.getElementById("dashboardFunStage");

        const dashboardSubscription =
            document.getElementById("dashboardSubscription");

        const dashboardBadge =
            document.getElementById("dashboardAccessBadge");

        const dashboardTitle =
            document.getElementById("dashboardSubscriptionTitle");

        const dashboardText =
            document.getElementById("dashboardSubscriptionText");

        const profileName =
            document.getElementById("profileName");

        const profileScore =
            document.getElementById("profileScore");

        const profileStreak =
            document.getElementById("profileStreak");

        const profileStage =
            document.getElementById("profileStage");

        const subscriptionStatus =
            document.getElementById("subscriptionStatus");

        if (dashboardName) {
            dashboardName.textContent =
                username;
        }

        if (dashboardXP) {
            dashboardXP.textContent =
                Number(s.xp || 0).toLocaleString("fa-IR");
        }

        if (dashboardHearts) {
            dashboardHearts.textContent =
                Number(s.hearts || 0).toLocaleString("fa-IR");
        }

        if (dashboardStreak) {
            dashboardStreak.textContent =
                Number(s.streak || 0).toLocaleString("fa-IR");
        }

        if (dashboardGeneral) {
            dashboardGeneral.textContent =
                this.getHighestPassedStage("general")
                    .toLocaleString("fa-IR");
        }

        if (dashboardFun) {
            dashboardFun.textContent =
                this.getHighestPassedStage("fun")
                    .toLocaleString("fa-IR");
        }

        if (dashboardSubscription) {
            dashboardSubscription.textContent =
                remainingText;
        }

        if (dashboardBadge) {
            dashboardBadge.classList.toggle("free", !active);
            dashboardBadge.classList.toggle("premium", active);
            dashboardBadge.textContent =
                active
                    ? "🔓 اشتراک فعال"
                    : "🔒 فقط ۱ مرحله رایگان";
        }

        if (dashboardTitle) {
            dashboardTitle.textContent =
                active
                    ? "اشتراک شما فعال است"
                    : "حساب رایگان";
        }

        if (dashboardText) {
            dashboardText.textContent =
                active
                    ? remainingText
                    : "حساب رایگان فقط به مرحله ۱ دسترسی دارد.";
        }

        if (profileName) {
            profileName.textContent =
                username;
        }

        if (profileScore) {
            profileScore.textContent =
                Number(s.xp || 0).toLocaleString("fa-IR");
        }

        if (profileStreak) {
            profileStreak.textContent =
                Number(s.streak || 0).toLocaleString("fa-IR");
        }

        if (profileStage) {
            profileStage.textContent =
                Math.max(
                    this.getHighestPassedStage("general"),
                    this.getHighestPassedStage("fun")
                ).toLocaleString("fa-IR");
        }

        if (subscriptionStatus) {
            subscriptionStatus.textContent =
                active
                    ? remainingText
                    : "رایگان";
        }

        const authButton =
            document.getElementById("authButton");

        if (authButton) {
            authButton.textContent =
                username === "بازیکن مهمان"
                    ? "ورود / ثبت‌نام"
                    : username;
        }
    }


    initLeaderboard() {

        document
            .querySelectorAll("[data-leader-period]")
            .forEach(button => {
                button.addEventListener("click", () => {
                    this.leaderboardPeriod =
                        button.dataset.leaderPeriod || "week";

                    document
                        .querySelectorAll("[data-leader-period]")
                        .forEach(item =>
                            item.classList.toggle(
                                "active",
                                item.dataset.leaderPeriod === this.leaderboardPeriod
                            )
                        );

                    this.renderLeaderboard();
                });
            });
    }


    renderLeaderboardBoard(targetId, entries, metric, valueLabel) {

        const target =
            document.getElementById(targetId);

        if (!target) return;

        const rows = Array.isArray(entries)
            ? entries.slice(0, 3)
            : [];

        if (!rows.length) {
            target.innerHTML = `
                <div class="leader-empty">
                    هنوز رکوردی برای این بازه ثبت نشده است.
                </div>
            `;
            return;
        }

        const medals = ["🥇", "🥈", "🥉"];

        target.innerHTML = rows.map((entry, index) => {
            const value =
                metric === "xp"
                    ? Number(entry.xp || 0)
                    : metric === "combo"
                        ? Number(entry.bestCombo || entry.combo || 0)
                        : Number(entry.bestStage || entry.stage || 0);

            return `
                <div class="leader-entry rank-${index + 1}">
                    <div class="leader-rank-medal">${medals[index]}</div>
                    <div class="leader-entry-main">
                        <strong>${escapeHTML(entry.username || "بازیکن")}</strong>
                        <small>${escapeHTML(valueLabel)}</small>
                    </div>
                    <div class="leader-entry-value">
                        ${Number(value).toLocaleString("fa-IR")}
                    </div>
                </div>
            `;
        }).join("");
    }


    async renderLeaderboard() {

        const period =
            this.leaderboardPeriod || "week";

        document
            .querySelectorAll("[data-leader-period]")
            .forEach(button =>
                button.classList.toggle(
                    "active",
                    button.dataset.leaderPeriod === period
                )
            );

        const title =
            document.getElementById("leaderboardPeriodTitle");

        const subtitle =
            document.getElementById("leaderboardPeriodSubtitle");

        const periodNames = {
            week: "هفته جاری",
            month: "ماه جاری",
            year: "سال جاری"
        };

        if (title) {
            title.textContent =
                periodNames[period] || periodNames.week;
        }

        if (subtitle) {
            subtitle.textContent =
                "سه بازیکن برتر هر معیار در این بازه زمانی";
        }

        const targets = [
            "leaderXpBody",
            "leaderComboBody",
            "leaderStageBody"
        ];

        targets.forEach(id => {
            const target = document.getElementById(id);
            if (target) {
                target.innerHTML = `
                    <div class="leader-loading">
                        در حال بارگذاری...
                    </div>
                `;
            }
        });

        try {
            const data =
                await serverJsonp(
                    "leaderboard",
                    { period }
                );

            const boards =
                data && data.success && data.boards
                    ? data.boards
                    : {};

            this.renderLeaderboardBoard(
                "leaderXpBody",
                boards.xp || [],
                "xp",
                "XP"
            );

            this.renderLeaderboardBoard(
                "leaderComboBody",
                boards.combo || [],
                "combo",
                "بهترین کمبو"
            );

            this.renderLeaderboardBoard(
                "leaderStageBody",
                boards.stage || [],
                "stage",
                "بالاترین مرحله"
            );

            const updated =
                document.getElementById("leaderboardUpdatedAt");

            if (updated && data.updatedAt) {
                updated.textContent =
                    `آخرین بروزرسانی: ${new Date(data.updatedAt).toLocaleString("fa-IR")}`;
            }

        } catch (error) {
            console.warn("Advanced leaderboard failed:", error);

            const localRows =
                this.state.username === "بازیکن مهمان"
                    ? []
                    : [{
                        username: this.state.username,
                        xp: Number(this.state.xp || 0),
                        bestCombo: Number(this.state.bestCombo || 0),
                        bestStage: Math.max(
                            this.getHighestPassedStage("general"),
                            this.getHighestPassedStage("fun")
                        )
                    }];

            this.renderLeaderboardBoard(
                "leaderXpBody",
                localRows,
                "xp",
                "XP"
            );

            this.renderLeaderboardBoard(
                "leaderComboBody",
                localRows,
                "combo",
                "بهترین کمبو"
            );

            this.renderLeaderboardBoard(
                "leaderStageBody",
                localRows,
                "stage",
                "بالاترین مرحله"
            );
        }
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
            this.renderProfile();
            return;
        }

        try {

            const data =
                await this.serverRequest({
                    action: "userUpdates",
                    username: this.state.username
                });

            if (!data.success) {
                throw new Error(
                    data.message ||
                    "دریافت وضعیت ناموفق بود."
                );
            }

            this.lastServerUpdates = {
                payments:
                    Array.isArray(data.payments)
                        ? data.payments
                        : [],
                support:
                    Array.isArray(data.support)
                        ? data.support
                        : []
            };

            const serverSubscription =
                data.subscription &&
                typeof data.subscription === "object"
                    ? data.subscription
                    : {
                        active: false,
                        planId: "",
                        planName: "",
                        start: null,
                        expiry: null
                    };

            const before =
                JSON.stringify(
                    this.getSubscriptionInfo()
                );

            const wasActiveBeforeSync =
                this.hasActiveSubscription();

            this.state.subscriptionInfo =
                serverSubscription;

            if (serverSubscription.active === true) {

                this.state.subscriptionStatus =
                    "active";

                this.state.subscriptionPlan =
                    serverSubscription.planId || "";

                this.state.subscriptionName =
                    serverSubscription.planName || "";

                this.state.subscriptionExpiry =
                    serverSubscription.expiry || null;

                this.state.subscriptionStart =
                    serverSubscription.start || null;

                this.state.subscription =
                    "paid";

            } else {

                this.state.subscriptionStatus =
                    "inactive";

                this.state.subscriptionPlan =
                    "";

                this.state.subscriptionName =
                    "";

                this.state.subscriptionExpiry =
                    null;

                this.state.subscriptionStart =
                    null;

                this.state.subscription =
                    "free";
            }

            const after =
                JSON.stringify(
                    this.getSubscriptionInfo()
                );

            if (before !== after) {
                this.persist();
            }

            this.renderUserPanels();
            this.renderProfile();

            const becameActiveForFirstTime =
                !wasActiveBeforeSync &&
                serverSubscription.active === true &&
                this.state.subscriptionCelebrationSeen !== true;

            if (becameActiveForFirstTime) {
                window.setTimeout(
                    () => this.showCelebration("subscription"),
                    250
                );
            }

            if (
                serverSubscription.active === true &&
                document
                    .getElementById("quiz")
                    ?.classList.contains("active") &&
                !this.quizModalOpen
            ) {
                this.renderStages();
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
