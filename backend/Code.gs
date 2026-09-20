const CONFIG = {
  SHEET_NAME: 'Payments',
  SUPPORT_SHEET_NAME: 'Support',
  DRIVE_FOLDER_NAME: 'QuizDuo Receipts',
  PRIVATE_TEST_CODE: 'QDZ-100K-HASTI',
  TEST_AMOUNT: 100000,
  MAX_RECEIPT_BYTES: 5 * 1024 * 1024,
  ADMIN_PASSWORD: 'CHANGE_THIS_ADMIN_PASSWORD'
};

const PAYMENT_HEADERS = [
  'Timestamp',
  'Username',
  'Phone',
  'Plan ID',
  'Plan Name',
  'Original Amount',
  'Final Amount',
  'Discount %',
  'Discount Code',
  'File Name',
  'Receipt URL',
  'Status',
  'User Message',
  'Status Timestamp'
];

const SUPPORT_HEADERS = [
  'Timestamp',
  'Username',
  'Phone',
  'Subject',
  'Message',
  'Status',
  'Admin Reply',
  'Reply Timestamp',
  'Conversation ID'
];

/* =========================================================
   WEB APP
========================================================= */

function doGet(e) {
  const page = e && e.parameter && e.parameter.page;

  if (page === 'admin') {
    return HtmlService
      .createTemplateFromFile('Admin')
      .evaluate()
      .setTitle('QuizDuo Admin')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return jsonResponse({
    success: true,
    service: 'QuizDuo',
    time: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents;

    if (!body) {
      return jsonResponse({
        success: false,
        message: 'درخواست خالی است.'
      });
    }

    const data = JSON.parse(body);

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

/* =========================================================
   DISCOUNT
========================================================= */

function validateDiscount(data) {
  const code = String(data.code || '').trim().toUpperCase();
  const plan = String(data.plan || '');

  const valid =
    code === CONFIG.PRIVATE_TEST_CODE &&
    plan === 'nineMonth';

  return jsonResponse({
    success: true,
    testCodeApplied: valid,
    amount: valid ? CONFIG.TEST_AMOUNT : null
  });
}

/* =========================================================
   PAYMENT
========================================================= */

function handlePayment(data) {

  if (
    !data.username ||
    !data.plan ||
    !data.receiptBase64
  ) {
    return jsonResponse({
      success: false,
      message: 'اطلاعات پرداخت کامل نیست.'
    });
  }

  const base64 = String(data.receiptBase64);

  const estimatedBytes =
    Math.floor(base64.length * 0.75);

  if (estimatedBytes > CONFIG.MAX_RECEIPT_BYTES) {
    return jsonResponse({
      success: false,
      message: 'حجم فیش بیشتر از ۵ مگابایت است.'
    });
  }

  const planPrices = {
    monthly: 100000,
    quarterly: 270000,
    sixMonth: 480000,
    nineMonth: 660000
  };

  if (
    !Object.prototype.hasOwnProperty.call(
      planPrices,
      data.plan
    )
  ) {
    return jsonResponse({
      success: false,
      message: 'پلن نامعتبر است.'
    });
  }

  const originalAmount =
    Number(planPrices[data.plan]);

  let amount =
    Number(data.amount || originalAmount);

  let testCodeApplied = false;

  if (
    String(data.discountCode || '')
      .trim()
      .toUpperCase() === CONFIG.PRIVATE_TEST_CODE &&
    data.plan === 'nineMonth'
  ) {
    amount = CONFIG.TEST_AMOUNT;
    testCodeApplied = true;
  }

  const mimeType =
    data.mimeType ||
    data.fileMime ||
    'image/jpeg';

  const fileName =
    data.fileName ||
    ('receipt_' + Date.now() + '.jpg');

  const bytes =
    Utilities.base64Decode(base64);

  const blob =
    Utilities.newBlob(
      bytes,
      mimeType,
      fileName
    );

  const folder =
    getOrCreateReceiptFolder();

  const savedFile =
    folder.createFile(blob);

  savedFile.setName(
    'QuizDuo_' +
    sanitizeFileName(data.username) +
    '_' +
    Date.now() +
    '_' +
    fileName
  );

  const fileUrl =
    savedFile.getUrl();

  const timestamp =
    new Date();

  const row = [
    timestamp,
    data.username,
    data.phone || '',
    data.plan,
    data.planName || data.plan,
    originalAmount,
    amount,
    Number(data.discountPercent || 0),
    data.discountCode || '',
    fileName,
    fileUrl,
    'در انتظار بررسی',
    '',
    ''
  ];

  appendPaymentRow(row);

  sendReceiptEmail(
    data,
    amount,
    fileUrl,
    savedFile
  );

  return jsonResponse({
    success: true,
    testCodeApplied,
    message: testCodeApplied
      ? 'فیش دریافت شد و کد تست خصوصی نیز تأیید شد.'
      : 'فیش با موفقیت برای بررسی ارسال شد.'
  });
}

/* =========================================================
   SUPPORT - USER MESSAGE
========================================================= */

function handleSupport(data) {
  const username =
    String(data.username || '').trim();

  const phone =
    String(data.phone || '').trim();

  const subject =
    String(data.subject || '').trim();

  const message =
    String(
      data.message ||
      data.text ||
      ''
    ).trim();

  if (
    !username ||
    username === 'بازیکن مهمان'
  ) {
    return jsonResponse({
      success: false,
      message:
        'برای ارسال درخواست پشتیبانی ابتدا وارد حساب شوید.'
    });
  }

  if (!subject || !message) {
    return jsonResponse({
      success: false,
      message:
        'موضوع و پیام را وارد کنید.'
    });
  }

  const conversationId =
    Utilities.getUuid();

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  let rowNumber;

  try {
    const sheet =
      getOrCreateSupportSheet();

    sheet.appendRow([
      new Date(),
      username,
      phone,
      subject,
      message,
      'جدید',
      '',
      '',
      conversationId
    ]);

    SpreadsheetApp.flush();

    rowNumber =
      sheet.getLastRow();

  } finally {
    lock.releaseLock();
  }

  let emailSent = false;
  let emailError = '';

  try {
    const adminEmail =
      getAdminEmail();

    if (adminEmail) {
      GmailApp.sendEmail(
        adminEmail,
        'QuizDuo | پیام پشتیبانی | ' + username,
        [
          'پیام جدیدی در پشتیبانی QuizDuo ثبت شد.',
          '',
          'کاربر: ' + username,
          'شماره تماس: ' + (phone || '-'),
          'موضوع: ' + subject,
          '',
          message,
          '',
          'شناسه گفت‌وگو: ' + conversationId,
          'شماره ردیف: ' + rowNumber
        ].join('\n')
      );

      emailSent = true;
    }

  } catch (error) {
    emailError =
      error.message ||
      String(error);
  }

  return jsonResponse({
    success: true,
    rowNumber,
    conversationId,
    message: emailSent
      ? 'درخواست پشتیبانی با موفقیت ارسال شد.'
      : 'درخواست پشتیبانی ثبت شد و در پنل مدیریت قرار گرفت.',
    emailSent,
    emailError
  });
}

/* =========================================================
   USER SUPPORT REPLY
========================================================= */

function handleSupportUserReply(data) {
  const username =
    String(data.username || '').trim();

  const conversationId =
    String(data.conversationId || '').trim();

  const message =
    String(data.message || '').trim();

  if (
    !username ||
    username === 'بازیکن مهمان'
  ) {
    return jsonResponse({
      success: false,
      message: 'ابتدا وارد حساب شوید.'
    });
  }

  if (!conversationId || !message) {
    return jsonResponse({
      success: false,
      message:
        'شناسه گفت‌وگو و متن پیام الزامی است.'
    });
  }

  const sheet =
    getOrCreateSupportSheet();

  const values =
    sheet.getDataRange().getValues();

  let found = false;
  let subject = 'ادامه گفت‌وگو';
  let phone = '';
  let closed = false;

  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    const rowConversationId =
      String(
        row[8] ||
        ('legacy-' + (i + 1))
      );

    const rowUsername =
      String(
        row[1] || ''
      ).trim();

    if (
      rowConversationId === conversationId &&
      rowUsername.toLowerCase() ===
        username.toLowerCase()
    ) {

      found = true;

      subject =
        String(
          row[3] ||
          subject
        );

      phone =
        String(
          row[2] || ''
        );

      if (
        String(row[5] || '') ===
        'بسته شد'
      ) {
        closed = true;
      }
    }
  }

  if (!found) {
    return jsonResponse({
      success: false,
      message: 'گفت‌وگو پیدا نشد.'
    });
  }

  if (closed) {
    return jsonResponse({
      success: false,
      message:
        'این گفت‌وگو بسته شده است.'
    });
  }

  sheet.appendRow([
    new Date(),
    username,
    phone,
    subject,
    message,
    'جدید',
    '',
    '',
    conversationId
  ]);

  SpreadsheetApp.flush();

  try {

    const adminEmail =
      getAdminEmail();

    if (adminEmail) {

      GmailApp.sendEmail(
        adminEmail,
        'QuizDuo | ادامه گفت‌وگو | ' + username,
        [
          'پیام جدید در یک گفت‌وگوی موجود ثبت شد.',
          '',
          'کاربر: ' + username,
          'موضوع: ' + subject,
          'شناسه گفت‌وگو: ' + conversationId,
          '',
          message
        ].join('\n')
      );
    }

  } catch (error) {
    console.error(error);
  }

  return jsonResponse({
    success: true,
    message:
      'پیام شما در همان گفت‌وگو ثبت شد.'
  });
}

/* =========================================================
   CLOSE SUPPORT CONVERSATION
========================================================= */

function closeSupportConversation(data) {

  const username =
    String(data.username || '').trim();

  const conversationId =
    String(data.conversationId || '').trim();

  if (!username || !conversationId) {
    return jsonResponse({
      success: false,
      message:
        'اطلاعات گفت‌وگو کامل نیست.'
    });
  }

  const sheet =
    getOrCreateSupportSheet();

  const values =
    sheet.getDataRange().getValues();

  let found = false;

  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    const rowConversationId =
      String(
        row[8] ||
        ('legacy-' + (i + 1))
      );

    if (
      rowConversationId === conversationId &&
      String(
        row[1] || ''
      ).trim().toLowerCase() ===
        username.toLowerCase()
    ) {

      sheet
        .getRange(i + 1, 6)
        .setValue('بسته شد');

      found = true;
    }
  }

  if (!found) {
    return jsonResponse({
      success: false,
      message:
        'گفت‌وگو پیدا نشد.'
    });
  }

  SpreadsheetApp.flush();

  return jsonResponse({
    success: true,
    message:
      'گفت‌وگو بسته شد.'
  });
}

/* =========================================================
   USER UPDATES
========================================================= */

function getUserUpdates(data) {

  const username =
    String(
      data.username || ''
    ).trim();

  if (
    !username ||
    username === 'بازیکن مهمان'
  ) {
    return jsonResponse({
      success: true,
      payments: [],
      support: [],
      subscription: {
        active: false,
        planId: '',
        planName: '',
        start: null,
        expiry: null
      }
    });
  }

  const payments =
    getUserPaymentUpdates(username);

  const support =
    getUserSupportUpdates(username);

  const subscription =
    getUserSubscription(username);

  return jsonResponse({
    success: true,
    payments,
    support,
    subscription
  });
}

/* =========================================================
   USER PAYMENT UPDATES
========================================================= */

function getUserPaymentUpdates(username) {

  const sheet =
    getOrCreateSheet();

  SpreadsheetApp.flush();

  const values =
    sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .map((row, index) => ({
      rowNumber:
        index + 2,

      timestamp:
        row[0]
          ? new Date(row[0]).toISOString()
          : '',

      username:
        String(row[1] || ''),

      phone:
        row[2] || '',

      planId:
        row[3] || '',

      planName:
        row[4] || '',

      amount:
        row[6] || 0,

      status:
        row[11] ||
        'در انتظار بررسی',

      userMessage:
        row[12] || '',

      statusTimestamp:
        row[13]
          ? new Date(row[13]).toISOString()
          : ''
    }))
    .filter(item =>
      item.username.toLowerCase() ===
      username.toLowerCase()
    )
    .reverse();
}

/* =========================================================
   USER SUPPORT UPDATES
========================================================= */

function getUserSupportUpdates(username) {

  const sheet =
    getOrCreateSupportSheet();

  SpreadsheetApp.flush();

  const values =
    sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  const groups = {};

  values
    .slice(1)
    .forEach((row, index) => {

      const rowNumber =
        index + 2;

      const conversationId =
        String(
          row[8] ||
          ('legacy-' + rowNumber)
        );

      const rowUsername =
        String(
          row[1] || ''
        ).trim();

      if (
        rowUsername.toLowerCase() !==
        username.toLowerCase()
      ) {
        return;
      }

      if (!groups[conversationId]) {

        groups[conversationId] = {
          conversationId,
          rowNumber,
          timestamp:
            row[0]
              ? new Date(row[0]).toISOString()
              : '',
          username:
            rowUsername,
          phone:
            row[2] || '',
          subject:
            row[3] || '',
          message:
            row[4] || '',
          status:
            row[5] || 'جدید',
          thread: []
        };
      }

      const group =
        groups[conversationId];

      group.rowNumber =
        Math.min(
          group.rowNumber,
          rowNumber
        );

      if (!group.subject) {
        group.subject =
          row[3] || '';
      }

      if (row[0]) {
        group.timestamp =
          new Date(
            row[0]
          ).toISOString();
      }

      group.status =
        row[5] ||
        group.status;

      if (row[4]) {

        group.thread.push({
          sender: 'user',
          text: String(row[4]),
          timestamp:
            row[0]
              ? new Date(
                  row[0]
                ).toISOString()
              : ''
        });
      }

      if (row[6]) {

        group.thread.push({
          sender: 'admin',
          text: String(row[6]),
          timestamp:
            row[7]
              ? new Date(
                  row[7]
                ).toISOString()
              : ''
        });
      }
    });

  return Object
    .values(groups)
    .map(group => {

      group.thread.sort(
        (a, b) =>
          new Date(
            a.timestamp || 0
          ) -
          new Date(
            b.timestamp || 0
          )
      );

      return group;
    })
    .sort(
      (a, b) =>
        new Date(
          b.timestamp || 0
        ) -
        new Date(
          a.timestamp || 0
        )
    );
}

/* =========================================================
   SUBSCRIPTION STATE
========================================================= */

function getUserSubscription(username) {

  const sheet =
    getOrCreateSheet();

  const values =
    sheet.getDataRange().getValues();

  const planMonths = {
    monthly: 1,
    quarterly: 3,
    sixMonth: 6,
    nineMonth: 9
  };

  const approved =
    values
      .slice(1)
      .map((row, index) => ({
        row,
        rowNumber: index + 2
      }))
      .filter(item =>
        String(
          item.row[1] || ''
        ).trim().toLowerCase() ===
          username.toLowerCase() &&
        String(
          item.row[11] || ''
        ).trim() ===
          'تأیید شد'
      )
      .sort(
        (a, b) =>
          new Date(
            a.row[0] || 0
          ) -
          new Date(
            b.row[0] || 0
          )
      );

  if (!approved.length) {

    return {
      active: false,
      planId: '',
      planName: '',
      start: null,
      expiry: null
    };
  }

  let cursor = null;

  let activeStart = null;
  let activeExpiry = null;
  let activePlanId = '';
  let activePlanName = '';

  approved.forEach(item => {

    const paymentDate =
      new Date(
        item.row[0] ||
        Date.now()
      );

    const months =
      Number(
        planMonths[
          String(
            item.row[3] || ''
          )
        ] || 0
      );

    if (!months) {
      return;
    }

    const base =
      cursor &&
      cursor.getTime() >
        paymentDate.getTime()
        ? new Date(cursor)
        : new Date(paymentDate);

    const expiry =
      addMonths(
        base,
        months
      );

    if (
      !activeExpiry ||
      expiry.getTime() >=
        activeExpiry.getTime()
    ) {

      activeStart = base;

      activeExpiry =
        expiry;

      activePlanId =
        String(
          item.row[3] || ''
        );

      activePlanName =
        String(
          item.row[4] ||
          activePlanId
        );
    }

    cursor =
      expiry;
  });

  const now =
    new Date();

  const active =
    activeExpiry &&
    activeExpiry.getTime() >
      now.getTime();

  return {
    active: Boolean(active),

    planId:
      active
        ? activePlanId
        : '',

    planName:
      active
        ? activePlanName
        : '',

    start:
      active
        ? activeStart.toISOString()
        : null,

    expiry:
      active
        ? activeExpiry.toISOString()
        : null
  };
}

function addMonths(date, months) {

  const result =
    new Date(date);

  const day =
    result.getDate();

  result.setDate(1);

  result.setMonth(
    result.getMonth() +
    Number(months)
  );

  const lastDay =
    new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0
    ).getDate();

  result.setDate(
    Math.min(
      day,
      lastDay
    )
  );

  return result;
}

/* =========================================================
   EMAIL
========================================================= */

function sendReceiptEmail(
  data,
  amount,
  fileUrl,
  file
) {

  const adminEmail =
    getAdminEmail();

  if (!adminEmail) {
    return;
  }

  const subject =
    'QuizDuo | فیش پرداخت جدید | ' +
    data.username;

  const body = [
    'یک فیش پرداخت جدید در QuizDuo ثبت شد.',
    '',
    'نام کاربری: ' +
      data.username,

    'شماره تماس: ' +
      (data.phone || '-'),

    'پلن: ' +
      (data.planName || data.plan),

    'مبلغ: ' +
      amount.toLocaleString('fa-IR') +
      ' تومان',

    'کد تخفیف: ' +
      (data.discountCode || '-'),

    '',

    'لینک فایل فیش در Google Drive:',
    fileUrl,

    '',

    'وضعیت فعلی: در انتظار بررسی'
  ].join('\n');

  GmailApp.sendEmail(
    adminEmail,
    subject,
    body,
    {
      attachments: [
        file.getBlob()
      ]
    }
  );
}

function getAdminEmail() {

  const saved =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        'ADMIN_EMAIL'
      );

  if (saved) {
    return saved;
  }

  return (
    Session
      .getEffectiveUser()
      .getEmail() ||
    ''
  );
}

