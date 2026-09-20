export function todayKey() {
    const date = new Date();
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

export function updateStreak(state) {
    const today = todayKey();

    if (state.lastActiveDate === today) {
        return;
    }

    if (!state.lastActiveDate) {
        state.streak = 1;
    } else {
        const previous = new Date(state.lastActiveDate);
        const current = new Date(today);
        const days = Math.round(
            (current - previous) / 86400000
        );

        state.streak =
            days === 1
                ? Number(state.streak || 0) + 1
                : 1;
    }

    state.lastActiveDate = today;
}

export function shuffle(array) {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}

export function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
