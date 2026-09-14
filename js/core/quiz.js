import { shuffle } from "./utils.js";
import { addXP, markStageCompleted, isStageCompleted } from "./state.js";

export const QUIZ_CONFIG = {
    questionsPerStage: 2,
    passingPercentage: 0.5,
    questionTime: 20,
    stageXP: 10,
    failedStageHeartPenalty: 1
};


/* =========================================================
   QUESTION NORMALIZATION
   هدف:
   پشتیبانی از ساختارهای مختلف JSON بدون نمایش undefined
========================================================= */

function normalizeQuestion(raw, fallbackStage = 1) {

    if (!raw || typeof raw !== "object") {
        return null;
    }

    /* ---------- متن سوال ---------- */

    const questionText =
        raw.question ??
        raw.q ??
        raw.text ??
        raw.title ??
        raw.prompt ??
        raw.questionText ??
        raw.description ??
        "";

    /* ---------- گزینه‌ها ---------- */

    let options =
        raw.options ??
        raw.choices ??
        raw.answers ??
        raw.o ??
        raw.variants ??
        [];

    /*
        اگر options به شکل object باشد:
        {
            a: "...",
            b: "...",
            c: "...",
            d: "..."
        }
    */

    if (!Array.isArray(options)) {

        if (
            options &&
            typeof options === "object"
        ) {
            options = Object.values(options);
        } else {
            options = [];
        }
    }

    /*
        گزینه‌هایی که خودشان object هستند:

        { text: "..." }
        { label: "..." }
        { value: "..." }
    */

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
                option.title ??
                ""
            );
        }

        return option;
    });

    /*
        همه گزینه‌ها را به String تبدیل می‌کنیم
        تا هیچ‌وقت undefined در HTML چاپ نشود.
    */

    options = options.map(option => {

        if (
            option === null ||
            option === undefined
        ) {
            return "";
        }

        return String(option);
    });


    /* ---------- پاسخ صحیح ---------- */

    let rawAnswer =
        raw.answer ??
        raw.correctAnswer ??
        raw.correct ??
        raw.answerIndex ??
        raw.correctIndex ??
        raw.correctOption ??
        raw.correctChoice;

    let answer = -1;


    /*
        حالت 1:
        answer = 0
        answer = 1
        ...
    */

    if (
        typeof rawAnswer === "number" &&
        Number.isInteger(rawAnswer)
    ) {

        if (
            rawAnswer >= 0 &&
            rawAnswer < options.length
        ) {
            answer = rawAnswer;
        }

        /*
            پشتیبانی از answer = 1 برای گزینه اول
        */

        else if (
            rawAnswer > 0 &&
            rawAnswer <= options.length
        ) {
            answer = rawAnswer - 1;
        }
    }


    /*
        حالت 2:
        answer = "2"
        answer = "1"
    */

    else if (typeof rawAnswer === "string") {

        const trimmed = rawAnswer.trim();

        if (trimmed !== "") {

            const numeric = Number(trimmed);

            if (Number.isInteger(numeric)) {

                if (
                    numeric >= 0 &&
                    numeric < options.length
                ) {
                    answer = numeric;
                }

                else if (
                    numeric > 0 &&
                    numeric <= options.length
                ) {
                    answer = numeric - 1;
                }
            }


            /*
                اگر answer متن خود گزینه باشد:

                answer: "توکیو"
            */

            if (answer < 0) {

                const normalizedAnswer =
                    trimmed.toLocaleLowerCase();

                answer = options.findIndex(option =>
                    String(option)
                        .trim()
                        .toLocaleLowerCase() ===
                    normalizedAnswer
                );
            }
        }
    }


    /*
        حالت 3:
        correctOptions: ["توکیو"]
    */

    if (
        answer < 0 &&
        Array.isArray(raw.correctOptions) &&
        raw.correctOptions.length > 0
    ) {

        const candidate =
            raw.correctOptions[0];

        answer = options.findIndex(option =>
            String(option).trim() ===
            String(candidate).trim()
        );
    }


    /*
        حالت 4:
        correct: {
            index: 2
        }
    */

    if (
        answer < 0 &&
        raw.correct &&
        typeof raw.correct === "object"
    ) {

        const correctObject = raw.correct;

        if (
            Number.isInteger(correctObject.index)
        ) {

            const index = correctObject.index;

            if (
                index >= 0 &&
                index < options.length
            ) {
                answer = index;
            }
        }

        else if (correctObject.text) {

            answer = options.findIndex(option =>
                String(option).trim() ===
                String(correctObject.text).trim()
            );
        }
    }


    /* ---------- مرحله ---------- */

    const stageValue =
        raw.stage ??
        raw.stageNumber ??
        raw.level ??
        raw.stageId ??
        fallbackStage;

    const stage =
        Number(stageValue) || fallbackStage;


    /* ---------- توضیح ---------- */

    const explanation =
        raw.explanation ??
        raw.explain ??
        raw.descriptionAnswer ??
        "";


    return {

        ...raw,

        stage,

        question:
            String(questionText || "").trim(),

        q:
            String(questionText || "").trim(),

        options,

        answer,

        explanation:
            String(explanation || "")
    };
}


