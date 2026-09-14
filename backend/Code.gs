const CONFIG = {
  SHEET_NAME: 'Payments',
  SUPPORT_SHEET_NAME: 'Support',
  DRIVE_FOLDER_NAME: 'QuizDuo Receipts',

  PRIVATE_TEST_CODE: 'QDZ-100K-HASTI',
  TEST_AMOUNT: 100000,

  MAX_RECEIPT_BYTES: 5 * 1024 * 1024,

  ADMIN_EMAIL: 'hvasei90@gmail.com',
  ADMIN_PASSWORD: 'CHANGE_THIS_ADMIN_PASSWORD'
};


/* =========================================================
   SHEET HEADERS
========================================================= */

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
  'Conversation ID',
  'Thread JSON'
];


/* =========================================================
   GET
========================================================= */

function doGet(e) {

  const page = e && e.parameter
    ? e.parameter.page
    : '';

  if (page === 'admin') {

    return HtmlService
      .createHtmlOutputFromFile('Admin')
      .setTitle('QuizDuo Admin')
      .setXFrameOptionsMode(
        HtmlService.XFrameOptionsMode.ALLOWALL
      );
  }

  return jsonResponse({
    success: true,
    service: 'QuizDuo API',
    time: new Date().toISOString()
  });
}


/* =========================================================
   POST ROUTER
========================================================= */

function doPost(e) {

  try {

    if (!e || !e.postData || !e.postData.contents) {

      return jsonResponse({
        success: false,
        message: 'درخواست خالی است.'
      });
    }

    const data = JSON.parse(
      e.postData.contents
    );

    switch (data.action) {

      case 'payment':
        return handlePayment(data);

      case 'validateDiscount':
        return validateDiscount(data);

      case 'support':
        return handleSupport(data);

      case 'supportUserReply':
        return handleUserSupportReply(data);

      case 'closeSupport':
        return closeSupportConversation(data);

      case 'userUpdates':
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
      message: 'خطای سرور: ' + (
        error && error.message
          ? error.message
          : String(error)
      )
    });
  }
}


/* =========================================================
   DISCOUNT
========================================================= */