/* =========================================================
   DRIVE / SHEETS
========================================================= */

function getOrCreateReceiptFolder() {

  const folders =
    DriveApp.getFoldersByName(
      CONFIG.DRIVE_FOLDER_NAME
    );

  return folders.hasNext()
    ? folders.next()
    : DriveApp.createFolder(
        CONFIG.DRIVE_FOLDER_NAME
      );
}

function getOrCreateSpreadsheet() {

  const props =
    PropertiesService
      .getScriptProperties();

  let spreadsheetId =
    props.getProperty(
      'PAYMENTS_SPREADSHEET_ID'
    );

  let spreadsheet;

  if (spreadsheetId) {

    try {

      spreadsheet =
        SpreadsheetApp.openById(
          spreadsheetId
        );

    } catch (error) {

      spreadsheet = null;
    }
  }

  if (!spreadsheet) {

    spreadsheet =
      SpreadsheetApp.create(
        'QuizDuo Payments'
      );

    props.setProperty(
      'PAYMENTS_SPREADSHEET_ID',
      spreadsheet.getId()
    );
  }

  return spreadsheet;
}

function getOrCreateSheet() {

  const spreadsheet =
    getOrCreateSpreadsheet();

  let sheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEET_NAME
    );

  if (!sheet) {

    sheet =
      spreadsheet.insertSheet(
        CONFIG.SHEET_NAME
      );
  }

  ensureHeaders(
    sheet,
    PAYMENT_HEADERS
  );

  return sheet;
}

