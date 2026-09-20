const CONFIG = {

  SHEET_NAME:
    "Payments",

  SUPPORT_SHEET_NAME:
    "Support",

  USERS_SHEET_NAME:
    "Users",

  DRIVE_FOLDER_NAME:
    "QuizDuo Receipts",

  MAX_RECEIPT_BYTES:
    5 * 1024 * 1024,

  ADMIN_PASSWORD:
    "CHANGE_THIS_ADMIN_PASSWORD"

};


const PAYMENT_HEADERS = [

  "Timestamp",
  "Username",
  "Phone",
  "Plan ID",
  "Plan Name",
  "Original Amount",
  "Final Amount",
  "Discount %",
  "Discount Code",
  "File Name",
  "Receipt URL",
  "Status",
  "User Message",
  "Status Timestamp"

];


const SUPPORT_HEADERS = [

  "Timestamp",
  "Username",
  "Phone",
  "Subject",
  "Message",
  "Status",
  "Admin Reply",
  "Reply Timestamp",
  "Conversation ID"

];


const USER_HEADERS = [

  "Username",
  "Phone",
  "XP",
  "Level",
  "Streak",
  "General Stage",
  "Fun Stage",
  "Updated At"

];


/* =========================================================
   GET
========================================================= */


function doGet(
  e
) {

  const params =
    e &&
    e.parameter
      ? e.parameter
      : {};


  const page =
    String(
      params.page ||
      ""
    ).trim();


  const action =
    String(
      params.action ||
      ""
    ).trim();


  const callback =
    String(
      params.callback ||
      ""
    ).trim();


  if (
    page ===
    "admin"
  ) {

    return HtmlService

      .createTemplateFromFile(
        "Admin"
      )

      .evaluate()

      .setTitle(
        "QuizDuo Admin"
      )

      .setXFrameOptionsMode(
        HtmlService
          .XFrameOptionsMode
          .ALLOWALL
      );

  }


  if (
    action ===
    "userUpdates"
  ) {

    const result =
      getUserUpdatesObject({

        username:
          String(
            params.username ||
            ""
          ).trim()

      });


    if (
      callback
    ) {

      return jsonpResponse(
        callback,
        result
      );

    }


    return jsonResponse(
      result
    );

  }


  if (
    action ===
    "leaderboard"
  ) {

    const result =
      getLeaderboardObject();


    if (
      callback
    ) {

      return jsonpResponse(
        callback,
        result
      );

    }


    return jsonResponse(
      result
    );

  }


  return jsonResponse({

    success:
      true,

    service:
      "QuizDuo",

    time:
      new Date()
        .toISOString()

  });

}


/* =========================================================
   POST
========================================================= */


function doPost(
  e
) {

  try {

    let data =
      null;


    /*
     * حالت ۱:
     * JSON مستقیم
     */

    const rawBody =
      e &&
      e.postData &&
      e.postData.contents
        ? String(
            e.postData.contents
          )
        : "";


    /*
     * حالت ۲:
     * فرم مخفی سایت
     *
     * payload=<JSON>
     */

    const formPayload =
      e &&
      e.parameter &&
      e.parameter.payload
        ? String(
            e.parameter.payload
          )
        : "";


    if (
      formPayload
    ) {

      data =
        JSON.parse(
          formPayload
        );

    } else if (
      rawBody
    ) {

      /*
       * گاهی Apps Script body را
       * به صورت form-urlencoded می‌گیرد.
       */

      try {

        data =
          JSON.parse(
            rawBody
          );

      } catch (
        firstError
      ) {

        const match =
          rawBody.match(
            /(?:^|&)payload=([^&]*)/
          );


        if (
          match
        ) {

          data =
            JSON.parse(
              decodeURIComponent(
                match[1]
              )
            );

        } else {

          throw firstError;

        }

      }

    }


    /*
     * fallback برای درخواست‌هایی که مستقیماً
     * action را در parameter می‌فرستند.
     */

    if (
      !data &&
      e &&
      e.parameter &&
      e.parameter.action
    ) {

      data = {

        action:
          e.parameter.action,

        username:
          e.parameter.username ||
          "",

        conversationId:
          e.parameter.conversationId ||
          "",

        message:
          e.parameter.message ||
          ""

      };

    }


    if (
      !data ||
      !data.action
    ) {

      return jsonResponse({

        success:
          false,

        message:
          "درخواست نامعتبر است."

      });

    }


    switch (
      String(
        data.action
      )
    ) {

      case "payment":

        return handlePayment(
          data
        );


      case "support":

        return handleSupport(
          data
        );


      case "supportUserReply":

        return handleSupportUserReply(
          data
        );


      case "closeSupport":

        return closeSupportConversation(
          data
        );


      case "userUpdates":

        return getUserUpdates(
          data
        );


      case "userState":

        return handleUserState(
          data
        );


      case "leaderboard":

        return jsonResponse(
          getLeaderboardObject()
        );


      default:

        return jsonResponse({

          success:
            false,

          message:
            "عملیات ناشناخته است."

        });

    }


  } catch (
    error
  ) {

    console.error(
      error
    );


    return jsonResponse({

      success:
        false,

      message:
        "خطای سرور: " +
        error.message

    });

  }

}


