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
  'Reply Timestamp'
];


/* =========================================================
   GET
========================================================= */

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};

    /* Admin panel */
    if (params.page === 'admin') {
      return HtmlService
        .createTemplateFromFile('Admin')
        .evaluate()
        .setTitle('QuizDuo Admin')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    /*
      JSONP:
      برای ارتباط پنل کاربر با Apps Script استفاده می‌شود
      تا مشکل CORS / Failed to fetch برای support و userUpdates
      ایجاد نشود.
    */

    const action = String(params.action || '').trim();
    const callback = String(params.callback || '').trim();

    let result;

    if (action === 'support') {
      result = handleSupport({
        username: params.username || '',
        phone: params.phone || '',
        subject: params.subject || '',
        message: params.message || ''
      });
    }

    else if (action === 'userUpdates') {
      result = getUserUpdates({
        username: params.username || ''
      });
    }

    else {
      result = {
        success: true,
        service: 'QuizDuo',
        time: new Date().toISOString()
      };
    }

    if (callback) {
      return jsonpResponse(callback, result);
    }

    return jsonResponse(result);

  } catch (error) {
    return jsonResponse({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
}


/* =========================================================
   POST
========================================================= */

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

    /*
      برای سازگاری با نسخه‌های قدیمی:
      support و userUpdates اگر با POST هم ارسال شوند
      همچنان کار می‌کنند.
    */
    if (data.action === 'support') {
      return handleSupport(data);
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
  const code = String(data.code || '')
    .trim()
    .toUpperCase();

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

  const timestamp = new Date();

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
   SUPPORT
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
    return {
      success: false,
      message:
        'برای ارسال درخواست پشتیبانی ابتدا وارد حساب شوید.'
    };
  }

  if (!subject || !message) {
    return {
      success: false,
      message:
        'موضوع و پیام را وارد کنید.'
    };
  }

  const sheet =
    getOrCreateSupportSheet();

  const timestamp = new Date();

  sheet.appendRow([
    timestamp,
    username,
    phone,
    subject,
    message,
    'جدید',
    '',
    ''
  ]);

  const rowNumber =
    sheet.getLastRow();

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

  return {
    success: true,
    rowNumber,

    message: emailSent
      ? 'درخواست پشتیبانی با موفقیت ارسال شد.'
      : 'درخواست پشتیبانی ثبت شد.',

    emailSent,
    emailError
  };
}


/* =========================================================
   USER UPDATES
========================================================= */

function getUserUpdates(data) {

  const username =
    String(data.username || '').trim();

  if (
    !username ||
    username === 'بازیکن مهمان'
  ) {
    return {
      success: true,
      payments: [],
      support: []
    };
  }

  const payments =
    getUserPaymentUpdates(username);

  const support =
    getUserSupportUpdates(username);

  return {
    success: true,
    payments,
    support
  };
}


/* =========================================================
   USER PAYMENT DATA
========================================================= */

function getUserPaymentUpdates(username) {

  const sheet =
    getOrCreateSheet();

  const values =
    sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .map((row, index) => ({

      rowNumber: index + 2,

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
   USER SUPPORT DATA
========================================================= */

function getUserSupportUpdates(username) {

  const sheet =
    getOrCreateSupportSheet();

  const values =
    sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .map((row, index) => ({

      rowNumber: index + 2,

      timestamp:
        row[0]
          ? new Date(row[0]).toISOString()
          : '',

      username:
        String(row[1] || ''),

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
          ? new Date(row[7]).toISOString()
          : ''

    }))
    .filter(item =>
      item.username.toLowerCase() ===
      username.toLowerCase()
    )
    .reverse();
}


/* =========================================================
   EMAIL ADMIN
========================================================= */

function sendReceiptEmail(
  data,
  amount,
  fileUrl,
  file
) {

  const adminEmail =
    getAdminEmail();

  if (!adminEmail) return;

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


/* =========================================================
   ADMIN EMAIL
========================================================= */

function getAdminEmail() {

  const saved =
    PropertiesService
      .getScriptProperties()
      .getProperty('ADMIN_EMAIL');

  if (saved) return saved;

  return (
    Session
      .getEffectiveUser()
      .getEmail() || ''
  );
}


/* =========================================================
   DRIVE
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


/* =========================================================
   SPREADSHEET
========================================================= */

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


/* =========================================================
   PAYMENT SHEET
========================================================= */

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


/* =========================================================
   SUPPORT SHEET
========================================================= */

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


/* =========================================================
   HEADERS
========================================================= */

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

      if (existing[index] !== header) {

        sheet
          .getRange(1, index + 1)
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


/* =========================================================
   APPEND PAYMENT
========================================================= */

function appendPaymentRow(row) {

  getOrCreateSheet()
    .appendRow(row);
}


/* =========================================================
   FILE NAME
========================================================= */

function sanitizeFileName(value) {

  return String(
    value || 'user'
  )
    .replace(
      /[\\/:*?"<>|]/g,
      '_'
    )
    .slice(0, 60);
}


/* =========================================================
   JSON
========================================================= */

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
   JSONP
========================================================= */

function jsonpResponse(
  callback,
  data
) {

  /*
    callback فقط باید یک identifier ساده باشد.
    هیچ کد دلخواهی از کاربر اجرا نمی‌شود.
  */

  if (
    !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(
      callback
    )
  ) {

    return jsonResponse({
      success: false,
      message: 'Callback نامعتبر است.'
    });
  }

  return ContentService
    .createTextOutput(
      callback +
      '(' +
      JSON.stringify(data) +
      ');'
    )
    .setMimeType(
      ContentService.MimeType.JAVASCRIPT
    );
}


/* =========================================================
   ADMIN AUTH
========================================================= */

function checkAdmin(password) {

  return String(password || '') ===
    CONFIG.ADMIN_PASSWORD;
}


/* =========================================================
   ADMIN PAYMENTS
========================================================= */

function getPaymentsForAdmin(
  password
) {

  if (!checkAdmin(password)) {
    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const sheet =
    getOrCreateSheet();

  const values =
    sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .map((row, index) => ({

      rowNumber: index + 2,

      timestamp:
        row[0]
          ? new Date(row[0]).toISOString()
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
          ? new Date(row[13]).toISOString()
          : ''

    }))
    .reverse();
}


/* =========================================================
   UPDATE PAYMENT STATUS
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

  if (
    !Number.isInteger(row) ||
    row < 2 ||
    row > sheet.getLastRow()
  ) {
    throw new Error(
      'ردیف پرداخت نامعتبر است.'
    );
  }

  const username =
    String(
      sheet
        .getRange(row, 2)
        .getValue() || ''
    );

  const planId =
    String(
      sheet
        .getRange(row, 4)
        .getValue() || ''
    );

  const planName =
    String(
      sheet
        .getRange(row, 5)
        .getValue() || ''
    );

  const now =
    new Date();

  let userMessage = '';

  /*
    این پیام‌ها در پنل ADMIN نمایش داده نمی‌شوند.
    آنها در ستون User Message ذخیره می‌شوند
    و فقط getUserPaymentUpdates آنها را
    برای همان username برمی‌گرداند.
  */

  if (status === 'تأیید شد') {

    userMessage =
      'پرداخت شما تأیید شد و اشتراک شما فعال شد.';

  }

  else if (status === 'رد شد') {

    userMessage =
      'پرداخت شما رد شد. در صورت بروز مشکل به آیدی @hv901 در بله پیام بدهید.';

  }

  sheet
    .getRange(row, 12)
    .setValue(status);

  sheet
    .getRange(row, 13)
    .setValue(userMessage);

  sheet
    .getRange(row, 14)
    .setValue(now);

  return {

    success: true,

    username,

    planId,

    planName,

    status,

    userMessage
  };
}


/* =========================================================
   ADMIN SUPPORT
========================================================= */

function getSupportForAdmin(
  password
) {

  if (!checkAdmin(password)) {
    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const sheet =
    getOrCreateSupportSheet();

  const values =
    sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .map((row, index) => ({

      rowNumber: index + 2,

      timestamp:
        row[0]
          ? new Date(row[0]).toISOString()
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
          ? new Date(row[7]).toISOString()
          : ''

    }))
    .reverse();
}


/* =========================================================
   REPLY SUPPORT
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
    String(reply || '').trim();

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

  if (
    !Number.isInteger(row) ||
    row < 2 ||
    row > sheet.getLastRow()
  ) {
    throw new Error(
      'ردیف پشتیبانی نامعتبر است.'
    );
  }

  sheet
    .getRange(row, 6)
    .setValue(finalStatus);

  sheet
    .getRange(row, 7)
    .setValue(text);

  sheet
    .getRange(row, 8)
    .setValue(new Date());

  return {
    success: true,
    message:
      'پاسخ برای پنل کاربر ثبت شد.'
  };
}


/* =========================================================
   SUPPORT STATUS
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
    .getRange(Number(rowNumber), 6)
    .setValue(status);

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
