const CONFIG = {
  SHEET_NAME: 'Payments',
  SUPPORT_SHEET_NAME: 'Support',
  DRIVE_FOLDER_NAME: 'QuizDuo Receipts',

  ADMIN_EMAIL: 'hvasei90@gmail.com',

  PRIVATE_TEST_CODE: 'QDZ-100K-HASTI',
  TEST_AMOUNT: 100000,

  MAX_RECEIPT_BYTES: 5 * 1024 * 1024,

  // رمز ورود پنل ادمین را اینجا عوض کن.
  ADMIN_PASSWORD: 'CHANGE_THIS_ADMIN_PASSWORD'
};


// =========================================================
// GET
// =========================================================

function doGet(e) {
  const page = e && e.parameter && e.parameter.page;

  if (page === 'admin') {
    return HtmlService
      .createTemplateFromFile('Admin')
      .evaluate()
      .setTitle('QuizDuo Admin')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return ContentService
    .createTextOutput(
      JSON.stringify({
        success: true,
        service: 'QuizDuo'
      })
    )
    .setMimeType(ContentService.MimeType.JSON);
}


// =========================================================
// POST
// =========================================================

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

    if (data.action === 'paymentStatus') {
      return getPaymentStatusForUser(data);
    }

    if (data.action === 'supportList') {
      return getSupportForUser(data);
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


// =========================================================
// DISCOUNT
// =========================================================

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


// =========================================================
// PAYMENT
// =========================================================

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
    'در انتظار بررسی'
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
      'Receipt email error:',
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


// =========================================================
// PAYMENT EMAIL TO ADMIN
// =========================================================

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
    'لینک فایل فیش:',
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


// =========================================================
// ADMIN EMAIL
// =========================================================

function getAdminEmail() {
  const saved =
    PropertiesService
      .getScriptProperties()
      .getProperty('ADMIN_EMAIL');

  if (saved) return saved;

  return CONFIG.ADMIN_EMAIL;
}


// =========================================================
// DRIVE
// =========================================================

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


// =========================================================
// PAYMENT SHEET
// =========================================================

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


// =========================================================
// PAYMENT ADMIN
// =========================================================

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
        row[11] || ''
    }));
}


// =========================================================
// UPDATE PAYMENT STATUS
// =========================================================

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


  sheet
    .getRange(row, 12)
    .setValue(status);


  return {
    success: true
  };
}


// =========================================================
// GET LATEST PAYMENT STATUS FOR USER
// =========================================================

function getPaymentStatusForUser(data) {
  const username =
    String(data.username || '')
      .trim();


  if (!username) {
    return jsonResponse({
      success: false,
      message: 'نام کاربری ارسال نشده است.'
    });
  }


  const sheet =
    getOrCreateSheet();

  const values =
    sheet.getDataRange().getValues();


  if (values.length <= 1) {
    return jsonResponse({
      success: true,
      found: false
    });
  }


  for (
    let i = values.length - 1;
    i >= 1;
    i--
  ) {
    const row =
      values[i];

    const rowUsername =
      String(row[1] || '')
        .trim()
        .toLowerCase();


    if (
      rowUsername ===
      username.toLowerCase()
    ) {
      return jsonResponse({
        success: true,
        found: true,

        status:
          row[11] || '',

        planId:
          row[3] || '',

        planName:
          row[4] || '',

        amount:
          row[6] || 0,

        timestamp:
          row[0]
            ? new Date(row[0]).toISOString()
            : ''
      });
    }
  }


  return jsonResponse({
    success: true,
    found: false
  });
}


// =========================================================
// SUPPORT SHEET
// =========================================================

function getOrCreateSupportSheet() {
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
      'Subject',
      'Message',
      'Admin Reply',
      'Status',
      'Reply Timestamp'
    ]);
  }


  return sheet;
}


// =========================================================
// CREATE SUPPORT TICKET
// =========================================================