/* =========================================================
   USER STATE
========================================================= */


function handleUserState(
  data
) {

  const username =
    String(
      data.username ||
      ""
    ).trim();


  if (
    !username ||
    username ===
      "بازیکن مهمان"
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "کاربر معتبر نیست."

    });

  }


  const sheet =
    getOrCreateUsersSheet();


  const values =
    sheet
      .getDataRange()
      .getValues();


  let rowNumber =
    -1;


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    if (
      String(
        values[i][0] ||
        ""
      )
        .trim()
        .toLowerCase() ===
      username.toLowerCase()
    ) {

      rowNumber =
        i + 1;

      break;

    }

  }


  const row = [

    username,

    String(
      data.phone ||
      ""
    ),

    Number(
      data.xp ||
      0
    ),

    Number(
      data.level ||
      1
    ),

    Number(
      data.streak ||
      0
    ),

    Number(
      data.generalStage ||
      1
    ),

    Number(
      data.funStage ||
      1
    ),

    new Date()

  ];


  if (
    rowNumber < 0
  ) {

    sheet.appendRow(
      row
    );

  } else {

    sheet
      .getRange(
        rowNumber,
        1,
        1,
        USER_HEADERS.length
      )
      .setValues([
        row
      ]);

  }


  SpreadsheetApp.flush();


  return jsonResponse({

    success:
      true

  });

}


/* =========================================================
   LEADERBOARD
========================================================= */


function getLeaderboardObject() {

  const users =
    getAllUsersForLeaderboard();


  users.sort(

    (a, b) => {

      const xpDiff =
        Number(
          b.xp ||
          0
        ) -
        Number(
          a.xp ||
          0
        );


      if (
        xpDiff !==
        0
      ) {

        return xpDiff;

      }


      const stageDiff =
        Math.max(

          Number(
            b.generalStage ||
            1
          ),

          Number(
            b.funStage ||
            1
          )

        ) -

        Math.max(

          Number(
            a.generalStage ||
            1
          ),

          Number(
            a.funStage ||
            1
          )

        );


      if (
        stageDiff !==
        0
      ) {

        return stageDiff;

      }


      return (
        Number(
          b.level ||
          1
        ) -
        Number(
          a.level ||
          1
        )
      );

    }

  );


  return {

    success:
      true,

    users

  };

}


function getAllUsersForLeaderboard() {

  const map =
    {};


  /*
   * اول Users Sheet
   */

  const userValues =
    getOrCreateUsersSheet()
      .getDataRange()
      .getValues();


  userValues
    .slice(1)
    .forEach(
      row => {

        const username =
          String(
            row[0] ||
            ""
          ).trim();


        if (
          !username
        ) {

          return;

        }


        map[
          username.toLowerCase()
        ] = {

          username,

          xp:
            Number(
              row[2] ||
              0
            ),

          level:
            Number(
              row[3] ||
              1
            ),

          streak:
            Number(
              row[4] ||
              0
            ),

          generalStage:
            Number(
              row[5] ||
              1
            ),

          funStage:
            Number(
              row[6] ||
              1
            )

        };

      }
    );


  /*
   * برای اینکه کاربران قدیمی که قبل از این نسخه
   * ثبت‌نام کرده‌اند هم از بین نروند، نام کاربری‌هایی
   * که در Payment یا Support هستند نیز اضافه می‌شوند.
   */

  const paymentValues =
    getOrCreateSheet()
      .getDataRange()
      .getValues();


  paymentValues
    .slice(1)
    .forEach(
      row => {

        const username =
          String(
            row[1] ||
            ""
          ).trim();


        if (
          !username
        ) {

          return;

        }


        const key =
          username.toLowerCase();


        if (
          !map[key]
        ) {

          map[key] = {

            username,

            xp:
              0,

            level:
              1,

            streak:
              0,

            generalStage:
              1,

            funStage:
              1

          };

        }

      }
    );


  const supportValues =
    getOrCreateSupportSheet()
      .getDataRange()
      .getValues();


  supportValues
    .slice(1)
    .forEach(
      row => {

        const username =
          String(
            row[1] ||
            ""
          ).trim();


        if (
          !username
        ) {

          return;

        }


        const key =
          username.toLowerCase();


        if (
          !map[key]
        ) {

          map[key] = {

            username,

            xp:
              0,

            level:
              1,

            streak:
              0,

            generalStage:
              1,

            funStage:
              1

          };

        }

      }
    );


  return Object
    .values(
      map
    );

}


