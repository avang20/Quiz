const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbwQNOpTNYI6jD2obOFKk02eEjSZd2OzkPiwvBgN_xnDgsZ90B3a_FCmXIvzVyuxzJiZQ/exec";

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
    Number(value || 0)
        .toLocaleString("fa-IR") + " تومان";
