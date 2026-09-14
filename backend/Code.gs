
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


// ============================================================
// GET
// ============================================================

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
    service: 'QuizDuo'
  });
}


// ============================================================
// POST
// ============================================================

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

    switch (data.action) {

      case 'payment':
        return handlePayment(data);

      case 'validateDiscount':
        return validateDiscount(data);

      case 'support':
        return handleSupport(data);

      case 'getUserUpdates':
        return getUserUpdates(data);

      default:
        return jsonResponse({
          success: false,
          message: 'عملیات ناشناخته است.'
        });
    }

  } catch (error) {
    console.error(error);

    return jsonResponse({
      success: false,
      message: 'خطای سرور: ' + error.message
    });
  }
}


// ============================================================
// DISCOUNT
// ============================================================

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


// ============================================================
// PAYMENT
// ============================================================

function handlePayment(data) {

  if (!data.username || !data.plan || !data.receiptBase64) {
    return jsonResponse({
      success: false,
      message: 'اطلاعات پرداخت کامل نیست.'
    });
  }

  const planPrices = {
    monthly: 100000,
    quarterly: 270000,
    sixMonth: 480000,
    nineMonth: 660000
  };

  if (!Object.prototype.hasOwnProperty.call(planPrices, data.plan)) {
    return jsonResponse({
      success: false,
      message: 'پلن نامعتبر است.'
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

  const originalAmount = Number(planPrices[data.plan]);

  let amount =
    Number(data.amount || originalAmount);

  let testCodeApplied = false;

  if (
    String(data.discountCode || '').trim().toUpperCase() ===
      CONFIG.PRIVATE_TEST_CODE &&
    data.plan === 'nineMonth'
  ) {
    amount = CONFIG.TEST_AMOUNT;
    testCodeApplied = true;
  }

  const mimeType =
    data.mimeType || 'image/jpeg';

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
    ''
  ];

  appendPaymentRow(row);

  try {
    sendReceiptEmail(
      data,
      amount,
      fileUrl,
      savedFile
    );
  } catch (emailError) {
    console.error(
      'Payment email error:',
      emailError
    );
  }

  return jsonResponse({
    success: true,
    testCodeApplied,
    message: testCodeApplied
      ? 'فیش دریافت شد و کد تست خصوصی نیز تأیید شد.'
      : 'فیش با موفقیت برای بررسی ارسال شد.'
  });
}


// ============================================================
// PAYMENT EMAIL TO ADMIN
// ============================================================

function sendReceiptEmail(
  data,
  amount,
  fileUrl,
  file
) {

  const adminEmail =
    CONFIG.ADMIN_EMAIL;

  if (!adminEmail) return;

  const subject =
    'QuizDuo | فیش پرداخت جدید | ' +
    data.username;

  const body = [
    'یک فیش پرداخت جدید در QuizDuo ثبت شد.',
    '',
    'نام کاربری: ' + data.username,
    'شماره تماس: ' + (data.phone || '-'),
    'پلن: ' + (data.planName || data.plan),
    'مبلغ: ' +
      amount.toLocaleString('fa-IR') +
      ' تومان',
    'کد تخفیف: ' +
      (data.discountCode || '-'),
    '',
    'لینک فایل فیش:',
    fileUrl,
    '',
    'وضعیت: در انتظار بررسی'
  ].join('\n');

  MailApp.sendEmail({
    to: adminEmail,
    subject: subject,
    body: body,
    attachments: [file.getBlob()]
  });
}


// ============================================================
// SUPPORT
// ============================================================

function handleSupport(data) {

  const username =
    String(data.username || '').trim();

  const subject =
    String(data.subject || '').trim();

  const text =
    String(data.text || '').trim();

  const phone =
    String(data.phone || '').trim();

  if (!username || !subject || !text) {
    return jsonResponse({
      success: false,
      message: 'موضوع و پیام را وارد کنید.'
    });
  }

  const sheet =
    getOrCreateSupportSheet();

  sheet.appendRow([
    new Date(),
    username,
    phone,
    subject,
    text,
    'جدید',
    '',
    ''
  ]);

  try {
    MailApp.sendEmail({
      to: CONFIG.ADMIN_EMAIL,
      subject:
        'QuizDuo | درخواست پشتیبانی | ' +
        username,
      body: [
        'یک درخواست پشتیبانی جدید دریافت شد.',
        '',
        'نام کاربری: ' + username,
        'شماره تماس: ' + (phone || '-'),
        'موضوع: ' + subject,
        '',
        text,
        '',
        'برای پاسخ، وارد پنل مدیریت QuizDuo شوید.'
      ].join('\n')
    });
  } catch (error) {
    console.error(
      'Support email error:',
      error
    );
  }

  return jsonResponse({
    success: true,
    message:
      'درخواست پشتیبانی با موفقیت ارسال شد.'
  });
}


// ============================================================
// USER UPDATES
// ============================================================

function getUserUpdates(data) {

  const username =
    String(data.username || '').trim();

  if (!username) {
    return jsonResponse({
      success: false,
      message: 'نام کاربری ارسال نشده است.'
    });
  }

  const paymentUpdates =
    getUserPaymentUpdates(username);

  const supportUpdates =
    getUserSupportUpdates(username);

  return jsonResponse({
    success: true,
    payments: paymentUpdates,
    support: supportUpdates
  });
}


// ============================================================
// USER PAYMENT STATUS
// ============================================================

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
    .filter(row =>
      String(row[1] || '').toLowerCase() ===
      username.toLowerCase()
    )
    .map((row, index) => {

      const status =
        String(row[11] || '');

      let message = '';

      if (status === 'تأیید شد') {
        message =
          'پرداخت شما تأیید شد و اشتراک شما فعال شد.';
      }

      if (status === 'رد شد') {
        message =
          'پرداخت شما رد شد. در صورت بروز مشکل به آیدی @hv901 در بله پیام بدهید.';
      }

      if (status === 'در انتظار بررسی') {
        message =
          'فیش پرداخت شما دریافت شده و در انتظار بررسی است.';
      }

      return {
        rowNumber: index + 2,
        timestamp:
          row[0] ?
          new Date(row[0]).toISOString() :
          '',
        planId: row[3] || '',
        planName: row[4] || '',
        amount: row[6] || 0,
        status: status,
        message: message
      };
    });
}


// ============================================================
// USER SUPPORT STATUS / REPLIES
// ============================================================

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
    .filter(row =>
      String(row[1] || '').toLowerCase() ===
      username.toLowerCase()
    )
    .map((row, index) => {

      return {
        rowNumber: index + 2,
        timestamp:
          row[0] ?
          new Date(row[0]).toISOString() :
          '',
        subject: row[3] || '',
        text: row[4] || '',
        status: row[5] || '',
        reply: row[6] || '',
        repliedAt:
          row[7] ?
          new Date(row[7]).toISOString() :
          ''
      };
    });
}