function getOrCreateSupportSheet() {

  const spreadsheet =
    getOrCreateSpreadsheet();

  let sheet =
    spreadsheet.getSheetByName(
      CONFIG.SUPPORT_SHEET_NAME
    );

  if (!sheet) {

    sheet =
      spreadsheet.insertSheet(
        CONFIG.SUPPORT_SHEET_NAME
      );
  }

  ensureHeaders(
    sheet,
    SUPPORT_HEADERS
  );

  return sheet;
}

function ensureHeaders(
  sheet,
  headers
) {

  const existingLastColumn =
    sheet.getLastColumn();

  const existing =
    existingLastColumn > 0
      ? sheet
          .getRange(
            1,
            1,
            1,
            existingLastColumn
          )
          .getValues()[0]
      : [];

  let changed = false;

  headers.forEach(
    (header, index) => {

      if (
        existing[index] !==
        header
      ) {

        sheet
          .getRange(
            1,
            index + 1
          )
          .setValue(header);

        changed = true;
      }
    }
  );

  if (
    changed ||
    sheet.getLastRow() === 0
  ) {

    sheet.setFrozenRows(1);
  }
}

function appendPaymentRow(row) {

  getOrCreateSheet()
    .appendRow(row);
}

/* =========================================================
   HELPERS
========================================================= */

