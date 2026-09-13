const CONFIG = {

    ADMIN_EMAIL: 'hvasei90@gmail.com',

    // حتماً رمز مدیر را تغییر بده.
    ADMIN_PASSWORD: 'Avang20',

    SHEET_NAME: 'Requests',

    DRIVE_FOLDER_NAME: 'QuizDuo Receipts'
};


/* =========================================================
   CREATE PAYMENT REQUEST
========================================================= */

function doPost(e) {

    try {

        const body =
            JSON.parse(
                e.postData.contents || '{}'
            );


        if (
            body.action !==
            'create_request'
        ) {

            return json_({
                ok: false,
                error: 'Invalid action'
            });
        }


        const username =
            String(
                body.username || ''
            ).trim();


        const phone =
            String(
                body.phone || ''
            ).trim();


        const plan =
            String(
                body.plan || ''
            ).trim();


        const planName =
            String(
                body.planName || ''
            ).trim();


        const amount =
            Number(
                body.amount || 0
            );


        const receiptBase64 =
            String(
                body.receiptBase64 || ''
            );


        const receiptName =
            String(
                body.receiptName ||
                'receipt.jpg'
            );


        const receiptType =
            String(
                body.receiptType ||
                'image/jpeg'
            );


        if (
            !username ||
            !phone ||
            !plan ||
            !planName ||
            !amount ||
            !receiptBase64
        ) {

            return json_({
                ok: false,
                error:
                    'Missing required fields'
            });
        }


        const requestId =
            String(
                body.requestId ||
                (
                    'QD-' +
                    Utilities
                        .getUuid()
                        .replace(/-/g, '')
                        .slice(0, 10)
                        .toUpperCase()
                )
            );


        const now =
            new Date();


        /* -------------------------
           DRIVE
        ------------------------- */

        const folder =
            getReceiptFolder_();


        const bytes =
            Utilities.base64Decode(
                receiptBase64
            );


        const blob =
            Utilities.newBlob(
                bytes,
                receiptType,
                requestId +
                '-' +
                receiptName
            );


        const file =
            folder.createFile(blob);


        file.setDescription(
            'QuizDuo payment receipt - ' +
            username +
            ' - ' +
            phone +
            ' - ' +
            planName
        );


        /* -------------------------
           SHEET
        ------------------------- */

        const sheet =
            getSheet_();


        sheet.appendRow([

            requestId,

            now,

            username,

            phone,

            plan,

            planName,

            amount,

            'pending',

            file.getId(),

            file.getUrl(),

            ''

        ]);


        /* -------------------------
           EMAIL
        ------------------------- */

        MailApp.sendEmail({

            to:
                CONFIG.ADMIN_EMAIL,

            subject:
                'QuizDuo | درخواست اشتراک جدید | ' +
                planName,

            htmlBody:
                buildAdminEmail_(
                    requestId,
                    username,
                    phone,
                    planName,
                    amount,
                    now,
                    file.getUrl()
                ),

            attachments: [
                blob
            ]

        });


        return json_({

            ok: true,

            requestId,

            status: 'pending'

        });


    } catch (err) {

        return json_({

            ok: false,

            error:
                String(err)

        });
    }
}


/* =========================================================
   GET / STATUS / ADMIN PAGE
========================================================= */

function doGet(e) {

    const action =
        String(
            e &&
            e.parameter &&
            e.parameter.action ||
            ''
        );


    /* -------------------------
       PAYMENT STATUS
    ------------------------- */

    if (
        action === 'status'
    ) {

        const requestId =
            String(
                e.parameter.requestId ||
                ''
            );


        const username =
            String(
                e.parameter.username ||
                ''
            );


        const callback =
            String(
                e.parameter.callback ||
                ''
            );


        const result =
            getStatus_(
                requestId,
                username
            );


        /*
         * JSONP برای جلوگیری از مشکل
         * CORS در GitHub Pages
         */

        if (callback) {

            return ContentService

                .createTextOutput(

                    callback +
                    '(' +
                    JSON.stringify(
                        result
                    ) +
                    ');'

                )

                .setMimeType(
                    ContentService
                        .MimeType
                        .JAVASCRIPT
                );
        }


        return json_(
            result
        );
    }


    /* -------------------------
       ADMIN PANEL
    ------------------------- */

    return HtmlService

        .createHtmlOutputFromFile(
            'Admin'
        )

        .setTitle(
            'QuizDuo Admin'
        );
}