// ============================================================
// DRIVE
// ============================================================

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


// ============================================================
// PAYMENTS SHEET
// ============================================================

function getOrCreateSheet() {

  const props =
    PropertiesService.getScriptProperties();

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
      'Status',
      'Admin Message'
    ]);
  }

  return sheet;
}


function appendPaymentRow(row) {
  getOrCreateSheet().appendRow(row);
}


// ============================================================
// SUPPORT SHEET
// ============================================================

function getOrCreateSupportSheet() {

  const props =
    PropertiesService.getScriptProperties();

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
      'Status',
      'Admin Reply',
      'Reply Time'
    ]);
  }

  return sheet;
}


// ============================================================
// ADMIN AUTH
// ============================================================

function checkAdmin(password) {

  return String(password || '') ===
    CONFIG.ADMIN_PASSWORD;
}


// ============================================================
// ADMIN - PAYMENTS
// ============================================================

function getPaymentsForAdmin(password) {

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
    .map((row, index) => {

      return {
        rowNumber: index + 2,

        timestamp:
          row[0] ?
          new Date(row[0]).toISOString() :
          '',

        username: row[1] || '',
        phone: row[2] || '',
        planId: row[3] || '',
        planName: row[4] || '',
        originalAmount: row[5] || 0,
        amount: row[6] || 0,
        discountPercent: row[7] || 0,
        discountCode: row[8] || '',
        fileName: row[9] || '',
        receiptUrl: row[10] || '',
        status: row[11] || '',
        adminMessage: row[12] || ''
      };
    });
}


