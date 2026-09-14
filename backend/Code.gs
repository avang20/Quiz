const CONFIG = {
  SHEET_NAME: 'Payments',
  SUPPORT_SHEET_NAME: 'Support',
  DRIVE_FOLDER_NAME: 'QuizDuo Receipts',

  ADMIN_EMAIL: 'hvasei90@gmail.com',

  PRIVATE_TEST_CODE: 'QDZ-100K-HASTI',
  TEST_AMOUNT: 100000,

  MAX_RECEIPT_BYTES: 5 * 1024 * 1024,

  ADMIN_PASSWORD: 'CHANGE_THIS_ADMIN_PASSWORD'
};


/* =========================
   WEB APP
========================= */

function doGet(e) {
  const page =
    e &&
    e.parameter &&
    e.parameter.page;

  if (page === 'admin') {
    return HtmlService
      .createTemplateFromFile('Admin')
      .evaluate()
      .setTitle('QuizDuo Admin')
      .setXFrameOptionsMode(
        HtmlService.XFrameOptionsMode.ALLOWALL
      );
  }

  return jsonResponse({
    success: true,
    service: 'QuizDuo',
    message: 'QuizDuo API is running.'
  });
}


function doPost(e) {
  try {
    const body =
      e &&
      e.postData &&
      e.postData.contents;

    if (!body) {
      return jsonResponse({
        success: false,
        message: 'درخواست خالی است.'
      });
    }

    const data =
      JSON.parse(body);

    const action =
      String(data.action || '')
        .trim();

    if (action === 'payment') {
      return handlePayment(data);
    }

    if (action === 'validateDiscount') {
      return validateDiscount(data);
    }

    if (action === 'support') {
      return handleSupport(data);
    }

    return jsonResponse({
      success: false,
      message: 'عملیات ناشناخته است.'
    });

  } catch (error) {
    console.error(error);

    return jsonResponse({
      success: false,
      message:
        'خطای سرور: ' +
        error.message
    });
  }
}


/* =========================
   DISCOUNT
========================= */

function validateDiscount(data) {
  const code =
    String(data.code || '')
      .trim()
      .toUpperCase();

  const plan =
    String(data.plan || '');

  const valid =
    code === CONFIG.PRIVATE_TEST_CODE &&
    plan === 'nineMonth';

  return jsonResponse({
    success: true,
    testCodeApplied: valid,
    amount:
      valid
        ? CONFIG.TEST_AMOUNT
        : null
  });
}


/* =========================
   PAYMENT
========================= */

function handlePayment(data) {

  if (
    !data.username ||
    !data.plan ||
    !data.receiptBase64
  ) {
    return jsonResponse({
      success: false,
      message:
        'اطلاعات پرداخت کامل نیست.'
    });
  }

  const base64 =
    String(data.receiptBase64);

  const estimatedBytes =
    Math.floor(
      base64.length * 0.75
    );

  if (
    estimatedBytes >
    CONFIG.MAX_RECEIPT_BYTES
  ) {
    return jsonResponse({
      success: false,
      message:
        'حجم فیش بیشتر از ۵ مگابایت است.'
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
      message:
        'پلن نامعتبر است.'
    });
  }

  const originalAmount =
    Number(
      planPrices[data.plan]
    );

  let amount =
    Number(
      data.amount ||
      originalAmount
    );

  let testCodeApplied = false;

  const discountCode =
    String(
      data.discountCode || ''
    )
      .trim()
      .toUpperCase();

  if (
    discountCode ===
      CONFIG.PRIVATE_TEST_CODE &&
    data.plan === 'nineMonth'
  ) {
    amount =
      CONFIG.TEST_AMOUNT;

    testCodeApplied = true;
  }

  const mimeType =
    data.mimeType ||
    'image/jpeg';

  const fileName =
    data.fileName ||
    ('receipt_' +
      Date.now() +
      '.jpg');

  const bytes =
    Utilities.base64Decode(
      base64
    );

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
    sanitizeFileName(
      data.username
    ) +
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
    Number(
      data.discountPercent || 0
    ),
    discountCode,
    fileName,
    fileUrl,
    'در انتظار بررسی'
  ];

  appendPaymentRow(row);

  let emailSent = false;
  let emailError = '';

  try {
    sendReceiptEmail(
      data,
      amount,
      fileUrl,
      savedFile
    );

    emailSent = true;

  } catch (error) {
    console.error(error);
    emailError = error.message;
  }

  return jsonResponse({
    success: true,
    testCodeApplied,
    emailSent,
    emailError,

    message:
      emailSent
        ? (
            testCodeApplied
              ? 'فیش دریافت شد و ایمیل اطلاع‌رسانی نیز ارسال شد.'
              : 'فیش با موفقیت برای بررسی ارسال شد.'
          )
        : (
            'فیش ذخیره شد، اما ایمیل ارسال نشد. ' +
            'مجوز ارسال ایمیل Apps Script را بررسی کنید.'
          )
  });
}


/* =========================
   PAYMENT EMAIL
========================= */