/* =========================================================
   ADMIN LOGIN
========================================================= */

function adminLogin(password) {

    if (
        String(password || '') !==
        CONFIG.ADMIN_PASSWORD
    ) {

        throw new Error(
            'رمز مدیر اشتباه است.'
        );
    }


    const token =
        Utilities.getUuid();


    CacheService

        .getScriptCache()

        .put(
            'admin:' + token,
            '1',
            21600
        );


    return token;
}


/* =========================================================
   ADMIN LIST
========================================================= */

function adminList(token) {

    requireAdmin_(
        token
    );


    const sheet =
        getSheet_();


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

        .reverse()

        .map(row => ({

            requestId:
                String(
                    row[0]
                ),

            createdAt:
                new Date(
                    row[1]
                ).toISOString(),

            username:
                String(
                    row[2]
                ),

            phone:
                String(
                    row[3]
                ),

            plan:
                String(
                    row[4]
                ),

            planName:
                String(
                    row[5]
                ),

            amount:
                Number(
                    row[6]
                ),

            status:
                String(
                    row[7]
                ),

            receiptUrl:
                String(
                    row[9] || ''
                )

        }));
}


/* =========================================================
   ADMIN SET STATUS
========================================================= */

function adminSetStatus(
    token,
    requestId,
    status
) {

    requireAdmin_(
        token
    );


    if (
        ![
            'approved',
            'rejected'
        ].includes(status)
    ) {

        throw new Error(
            'وضعیت نامعتبر است.'
        );
    }


    const sheet =
        getSheet_();


    const values =
        sheet
            .getDataRange()
            .getValues();


    for (
        let i = 1;
        i < values.length;
        i++
    ) {

        if (
            String(
                values[i][0]
            ) ===
            String(
                requestId
            )
        ) {

            /*
             * ستون H = Status
             */

            sheet
                .getRange(
                    i + 1,
                    8
                )
                .setValue(
                    status
                );


            /*
             * ستون K = Reviewed At
             */

            sheet
                .getRange(
                    i + 1,
                    11
                )
                .setValue(
                    new Date()
                );


            return {

                ok: true,

                status

            };
        }
    }


    throw new Error(
        'درخواست پیدا نشد.'
    );
}


/* =========================================================
   GET PAYMENT STATUS
========================================================= */

function getStatus_(
    requestId,
    username
) {

    if (
        !requestId ||
        !username
    ) {

        return {

            ok: false,

            status:
                'not_found'

        };
    }


    const sheet =
        getSheet_();


    const values =
        sheet
            .getDataRange()
            .getValues();


    for (
        let i = 1;
        i < values.length;
        i++
    ) {

        if (

            String(
                values[i][0]
            ) ===
            requestId &&

            String(
                values[i][2]
            )
                .toLowerCase() ===
            username.toLowerCase()

        ) {

            return {

                ok: true,

                requestId,

                status:
                    String(
                        values[i][7]
                    ),

                plan:
                    String(
                        values[i][5]
                    ),

                amount:
                    Number(
                        values[i][6]
                    )

            };
        }
    }


    return {

        ok: false,

        status:
            'not_found'

    };
}


/* =========================================================
   SHEET
========================================================= */