/* =========================================================
   PAYMENT
========================================================= */


function handlePayment(
  data
) {

  if (
    !data.username ||
    !data.plan ||
    !data.receiptBase64
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "اطلاعات پرداخت کامل نیست."

    });

  }


  const prices = {

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
      prices,
      data.plan
    )
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "پلن انتخاب‌شده معتبر نیست."

    });

  }


  const originalAmount =
    Number(
      prices[
        data.plan
      ]
    );


  const amount =
    Number(
      data.amount ||
      originalAmount
    );


  const base64 =
    String(
      data.receiptBase64
    );


  const estimatedBytes =
    Math.floor(
      base64.length *
      0.75
    );


  if (
    estimatedBytes >
    CONFIG.MAX_RECEIPT_BYTES
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "حجم فیش بیشتر از ۵ مگابایت است."

    });

  }


  const bytes =
    Utilities.base64Decode(
      base64
    );


  const mimeType =
    data.mimeType ||
    "image/jpeg";


  const fileName =
    data.fileName ||
    (
      "receipt_" +
      Date.now() +
      ".jpg"
    );


  const blob =
    Utilities.newBlob(

      bytes,

      mimeType,

      fileName

    );


  const folder =
    getOrCreateReceiptFolder();


  const file =
    folder.createFile(
      blob
    );


  file.setName(

    "QuizDuo_" +

    sanitizeFileName(
      data.username
    ) +

    "_" +

    Date.now() +

    "_" +

    fileName

  );


  const fileUrl =
    file.getUrl();


  getOrCreateSheet()
    .appendRow([

      new Date(),

      data.username,

      data.phone ||
        "",

      data.plan,

      data.planName ||
        data.plan,

      originalAmount,

      amount,

      Number(
        data.discountPercent ||
        0
      ),

      data.discountCode ||
        "",

      fileName,

      fileUrl,

      "در انتظار بررسی",

      "",

      ""

    ]);


  SpreadsheetApp.flush();


  try {

    sendReceiptEmail(
      data,
      amount,
      fileUrl,
      file
    );

  } catch (
    error
  ) {

    console.error(
      error
    );

  }


  return jsonResponse({

    success:
      true,

    message:
      "فیش با موفقیت برای بررسی ثبت شد."

  });

}


/* =========================================================
   SUPPORT - NEW
========================================================= */


function handleSupport(
  data
) {

  const username =
    String(
      data.username ||
      ""
    ).trim();


  const phone =
    String(
      data.phone ||
      ""
    ).trim();


  const subject =
    String(
      data.subject ||
      ""
    ).trim();


  const message =
    String(
      data.message ||
      ""
    ).trim();


  const conversationId =
    String(
      data.conversationId ||
      ""
    ).trim() ||
    Utilities.getUuid();


  if (
    !username ||
    username ===
      "بازیکن مهمان"
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "ابتدا وارد حساب شوید."

    });

  }


  if (
    !subject ||
    !message
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "موضوع و متن پیام الزامی است."

    });

  }


  const sheet =
    getOrCreateSupportSheet();


  sheet.appendRow([

    new Date(),

    username,

    phone,

    subject,

    message,

    "جدید",

    "",

    "",

    conversationId

  ]);


  SpreadsheetApp.flush();


  try {

    const email =
      getAdminEmail();


    if (
      email
    ) {

      GmailApp.sendEmail(

        email,

        "QuizDuo | پیام پشتیبانی | " +
          username,

        [

          "گفتگوی جدید پشتیبانی QuizDuo",

          "",

          "کاربر: " +
            username,

          "شماره تماس: " +
            (
              phone ||
              "-"
            ),

          "موضوع: " +
            subject,

          "شناسه گفتگو: " +
            conversationId,

          "",

          message

        ].join(
          "\n"
        )

      );

    }

  } catch (
    error
  ) {

    console.error(
      error
    );

  }


  return jsonResponse({

    success:
      true,

    conversationId,

    message:
      "گفتگو با موفقیت ثبت شد."

  });

}


