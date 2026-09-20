 const CONFIG = {   SHEET_NAME: 'Payments',   SUPPORT_SHEET_NAME: 'Support',   USERS_SHEET_NAME: 'Users',   DRIVE_FOLDER_NAME: 'QuizDuo Receipts',   PRIVATE_TEST_CODE: 'QDZ-100K-HASTI',   TEST_AMOUNT: 100000,   MAX_RECEIPT_BYTES: 5 * 1024 * 1024,   ADMIN_PASSWORD: 'CHANGE_THIS_ADMIN_PASSWORD' };  const PAYMENT_HEADERS = [   'Timestamp', 'Username', 'Phone', 'Plan ID', 'Plan Name',   'Original Amount', 'Final Amount', 'Discount %', 'Discount Code',   'File Name', 'Receipt URL', 'Status', 'User Message', 'Status Timestamp' ];

const USER_HEADERS = [
  'Timestamp', 'Username', 'Phone', 'XP', 'Level', 'Streak', 'General Stage', 'Fun Stage', 'Best Combo'
];

const LEADERBOARD_HISTORY_HEADERS = [
  'Timestamp', 'Date Key', 'Username', 'XP', 'Level', 'Best Combo', 'Streak', 'Best Stage', 'General Stage', 'Fun Stage'
];  const SUPPORT_HEADERS = [   'Timestamp', 'Username', 'Phone', 'Subject', 'Message', 'Status',   'Admin Reply', 'Reply Timestamp', 'Conversation ID' ];  function doGet(e) {
  const params = (e && e.parameter) || {};
  const page = params.page;

  if (page === 'admin') {
    return HtmlService.createTemplateFromFile('Admin')
      .evaluate()
      .setTitle('QuizDuo Admin')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const action = String(params.action || '');
  const callback = String(params.callback || '').trim();

  if (action === 'leaderboard') {
    const data = getLeaderboardObject(params.period || 'week');
    return callback
      ? jsonpResponse(callback, data)
      : jsonResponse(data);
  }

  if (action === 'userUpdates') {
    const data = getUserUpdates(params);
    return callback
      ? jsonpResponse(callback, JSON.parse(data.getContent()))
      : data;
  }

  return jsonResponse({
    success: true,
    service: 'QuizDuo',
    time: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    let data = null;

    if (e && e.parameter && e.parameter.payload) {
      data = JSON.parse(String(e.parameter.payload));
    } else {
      const body = e && e.postData && e.postData.contents;
      if (body) {
        data = JSON.parse(body);
      } else {
        data = {
          ...(e && e.parameter ? e.parameter : {})
        };
      }
    }

    if (!data || !data.action) {
      return jsonResponse({
        success: false,
        message: 'درخواست خالی یا نامعتبر است.'
      });
    }

    if (data.action === 'payment') {
      return handlePayment(data);
    }

    if (data.action === 'validateDiscount') {
      return validateDiscount(data);
    }

    if (data.action === 'support') {
      return handleSupport(data);
    }

    if (data.action === 'supportUserReply') {
      return handleSupportUserReply(data);
    }

    if (data.action === 'closeSupport') {
      return closeSupportConversation(data);
    }

    if (data.action === 'userUpdates') {
      return getUserUpdates(data);
    }

    if (data.action === 'userState') {
      return handleUserState(data);
    }

    return jsonResponse({
      success: false,
      message: 'عملیات ناشناخته است.'
    });

  } catch (error) {
    console.error(error);

    return jsonResponse({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
}

/* =========================================================    DISCOUNT ========================================================= */  function validateDiscount(data) {   const code = String(data.code || '').trim().toUpperCase();   const plan = String(data.plan || '');    const valid =     code === CONFIG.PRIVATE_TEST_CODE &&     plan === 'nineMonth';    return jsonResponse({     success: true,     testCodeApplied: valid,     amount: valid ? CONFIG.TEST_AMOUNT : null   }); }   /* =========================================================    PAYMENT ========================================================= */  function handlePayment(data) {    if (     !data.username ||     !data.plan ||     !data.receiptBase64   ) {     return jsonResponse({       success: false,       message: 'اطلاعات پرداخت کامل نیست.'     });   }    const base64 = String(data.receiptBase64);    const estimatedBytes =     Math.floor(base64.length * 0.75);    if (estimatedBytes > CONFIG.MAX_RECEIPT_BYTES) {     return jsonResponse({       success: false,       message: 'حجم فیش بیشتر از ۵ مگابایت است.'     });   }    const planPrices = {     monthly: 100000,     quarterly: 270000,     sixMonth: 480000,     nineMonth: 660000   };    if (     !Object.prototype.hasOwnProperty.call(       planPrices,       data.plan     )   ) {     return jsonResponse({       success: false,       message: 'پلن نامعتبر است.'     });   }    const originalAmount =     Number(planPrices[data.plan]);    let amount =     Number(data.amount || originalAmount);    let testCodeApplied = false;    if (     String(data.discountCode || '')       .trim()       .toUpperCase() === CONFIG.PRIVATE_TEST_CODE &&     data.plan === 'nineMonth'   ) {     amount = CONFIG.TEST_AMOUNT;     testCodeApplied = true;   }    const mimeType =     data.mimeType ||     data.fileMime ||     'image/jpeg';    const fileName =     data.fileName ||     ('receipt_' + Date.now() + '.jpg');    const bytes =     Utilities.base64Decode(base64);    const blob =     Utilities.newBlob(       bytes,       mimeType,       fileName     );    const folder =     getOrCreateReceiptFolder();    const savedFile =     folder.createFile(blob);    savedFile.setName(     'QuizDuo_' +     sanitizeFileName(data.username) +     '_' +     Date.now() +     '_' +     fileName   );    const fileUrl =     savedFile.getUrl();    const timestamp =     new Date();    const row = [     timestamp,     data.username,     data.phone || '',     data.plan,     data.planName || data.plan,     originalAmount,     amount,     Number(data.discountPercent || 0),     data.discountCode || '',     fileName,     fileUrl,     'در انتظار بررسی',     '',     ''   ];    appendPaymentRow(row);

    let emailSent = false;
    let emailError = '';

    // خطای مجوز Gmail نباید ثبت فیش را خراب کند.
    try {
      sendReceiptEmail(
        data,
        amount,
        fileUrl,
        savedFile
      );
      emailSent = true;
    } catch (error) {
      emailError =
        error && error.message
          ? error.message
          : String(error);

      console.warn(
        'Receipt email was not sent:',
        emailError
      );
    }

    return jsonResponse({
      success: true,
      testCodeApplied,
      emailSent,
      // خطای داخلی ایمیل به کاربر نمایش داده نمی‌شود.
      emailError: '',
      message: testCodeApplied
        ? 'فیش دریافت شد و کد تست خصوصی نیز تأیید شد.'
        : 'فیش با موفقیت برای بررسی ثبت شد.'
    }); }   /* =========================================================    SUPPORT - USER MESSAGE ========================================================= */  function handleSupport(data) {
  const username = String(data.username || '').trim();
  const phone = String(data.phone || '').trim();
  const subject = String(data.subject || '').trim();
  const message = String(data.message || data.text || '').trim();

  if (!username || username === 'بازیکن مهمان') {
    return jsonResponse({ success: false, message: 'برای ارسال درخواست پشتیبانی ابتدا وارد حساب شوید.' });
  }

  if (!subject || !message) {
    return jsonResponse({ success: false, message: 'موضوع و پیام را وارد کنید.' });
  }

  const conversationId = Utilities.getUuid();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let rowNumber;

  try {
    const sheet = getOrCreateSupportSheet();
    sheet.appendRow([
      new Date(), username, phone, subject, message, 'جدید', '', '', conversationId
    ]);
    SpreadsheetApp.flush();
    rowNumber = sheet.getLastRow();
  } finally {
    lock.releaseLock();
  }

  let emailSent = false;
  let emailError = '';
  try {
    const adminEmail = getAdminEmail();
    if (adminEmail) {
      GmailApp.sendEmail(
        adminEmail,
        'QuizDuo | پیام پشتیبانی | ' + username,
        [
          'پیام جدیدی در پشتیبانی QuizDuo ثبت شد.', '',
          'کاربر: ' + username,
          'شماره تماس: ' + (phone || '-'),
          'موضوع: ' + subject, '', message, '',
          'شناسه گفت‌وگو: ' + conversationId,
          'شماره ردیف: ' + rowNumber
        ].join('\n')
      );
      emailSent = true;
    }
  } catch (error) {
    emailError = error.message || String(error);
  }

  return jsonResponse({
    success: true, rowNumber, conversationId,
    message: emailSent ? 'درخواست پشتیبانی با موفقیت ارسال شد.' : 'درخواست پشتیبانی ثبت شد و در پنل مدیریت قرار گرفت.',
    emailSent, emailError
  });
}

/* =========================================================
   USER SUPPORT REPLY
========================================================= */
function handleSupportUserReply(data) {
  const username = String(data.username || '').trim();
  const conversationId = String(data.conversationId || '').trim();
  const message = String(data.message || '').trim();

  if (!username || username === 'بازیکن مهمان') {
    return jsonResponse({ success: false, message: 'ابتدا وارد حساب شوید.' });
  }
  if (!conversationId || !message) {
    return jsonResponse({ success: false, message: 'شناسه گفت‌وگو و متن پیام الزامی است.' });
  }

  const sheet = getOrCreateSupportSheet();
  const values = sheet.getDataRange().getValues();
  let found = false;
  let subject = 'ادامه گفت‌وگو';
  let phone = '';
  let closed = false;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowConversationId = String(row[8] || ('legacy-' + (i + 1)));
    const rowUsername = String(row[1] || '').trim();
    if (rowConversationId === conversationId && rowUsername.toLowerCase() === username.toLowerCase()) {
      found = true;
      subject = String(row[3] || subject);
      phone = String(row[2] || '');
      if (String(row[5] || '') === 'بسته شد') closed = true;
    }
  }

  if (!found) {
    return jsonResponse({ success: false, message: 'گفت‌وگو پیدا نشد.' });
  }
  if (closed) {
    return jsonResponse({ success: false, message: 'این گفت‌وگو بسته شده است.' });
  }

  sheet.appendRow([new Date(), username, phone, subject, message, 'جدید', '', '', conversationId]);
  SpreadsheetApp.flush();

  try {
    const adminEmail = getAdminEmail();
    if (adminEmail) {
      GmailApp.sendEmail(
        adminEmail,
        'QuizDuo | ادامه گفت‌وگو | ' + username,
        ['پیام جدید در یک گفت‌وگوی موجود ثبت شد.', '', 'کاربر: ' + username, 'موضوع: ' + subject, 'شناسه گفت‌وگو: ' + conversationId, '', message].join('\n')
      );
    }
  } catch (error) {
    console.error(error);
  }

  return jsonResponse({ success: true, message: 'پیام شما در همان گفت‌وگو ثبت شد.' });
}

/* =========================================================
   CLOSE SUPPORT CONVERSATION
========================================================= */
function closeSupportConversation(data) {
  const username = String(data.username || '').trim();
  const conversationId = String(data.conversationId || '').trim();

  if (!username || !conversationId) {
    return jsonResponse({ success: false, message: 'اطلاعات گفت‌وگو کامل نیست.' });
  }

  const sheet = getOrCreateSupportSheet();
  const values = sheet.getDataRange().getValues();
  let found = false;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowConversationId = String(row[8] || ('legacy-' + (i + 1)));
    if (rowConversationId === conversationId && String(row[1] || '').trim().toLowerCase() === username.toLowerCase()) {
      sheet.getRange(i + 1, 6).setValue('بسته شد');
      found = true;
    }
  }

  if (!found) {
    return jsonResponse({ success: false, message: 'گفت‌وگو پیدا نشد.' });
  }

  SpreadsheetApp.flush();
  return jsonResponse({ success: true, message: 'گفت‌وگو بسته شد.' });
}

/* =========================================================    USER UPDATES ========================================================= */  function getUserUpdates(data) {    const username =     String(data.username || '').trim();    if (     !username ||     username === 'بازیکن مهمان'   ) {     return jsonResponse({       success: true,       payments: [],       support: []     });   }    const payments =     getUserPaymentUpdates(username);    const support = getUserSupportUpdates(username);
  const subscription = getUserSubscription(username);
  return jsonResponse({
    success: true,
    username,
    payments,
    support,
    subscription
  }); }   /* =========================================================    USER PAYMENT UPDATES ========================================================= */  function getUserPaymentUpdates(username) {    const sheet =     getOrCreateSheet();    SpreadsheetApp.flush();    const values =     sheet.getDataRange().getValues();    if (values.length <= 1) {     return [];   }    return values     .slice(1)     .map((row, index) => ({        rowNumber: index + 2,        timestamp:         row[0]           ? new Date(row[0]).toISOString()           : '',        username:         String(row[1] || ''),        phone:         row[2] || '',        planId:         row[3] || '',        planName:         row[4] || '',        amount:         row[6] || 0,        status:         row[11] ||         'در انتظار بررسی',        userMessage:         row[12] || '',        statusTimestamp:         row[13]           ? new Date(row[13]).toISOString()           : ''      }))     .filter(item =>       item.username.toLowerCase() ===       username.toLowerCase()     )     .reverse(); }   /* =========================================================    USER SUPPORT UPDATES ========================================================= */  function getUserSupportUpdates(username) {
  const sheet = getOrCreateSupportSheet();
  SpreadsheetApp.flush();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const groups = {};
  values.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const conversationId = String(row[8] || ('legacy-' + rowNumber));
    const rowUsername = String(row[1] || '').trim();
    if (rowUsername.toLowerCase() !== username.toLowerCase()) return;

    if (!groups[conversationId]) {
      groups[conversationId] = {
        conversationId,
        rowNumber,
        timestamp: row[0] ? new Date(row[0]).toISOString() : '',
        username: rowUsername,
        phone: row[2] || '',
        subject: row[3] || '',
        message: row[4] || '',
        status: row[5] || 'جدید',
        thread: []
      };
    }

    const group = groups[conversationId];
    group.rowNumber = Math.min(group.rowNumber, rowNumber);
    if (!group.subject) group.subject = row[3] || '';
    if (row[0]) group.timestamp = new Date(row[0]).toISOString();
    group.status = row[5] || group.status;

    if (row[4]) {
      group.thread.push({ sender: 'user', text: String(row[4]), timestamp: row[0] ? new Date(row[0]).toISOString() : '' });
    }
    if (row[6]) {
      group.thread.push({ sender: 'admin', text: String(row[6]), timestamp: row[7] ? new Date(row[7]).toISOString() : '' });
    }
  });

  return Object.values(groups).map(group => {
    group.thread.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
    return group;
  }).sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
}

/* =========================================================
   USER STATE / LEADERBOARD
========================================================= */
function getServerDateKey(date) {
  const value = date instanceof Date ? date : new Date(date || Date.now());
  return Utilities.formatDate(
    value,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}

function handleUserState(data) {
  const username = String(data.username || '').trim();

  if (!username || username === 'بازیکن مهمان') {
    return jsonResponse({
      success: false,
      message: 'کاربر معتبر نیست.'
    });
  }

  const sheet = getOrCreateUsersSheet();
  const values = sheet.getDataRange().getValues();
  const normalized = username.toLowerCase();
  let foundRow = 0;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1] || '').trim().toLowerCase() === normalized) {
      foundRow = i + 1;
      break;
    }
  }

  const generalStage = Math.max(0, Number(data.generalStage || 0));
  const funStage = Math.max(0, Number(data.funStage || 0));
  const bestStage = Math.max(generalStage, funStage);
  const bestCombo = Math.max(0, Number(data.bestCombo || 0));

  const row = [
    new Date(),
    username,
    String(data.phone || ''),
    Number(data.xp || 0),
    Number(data.level || 1),
    Number(data.streak || 0),
    generalStage,
    funStage,
    bestCombo
  ];

  if (foundRow) {
    sheet.getRange(foundRow, 1, 1, USER_HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  SpreadsheetApp.flush();

  upsertLeaderboardHistory({
    username,
    xp: Number(data.xp || 0),
    level: Number(data.level || 1),
    bestCombo,
    streak: Number(data.streak || 0),
    bestStage,
    generalStage,
    funStage
  });

  return jsonResponse({
    success: true,
    message: 'وضعیت کاربر ذخیره شد.'
  });
}

function upsertLeaderboardHistory(data) {
  const sheet = getOrCreateLeaderboardHistorySheet();
  const now = new Date();
  const dateKey = getServerDateKey(now);
  const username = String(data.username || '').trim();
  const normalized = username.toLowerCase();

  if (!username) return;

  const values = sheet.getDataRange().getValues();
  let foundRow = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rowDate = String(row[1] || '');
    const rowUser = String(row[2] || '').trim().toLowerCase();

    if (rowDate === dateKey && rowUser === normalized) {
      foundRow = i + 1;
      break;
    }
  }

  const row = [
    now,
    dateKey,
    username,
    Number(data.xp || 0),
    Number(data.level || 1),
    Number(data.bestCombo || 0),
    Number(data.streak || 0),
    Number(data.bestStage || 0),
    Number(data.generalStage || 0),
    Number(data.funStage || 0)
  ];

  if (foundRow) {
    sheet.getRange(foundRow, 1, 1, LEADERBOARD_HISTORY_HEADERS.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function getLeaderboardPeriodRange(period) {
  const now = new Date();
  const safePeriod = ['week', 'month', 'year'].includes(String(period))
    ? String(period)
    : 'week';

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (safePeriod === 'week') {
    const day = start.getDay();
    const daysFromMonday = (day + 6) % 7;
    start.setDate(start.getDate() - daysFromMonday);
  } else if (safePeriod === 'month') {
    start.setDate(1);
  } else if (safePeriod === 'year') {
    start.setMonth(0, 1);
  }

  return {
    period: safePeriod,
    start,
    end: now
  };
}

function getLeaderboardObject(period) {
  const range = getLeaderboardPeriodRange(period);
  const entriesByUser = {};
  const historySheet = getOrCreateLeaderboardHistorySheet();
  const historyValues = historySheet.getDataRange().getValues();

  historyValues.slice(1).forEach(row => {
    const timestamp = row[0] ? new Date(row[0]) : null;
    if (!timestamp || Number.isNaN(timestamp.getTime())) return;
    if (timestamp < range.start || timestamp > range.end) return;

    const username = String(row[2] || '').trim();
    if (!username) return;

    const key = username.toLowerCase();
    const current = entriesByUser[key];

    if (!current) {
      entriesByUser[key] = {
        username,
        xp: Number(row[3] || 0),
        level: Number(row[4] || 1),
        bestCombo: Number(row[5] || 0),
        streak: Number(row[6] || 0),
        bestStage: Number(row[7] || 0),
        generalStage: Number(row[8] || 0),
        funStage: Number(row[9] || 0),
        latestTimestamp: timestamp.getTime()
      };
      return;
    }

    current.xp = Math.max(current.xp, Number(row[3] || 0));
    current.level = Math.max(current.level, Number(row[4] || 1));
    current.bestCombo = Math.max(current.bestCombo, Number(row[5] || 0));
    current.bestStage = Math.max(current.bestStage, Number(row[7] || 0));

    if (timestamp.getTime() >= current.latestTimestamp) {
      current.streak = Number(row[6] || 0);
      current.generalStage = Number(row[8] || 0);
      current.funStage = Number(row[9] || 0);
      current.latestTimestamp = timestamp.getTime();
    }
  });

  // For the current period, include users who have a fresh Users snapshot
  // but do not yet have a history row (e.g. immediately after deployment).
  try {
    const usersSheet = getOrCreateUsersSheet();
    const values = usersSheet.getDataRange().getValues();

    values.slice(1).forEach(row => {
      const timestamp = row[0] ? new Date(row[0]) : null;
      if (!timestamp || Number.isNaN(timestamp.getTime())) return;
      if (timestamp < range.start || timestamp > range.end) return;

      const username = String(row[1] || '').trim();
      if (!username) return;

      const key = username.toLowerCase();
      const candidate = {
        username,
        xp: Number(row[3] || 0),
        level: Number(row[4] || 1),
        bestCombo: Number(row[8] || 0),
        streak: Number(row[5] || 0),
        bestStage: Math.max(Number(row[6] || 0), Number(row[7] || 0)),
        generalStage: Number(row[6] || 0),
        funStage: Number(row[7] || 0),
        latestTimestamp: timestamp.getTime()
      };

      if (!entriesByUser[key]) {
        entriesByUser[key] = candidate;
      } else {
        const current = entriesByUser[key];
        current.xp = Math.max(current.xp, candidate.xp);
        current.level = Math.max(current.level, candidate.level);
        current.bestCombo = Math.max(current.bestCombo, candidate.bestCombo);
        current.bestStage = Math.max(current.bestStage, candidate.bestStage);
        if (candidate.latestTimestamp >= current.latestTimestamp) {
          current.streak = candidate.streak;
          current.generalStage = candidate.generalStage;
          current.funStage = candidate.funStage;
          current.latestTimestamp = candidate.latestTimestamp;
        }
      }
    });
  } catch (error) {
    console.error('Users current-period merge failed:', error);
  }

  const entries = Object.values(entriesByUser);

  const xpBoard = [...entries]
    .sort((a, b) =>
      Number(b.xp || 0) - Number(a.xp || 0) ||
      Number(b.bestStage || 0) - Number(a.bestStage || 0) ||
      Number(b.bestCombo || 0) - Number(a.bestCombo || 0) ||
      String(a.username).localeCompare(String(b.username), 'fa')
    )
    .slice(0, 3);

  const comboBoard = [...entries]
    .sort((a, b) =>
      Number(b.bestCombo || 0) - Number(a.bestCombo || 0) ||
      Number(b.xp || 0) - Number(a.xp || 0) ||
      String(a.username).localeCompare(String(b.username), 'fa')
    )
    .slice(0, 3);

  const stageBoard = [...entries]
    .sort((a, b) =>
      Number(b.bestStage || 0) - Number(a.bestStage || 0) ||
      Number(b.xp || 0) - Number(a.xp || 0) ||
      Number(b.bestCombo || 0) - Number(a.bestCombo || 0) ||
      String(a.username).localeCompare(String(b.username), 'fa')
    )
    .slice(0, 3);

  return {
    success: true,
    period: range.period,
    periodStart: range.start.toISOString(),
    periodEnd: range.end.toISOString(),
    boards: {
      xp: xpBoard,
      combo: comboBoard,
      stage: stageBoard
    },
    updatedAt: new Date().toISOString()
  };
}

/* =========================================================
   SUBSCRIPTION STATE
========================================================= */
function getUserSubscription(username) {
  const sheet = getOrCreateSheet();
  const values = sheet.getDataRange().getValues();
  const planMonths = { monthly: 1, quarterly: 3, sixMonth: 6, nineMonth: 9 };

  const approved = values.slice(1)
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(item =>
      String(item.row[1] || '').trim().toLowerCase() === username.toLowerCase() &&
      String(item.row[11] || '').trim() === 'تأیید شد'
    )
    .sort((a, b) => new Date(a.row[0] || 0) - new Date(b.row[0] || 0));

  if (!approved.length) {
    return { active: false, planId: '', planName: '', start: null, expiry: null };
  }

  let cursor = null;
  let activeStart = null;
  let activeExpiry = null;
  let activePlanId = '';
  let activePlanName = '';

  approved.forEach(item => {
    const paymentDate = new Date(item.row[0] || Date.now());
    const months = Number(planMonths[String(item.row[3] || '')] || 0);
    if (!months) return;

    const base = cursor && cursor.getTime() > paymentDate.getTime() ? new Date(cursor) : new Date(paymentDate);
    const expiry = addMonths(base, months);

    if (!activeExpiry || expiry.getTime() >= activeExpiry.getTime()) {
      activeStart = base;
      activeExpiry = expiry;
      activePlanId = String(item.row[3] || '');
      activePlanName = String(item.row[4] || activePlanId);
    }
    cursor = expiry;
  });

  const now = new Date();
  const active = activeExpiry && activeExpiry.getTime() > now.getTime();
  return {
    active: Boolean(active),
    planId: active ? activePlanId : '',
    planName: active ? activePlanName : '',
    start: active ? activeStart.toISOString() : null,
    expiry: active ? activeExpiry.toISOString() : null
  };
}

function addMonths(date, months) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + Number(months));
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

/* =========================================================    EMAIL ========================================================= */  function sendReceiptEmail(   data,   amount,   fileUrl,   file ) {    const adminEmail =     getAdminEmail();    if (!adminEmail) return;    const subject =     'QuizDuo | فیش پرداخت جدید | ' +     data.username;    const body = [     'یک فیش پرداخت جدید در QuizDuo ثبت شد.',     '',     'نام کاربری: ' + data.username,     'شماره تماس: ' + (data.phone || '-'),     'پلن: ' + (data.planName || data.plan),     'مبلغ: ' +       amount.toLocaleString('fa-IR') +       ' تومان',     'کد تخفیف: ' +       (data.discountCode || '-'),     '',     'لینک فایل فیش در Google Drive:',     fileUrl,     '',     'وضعیت فعلی: در انتظار بررسی'   ].join('\n');    GmailApp.sendEmail(     adminEmail,     subject,     body,     {       attachments: [         file.getBlob()       ]     }   ); }   function getAdminEmail() {    const saved =     PropertiesService       .getScriptProperties()       .getProperty('ADMIN_EMAIL');    if (saved) return saved;    return (     Session       .getEffectiveUser()       .getEmail() ||     ''   ); }   /* =========================================================    DRIVE / SHEETS ========================================================= */  function getOrCreateReceiptFolder() {    const folders =     DriveApp.getFoldersByName(       CONFIG.DRIVE_FOLDER_NAME     );    return folders.hasNext()     ? folders.next()     : DriveApp.createFolder(         CONFIG.DRIVE_FOLDER_NAME       ); }   function getOrCreateSpreadsheet() {    const props =     PropertiesService       .getScriptProperties();    let spreadsheetId =     props.getProperty(       'PAYMENTS_SPREADSHEET_ID'     );    let spreadsheet;     if (spreadsheetId) {      try {        spreadsheet =         SpreadsheetApp.openById(           spreadsheetId         );      } catch (error) {        spreadsheet = null;     }   }     if (!spreadsheet) {      spreadsheet =       SpreadsheetApp.create(         'QuizDuo Payments'       );      props.setProperty(       'PAYMENTS_SPREADSHEET_ID',       spreadsheet.getId()     );   }    return spreadsheet; }   function getOrCreateSheet() {    const spreadsheet =     getOrCreateSpreadsheet();    let sheet =     spreadsheet.getSheetByName(       CONFIG.SHEET_NAME     );    if (!sheet) {     sheet =       spreadsheet.insertSheet(         CONFIG.SHEET_NAME       );   }    ensureHeaders(     sheet,     PAYMENT_HEADERS   );    return sheet; }   function getOrCreateSupportSheet() {    const spreadsheet =     getOrCreateSpreadsheet();    let sheet =     spreadsheet.getSheetByName(       CONFIG.SUPPORT_SHEET_NAME     );    if (!sheet) {      sheet =       spreadsheet.insertSheet(         CONFIG.SUPPORT_SHEET_NAME       );   }    ensureHeaders(     sheet,     SUPPORT_HEADERS   );    return sheet; }   function getOrCreateUsersSheet() {
  const spreadsheet = getOrCreateSpreadsheet();
  let sheet = spreadsheet.getSheetByName(CONFIG.USERS_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.USERS_SHEET_NAME);
  }
  ensureHeaders(sheet, USER_HEADERS);
  return sheet;
}

function getOrCreateLeaderboardHistorySheet() {
  const spreadsheet = getOrCreateSpreadsheet();
  let sheet = spreadsheet.getSheetByName(CONFIG.LEADERBOARD_HISTORY_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.LEADERBOARD_HISTORY_SHEET_NAME);
  }
  ensureHeaders(sheet, LEADERBOARD_HISTORY_HEADERS);
  return sheet;
}