function validateDiscount(data) {

  const code = String(
    data.code || ''
  ).trim().toUpperCase();

  const plan = String(
    data.plan || ''
  ).trim();

  const valid =
    code === CONFIG.PRIVATE_TEST_CODE &&
    plan === 'nineMonth';

  return jsonResponse({
    success: true,
    testCodeApplied: valid,
    amount: valid
      ? CONFIG.TEST_AMOUNT
      : null
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


  const username = String(
    data.username
  ).trim();


  const base64 = String(
    data.receiptBase64
  );


  const estimatedBytes =
    Math.floor(base64.length * 0.75);


  if (
    estimatedBytes >
    CONFIG.MAX_RECEIPT_BYTES
  ) {

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
    Number(
      data.amount || originalAmount
    );


  let testCodeApplied = false;


  if (
    String(
      data.discountCode || ''
    ).trim().toUpperCase() ===
    CONFIG.PRIVATE_TEST_CODE &&
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


  if (
    bytes.length >
    CONFIG.MAX_RECEIPT_BYTES
  ) {

    return jsonResponse({
      success: false,
      message: 'حجم فیش بیشتر از ۵ مگابایت است.'
    });
  }


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
    sanitizeFileName(username) +
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

    username,

    data.phone || '',

    data.plan,

    data.planName || data.plan,

    originalAmount,

    amount,

    Number(
      data.discountPercent || 0
    ),

    data.discountCode || '',

    fileName,

    fileUrl,

    'در انتظار بررسی',

    '',

    ''
  ];


  appendPaymentRow(row);


  /*
   * خیلی مهم:
   * خطای ایمیل نباید باعث شکست ثبت فیش شود.
   */

  try {

    sendReceiptEmail(
      data,
      amount,
      fileUrl,
      savedFile
    );

  } catch (emailError) {

    console.error(
      'Receipt email failed:',
      emailError
    );
  }


  return jsonResponse({

    success: true,

    testCodeApplied,

    message:
      'فیش با موفقیت برای بررسی ارسال شد.'
  });
}


/* =========================================================
   SUPPORT - NEW CONVERSATION
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


  const sheet =
    getOrCreateSupportSheet();


  const conversationId =
    createConversationId();


  const now =
    new Date();


  const thread = [

    {
      sender: 'user',

      text: message,

      timestamp:
        now.toISOString()
    }

  ];


  sheet.appendRow([

    now,

    username,

    phone,

    subject,

    message,

    'در حال بررسی',

    '',

    '',

    conversationId,

    JSON.stringify(thread)
  ]);


  const rowNumber =
    sheet.getLastRow();


  /*
   * ایمیل فقط اطلاع‌رسانی است.
   * اگر Gmail مجوز نداشته باشد،
   * تیکت همچنان ثبت می‌شود.
   */

  let emailSent = false;


  try {

    const adminEmail =
      getAdminEmail();


    if (adminEmail) {

      MailApp.sendEmail({

        to: adminEmail,

        subject:
          'QuizDuo | پیام پشتیبانی | ' +
          username,

        htmlBody:
          '<div dir="rtl">' +
          '<h2>پیام جدید پشتیبانی QuizDuo</h2>' +
          '<p><b>کاربر:</b> ' +
          escapeHtml(username) +
          '</p>' +
          '<p><b>موضوع:</b> ' +
          escapeHtml(subject) +
          '</p>' +
          '<p><b>پیام:</b></p>' +
          '<p>' +
          escapeHtml(message) +
          '</p>' +
          '</div>'
      });

      emailSent = true;
    }

  } catch (error) {

    console.error(
      'Support email failed:',
      error
    );
  }


  return jsonResponse({

    success: true,

    conversationId,

    rowNumber,

    message:
      'گفت‌وگوی پشتیبانی با موفقیت ایجاد شد.',

    emailSent
  });
}


/* =========================================================
   SUPPORT - USER CONTINUE SAME CONVERSATION
========================================================= */

function handleUserSupportReply(data) {

  const username =
    String(data.username || '').trim();

  const conversationId =
    String(
      data.conversationId || ''
    ).trim();

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
      message: 'ابتدا وارد حساب شوید.'
    });
  }


  if (!conversationId) {

    return jsonResponse({
      success: false,
      message:
        'شناسه گفت‌وگو ارسال نشده است.'
    });
  }


  if (!message) {

    return jsonResponse({
      success: false,
      message:
        'متن پیام را وارد کنید.'
    });
  }


  const sheet =
    getOrCreateSupportSheet();


  const rowNumber =
    findSupportRow(
      sheet,
      username,
      conversationId
    );


  if (!rowNumber) {

    return jsonResponse({
      success: false,
      message:
        'گفت‌وگو پیدا نشد.'
    });
  }


  const status =
    String(
      sheet.getRange(
        rowNumber,
        7
      ).getValue() || ''
    );


  if (status === 'بسته شد') {

    return jsonResponse({
      success: false,
      message:
        'این گفت‌وگو توسط شما به پایان رسیده است. برای ادامه یک درخواست جدید ایجاد کنید.'
    });
  }


  const thread =
    readThread(
      sheet,
      rowNumber
    );


  const now =
    new Date();


  thread.push({

    sender: 'user',

    text: message,

    timestamp:
      now.toISOString()
  });


  /*
   * بعد از پیام جدید کاربر،
   * وضعیت دوباره در حال بررسی می‌شود.
   */

  sheet.getRange(
    rowNumber,
    5
  ).setValue(message);


  sheet.getRange(
    rowNumber,
    6
  ).setValue('در حال بررسی');


  sheet.getRange(
    rowNumber,
    8
  ).setValue('');


  sheet.getRange(
    rowNumber,
    9
  ).setValue(now);


  sheet.getRange(
    rowNumber,
    10
  ).setValue(
    JSON.stringify(thread)
  );


  return jsonResponse({

    success: true,

    message:
      'پیام شما در همان گفت‌وگو ثبت شد.'
  });
}


/* =========================================================
   SUPPORT - USER CLOSES CONVERSATION
========================================================= */

function closeSupportConversation(data) {

  const username =
    String(data.username || '').trim();

  const conversationId =
    String(
      data.conversationId || ''
    ).trim();


  if (
    !username ||
    !conversationId
  ) {

    return jsonResponse({
      success: false,
      message:
        'اطلاعات گفت‌وگو کامل نیست.'
    });
  }


  const sheet =
    getOrCreateSupportSheet();


  const rowNumber =
    findSupportRow(
      sheet,
      username,
      conversationId
    );


  if (!rowNumber) {

    return jsonResponse({
      success: false,
      message:
        'گفت‌وگو پیدا نشد.'
    });
  }


  sheet.getRange(
    rowNumber,
    6
  ).setValue('بسته شد');


  sheet.getRange(
    rowNumber,
    9
  ).setValue(
    new Date()
  );


  return jsonResponse({

    success: true,

    message:
      'گفت‌وگو توسط شما به پایان رسید.'
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

      support: []
    });
  }


  return jsonResponse({

    success: true,

    payments:
      getUserPaymentUpdates(
        username
      ),

    support:
      getUserSupportUpdates(
        username
      )
  });
}


