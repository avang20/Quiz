const CONFIG = {
  SHEET_NAME: 'Payments',
  SUPPORT_SHEET_NAME: 'Support',
  DRIVE_FOLDER_NAME: 'QuizDuo Receipts',
  PRIVATE_TEST_CODE: 'QDZ-100K-HASTI',
  TEST_AMOUNT: 100000,
  MAX_RECEIPT_BYTES: 5 * 1024 * 1024,

  // رمز اصلی را بهتر است در Script Properties با کلید ADMIN_PASSWORD قرار دهید.
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
  'Status Timestamp',
  'Subscription Start',
  'Subscription Expiry'
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
    time: new Date().toISOString()
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

    if (data.action === 'payment') {
      return handlePayment(data);
    }

    if (data.action === 'validateDiscount') {
      return validateDiscount(data);
    }

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
      message:
        'خطای سرور: ' +
        (error.message || error)
    });
  }
}


/* =========================================================
   DISCOUNT
========================================================= */

function validateDiscount(data) {

  const code =
    String(
      data.code || ''
    )
      .trim()
      .toUpperCase();

  const plan =
    String(
      data.plan || ''
    );

  const valid =
    code ===
      CONFIG.PRIVATE_TEST_CODE &&
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
      message:
        'اطلاعات پرداخت کامل نیست.'
    });
  }

  const planPrices = {

    monthly:
      100000,

    quarterly:
      270000,

    sixMonth:
      480000,

    nineMonth:
      660000
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

  const base64 =
    String(
      data.receiptBase64
    );

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

  const originalAmount =
    Number(
      planPrices[data.plan]
    );

  let amount =
    Number(
      data.amount ||
      originalAmount
    );

  let testCodeApplied =
    false;

  if (
    String(
      data.discountCode || ''
    )
      .trim()
      .toUpperCase() ===
      CONFIG.PRIVATE_TEST_CODE &&
    data.plan === 'nineMonth'
  ) {

    amount =
      CONFIG.TEST_AMOUNT;

    testCodeApplied =
      true;
  }

  const bytes =
    Utilities.base64Decode(
      base64
    );

  const originalFileName =
    data.fileName ||
    (
      'receipt_' +
      Date.now() +
      '.jpg'
    );

  const blob =
    Utilities.newBlob(
      bytes,
      data.mimeType ||
        data.fileMime ||
        'image/jpeg',
      originalFileName
    );

  const folder =
    getOrCreateReceiptFolder();

  const savedFile =
    folder.createFile(
      blob
    );

  const safeName =
    sanitizeFileName(
      data.username
    );

  savedFile.setName(
    'QuizDuo_' +
    safeName +
    '_' +
    Date.now() +
    '_' +
    originalFileName
  );

  const row = [

    new Date(),

    data.username,

    data.phone || '',

    data.plan,

    data.planName ||
      data.plan,

    originalAmount,

    amount,

    Number(
      data.discountPercent || 0
    ),

    data.discountCode || '',

    originalFileName,

    savedFile.getUrl(),

    'در انتظار بررسی',

    '',

    '',

    '',

    ''
  ];

  appendPaymentRow(
    row
  );

  sendReceiptEmail(
    data,
    amount,
    savedFile.getUrl(),
    savedFile
  );

  return jsonResponse({

    success: true,

    testCodeApplied,

    message:
      testCodeApplied
        ? 'فیش دریافت شد و کد تست خصوصی نیز تأیید شد.'
        : 'فیش با موفقیت برای بررسی ارسال شد.'
  });
}


/* =========================================================
   SUPPORT - USER MESSAGE
========================================================= */