/* =========================================================
   QUIZ ENGINE
========================================================= */

export class QuizEngine {

    constructor(state, saveState) {

        this.state = state;

        this.saveState = saveState;

        this.questions = [];

        this.selectedQuestions = [];

        this.currentQuestion = 0;

        this.currentCategory = "general";

        this.currentStage = 1;

        this.correctAnswers = 0;

        this.wrongAnswers = 0;

        this.combo = 0;

        this.finished = false;

        this.isReplay = false;

        this.stageRewardGiven = false;
    }


    /* =====================================================
       LOAD CATEGORY
    ===================================================== */

    async loadCategory(category) {

        const response =
            await fetch(
                `data/${category}.json`,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                `Could not load data/${category}.json`
            );
        }


        const data =
            await response.json();

        let rawQuestions = [];


        /* -------------------------------------------------
           حالت 1:

           [
               {...},
               {...}
           ]
        ------------------------------------------------- */

        if (Array.isArray(data)) {

            rawQuestions = data;
        }


        /* -------------------------------------------------
           حالت 2:

           {
               questions: [...]
           }
        ------------------------------------------------- */

        else if (
            Array.isArray(data.questions)
        ) {

            rawQuestions =
                data.questions;
        }


        /* -------------------------------------------------
           حالت 3:

           {
               stages: [
                   {
                       stage: 1,
                       questions: [...]
                   }
               ]
           }
        ------------------------------------------------- */

        else if (
            Array.isArray(data.stages)
        ) {

            data.stages.forEach(
                stageBlock => {

                    if (
                        !stageBlock ||
                        typeof stageBlock !== "object"
                    ) {
                        return;
                    }

                    const stageNumber =
                        Number(
                            stageBlock.stage ??
                            stageBlock.id ??
                            stageBlock.level ??
                            1
                        ) || 1;


                    const list =
                        Array.isArray(
                            stageBlock.questions
                        )
                            ? stageBlock.questions
                            : [];


                    list.forEach(question => {

                        if (
                            question &&
                            typeof question === "object"
                        ) {

                            rawQuestions.push({

                                ...question,

                                stage:
                                    question.stage ??
                                    question.stageNumber ??
                                    stageNumber
                            });
                        }
                    });
                }
            );
        }


        /* -------------------------------------------------
           حالت 4:

           {
               "1": [...],
               "2": [...]
           }

           برای ساختارهای stage-based ساده
        ------------------------------------------------- */

        else if (
            data &&
            typeof data === "object"
        ) {

            Object.entries(data)
                .forEach(([key, value]) => {

                    if (!Array.isArray(value)) {
                        return;
                    }

                    const stageNumber =
                        Number(key);

                    if (
                        !Number.isInteger(
                            stageNumber
                        )
                    ) {
                        return;
                    }

                    value.forEach(question => {

                        if (
                            question &&
                            typeof question === "object"
                        ) {

                            rawQuestions.push({

                                ...question,

                                stage:
                                    question.stage ??
                                    stageNumber
                            });
                        }
                    });
                });
        }


        /* -------------------------------------------------
           نرمال‌سازی همه سوال‌ها
        ------------------------------------------------- */

        this.questions =
            rawQuestions

                .map(question =>
                    normalizeQuestion(
                        question,
                        1
                    )
                )

                .filter(question => {

                    if (!question) {
                        return false;
                    }

                    if (
                        !question.question ||
                        !question.question.trim()
                    ) {
                        return false;
                    }

                    if (
                        !Array.isArray(
                            question.options
                        )
                    ) {
                        return false;
                    }

                    /*
                        حداقل یک گزینه غیرخالی
                    */

                    const hasOption =
                        question.options.some(
                            option =>
                                String(option)
                                    .trim()
                                    .length > 0
                        );

                    return hasOption;
                });