/* =========================================================
   SUPPORT - CONTINUE
========================================================= */


function handleSupportUserReply(
  data
) {

  const username =
    String(
      data.username ||
      ""
    ).trim();


  const conversationId =
    String(
      data.conversationId ||
      ""
    ).trim();


  const message =
    String(
      data.message ||
      ""
    ).trim();


  if (
    !username ||
    username ===
      "بازیکن مهمان"
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "ابتدا وارد حساب شوید."

    });

  }


  if (
    !conversationId ||
    !message
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "اطلاعات گفت‌وگو کامل نیست."

    });

  }


  const sheet =
    getOrCreateSupportSheet();


  const values =
    sheet
      .getDataRange()
      .getValues();


  let found =
    false;


  let closed =
    false;


  let subject =
    "ادامه گفت‌وگو";


  let phone =
    "";


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const row =
      values[i];


    const rowConversationId =
      String(
        row[8] ||
        (
          "legacy-" +
          (
            i + 1
          )
        )
      );


    const rowUsername =
      String(
        row[1] ||
        ""
      ).trim();


    if (
      rowConversationId ===
        conversationId &&

      rowUsername
        .toLowerCase() ===
        username
          .toLowerCase()
    ) {

      found =
        true;


      subject =
        String(
          row[3] ||
          subject
        );


      phone =
        String(
          row[2] ||
          ""
        );


      if (
        String(
          row[5] ||
          ""
        ) ===
        "بسته شد"
      ) {

        closed =
          true;

      }

    }

  }


  if (
    !found
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "گفت‌وگو پیدا نشد."

    });

  }


  if (
    closed
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "این گفت‌وگو بسته شده است."

    });

  }


  sheet.appendRow([

    new Date(),

    username,

    phone,

    subject,

    message,

    "جدید",

    "",

    "",

    conversationId

  ]);


  SpreadsheetApp.flush();


  try {

    const email =
      getAdminEmail();


    if (
      email
    ) {

      GmailApp.sendEmail(

        email,

        "QuizDuo | ادامه پشتیبانی | " +
          username,

        [

          "کاربر در همان گفت‌وگوی قبلی پیام جدید فرستاد.",

          "",

          "کاربر: " +
            username,

          "موضوع: " +
            subject,

          "شناسه گفت‌وگو: " +
            conversationId,

          "",

          message

        ].join(
          "\n"
        )

      );

    }

  } catch (
    error
  ) {

    console.error(
      error
    );

  }


  return jsonResponse({

    success:
      true,

    message:
      "پیام در همان گفت‌وگو ثبت شد."

  });

}


/* =========================================================
   SUPPORT - CLOSE
========================================================= */


function closeSupportConversation(
  data
) {

  const username =
    String(
      data.username ||
      ""
    ).trim();


  const conversationId =
    String(
      data.conversationId ||
      ""
    ).trim();


  if (
    !username ||
    !conversationId
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "اطلاعات گفت‌وگو کامل نیست."

    });

  }


  const sheet =
    getOrCreateSupportSheet();


  const values =
    sheet
      .getDataRange()
      .getValues();


  let found =
    false;


  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const row =
      values[i];


    const rowConversationId =
      String(
        row[8] ||
        (
          "legacy-" +
          (
            i + 1
          )
        )
      );


    const rowUsername =
      String(
        row[1] ||
        ""
      ).trim();


    if (
      rowConversationId ===
        conversationId &&

      rowUsername
        .toLowerCase() ===
        username
          .toLowerCase()
    ) {

      sheet
        .getRange(
          i + 1,
          6
        )
        .setValue(
          "بسته شد"
        );


      found =
        true;

    }

  }


  if (
    !found
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "گفت‌وگو پیدا نشد."

    });

  }


  SpreadsheetApp.flush();


  return jsonResponse({

    success:
      true,

    message:
      "گفت‌وگو بسته شد."

  });

}


/* =========================================================
   USER UPDATES
========================================================= */


function getUserUpdates(
  data
) {

  return jsonResponse(
    getUserUpdatesObject(
      data
    )
  );

}