function handleSupport(data) {

  const username =
    String(
      data.username || ''
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

  if (
    !subject ||
    !message
  ) {

    return jsonResponse({
      success: false,
      message:
        'موضوع و پیام را وارد کنید.'
    });
  }

  const lock =
    LockService
      .getScriptLock();

  lock.waitLock(
    10000
  );

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

      ''
    ]);

    SpreadsheetApp.flush();

    rowNumber =
      sheet.getLastRow();

  } finally {

    lock.releaseLock();
  }

  let emailSent =
    false;

  let emailError =
    '';

  try {

    const adminEmail =
      getAdminEmail();

    if (adminEmail) {

      GmailApp.sendEmail(

        adminEmail,

        'QuizDuo | پیام پشتیبانی | ' +
          username,

        [

          'پیام جدیدی در پشتیبانی QuizDuo ثبت شد.',
          '',
          'کاربر: ' + username,
          'شماره تماس: ' +
            (phone || '-'),
          'موضوع: ' + subject,
          '',
          message,
          '',
          'شماره ردیف پشتیبانی: ' +
            rowNumber

        ].join('\n')
      );

      emailSent =
        true;
    }

  } catch (error) {

    emailError =
      error.message ||
      String(error);
  }

  return jsonResponse({

    success: true,

    rowNumber,

    message:
      emailSent
        ? 'درخواست پشتیبانی با موفقیت ارسال شد.'
        : 'درخواست پشتیبانی ثبت شد و در پنل مدیریت قرار گرفت.',

    emailSent,

    emailError
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

      subscription: null
    });
  }

  const payments =
    getUserPaymentUpdates(
      username
    );

  const support =
    getUserSupportUpdates(
      username
    );

  const subscription =
    getUserSubscription(
      username
    );

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

function getUserPaymentUpdates(
  username
) {

  const sheet =
    getOrCreateSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (
    values.length <= 1
  ) {
    return [];
  }

  return values
    .slice(1)
    .map(
      function (
        row,
        index
      ) {

        return {

          rowNumber:
            index + 2,

          timestamp:
            row[0]
              ? new Date(
                  row[0]
                ).toISOString()
              : '',

          username:
            String(
              row[1] || ''
            ),

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
              ? new Date(
                  row[13]
                ).toISOString()
              : '',

          subscriptionStart:
            row[14]
              ? new Date(
                  row[14]
                ).toISOString()
              : '',

          subscriptionExpiry:
            row[15]
              ? new Date(
                  row[15]
                ).toISOString()
              : ''
        };
      }
    )
    .filter(
      function (item) {

        return (
          item.username
            .toLowerCase() ===
          username
            .toLowerCase()
        );
      }
    )
    .reverse();
}


/* =========================================================
   USER SUPPORT UPDATES
========================================================= */

function getUserSupportUpdates(
  username
) {

  const sheet =
    getOrCreateSupportSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (
    values.length <= 1
  ) {
    return [];
  }

  return values
    .slice(1)
    .map(
      function (
        row,
        index
      ) {

        return {

          rowNumber:
            index + 2,

          timestamp:
            row[0]
              ? new Date(
                  row[0]
                ).toISOString()
              : '',

          username:
            String(
              row[1] || ''
            ),

          phone:
            row[2] || '',

          subject:
            row[3] || '',

          message:
            row[4] || '',

          status:
            row[5] ||
            'جدید',

          adminReply:
            row[6] || '',

          replyTimestamp:
            row[7]
              ? new Date(
                  row[7]
                ).toISOString()
              : ''
        };
      }
    )
    .filter(
      function (item) {

        return (
          item.username
            .toLowerCase() ===
          username
            .toLowerCase()
        );
      }
    )
    .reverse();
}


/* =========================================================
   USER SUBSCRIPTION
========================================================= */

