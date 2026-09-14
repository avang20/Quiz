import { shuffle } from "./utils.js";
import {
    addXP,
    markStageCompleted,
    isStageCompleted
} from "./state.js";


export const QUIZ_CONFIG = {

    questionsPerStage: 2,

    passingPercentage: 0.5,

    questionTime: 20,

    stageXP: 10,

    failedStageHeartPenalty: 1

};


/* =========================================================
   QUESTION NORMALIZER
========================================================= */

function normalizeQuestion(raw, fallbackStage = 1) {

    if (!raw || typeof raw !== "object") {
        return null;
    }


    /* -------------------------
       QUESTION TEXT
    ------------------------- */

    const questionText =
        raw.question ??
        raw.questionText ??
        raw.question_text ??
        raw.q ??
        raw.text ??
        raw.title ??
        raw.prompt ??
        raw.description ??
        "";


    /* -------------------------
       OPTIONS
    ------------------------- */

    let options =
        raw.options ??
        raw.choices ??
        raw.answers ??
        raw.answerOptions ??
        raw.answer_options ??
        raw.o ??
        [];


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


    options = options.map(option =>
        String(option ?? "").trim()
    );


    /* -------------------------
       CORRECT ANSWER
    ------------------------- */

    const rawAnswer =
        raw.answer ??
        raw.correctAnswer ??
        raw.correct_answer ??
        raw.correct ??
        raw.answerIndex ??
        raw.answer_index ??
        raw.correctIndex ??
        raw.correct_index ??
        raw.correctOption ??
        raw.correct_option;


    let answer = -1;


    if (
        typeof rawAnswer === "number" &&
        Number.isInteger(rawAnswer)
    ) {

        /* 0-based */

        if (
            rawAnswer >= 0 &&
            rawAnswer < options.length
        ) {

            answer = rawAnswer;

        }

        /* 1-based */

        else if (
            rawAnswer > 0 &&
            rawAnswer <= options.length
        ) {

            answer = rawAnswer - 1;

        }

    }


    else if (
        typeof rawAnswer === "string"
    ) {

        const trimmed = rawAnswer.trim();

        const numeric = Number(trimmed);


        if (
            Number.isInteger(numeric)
        ) {

            /* 0-based */

            if (
                numeric >= 0 &&
                numeric < options.length
            ) {

                answer = numeric;

            }

            /* 1-based */

            else if (
                numeric > 0 &&
                numeric <= options.length
            ) {

                answer = numeric - 1;

            }

        }


        /* Answer text */

        if (answer < 0) {

            const normalizedAnswer =
                trimmed.toLocaleLowerCase();

            answer = options.findIndex(
                option =>
                    String(option)
                        .trim()
                        .toLocaleLowerCase() ===
                    normalizedAnswer
            );

        }

    }


    /* -------------------------
       CORRECT OPTIONS
    ------------------------- */

    if (
        answer < 0 &&
        Array.isArray(raw.correctOptions)
    ) {

        const candidate =
            raw.correctOptions[0];

        answer = options.findIndex(
            option =>
                String(option).trim() ===
                String(candidate).trim()
        );

    }


    /* -------------------------
       STAGE
    ------------------------- */

    const stageValue =
        raw.stage ??
        raw.stageNumber ??
        raw.stage_number ??
        raw.stageId ??
        raw.stage_id ??
        raw.level ??
        fallbackStage;


    const stage =
        Number(stageValue) || fallbackStage;


    return {

        ...raw,

        stage,

        question:
            String(questionText).trim(),

        q:
            String(questionText).trim(),

        options,

        answer,

        explanation:
            raw.explanation ??
            raw.explain ??
            raw.description_explanation ??
            ""

    };

}


/* =========================================================
   EXTRACT QUESTIONS
========================================================= */

function extractQuestions(data) {

    let rawQuestions = [];


    /* -------------------------
       JSON ARRAY
    ------------------------- */

    if (Array.isArray(data)) {

        rawQuestions = data;

    }


    /* -------------------------
       { questions: [...] }
    ------------------------- */

    else if (
        data &&
        Array.isArray(data.questions)
    ) {

        rawQuestions = data.questions;

    }


    /* -------------------------
       { stages: [...] }
    ------------------------- */

    else if (
        data &&
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
                        stageBlock.stageNumber ??
                        stageBlock.stage_number ??
                        1
                    ) || 1;


                let list =
                    stageBlock.questions ??
                    stageBlock.items ??
                    stageBlock.data ??
                    [];


                if (!Array.isArray(list)) {
                    list = [];
                }


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


    /* -------------------------
       OBJECT OF STAGES
       {
         "1": [...],
         "2": [...]
       }
    ------------------------- */

    else if (
        data &&
        typeof data === "object"
    ) {

        Object.entries(data).forEach(
            ([key, value]) => {

                if (!Array.isArray(value)) {
                    return;
                }


                const stageNumber =
                    Number(key) || 1;


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

            }
        );

    }


    return rawQuestions;

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


        const rawQuestions =
            extractQuestions(data);


        this.questions =
            rawQuestions
                .map(
                    question =>
                        normalizeQuestion(
                            question,
                            1
                        )
                )
                .filter(
                    question =>
                        question &&
                        question.question &&
                        question.question.trim() &&
                        Array.isArray(question.options) &&
                        question.options.length > 0
                );


        this.currentCategory =
            category;


        return this.questions;

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
            this.getStageQuestions(stage)
                .filter(
                    question =>
                        Number.isInteger(
                            question.answer
                        ) &&
                        question.answer >= 0
                );


        this.selectedQuestions =
            shuffle(stageQuestions)
                .slice(
                    0,
                    Math.min(
                        QUIZ_CONFIG.questionsPerStage,
                        stageQuestions.length
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

                passed: false

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
           STAGE FINISHED
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


            /* -------------------------
               PASSED
            ------------------------- */

            if (passed) {

                const alreadyCompleted =
                    isStageCompleted(
                        this.state,
                        this.currentCategory,
                        this.currentStage
                    );


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


                    newlyCompleted =
                        true;


                    this.stageRewardGiven =
                        true;

                }

            }


            /* -------------------------
               FAILED
            ------------------------- */

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


                    heartLost =
                        true;

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

            replay: this.isReplay,

            combo: this.combo,

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