/* =========================================================
   USER PAYMENTS
========================================================= */

function getUserPaymentUpdates(username) {

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

      rowNumber:
        index + 2,

      timestamp:
        toISOStringSafe(row[0]),

      username:
        String(row[1] || ''),

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
        toISOStringSafe(row[13])
    }))

    .filter(
      item =>
        item.username.toLowerCase() ===
        username.toLowerCase()
    )

    .reverse();
}


/* =========================================================
   USER SUPPORT
========================================================= */

function getUserSupportUpdates(username) {

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

    .map((row, index) => {

      let thread =
        parseThread(row[9]);


      /*
       * پشتیبانی‌های قدیمی که قبل از
       * سیستم گفتگو ثبت شده‌اند.
       */

      if (!thread.length) {

        thread = [];

        if (row[4]) {

          thread.push({

            sender: 'user',

            text:
              String(row[4]),

            timestamp:
              toISOStringSafe(row[0])
          });
        }


        if (row[6]) {

          thread.push({

            sender: 'admin',

            text:
              String(row[6]),

            timestamp:
              toISOStringSafe(row[7])
          });
        }
      }


      return {

        rowNumber:
          index + 2,

        timestamp:
          toISOStringSafe(row[0]),

        username:
          String(row[1] || ''),

        phone:
          row[2] || '',

        subject:
          row[3] || '',

        message:
          row[4] || '',

        status:
          row[5] ||
          'در حال بررسی',

        adminReply:
          row[6] || '',

        replyTimestamp:
          toISOStringSafe(row[7]),

        conversationId:
          row[8] ||
          ('legacy-' + (index + 2)),

        thread
      };
    })

    .filter(
      item =>
        item.username.toLowerCase() ===
        username.toLowerCase()
    )

    .reverse();
}


/* =========================================================
   ADMIN - PAYMENTS
========================================================= */

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

      rowNumber:
        index + 2,

      timestamp:
        toISOStringSafe(row[0]),

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
        toISOStringSafe(row[13])
    }))

    .reverse();
}


/* =========================================================
   ADMIN - UPDATE PAYMENT
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
      sheet.getRange(
        row,
        2
      ).getValue() || ''
    );


  const planId =
    String(
      sheet.getRange(
        row,
        4
      ).getValue() || ''
    );


  const planName =
    String(
      sheet.getRange(
        row,
        5
      ).getValue() || ''
    );


  const now =
    new Date();


  let userMessage = '';


  if (status === 'تأیید شد') {

    userMessage =
      'پرداخت شما تأیید شد و اشتراک شما فعال شد.';

  } else if (status === 'رد شد') {

    userMessage =
      'پرداخت شما رد شد. در صورت بروز مشکل به آیدی @hv901 در بله پیام بدهید.';
  }


  sheet.getRange(
    row,
    12
  ).setValue(status);


  sheet.getRange(
    row,
    13
  ).setValue(userMessage);


  sheet.getRange(
    row,
    14
  ).setValue(now);


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
   ADMIN - SUPPORT LIST
========================================================= */

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

    .map((row, index) => {

      let thread =
        parseThread(row[9]);


      if (!thread.length) {

        thread = [];

        if (row[4]) {

          thread.push({

            sender: 'user',

            text:
              String(row[4]),

            timestamp:
              toISOStringSafe(row[0])
          });
        }


        if (row[6]) {

          thread.push({

            sender: 'admin',

            text:
              String(row[6]),

            timestamp:
              toISOStringSafe(row[7])
          });
        }
      }


      return {

        rowNumber:
          index + 2,

        timestamp:
          toISOStringSafe(row[0]),

        username:
          row[1] || '',

        phone:
          row[2] || '',

        subject:
          row[3] || '',

        message:
          row[4] || '',

        status:
          row[5] ||
          'در حال بررسی',

        adminReply:
          row[6] || '',

        replyTimestamp:
          toISOStringSafe(row[7]),

        conversationId:
          row[8] ||
          ('legacy-' + (index + 2)),

        thread
      };
    })

    .reverse();
}