function getUserUpdatesObject(
  data
) {

  const username =
    String(
      data.username ||
      ""
    ).trim();


  if (
    !username ||
    username ===
      "بازیکن مهمان"
  ) {

    return {

      success:
        true,

      payments:
        [],

      support:
        [],

      subscription: {

        active:
          false

      }

    };

  }


  return {

    success:
      true,

    payments:
      getUserPaymentUpdates(
        username
      ),

    support:
      getUserSupportUpdates(
        username
      ),

    subscription:
      getUserSubscription(
        username
      )

  };

}


/* =========================================================
   PAYMENT USER UPDATES
========================================================= */


function getUserPaymentUpdates(
  username
) {

  const values =
    getOrCreateSheet()
      .getDataRange()
      .getValues();


  return values
    .slice(1)

    .map(
      (
        row,
        index
      ) => ({

        rowNumber:
          index + 2,

        timestamp:
          row[0]
            ? new Date(
                row[0]
              )
                .toISOString()
            : "",

        username:
          String(
            row[1] ||
            ""
          ),

        phone:
          row[2] ||
          "",

        planId:
          row[3] ||
          "",

        planName:
          row[4] ||
          "",

        amount:
          row[6] ||
          0,

        status:
          row[11] ||
          "در انتظار بررسی",

        userMessage:
          row[12] ||
          "",

        statusTimestamp:
          row[13]
            ? new Date(
                row[13]
              ).toISOString()
            : ""

      })
    )

    .filter(
      item =>

        item.username
          .toLowerCase() ===
        username
          .toLowerCase()

    )

    .reverse();

}


/* =========================================================
   SUPPORT USER UPDATES
========================================================= */


function getUserSupportUpdates(
  username
) {

  const values =
    getOrCreateSupportSheet()
      .getDataRange()
      .getValues();


  if (
    values.length <= 1
  ) {

    return [];

  }


  const groups =
    {};


  values
    .slice(1)
    .forEach(
      (
        row,
        index
      ) => {

        const rowNumber =
          index + 2;


        const conversationId =
          String(
            row[8] ||
            (
              "legacy-" +
              rowNumber
            )
          );


        const rowUsername =
          String(
            row[1] ||
            ""
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
          !groups[
            conversationId
          ]
        ) {

          groups[
            conversationId
          ] = {

            conversationId,

            rowNumber,

            timestamp:
              row[0]
                ? new Date(
                    row[0]
                  ).toISOString()
                : "",

            username:
              rowUsername,

            phone:
              row[2] ||
              "",

            subject:
              row[3] ||
              "",

            status:
              row[5] ||
              "جدید",

            thread:
              []

          };

        }


        const group =
          groups[
            conversationId
          ];


        group.status =
          row[5] ||
          group.status;


        if (
          row[4]
        ) {

          group.thread.push({

            sender:
              "user",

            text:
              String(
                row[4]
              ),

            timestamp:
              row[0]
                ? new Date(
                    row[0]
                  ).toISOString()
                : ""

          });

        }


        if (
          row[6]
        ) {

          group.thread.push({

            sender:
              "admin",

            text:
              String(
                row[6]
              ),

            timestamp:
              row[7]
                ? new Date(
                    row[7]
                  ).toISOString()
                : ""

          });

        }

      }
    );


  return Object
    .values(
      groups
    )
    .map(
      group => {

        group.thread.sort(
          (
            a,
            b
          ) =>

            new Date(
              a.timestamp ||
              0
            ) -

            new Date(
              b.timestamp ||
              0
            )

        );


        return group;

      }
    )
    .sort(
      (
        a,
        b
      ) =>

        new Date(
          b.timestamp ||
          0
        ) -

        new Date(
          a.timestamp ||
          0
        )
    );

}


/* =========================================================
   SUBSCRIPTION
========================================================= */