        this.currentCategory =
            category;
    }


    /* =====================================================
       GET STAGE QUESTIONS
    ===================================================== */

    getStageQuestions(stage) {

        return this.questions.filter(
            question =>
                Number(question.stage) ===
                Number(stage)
        );
    }


    /* =====================================================
       START STAGE
    ===================================================== */

    startStage(
        category,
        stage,
        replay = false
    ) {

        this.currentCategory =
            category;

        this.currentStage =
            stage;

        this.isReplay =
            replay;

        this.currentQuestion = 0;

        this.correctAnswers = 0;

        this.wrongAnswers = 0;

        this.combo = 0;

        this.finished = false;

        this.stageRewardGiven = false;


        const stageQuestions =
            this.getStageQuestions(stage);


        /*
            سوال‌هایی که پاسخ صحیح معتبر دارند
        */

        const validQuestions =
            stageQuestions.filter(
                question =>
                    Number.isInteger(
                        question.answer
                    ) &&
                    question.answer >= 0 &&
                    question.answer <
                        question.options.length
            );


        this.selectedQuestions =
            shuffle(validQuestions)
                .slice(
                    0,
                    Math.min(
                        QUIZ_CONFIG.questionsPerStage,
                        validQuestions.length
                    )
                );


        return this.selectedQuestions;
    }


    /* =====================================================
       CURRENT QUESTION
    ===================================================== */

    getCurrentQuestion() {

        return this.selectedQuestions[
            this.currentQuestion
        ];
    }


    /* =====================================================
       QUESTION COUNT
    ===================================================== */

    getQuestionCount() {

        return this.selectedQuestions.length;
    }


    /* =====================================================
       ANSWER
    ===================================================== */

    answer(answerIndex) {

        const question =
            this.getCurrentQuestion();


        if (!question) {

            return {

                finished: true,

                correct: false,

                passed: false,

                earnedXP: 0,

                heartLost: false,

                newlyCompleted: false,

                replay: this.isReplay,

                combo: this.combo,

                correctAnswers:
                    this.correctAnswers,

                wrongAnswers:
                    this.wrongAnswers,

                total:
                    this.selectedQuestions.length,

                percentage: 0,

                explanation: ""
            };
        }


        const correct =
            Number(answerIndex) ===
            Number(question.answer);


        if (correct) {

            this.correctAnswers++;

            this.combo++;
        }

        else {

            this.wrongAnswers++;

            this.combo = 0;
        }


        this.currentQuestion++;


        const finished =
            this.currentQuestion >=
            this.selectedQuestions.length;


        let passed = false;

        let earnedXP = 0;

        let heartLost = false;

        let newlyCompleted = false;


        /* =================================================
           پایان مرحله
        ================================================= */

        if (finished) {

            const percentage =
                this.selectedQuestions.length
                    ? this.correctAnswers /
                      this.selectedQuestions.length
                    : 0;


            passed =
                percentage >=
                QUIZ_CONFIG.passingPercentage;


            /* ---------------------------------------------
               مرحله قبول شده
            --------------------------------------------- */

            if (passed) {

                const alreadyCompleted =
                    isStageCompleted(
                        this.state,
                        this.currentCategory,
                        this.currentStage
                    );


                /*
                    فقط بار اول XP و مرحله بعدی
                */

                if (
                    !this.isReplay &&
                    !alreadyCompleted
                ) {

                    addXP(
                        this.state,
                        QUIZ_CONFIG.stageXP
                    );


                    earnedXP =
                        QUIZ_CONFIG.stageXP;


                    markStageCompleted(
                        this.state,
                        this.currentCategory,
                        this.currentStage
                    );


                    newlyCompleted = true;

                    this.stageRewardGiven =
                        true;
                }
            }


            /* ---------------------------------------------
               مرحله رد شده

               فقط یک قلب برای کل مرحله
            --------------------------------------------- */

            else if (!this.isReplay) {

                if (
                    this.state.hearts > 0
                ) {

                    this.state.hearts =
                        Math.max(
                            0,
                            this.state.hearts -
                            QUIZ_CONFIG.failedStageHeartPenalty
                        );

                    heartLost = true;
                }
            }
        }


        this.finished =
            finished;


        this.saveState();


        return {

            correct,

            finished,

            passed,

            earnedXP,

            heartLost,

            newlyCompleted,

            replay:
                this.isReplay,

            combo:
                this.combo,

            correctAnswers:
                this.correctAnswers,

            wrongAnswers:
                this.wrongAnswers,

            total:
                this.selectedQuestions.length,

            percentage:
                this.selectedQuestions.length
                    ? this.correctAnswers /
                      this.selectedQuestions.length
                    : 0,

            explanation:
                question.explanation || ""
        };
    }
}