function sendReceiptEmail(
  data,
  amount,
  fileUrl,
  file
) {
  const adminEmail =
    CONFIG.ADMIN_EMAIL;

  if (!adminEmail) {
    throw new Error(
      'آدرس ایمیل مدیریت مشخص نشده است.'
    );
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
      (data.planName ||
        data.plan),

    'مبلغ: ' +
      amount.toLocaleString(
        'fa-IR'
      ) +
      ' تومان',

    'کد تخفیف: ' +
      (data.discountCode || '-'),

    '',
    'لینک فایل فیش در Google Drive:',
    fileUrl,

    '',
    'وضعیت فعلی: در انتظار بررسی'
  ].join('\n');

  MailApp.sendEmail({
    to: adminEmail,
    subject: subject,
    body: body,
    attachments: [
      file.getBlob()
    ]
  });
}


/* =========================
   SUPPORT
========================= */

function handleSupport(data) {

  const username =
    String(
      data.username || 'بازیکن مهمان'
    ).trim();

  const phone =
    String(
      data.phone || ''
    ).trim();

  const subject =
    String(
      data.subject || ''
    ).trim();

  const message =
    String(
      data.message ||
      data.text ||
      ''
    ).trim();

  if (!subject) {
    return jsonResponse({
      success: false,
      message:
        'موضوع پشتیبانی را وارد کنید.'
    });
  }

  if (!message) {
    return jsonResponse({
      success: false,
      message:
        'متن پیام پشتیبانی را وارد کنید.'
    });
  }

  const timestamp =
    new Date();

  const row = [
    timestamp,
    username,
    phone,
    subject,
    message,
    'جدید'
  ];

  appendSupportRow(row);

  let emailSent = false;
  let emailError = '';

  try {
    sendSupportEmail({
      username,
      phone,
      subject,
      message,
      timestamp
    });

    emailSent = true;

  } catch (error) {
    console.error(error);
    emailError = error.message;
  }

  return jsonResponse({
    success: true,
    emailSent,
    emailError,

    message:
      emailSent
        ? 'درخواست پشتیبانی با موفقیت ارسال شد.'
        : 'درخواست شما ثبت شد، اما ایمیل ارسال نشد. مجوز ارسال ایمیل را بررسی کنید.'
  });
}


function sendSupportEmail(data) {

  const adminEmail =
    CONFIG.ADMIN_EMAIL;

  if (!adminEmail) {
    throw new Error(
      'آدرس ایمیل مدیریت مشخص نشده است.'
    );
  }

  const subject =
    'QuizDuo | پشتیبانی | ' +
    data.subject;

  const body = [
    'یک درخواست پشتیبانی جدید در QuizDuo ثبت شده است.',
    '',
    'نام کاربری: ' +
      data.username,

    'شماره تماس: ' +
      (data.phone || '-'),

    'موضوع: ' +
      data.subject,

    '',
    'متن پیام:',
    data.message,

    '',
    'زمان ثبت:',
    data.timestamp
      .toLocaleString('fa-IR')
  ].join('\n');

  MailApp.sendEmail({
    to: adminEmail,
    subject: subject,
    body: body
  });
}


/* =========================
   DRIVE
========================= */

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


/* =========================
   PAYMENTS SHEET
========================= */

function getOrCreateSheet() {

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

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
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
      'Status'
    ]);
  }

  return sheet;
}


function appendPaymentRow(row) {
  getOrCreateSheet()
    .appendRow(row);
}


/* =========================
   SUPPORT SHEET
========================= */

function getOrCreateSupportSheet() {

  const props =
    PropertiesService
      .getScriptProperties();

  let spreadsheetId =
    props.getProperty(
      'SUPPORT_SPREADSHEET_ID'
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
        'QuizDuo Support'
      );

    props.setProperty(
      'SUPPORT_SPREADSHEET_ID',
      spreadsheet.getId()
    );
  }

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

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Timestamp',
      'Username',
      'Phone',
      'Subject',
      'Message',
      'Status'
    ]);
  }

  return sheet;
}


function appendSupportRow(row) {
  getOrCreateSupportSheet()
    .appendRow(row);
}


/* =========================
   HELPERS
========================= */

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


function jsonResponse(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


/* =========================
   EMAIL TEST
========================= */

function testEmail() {

  MailApp.sendEmail({
    to: CONFIG.ADMIN_EMAIL,
    subject:
      'QuizDuo | تست ارسال ایمیل',
    body:
      'اگر این ایمیل را دریافت کردی، مجوز ارسال ایمیل Apps Script به‌درستی فعال شده است.'
  });

  return 'ایمیل تست ارسال شد.';
}


/* =========================
   ADMIN
========================= */

function checkAdmin(password) {
  return String(password || '') ===
    CONFIG.ADMIN_PASSWORD;
}


function getPaymentsForAdmin(password) {

  if (!checkAdmin(password)) {
    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const sheet =
    getOrCreateSheet();

  const values =
    sheet.getDataRange()
      .getValues();

  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,
      timestamp:
        row[0]
          ? new Date(
              row[0]
            ).toISOString()
          : '',
      username: row[1] || '',
      phone: row[2] || '',
      planId: row[3] || '',
      planName: row[4] || '',
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
        row[11] || ''
    }));
}


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

  sheet
    .getRange(
      Number(rowNumber),
      12
    )
    .setValue(status);

  return {
    success: true
  };
}


function getSupportForAdmin(password) {

  if (!checkAdmin(password)) {
    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const sheet =
    getOrCreateSupportSheet();

  const values =
    sheet.getDataRange()
      .getValues();

  if (values.length <= 1) {
    return [];
  }

  return values
    .slice(1)
    .map((row, index) => ({
      rowNumber: index + 2,

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
        row[5] || ''
    }));
}


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

  return {
    success: true
  };
}