// ============================================================
// ADMIN - UPDATE PAYMENT
// ============================================================

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
      sheet.getRange(row, 2).getValue()
    );

  const planName =
    String(
      sheet.getRange(row, 5).getValue()
    );

  let message = '';

  if (status === 'تأیید شد') {

    message =
      'پرداخت شما تأیید شد و اشتراک ' +
      planName +
      ' برای شما فعال شد.';

    sheet
      .getRange(row, 13)
      .setValue(message);
  }

  if (status === 'رد شد') {

    message =
      'پرداخت شما رد شد. در صورت بروز مشکل به آیدی @hv901 در بله پیام بدهید.';

    sheet
      .getRange(row, 13)
      .setValue(message);
  }

  if (status === 'در انتظار بررسی') {

    message =
      'فیش پرداخت شما در انتظار بررسی است.';

    sheet
      .getRange(row, 13)
      .setValue(message);
  }

  sheet
    .getRange(row, 12)
    .setValue(status);

  return {
    success: true,
    username: username,
    status: status,
    message: message
  };
}


// ============================================================
// ADMIN - SUPPORT
// ============================================================

function getSupportForAdmin(password) {

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
    .map((row, index) => {

      return {
        rowNumber: index + 2,

        timestamp:
          row[0] ?
          new Date(row[0]).toISOString() :
          '',

        username: row[1] || '',
        phone: row[2] || '',
        subject: row[3] || '',
        text: row[4] || '',
        status: row[5] || '',
        reply: row[6] || '',

        repliedAt:
          row[7] ?
          new Date(row[7]).toISOString() :
          ''
      };
    });
}


// ============================================================
// ADMIN - SUPPORT STATUS
// ============================================================

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


// ============================================================
// ADMIN - REPLY SUPPORT
// ============================================================

function replyToSupport(
  password,
  rowNumber,
  replyText
) {

  if (!checkAdmin(password)) {
    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const reply =
    String(replyText || '').trim();

  if (!reply) {
    throw new Error(
      'متن پاسخ خالی است.'
    );
  }

  const sheet =
    getOrCreateSupportSheet();

  const row =
    Number(rowNumber);

  const username =
    String(
      sheet.getRange(row, 2).getValue()
    );

  sheet
    .getRange(row, 6)
    .setValue('پاسخ داده شد');

  sheet
    .getRange(row, 7)
    .setValue(reply);

  sheet
    .getRange(row, 8)
    .setValue(new Date());

  return {
    success: true,
    username: username,
    message:
      'پاسخ با موفقیت ثبت شد.'
  };
}


// ============================================================
// ADMIN TEST
// ============================================================

function testEmail() {

  MailApp.sendEmail({
    to: CONFIG.ADMIN_EMAIL,
    subject: 'QuizDuo | تست ایمیل',
    body:
      'اگر این ایمیل را دریافت کردید، ارسال ایمیل QuizDuo فعال است.'
  });

  return 'Email sent successfully.';
}


// ============================================================
// UTILITIES
// ============================================================

function sanitizeFileName(value) {

  return String(value || 'user')
    .replace(/[\\/:*?"<>|]/g, '_')
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