/* =========================================================
   ADMIN - REPLY SUPPORT
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


  const sheet =
    getOrCreateSupportSheet();


  const row =
    Number(rowNumber);


  const currentStatus =
    String(
      sheet.getRange(
        row,
        6
      ).getValue() || ''
    );


  if (currentStatus === 'بسته شد') {

    throw new Error(
      'این گفت‌وگو توسط کاربر به پایان رسیده است.'
    );
  }


  const thread =
    readThread(
      sheet,
      row
    );


  const now =
    new Date();


  thread.push({

    sender: 'admin',

    text,

    timestamp:
      now.toISOString()
  });


  const allowed = [

    'در حال بررسی',

    'پاسخ داده شد'
  ];


  const finalStatus =
    allowed.includes(status)
      ? status
      : 'پاسخ داده شد';


  sheet.getRange(
    row,
    6
  ).setValue(finalStatus);


  sheet.getRange(
    row,
    7
  ).setValue(text);


  sheet.getRange(
    row,
    8
  ).setValue(now);


  sheet.getRange(
    row,
    9
  ).setValue(now);


  sheet.getRange(
    row,
    10
  ).setValue(
    JSON.stringify(thread)
  );


  return {

    success: true,

    message:
      'پاسخ در همان گفت‌وگوی کاربر ثبت شد.'
  };
}


/* =========================================================
   ADMIN - SUPPORT STATUS
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


  sheet.getRange(
    Number(rowNumber),
    6
  ).setValue(status);


  sheet.getRange(
    Number(rowNumber),
    9
  ).setValue(
    new Date()
  );


  return {
    success: true
  };
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


  /*
   * اگر Gmail مجوز نداشته باشد،
   * این تابع خطا می‌دهد ولی handlePayment
   * آن را catch می‌کند و ثبت فیش باقی می‌ماند.
   */

  GmailApp.sendEmail(

    adminEmail,

    'QuizDuo | فیش پرداخت جدید | ' +
    data.username,

    [
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
    ].join('\n'),

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


  if (saved) {
    return saved;
  }


  return CONFIG.ADMIN_EMAIL;
}


/* =========================================================
   HELPERS
========================================================= */

function getOrCreateReceiptFolder() {

  const folders =
    DriveApp.getFoldersByName(
      CONFIG.DRIVE_FOLDER_NAME
    );


  if (folders.hasNext()) {

    return folders.next();
  }


  return DriveApp.createFolder(
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
      }
    }
  );


  sheet.setFrozenRows(1);
}


function appendPaymentRow(row) {

  getOrCreateSheet()
    .appendRow(row);
}


function createConversationId() {

  return (
    'QD-' +
    Date.now() +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()
  );
}


function findSupportRow(
  sheet,
  username,
  conversationId
) {

  const values =
    sheet.getDataRange()
      .getValues();


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const rowUsername =
      String(
        values[i][1] || ''
      ).toLowerCase();


    const rowConversation =
      String(
        values[i][8] || ''
      );


    if (
      rowUsername ===
      username.toLowerCase() &&
      rowConversation ===
      conversationId
    ) {

      return i + 1;
    }
  }


  return null;
}


function readThread(
  sheet,
  rowNumber
) {

  const raw =
    sheet
      .getRange(
        rowNumber,
        10
      )
      .getValue();


  return parseThread(raw);
}


function parseThread(raw) {

  if (!raw) {
    return [];
  }


  try {

    const parsed =
      JSON.parse(String(raw));


    return Array.isArray(parsed)
      ? parsed
      : [];

  } catch (error) {

    return [];
  }
}


function toISOStringSafe(value) {

  if (!value) {
    return '';
  }


  try {

    return new Date(value)
      .toISOString();

  } catch (error) {

    return String(value);
  }
}


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


function escapeHtml(value) {

  return String(value || '')

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    )

    .replace(
      /'/g,
      '&#039;'
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

  return String(password || '') ===
    CONFIG.ADMIN_PASSWORD;
}


/* =========================================================
   TEST EMAIL
========================================================= */

function testEmail() {

  MailApp.sendEmail({

    to: CONFIG.ADMIN_EMAIL,

    subject:
      'QuizDuo Test Email',

    htmlBody:
      '<div dir="rtl">' +
      '<h2>ایمیل تست QuizDuo</h2>' +
      '<p>ارسال ایمیل با موفقیت انجام شد.</p>' +
      '</div>'
  });
}