function getUserSubscription(
  username
) {

  const sheet =
    getOrCreateSheet();

  const values =
    sheet
      .getDataRange()
      .getValues();

  if (
    values.length <= 1
  ) {
    return null;
  }

  let best =
    null;

  values
    .slice(1)
    .forEach(
      function (row, index) {

        const rowUsername =
          String(
            row[1] || ''
          ).trim();

        const status =
          String(
            row[11] || ''
          ).trim();

        if (
          rowUsername
            .toLowerCase() !==
          username
            .toLowerCase()
        ) {
          return;
        }

        if (
          status !==
          'تأیید شد'
        ) {
          return;
        }

        const planId =
          String(
            row[3] || ''
          );

        const months =
          getPlanMonths(
            planId
          );

        if (!months) {
          return;
        }

        let expiry =
          row[15]
            ? new Date(
                row[15]
              )
            : null;

        if (
          !expiry ||
          isNaN(
            expiry.getTime()
          )
        ) {

          const statusDate =
            row[13]
              ? new Date(
                  row[13]
                )
              : new Date(
                  row[0]
                );

          expiry =
            addMonths(
              statusDate,
              months
            );
        }

        const start =
          row[14]
            ? new Date(
                row[14]
              )
            : (
                row[13]
                  ? new Date(
                      row[13]
                    )
                  : new Date(
                      row[0]
                    )
              );

        if (
          !best ||
          expiry.getTime() >
            best.expiry.getTime()
        ) {

          best = {

            rowNumber:
              index + 2,

            planId,

            planName:
              row[4] ||
              planId,

            start,

            expiry
          };
        }
      }
    );

  if (!best) {
    return null;
  }

  const active =
    best.expiry.getTime() >=
    Date.now();

  return {

    active,

    planId:
      best.planId,

    planName:
      best.planName,

    start:
      best.start.toISOString(),

    expiry:
      best.expiry.toISOString()
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
        (data.planName ||
          data.plan),
      'مبلغ: ' +
        amount.toLocaleString(
          'fa-IR'
        ) +
        ' تومان',
      'کد تخفیف: ' +
        (data.discountCode ||
          '-'),
      '',
      'لینک فایل فیش در Google Drive:',
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

  let spreadsheet =
    null;

  if (spreadsheetId) {

    try {

      spreadsheet =
        SpreadsheetApp.openById(
          spreadsheetId
        );

    } catch (error) {

      spreadsheet =
        null;
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

  const lastColumn =
    sheet.getLastColumn();

  const existing =
    lastColumn > 0

      ? sheet
          .getRange(
            1,
            1,
            1,
            lastColumn
          )
          .getValues()[0]

      : [];

  headers.forEach(
    function (
      header,
      index
    ) {

      if (
        existing[index] !==
        header
      ) {

        sheet
          .getRange(
            1,
            index + 1
          )
          .setValue(
            header
          );
      }
    }
  );

  sheet.setFrozenRows(1);
}


function appendPaymentRow(
  row
) {

  getOrCreateSheet()
    .appendRow(row);
}


/* =========================================================
   HELPERS
========================================================= */

function sanitizeFileName(
  value
) {

  return String(
    value || 'user'
  )
    .replace(
      /[\\/:*?"<>|]/g,
      '_'
    )
    .slice(
      0,
      60
    );
}


function jsonResponse(
  data
) {

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

function checkAdmin(
  password
) {

  const savedPassword =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        'ADMIN_PASSWORD'
      );

  const finalPassword =
    savedPassword ||
    CONFIG.ADMIN_PASSWORD;

  return (
    String(password || '') ===
    String(finalPassword || '')
  );
}


/* =========================================================
   ADMIN PAYMENTS
========================================================= */

function getPaymentsForAdmin(
  password
) {

  if (
    !checkAdmin(password)
  ) {

    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const values =
    getOrCreateSheet()
      .getDataRange()
      .getValues();

  if (
    values.length <= 1
  ) {

    return [];
  }

  return values
    .slice(1)
    .map(
      function (
        row,
        index
      ) {

        return {

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
              : '',

          subscriptionStart:
            row[14]
              ? new Date(
                  row[14]
                ).toISOString()
              : '',

          subscriptionExpiry:
            row[15]
              ? new Date(
                  row[15]
                ).toISOString()
              : ''
        };
      }
    )
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

  if (
    !checkAdmin(password)
  ) {

    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const allowed = [

    'تأیید شد',

    'رد شد',

    'در انتظار بررسی'
  ];

  if (
    !allowed.includes(
      status
    )
  ) {

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

  const planName =
    String(
      sheet
        .getRange(
          row,
          5
        )
        .getValue() ||
      planId
    );

  const now =
    new Date();

  let userMessage =
    '';

  let subscription =
    null;


  if (
    status ===
    'تأیید شد'
  ) {

    const months =
      getPlanMonths(
        planId
      );

    if (!months) {

      throw new Error(
        'مدت پلن قابل تشخیص نیست.'
      );
    }

    /*
      اگر اشتراک قبلی هنوز فعال باشد،
      تمدید از تاریخ پایان قبلی شروع می‌شود.
    */

    const current =
      getUserSubscription(
        username
      );

    let start =
      new Date(
        now
      );

    if (
      current &&
      current.active &&
      current.expiry
    ) {

      const currentExpiry =
        new Date(
          current.expiry
        );

      if (
        !isNaN(
          currentExpiry.getTime()
        ) &&
        currentExpiry.getTime() >
          start.getTime()
      ) {

        start =
          currentExpiry;
      }
    }

    const expiry =
      addMonths(
        start,
        months
      );

    sheet
      .getRange(
        row,
        15
      )
      .setValue(
        start
      );

    sheet
      .getRange(
        row,
        16
      )
      .setValue(
        expiry
      );

    userMessage =
      'پرداخت شما تأیید شد و اشتراک شما فعال شد. مراحل بعدی برای حساب شما باز شدند.';

    subscription = {

      active: true,

      planId,

      planName,

      start:
        start.toISOString(),

      expiry:
        expiry.toISOString()
    };

  } else if (
    status ===
    'رد شد'
  ) {

    userMessage =
      'پرداخت شما رد شد. در صورت بروز مشکل به آیدی @hv901 در بله پیام بدهید.';
  }

  sheet
    .getRange(
      row,
      12
    )
    .setValue(
      status
    );

  sheet
    .getRange(
      row,
      13
    )
    .setValue(
      userMessage
    );

  sheet
    .getRange(
      row,
      14
    )
    .setValue(
      now
    );

  SpreadsheetApp.flush();

  if (
    status !==
    'تأیید شد'
  ) {

    subscription =
      getUserSubscription(
        username
      );
  }

  return {

    success: true,

    username,

    planId,

    status,

    userMessage,

    subscription
  };
}


/* =========================================================
   ADMIN SUPPORT
========================================================= */

function getSupportForAdmin(
  password
) {

  if (
    !checkAdmin(password)
  ) {

    throw new Error(
      'رمز مدیریت اشتباه است.'
    );
  }

  const values =
    getOrCreateSupportSheet()
      .getDataRange()
      .getValues();

  if (
    values.length <= 1
  ) {

    return [];
  }

  return values
    .slice(1)
    .map(
      function (
        row,
        index
      ) {

        return {

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
            row[5] ||
            'جدید',

          adminReply:
            row[6] || '',

          replyTimestamp:
            row[7]
              ? new Date(
                  row[7]
                ).toISOString()
              : ''
        };
      }
    )
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

  if (
    !checkAdmin(password)
  ) {

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
    allowed.includes(
      status
    )
      ? status
      : 'پاسخ داده شد';

  const sheet =
    getOrCreateSupportSheet();

  const row =
    Number(rowNumber);

  if (
    row < 2 ||
    row > sheet.getLastRow()
  ) {

    throw new Error(
      'پیام پشتیبانی پیدا نشد.'
    );
  }

  sheet
    .getRange(
      row,
      6
    )
    .setValue(
      finalStatus
    );

  sheet
    .getRange(
      row,
      7
    )
    .setValue(
      text
    );

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
      'پاسخ ثبت شد و در پنل کاربر نمایش داده می‌شود.'
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

  if (
    !checkAdmin(password)
  ) {

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

  if (
    !allowed.includes(
      status
    )
  ) {

    throw new Error(
      'وضعیت نامعتبر است.'
    );
  }

  const sheet =
    getOrCreateSupportSheet();

  const row =
    Number(rowNumber);

  if (
    row < 2 ||
    row > sheet.getLastRow()
  ) {

    throw new Error(
      'پیام پشتیبانی پیدا نشد.'
    );
  }

  sheet
    .getRange(
      row,
      6
    )
    .setValue(
      status
    );

  SpreadsheetApp.flush();

  return {
    success: true
  };
}


/* =========================================================
   TEST EMAIL
========================================================= */

function testEmail() {

  const adminEmail =
    getAdminEmail();

  if (!adminEmail) {

    throw new Error(
      'ADMIN_EMAIL در Script Properties تنظیم نشده است.'
    );
  }

  GmailApp.sendEmail(

    adminEmail,

    'QuizDuo Test Email',

    'ارسال ایمیل تست QuizDuo با موفقیت انجام شد.'
  );
}


/* =========================================================
   SUBSCRIPTION HELPERS
========================================================= */

function getPlanMonths(
  planId
) {

  const months = {

    monthly:
      1,

    quarterly:
      3,

    sixMonth:
      6,

    nineMonth:
      9
  };

  return (
    months[
      String(
        planId || ''
      )
    ] ||
    0
  );
}


function addMonths(
  date,
  months
) {

  const result =
    new Date(
      date
    );

  const day =
    result.getDate();

  result.setDate(
    1
  );

  result.setMonth(
    result.getMonth() +
      Number(
        months || 0
      )
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