function getUserSubscription(
  username
) {

  const values =
    getOrCreateSheet()
      .getDataRange()
      .getValues();


  const monthsMap = {

    monthly:
      1,

    quarterly:
      3,

    sixMonth:
      6,

    nineMonth:
      9

  };


  const approved =
    values
      .slice(1)

      .map(
        (
          row,
          index
        ) => ({

          row,

          rowNumber:
            index + 2

        })
      )

      .filter(
        item =>

          String(
            item.row[1] ||
            ""
          )
            .trim()
            .toLowerCase() ===
          username
            .toLowerCase()

          &&

          String(
            item.row[11] ||
            ""
          )
            .trim() ===
          "تأیید شد"

      )

      .sort(
        (
          a,
          b
        ) =>

          new Date(
            a.row[0] ||
            0
          ) -

          new Date(
            b.row[0] ||
            0
          )

      );


  if (
    !approved.length
  ) {

    return {

      active:
        false,

      planId:
        "",

      planName:
        "",

      start:
        null,

      expiry:
        null

    };

  }


  let cursor =
    null;


  let activeStart =
    null;


  let activeExpiry =
    null;


  let activePlanId =
    "";


  let activePlanName =
    "";


  approved.forEach(
    item => {

      const paymentDate =
        new Date(
          item.row[0] ||
          Date.now()
        );


      const months =
        Number(
          monthsMap[
            String(
              item.row[3] ||
              ""
            )
          ] ||
          0
        );


      if (
        !months
      ) {

        return;

      }


      const base =
        cursor &&
        cursor.getTime() >
          paymentDate.getTime()

          ? new Date(
              cursor
            )

          : new Date(
              paymentDate
            );


      const expiry =
        addMonths(
          base,
          months
        );


      activeStart =
        base;


      activeExpiry =
        expiry;


      activePlanId =
        String(
          item.row[3] ||
          ""
        );


      activePlanName =
        String(
          item.row[4] ||
          activePlanId
        );


      cursor =
        expiry;

    }
  );


  const now =
    new Date();


  const active =
    activeExpiry &&
    activeExpiry.getTime() >
      now.getTime();


  return {

    active:
      Boolean(
        active
      ),

    planId:
      active
        ? activePlanId
        : "",

    planName:
      active
        ? activePlanName
        : "",

    start:
      active
        ? activeStart
          .toISOString()
        : null,

    expiry:
      active
        ? activeExpiry
          .toISOString()
        : null

  };

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
      months
    )
  );


  const lastDay =
    new Date(

      result.getFullYear(),

      result.getMonth() +
        1,

      0

    )
      .getDate();


  result.setDate(
    Math.min(
      day,
      lastDay
    )
  );


  return result;

}


/* =========================================================
   DRIVE / EMAIL
========================================================= */


function getOrCreateReceiptFolder() {

  const folders =
    DriveApp
      .getFoldersByName(
        CONFIG
          .DRIVE_FOLDER_NAME
      );


  return folders.hasNext()

    ? folders.next()

    : DriveApp.createFolder(
        CONFIG
          .DRIVE_FOLDER_NAME
      );

}