function ensureHeaders(   sheet,   headers ) {    const existingLastColumn =     sheet.getLastColumn();    const existing =     existingLastColumn > 0       ? sheet           .getRange(             1,             1,             1,             existingLastColumn           )           .getValues()[0]       : [];    let changed = false;    headers.forEach(     (header, index) => {        if (         existing[index] !== header       ) {          sheet           .getRange(             1,             index + 1           )           .setValue(header);          changed = true;       }     }   );    if (     changed ||     sheet.getLastRow() === 0   ) {     sheet.setFrozenRows(1);   } }   function appendPaymentRow(row) {   getOrCreateSheet()     .appendRow(row); }   /* =========================================================    HELPERS ========================================================= */  function sanitizeFileName(value) {    return String(     value || 'user'   )     .replace(       /[\\\/:*?"<>|]/g,       '_'     )     .slice(0, 60); }   function jsonpResponse(callback, data) {
  const safeCallback = String(callback || '').replace(/[^a-zA-Z0-9_.$]/g, '');
  if (!safeCallback) {
    return jsonResponse(data);
  }

  return ContentService
    .createTextOutput(
      safeCallback + '(' + JSON.stringify(data) + ');'
    )
    .setMimeType(
      ContentService.MimeType.JAVASCRIPT
    );
}

function jsonResponse(data) {    return ContentService     .createTextOutput(       JSON.stringify(data)     )     .setMimeType(       ContentService.MimeType.JSON     ); }   /* =========================================================    ADMIN AUTH ========================================================= */  function checkAdmin(password) {    return String(password || '') ===     CONFIG.ADMIN_PASSWORD; }   /* =========================================================    ADMIN PAYMENTS ========================================================= */  function getPaymentsForAdmin(password) {    if (!checkAdmin(password)) {     throw new Error(       'رمز مدیریت اشتباه است.'     );   }    const sheet =     getOrCreateSheet();    SpreadsheetApp.flush();    const values =     sheet.getDataRange().getValues();    if (values.length <= 1) {     return [];   }    return values     .slice(1)     .map((row, index) => ({        rowNumber: index + 2,        timestamp:         row[0]           ? new Date(row[0]).toISOString()           : '',        username:         row[1] || '',        phone:         row[2] || '',        planId:         row[3] || '',        planName:         row[4] || '',        originalAmount:         row[5] || 0,        amount:         row[6] || 0,        discountPercent:         row[7] || 0,        discountCode:         row[8] || '',        fileName:         row[9] || '',        receiptUrl:         row[10] || '',        status:         row[11] ||         'در انتظار بررسی',        userMessage:         row[12] || '',        statusTimestamp:         row[13]           ? new Date(row[13]).toISOString()           : ''      }))     .reverse(); }   /* =========================================================    ADMIN PAYMENT STATUS ========================================================= */  function updatePaymentStatus(   password,   rowNumber,   status ) {    if (!checkAdmin(password)) {     throw new Error(       'رمز مدیریت اشتباه است.'     );   }    const allowed = [     'تأیید شد',     'رد شد',     'در انتظار بررسی'   ];    if (!allowed.includes(status)) {     throw new Error(       'وضعیت نامعتبر است.'     );   }    const sheet =     getOrCreateSheet();    const row =     Number(rowNumber);    const username =     String(       sheet         .getRange(row, 2)         .getValue() || ''     );    const planId =     String(       sheet         .getRange(row, 4)         .getValue() || ''     );    const now =     new Date();    let userMessage = '';    if (status === 'تأیید شد') {      userMessage =       'پرداخت شما تأیید شد و اشتراک شما فعال شد. همه مراحل برای حساب شما باز شد.';    } else if (status === 'رد شد') {      userMessage =       'پرداخت شما رد شد. در صورت بروز مشکل به آیدی @hv901 در بله پیام بدهید.';   }    sheet     .getRange(row, 12)     .setValue(status);    sheet     .getRange(row, 13)     .setValue(userMessage);    sheet     .getRange(row, 14)     .setValue(now);    SpreadsheetApp.flush();    return {     success: true,     username,     planId,     status,     userMessage   }; }   /* =========================================================    ADMIN SUPPORT ========================================================= */  function getSupportForAdmin(password) {    if (!checkAdmin(password)) {     throw new Error(       'رمز مدیریت اشتباه است.'     );   }    const sheet =     getOrCreateSupportSheet();    SpreadsheetApp.flush();    const values =     sheet.getDataRange().getValues();    if (values.length <= 1) {     return [];   }    /*     نکته مهم:     این تابع هیچ‌وقت پیام‌ها را حذف نمی‌کند.     تمام ردیف‌های Support خوانده می‌شوند.   */    return values     .slice(1)     .map((row, index) => ({        rowNumber:         index + 2,        timestamp:         row[0]           ? new Date(row[0]).toISOString()           : '',        username:         row[1] || '',        phone:         row[2] || '',        subject:         row[3] || '',        message:         row[4] || '',        status:         row[5] || 'جدید',        adminReply:         row[6] || '',        replyTimestamp:         row[7]           ? new Date(row[7]).toISOString()           : '',        conversationId:         String(row[8] || ('legacy-' + (index + 2)))      }))     .reverse(); }   /* =========================================================    ADMIN REPLY ========================================================= */  function replyToSupport(   password,   rowNumber,   reply,   status ) {    if (!checkAdmin(password)) {     throw new Error(       'رمز مدیریت اشتباه است.'     );   }    const text =     String(reply || '').trim();    if (!text) {     throw new Error(       'متن پاسخ را وارد کنید.'     );   }    const allowed = [     'جدید',     'در حال بررسی',     'پاسخ داده شد',     'بسته شد'   ];    const finalStatus =     allowed.includes(status)       ? status       : 'پاسخ داده شد';    const sheet =     getOrCreateSupportSheet();    const row =     Number(rowNumber);    sheet     .getRange(row, 6)     .setValue(finalStatus);    sheet     .getRange(row, 7)     .setValue(text);    sheet     .getRange(row, 8)     .setValue(new Date());    SpreadsheetApp.flush();    return {     success: true,     message:       'پاسخ با موفقیت برای پنل کاربر ثبت شد.'   }; }   /* =========================================================    ADMIN SUPPORT STATUS ========================================================= */  function updateSupportStatus(   password,   rowNumber,   status ) {    if (!checkAdmin(password)) {     throw new Error(       'رمز مدیریت اشتباه است.'     );   }    const allowed = [     'جدید',     'در حال بررسی',     'پاسخ داده شد',     'بسته شد'   ];    if (!allowed.includes(status)) {     throw new Error(       'وضعیت نامعتبر است.'     );   }    const sheet =     getOrCreateSupportSheet();    sheet     .getRange(       Number(rowNumber),       6     )     .setValue(status);    SpreadsheetApp.flush();    return {     success: true   }; }   /* =========================================================    TEST EMAIL ========================================================= */  function testEmail() {    GmailApp.sendEmail({     to: getAdminEmail(),      subject:       'QuizDuo Test Email',      htmlBody:       '<div dir="rtl">' +       '<h2>ایمیل تست QuizDuo</h2>' +       '<p>ارسال ایمیل با موفقیت انجام شد.</p>' +       '</div>'   }); }  