function sanitizeFileName(value) {

  return String(
    value || 'user'
  )
    .replace(
      /[\\\/:*?"<>|]/g,
      '_'
    )
    .slice(
      0,
      60
    );
}

function jsonResponse(data) {

  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

/* =========================================================
   ADMIN AUTH
========================================================= */

function checkAdmin(password) {

  return String(
    password || ''
  ) ===
    CONFIG.ADMIN_PASSWORD;
}

/* =========================================================
   ADMIN PAYMENTS
========================================================= */

function getPaymentsForAdmin(password) {

  if (!checkAdmin(password)) {

    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const sheet =
    getOrCreateSheet();

  SpreadsheetApp.flush();

  const values =
    sheet.getDataRange()
      .getValues();

  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .map((row, index) => ({

      rowNumber:
        index + 2,

      timestamp:
        row[0]
          ? new Date(
              row[0]
            ).toISOString()
          : '',

      username:
        row[1] || '',

      phone:
        row[2] || '',

      planId:
        row[3] || '',

      planName:
        row[4] || '',

      originalAmount:
        row[5] || 0,

      amount:
        row[6] || 0,

      discountPercent:
        row[7] || 0,

      discountCode:
        row[8] || '',

      fileName:
        row[9] || '',

      receiptUrl:
        row[10] || '',

      status:
        row[11] ||
        'در انتظار بررسی',

      userMessage:
        row[12] || '',

      statusTimestamp:
        row[13]
          ? new Date(
              row[13]
            ).toISOString()
          : ''
    }))
    .reverse();
}

/* =========================================================
   ADMIN PAYMENT STATUS
========================================================= */

function updatePaymentStatus(
  password,
  rowNumber,
  status
) {

  if (!checkAdmin(password)) {

    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const allowed = [
    'تأیید شد',
    'رد شد',
    'در انتظار بررسی'
  ];

  if (!allowed.includes(status)) {

    throw new Error(
      'وضعیت نامعتبر است.'
    );
  }

  const sheet =
    getOrCreateSheet();

  const row =
    Number(rowNumber);

  const username =
    String(
      sheet
        .getRange(
          row,
          2
        )
        .getValue() ||
      ''
    );

  const planId =
    String(
      sheet
        .getRange(
          row,
          4
        )
        .getValue() ||
      ''
    );

  const now =
    new Date();

  let userMessage = '';

  if (
    status === 'تأیید شد'
  ) {

    userMessage =
      'پرداخت شما تأیید شد و اشتراک شما فعال شد. همه مراحل برای حساب شما باز شد.';

  } else if (
    status === 'رد شد'
  ) {

    userMessage =
      'پرداخت شما رد شد. در صورت بروز مشکل به آیدی @hv901 در بله پیام بدهید.';
  }

  sheet
    .getRange(
      row,
      12
    )
    .setValue(status);

  sheet
    .getRange(
      row,
      13
    )
    .setValue(userMessage);

  sheet
    .getRange(
      row,
      14
    )
    .setValue(now);

  SpreadsheetApp.flush();

  return {
    success: true,
    username,
    planId,
    status,
    userMessage
  };
}

/* =========================================================
   ADMIN SUPPORT
========================================================= */

function getSupportForAdmin(password) {

  if (!checkAdmin(password)) {

    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const sheet =
    getOrCreateSupportSheet();

  SpreadsheetApp.flush();

  const values =
    sheet.getDataRange()
      .getValues();

  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .map((row, index) => ({

      rowNumber:
        index + 2,

      timestamp:
        row[0]
          ? new Date(
              row[0]
            ).toISOString()
          : '',

      username:
        row[1] || '',

      phone:
        row[2] || '',

      subject:
        row[3] || '',

      message:
        row[4] || '',

      status:
        row[5] || 'جدید',

      adminReply:
        row[6] || '',

      replyTimestamp:
        row[7]
          ? new Date(
              row[7]
            ).toISOString()
          : '',

      conversationId:
        String(
          row[8] ||
          ('legacy-' +
            (index + 2))
        )
    }))
    .reverse();
}

/* =========================================================
   ADMIN REPLY
========================================================= */

function replyToSupport(
  password,
  rowNumber,
  reply,
  status
) {

  if (!checkAdmin(password)) {

    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const text =
    String(
      reply || ''
    ).trim();

  if (!text) {

    throw new Error(
      'متن پاسخ را وارد کنید.'
    );
  }

  const allowed = [
    'جدید',
    'در حال بررسی',
    'پاسخ داده شد',
    'بسته شد'
  ];

  const finalStatus =
    allowed.includes(status)
      ? status
      : 'پاسخ داده شد';

  const sheet =
    getOrCreateSupportSheet();

  const row =
    Number(rowNumber);

  sheet
    .getRange(
      row,
      6
    )
    .setValue(finalStatus);

  sheet
    .getRange(
      row,
      7
    )
    .setValue(text);

  sheet
    .getRange(
      row,
      8
    )
    .setValue(
      new Date()
    );

  SpreadsheetApp.flush();

  return {
    success: true,
    message:
      'پاسخ با موفقیت برای پنل کاربر ثبت شد.'
  };
}

/* =========================================================
   ADMIN SUPPORT STATUS
========================================================= */

function updateSupportStatus(
  password,
  rowNumber,
  status
) {

  if (!checkAdmin(password)) {

    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const allowed = [
    'جدید',
    'در حال بررسی',
    'پاسخ داده شد',
    'بسته شد'
  ];

  if (!allowed.includes(status)) {

    throw new Error(
      'وضعیت نامعتبر است.'
    );
  }

  const sheet =
    getOrCreateSupportSheet();

  sheet
    .getRange(
      Number(rowNumber),
      6
    )
    .setValue(status);

  SpreadsheetApp.flush();

  return {
    success: true
  };
}

/* =========================================================
   TEST EMAIL
========================================================= */

function testEmail() {

  GmailApp.sendEmail({
    to: getAdminEmail(),

    subject:
      'QuizDuo Test Email',

    htmlBody:
      '<div dir="rtl">' +
      '<h2>ایمیل تست QuizDuo</h2>' +
      '<p>ارسال ایمیل با موفقیت انجام شد.</p>' +
      '</div>'
  });
}
