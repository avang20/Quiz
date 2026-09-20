import { shuffle } from "./utils.js";

import {
    addXP,
    markStageCompleted,
    isStageCompleted
} from "./state.js";


export const QUIZ_CONFIG = {
    questionsPerStage: 15,
    passingPercentage: 0.5,
    questionTime: 20,
    stageXP: 10,
    failedStageHeartPenalty: 1
};


function normalizeQuestion(
    raw,
    fallbackStage = 1
) {

    if (
        !raw ||
        typeof raw !== "object"
    ) {
        return null;
    }


    let questionText =
        raw.question ??
        raw.questionText ??
        raw.q ??
        raw.text ??
        raw.title ??
        raw.prompt ??
        raw.content ??
        "";


    if (
        questionText &&
        typeof questionText === "object"
    ) {

        questionText =
            questionText.text ??
            questionText.value ??
            questionText.title ??
            questionText.content ??
            "";
    }


    let options =
        raw.options ??
        raw.choices ??
        raw.answers ??
        raw.variants ??
        raw.o ??
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

                return String(
                    option.text ??
                    option.label ??
                    option.value ??
                    option.answer ??
                    option.content ??
                    ""
                );
            }

            return String(
                option ?? ""
            );
        });


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

        if (
            rawAnswer >= 0 &&
            rawAnswer < options.length
        ) {

            answer =
                rawAnswer;

        } else if (
            rawAnswer > 0 &&
            rawAnswer <= options.length
        ) {

            answer =
                rawAnswer - 1;
        }
    }


    else if (
        typeof rawAnswer === "string"
    ) {

        const trimmed =
            rawAnswer.trim();


        const numeric =
            Number(trimmed);


        if (Number.isInteger(numeric)) {

            if (
                numeric >= 0 &&
                numeric < options.length
            ) {

                answer =
                    numeric;

            } else if (
                numeric > 0 &&
                numeric <= options.length
            ) {

                answer =
                    numeric - 1;
            }
        }


        if (
            answer < 0 &&
            /^[A-Za-z]$/.test(trimmed)
        ) {

            const letterIndex =
                trimmed
                    .toUpperCase()
                    .charCodeAt(0) - 65;


            if (
                letterIndex >= 0 &&
                letterIndex < options.length
            ) {

                answer =
                    letterIndex;
            }
        }


        if (answer < 0) {

            const normalized =
                trimmed.toLocaleLowerCase();


            answer =
                options.findIndex(
                    option =>
                        String(option)
                            .trim()
                            .toLocaleLowerCase() ===
                        normalized
                );
        }
    }


    else if (
        rawAnswer &&
        typeof rawAnswer === "object"
    ) {

        const candidate =
            rawAnswer.text ??
            rawAnswer.label ??
            rawAnswer.value ??
            rawAnswer.answer;


        if (
            candidate !== undefined
        ) {

            answer =
                options.findIndex(
                    option =>
                        String(option)
                            .trim() ===
                        String(candidate)
                            .trim()
                );
        }
    }


    if (answer < 0) {

        const correctOptions =
            raw.correctOptions ??
            raw.correct_options;


        if (
            Array.isArray(correctOptions) &&
            correctOptions.length
        ) {

            const candidate =
                correctOptions[0];


            answer =
                options.findIndex(
                    option =>
                        String(option)
                            .trim() ===
                        String(candidate)
                            .trim()
                );
        }
    }


    const stage =
        Number(
            raw.stage ??
            raw.stageNumber ??
            raw.stage_number ??
            raw.level ??
            raw.levelNumber ??
            fallbackStage
        ) || fallbackStage;


    return {

        ...raw,

        stage,

        question:
            String(
                questionText ?? ""
            ),

        q:
            String(
                questionText ?? ""
            ),

        options,

        answer,

        explanation:
            String(
                raw.explanation ??
                raw.explain ??
                raw.description ??
                ""
            )
    };
}


export class QuizEngine {