function sendReceiptEmail(
  data,
  amount,
  fileUrl,
  file
) {

  const email =
    getAdminEmail();


  if (
    !email
  ) {

    return;

  }


  GmailApp.sendEmail(

    email,

    "QuizDuo | فیش پرداخت جدید | " +
      data.username,

    [

      "فیش پرداخت جدید دریافت شد.",

      "",

      "کاربر: " +
        data.username,

      "شماره تماس: " +
        (
          data.phone ||
          "-"
        ),

      "پلن: " +
        (
          data.planName ||
          data.plan
        ),

      "مبلغ: " +
        Number(
          amount ||
          0
        )
          .toLocaleString(
            "fa-IR"
          ) +
        " تومان",

      "",

      "لینک فیش:",

      fileUrl

    ].join(
      "\n"
    ),

    {

      attachments:
        [
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
        "ADMIN_EMAIL"
      );


  if (
    saved
  ) {

    return saved;

  }


  return (
    Session
      .getEffectiveUser()
      .getEmail() ||
    ""
  );

}


/* =========================================================
   SHEETS
========================================================= */


function getOrCreateSpreadsheet() {

  const props =
    PropertiesService
      .getScriptProperties();


  let id =
    props.getProperty(
      "PAYMENTS_SPREADSHEET_ID"
    );


  let spreadsheet =
    null;


  if (
    id
  ) {

    try {

      spreadsheet =
        SpreadsheetApp
          .openById(
            id
          );

    } catch (
      error
    ) {

      spreadsheet =
        null;

    }

  }


  if (
    !spreadsheet
  ) {

    spreadsheet =
      SpreadsheetApp.create(
        "QuizDuo Payments"
      );


    props.setProperty(
      "PAYMENTS_SPREADSHEET_ID",
      spreadsheet.getId()
    );

  }


  return spreadsheet;

}


function getOrCreateSheet() {

  return getSheet(
    CONFIG.SHEET_NAME,
    PAYMENT_HEADERS
  );

}


function getOrCreateSupportSheet() {

  return getSheet(
    CONFIG.SUPPORT_SHEET_NAME,
    SUPPORT_HEADERS
  );

}


function getOrCreateUsersSheet() {

  return getSheet(
    CONFIG.USERS_SHEET_NAME,
    USER_HEADERS
  );

}


function getSheet(
  name,
  headers
) {

  const spreadsheet =
    getOrCreateSpreadsheet();


  let sheet =
    spreadsheet
      .getSheetByName(
        name
      );


  if (
    !sheet
  ) {

    sheet =
      spreadsheet.insertSheet(
        name
      );

  }


  ensureHeaders(
    sheet,
    headers
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
    (
      header,
      index
    ) => {

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


  if (
    sheet.getFrozenRows() ===
    0
  ) {

    sheet.setFrozenRows(
      1
    );

  }

}


/* =========================================================
   ADMIN
========================================================= */


function checkAdmin(
  password
) {

  return (
    String(
      password ||
      ""
    ) ===
    CONFIG.ADMIN_PASSWORD
  );

}


function getPaymentsForAdmin(
  password
) {

  if (
    !checkAdmin(
      password
    )
  ) {

    throw new Error(
      "رمز مدیریت اشتباه است."
    );

  }


  const values =
    getOrCreateSheet()
      .getDataRange()
      .getValues();


  return values
    .slice(1)
    .map(
      (
        row,
        index
      ) => ({

        rowNumber:
          index + 2,

        timestamp:
          row[0]
            ? new Date(
                row[0]
              )
                .toISOString()
            : "",

        username:
          row[1] ||
          "",

        phone:
          row[2] ||
          "",

        planId:
          row[3] ||
          "",

        planName:
          row[4] ||
          "",

        originalAmount:
          row[5] ||
          0,

        amount:
          row[6] ||
          0,

        discountPercent:
          row[7] ||
          0,

        discountCode:
          row[8] ||
          "",

        fileName:
          row[9] ||
          "",

        receiptUrl:
          row[10] ||
          "",

        status:
          row[11] ||
          "در انتظار بررسی",

        userMessage:
          row[12] ||
          "",

        statusTimestamp:
          row[13]
            ? new Date(
                row[13]
              )
                .toISOString()
            : ""

      })
    )
    .reverse();

}


function updatePaymentStatus(
  password,
  rowNumber,
  status
) {

  if (
    !checkAdmin(
      password
    )
  ) {

    throw new Error(
      "رمز مدیریت اشتباه است."
    );

  }


  const allowed = [

    "تأیید شد",

    "رد شد",

    "در انتظار بررسی"

  ];


  if (
    !allowed.includes(
      status
    )
  ) {

    throw new Error(
      "وضعیت نامعتبر است."
    );

  }


  const sheet =
    getOrCreateSheet();


  const row =
    Number(
      rowNumber
    );


  const username =
    String(
      sheet
        .getRange(
          row,
          2
        )
        .getValue() ||
        ""
    );


  const planId =
    String(
      sheet
        .getRange(
          row,
          4
        )
        .getValue() ||
        ""
    );


  let userMessage =
    "";


  if (
    status ===
    "تأیید شد"
  ) {

    userMessage =
      "پرداخت شما تأیید شد و اشتراک فعال شد.";

  }


  if (
    status ===
    "رد شد"
  ) {

    userMessage =
      "پرداخت شما رد شد.";

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
      new Date()
    );


  SpreadsheetApp.flush();


  return {

    success:
      true,

    username,

    planId,

    status,

    userMessage

  };

}


function getSupportForAdmin(
  password
) {

  if (
    !checkAdmin(
      password
    )
  ) {

    throw new Error(
      "رمز مدیریت اشتباه است."
    );

  }


  const values =
    getOrCreateSupportSheet()
      .getDataRange()
      .getValues();


  return values
    .slice(1)
    .map(
      (
        row,
        index
      ) => ({

        rowNumber:
          index + 2,

        timestamp:
          row[0]
            ? new Date(
                row[0]
              )
                .toISOString()
            : "",

        username:
          row[1] ||
          "",

        phone:
          row[2] ||
          "",

        subject:
          row[3] ||
          "",

        message:
          row[4] ||
          "",

        status:
          row[5] ||
          "جدید",

        adminReply:
          row[6] ||
          "",

        replyTimestamp:
          row[7]
            ? new Date(
                row[7]
              )
                .toISOString()
            : "",

        conversationId:
          String(
            row[8] ||
            (
              "legacy-" +
              (
                index + 2
              )
            )
          )

      })
    )
    .reverse();

}


function replyToSupport(
  password,
  rowNumber,
  reply,
  status
) {

  if (
    !checkAdmin(
      password
    )
  ) {

    throw new Error(
      "رمز مدیریت اشتباه است."
    );

  }


  const text =
    String(
      reply ||
      ""
    ).trim();


  if (
    !text
  ) {

    throw new Error(
      "متن پاسخ را وارد کنید."
    );

  }


  const allowed = [

    "جدید",

    "در حال بررسی",

    "پاسخ داده شد",

    "بسته شد"

  ];


  const finalStatus =
    allowed.includes(
      status
    )
      ? status
      : "پاسخ داده شد";


  const sheet =
    getOrCreateSupportSheet();


  const row =
    Number(
      rowNumber
    );


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

    success:
      true,

    message:
      "پاسخ با موفقیت ثبت شد."

  };

}


function updateSupportStatus(
  password,
  rowNumber,
  status
) {

  if (
    !checkAdmin(
      password
    )
  ) {

    throw new Error(
      "رمز مدیریت اشتباه است."
    );

  }


  const allowed = [

    "جدید",

    "در حال بررسی",

    "پاسخ داده شد",

    "بسته شد"

  ];


  if (
    !allowed.includes(
      status
    )
  ) {

    throw new Error(
      "وضعیت نامعتبر است."
    );

  }


  getOrCreateSupportSheet()
    .getRange(
      Number(
        rowNumber
      ),
      6
    )
    .setValue(
      status
    );


  SpreadsheetApp.flush();


  return {

    success:
      true

  };

}


/* =========================================================
   DRIVE / HELPERS
========================================================= */


function sanitizeFileName(
  value
) {

  return String(
    value ||
    "user"
  )

    .replace(
      /[\\/:*?"<>|]/g,
      "_"
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
      JSON.stringify(
        data
      )
    )

    .setMimeType(
      ContentService
        .MimeType
        .JSON
    );

}


function jsonpResponse(
  callback,
  data
) {

  const safeCallback =
    String(
      callback ||
      ""
    )
      .replace(
        /[^a-zA-Z0-9_$.]/g,
        ""
      );


  if (
    !safeCallback
  ) {

    return jsonResponse({

      success:
        false,

      message:
        "callback نامعتبر است."

    });

  }


  return ContentService

    .createTextOutput(

      safeCallback +
      "(" +
      JSON.stringify(
        data
      ) +
      ")"

    )

    .setMimeType(
      ContentService
        .MimeType
        .JAVASCRIPT
    );

}


function getOrCreateReceiptFolder() {

  const folders =
    DriveApp
      .getFoldersByName(
        CONFIG
          .DRIVE_FOLDER_NAME
      );


  return folders.hasNext()

    ? folders.next()

    : DriveApp.createFolder(
        CONFIG
          .DRIVE_FOLDER_NAME
      );

}


function getAdminEmail() {

  const saved =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        "ADMIN_EMAIL"
      );


  if (
    saved
  ) {

    return saved;

  }


  return (
    Session
      .getEffectiveUser()
      .getEmail() ||
    ""
  );

}


function getOrCreateSpreadsheet() {

  const props =
    PropertiesService
      .getScriptProperties();


  let id =
    props.getProperty(
      "PAYMENTS_SPREADSHEET_ID"
    );


  let spreadsheet =
    null;


  if (
    id
  ) {

    try {

      spreadsheet =
        SpreadsheetApp
          .openById(
            id
          );

    } catch (
      error
    ) {

      spreadsheet =
        null;

    }

  }


  if (
    !spreadsheet
  ) {

    spreadsheet =
      SpreadsheetApp.create(
        "QuizDuo Payments"
      );


    props.setProperty(
      "PAYMENTS_SPREADSHEET_ID",
      spreadsheet.getId()
    );

  }


  return spreadsheet;

}


/* =========================================================
   TEST EMAIL
========================================================= */


function testEmail() {

  const email =
    getAdminEmail();


  if (
    !email
  ) {

    throw new Error(
      "ADMIN_EMAIL تنظیم نشده است."
    );

  }


  GmailApp.sendEmail(

    email,

    "QuizDuo Test Email",

    "ارسال ایمیل تست با موفقیت انجام شد."

  );

}