function createSupportTicket(data) {
  const username =
    String(data.username || '').trim();

  const subject =
    String(data.subject || '').trim();

  const message =
    String(data.message || '').trim();


  if (
    !username ||
    !subject ||
    !message
  ) {
    throw new Error(
      'اطلاعات پشتیبانی کامل نیست.'
    );
  }


  const sheet =
    getOrCreateSupportSheet();


  sheet.appendRow([
    new Date(),
    username,
    subject,
    message,
    '',
    'جدید',
    ''
  ]);


  try {
    MailApp.sendEmail(
      getAdminEmail(),
      'QuizDuo | درخواست پشتیبانی | ' +
        username,
      [
        'درخواست پشتیبانی جدید:',
        '',
        'نام کاربری: ' + username,
        'موضوع: ' + subject,
        '',
        message
      ].join('\n')
    );
  } catch (error) {
    console.error(
      'Support notification error:',
      error
    );
  }


  return {
    success: true
  };
}


// =========================================================
// SUPPORT LIST FOR USER
// =========================================================

function getSupportForUser(data) {
  const username =
    String(data.username || '')
      .trim();


  if (!username) {
    return jsonResponse({
      success: false,
      message: 'نام کاربری ارسال نشده است.'
    });
  }


  const sheet =
    getOrCreateSupportSheet();

  const values =
    sheet.getDataRange().getValues();


  if (values.length <= 1) {
    return jsonResponse({
      success: true,
      tickets: []
    });
  }


  const tickets = [];


  values
    .slice(1)
    .forEach((row, index) => {
      if (
        String(row[1] || '')
          .trim()
          .toLowerCase() !==
        username.toLowerCase()
      ) {
        return;
      }


      tickets.push({
        rowNumber: index + 2,

        timestamp:
          row[0]
            ? new Date(row[0]).toISOString()
            : '',

        username:
          row[1] || '',

        subject:
          row[2] || '',

        message:
          row[3] || '',

        reply:
          row[4] || '',

        status:
          row[5] || 'جدید',

        replyTimestamp:
          row[6]
            ? new Date(row[6]).toISOString()
            : ''
      });
    });


  return jsonResponse({
    success: true,
    tickets
  });
}


// =========================================================
// SUPPORT ADMIN
// =========================================================

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
    .map((row, index) => ({
      rowNumber: index + 2,

      timestamp:
        row[0]
          ? new Date(row[0]).toISOString()
          : '',

      username:
        row[1] || '',

      subject:
        row[2] || '',

      message:
        row[3] || '',

      reply:
        row[4] || '',

      status:
        row[5] || 'جدید',

      replyTimestamp:
        row[6]
          ? new Date(row[6]).toISOString()
          : ''
    }));
}


// =========================================================
// SEND SUPPORT REPLY
// =========================================================

function sendSupportReply(
  password,
  rowNumber,
  reply
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


  const subject =
    String(
      sheet.getRange(row, 3).getValue()
    );


  sheet
    .getRange(row, 5)
    .setValue(text);


  sheet
    .getRange(row, 6)
    .setValue('پاسخ داده شد');


  sheet
    .getRange(row, 7)
    .setValue(new Date());


  // اطلاع‌رسانی به ادمین/صندوق ایمیل ثبت‌شده
  // پاسخ اصلی داخل حساب کاربر نمایش داده می‌شود.
  try {
    MailApp.sendEmail(
      getAdminEmail(),
      'QuizDuo | پاسخ پشتیبانی ثبت شد | ' +
        username,
      [
        'پاسخ پشتیبانی برای کاربر ثبت شد.',
        '',
        'نام کاربری: ' + username,
        'موضوع: ' + subject,
        '',
        'پاسخ:',
        text
      ].join('\n')
    );
  } catch (error) {
    console.error(
      'Support reply email error:',
      error
    );
  }


  return {
    success: true
  };
}


// =========================================================
// UPDATE SUPPORT STATUS
// =========================================================

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
      'وضعیت پشتیبانی نامعتبر است.'
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


// =========================================================
// HELPERS
// =========================================================

function sanitizeFileName(value) {
  return String(value || 'user')
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


// =========================================================
// TEST EMAIL
// =========================================================

function testEmail() {
  MailApp.sendEmail(
    getAdminEmail(),
    'QuizDuo | تست ایمیل',
    'ارسال ایمیل از Google Apps Script با موفقیت انجام شد.'
  );
}