function getSheet_() {

    const props =
        PropertiesService
            .getScriptProperties();


    let id =
        props.getProperty(
            'QUIZDUO_SHEET_ID'
        );


    let ss;


    if (id) {

        try {

            ss =
                SpreadsheetApp
                    .openById(
                        id
                    );

        } catch (_) {}

    }


    if (!ss) {

        ss =
            SpreadsheetApp.create(
                'QuizDuo Payment Requests'
            );


        props.setProperty(
            'QUIZDUO_SHEET_ID',
            ss.getId()
        );
    }


    let sheet =
        ss.getSheetByName(
            CONFIG.SHEET_NAME
        );


    if (!sheet) {

        sheet =
            ss.insertSheet(
                CONFIG.SHEET_NAME
            );
    }


    /* -------------------------
       CREATE HEADER
    ------------------------- */

    if (
        sheet.getLastRow() === 0
    ) {

        sheet.appendRow([

            'Request ID',
            'Created At',
            'Username',
            'Phone',
            'Plan ID',
            'Plan Name',
            'Amount',
            'Status',
            'Receipt File ID',
            'Receipt URL',
            'Reviewed At'

        ]);

    } else {

        /*
         * اگر Sheet از نسخه قبلی باشد،
         * ستون Phone را اضافه می‌کنیم.
         */

        const header =
            sheet
                .getRange(
                    1,
                    1,
                    1,
                    Math.max(
                        1,
                        sheet.getLastColumn()
                    )
                )
                .getValues()[0];


        if (
            header.indexOf(
                'Phone'
            ) === -1
        ) {

            sheet.insertColumnAfter(
                3
            );

            sheet
                .getRange(
                    1,
                    4
                )
                .setValue(
                    'Phone'
                );
        }
    }


    return sheet;
}


/* =========================================================
   DRIVE FOLDER
========================================================= */

function getReceiptFolder_() {

    const folders =
        DriveApp
            .getFoldersByName(
                CONFIG.DRIVE_FOLDER_NAME
            );


    return folders.hasNext()

        ? folders.next()

        : DriveApp.createFolder(
            CONFIG.DRIVE_FOLDER_NAME
        );
}


/* =========================================================
   ADMIN AUTH
========================================================= */

function requireAdmin_(
    token
) {

    if (

        !token ||

        CacheService
            .getScriptCache()
            .get(
                'admin:' + token
            ) !== '1'

    ) {

        throw new Error(
            'نشست مدیر منقضی شده است.'
        );
    }
}


/* =========================================================
   ADMIN EMAIL
========================================================= */

function buildAdminEmail_(
    requestId,
    username,
    phone,
    planName,
    amount,
    createdAt,
    receiptUrl
) {

    return (

        '<div dir="rtl" ' +

        'style="' +
        'font-family:Arial,sans-serif;' +
        'line-height:1.9' +
        '">' +

        '<h2>' +
        'درخواست اشتراک جدید QuizDuo' +
        '</h2>' +

        '<p>' +

        '<b>شناسه درخواست:</b> ' +

        escape_(
            requestId
        ) +

        '</p>' +

        '<p>' +

        '<b>نام کاربری:</b> ' +

        escape_(
            username
        ) +

        '</p>' +

        '<p>' +

        '<b>شماره تلفن:</b> ' +

        escape_(
            phone
        ) +

        '</p>' +

        '<p>' +

        '<b>اشتراک:</b> ' +

        escape_(
            planName
        ) +

        '</p>' +

        '<p>' +

        '<b>مبلغ:</b> ' +

        Number(
            amount
        )
            .toLocaleString(
                'fa-IR'
            ) +

        ' تومان' +

        '</p>' +

        '<p>' +

        '<b>زمان:</b> ' +

        escape_(
            createdAt.toLocaleString(
                'fa-IR'
            )
        ) +

        '</p>' +

        '<p>' +

        'فیش در این ایمیل پیوست شده است. ' +

        'همچنین در Google Drive ذخیره شده است.' +

        '</p>' +

        '<p>' +

        '<a href="' +

        escape_(
            receiptUrl
        ) +

        '">' +

        'مشاهده فایل فیش' +

        '</a>' +

        '</p>' +

        '<hr>' +

        '<p>' +

        'پس از بررسی فیش، ' +

        'از پنل مدیر وضعیت درخواست را ' +

        'تأیید یا رد کنید.' +

        '</p>' +

        '</div>'
    );
}


/* =========================================================
   ESCAPE
========================================================= */

function escape_(value) {

    return String(
        value
    )
        .replace(
            /[&<>'"]/g,
            c => ({

                '&':
                    '&amp;',

                '<':
                    '&lt;',

                '>':
                    '&gt;',

                "'":
                    '&#39;',

                '"':
                    '&quot;'

            }[c])
        );
}


/* =========================================================
   JSON RESPONSE
========================================================= */

function json_(obj) {

    return ContentService

        .createTextOutput(
            JSON.stringify(
                obj
            )
        )

        .setMimeType(
            ContentService
                .MimeType
                .JSON
        );
}