    constructor(
        state,
        saveState
    ) {

        this.state =
            state;

        this.saveState =
            saveState;

        this.questions =
            [];

        this.selectedQuestions =
            [];

        this.currentQuestion =
            0;

        this.currentCategory =
            "general";

        this.currentStage =
            1;

        this.correctAnswers =
            0;

        this.wrongAnswers =
            0;

        this.combo =
            0;

        this.finished =
            false;

        this.isReplay =
            false;

        this.stageRewardGiven =
            false;
    }


    async loadCategory(category) {

        const response =
            await fetch(
                `../../data/${category}.json`,
                {
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `Could not load ../../data/${category}.json`
            );
        }


        const data =
            await response.json();


        let rawQuestions = [];


        if (Array.isArray(data)) {

            rawQuestions =
                data;

        } else if (
            Array.isArray(
                data.questions
            )
        ) {

            rawQuestions =
                data.questions;

        } else if (
            Array.isArray(
                data.items
            )
        ) {

            rawQuestions =
                data.items;

        } else if (
            Array.isArray(
                data.stages
            )
        ) {

            data.stages.forEach(
                stageBlock => {

                    const stageNumber =
                        Number(
                            stageBlock.stage ??
                            stageBlock.id ??
                            1
                        ) || 1;


                    const list =
                        Array.isArray(
                            stageBlock.questions
                        )
                            ? stageBlock.questions
                            : [];


                    list.forEach(
                        question => {

                            rawQuestions.push({
                                ...question,

                                stage:
                                    question.stage ??
                                    stageNumber
                            });
                        }
                    );
                }
            );
        }


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
                        question.question
                            .trim() &&
                        question.options
                            .length > 0
                );


        this.currentCategory =
            category;
    }


    getStageQuestions(stage) {

        return this.questions.filter(
            question =>
                Number(question.stage) ===
                Number(stage)
        );
    }


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

        this.currentQuestion =
            0;

        this.correctAnswers =
            0;

        this.wrongAnswers =
            0;

        this.combo =
            0;

        this.finished =
            false;

        this.stageRewardGiven =
            false;


        const stageQuestions =
            this.getStageQuestions(
                stage
            )
            .filter(
                question =>
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


        if (!this.selectedQuestions.length) {

            throw new Error(
                "No valid questions available for this stage."
            );
        }
    }


    answer(index) {

        if (this.finished) {
            return null;
        }


        const question =
            this.selectedQuestions[
                this.currentQuestion
            ];


        if (!question) {
            return null;
        }


        const selectedIndex =
            Number(index);


        const correctIndex =
            Number(
                question.answer
            );


        const correct =
            selectedIndex ===
            correctIndex;


        if (correct) {

            this.correctAnswers++;

            this.combo++;

        } else {

            this.wrongAnswers++;

            this.combo = 0;
        }


        const result = {

            correct,

            selectedIndex,

            correctIndex,

            question,

            correctAnswers:
                this.correctAnswers,

            wrongAnswers:
                this.wrongAnswers
        };


        this.currentQuestion++;


        if (
            this.currentQuestion >=
            this.selectedQuestions.length
        ) {

            this.finished =
                true;
        }


        return result;
    }


    finish() {

        const total =
            this.selectedQuestions.length;


        if (!total) {
            return null;
        }


        const percentage =
            this.correctAnswers /
            total;


        const passed =
            percentage >=
            QUIZ_CONFIG.passingPercentage;


        let xpGained = 0;


        if (
            passed &&
            !this.isReplay &&
            !this.stageRewardGiven
        ) {

            xpGained =
                QUIZ_CONFIG.stageXP;

            addXP(
                this.state,
                xpGained
            );


            markStageCompleted(
                this.state,
                this.currentCategory,
                this.currentStage
            );


            this.stageRewardGiven =
                true;


            this.saveState(
                this.state
            );
        }


        return {

            passed,

            percentage,

            correct:
                this.correctAnswers,

            wrong:
                this.wrongAnswers,

            total,

            xpGained,

            stage:
                this.currentStage,

            category:
                this.currentCategory
        };
    }
}


export default {
    QuizEngine,
    QUIZ_CONFIG
};
