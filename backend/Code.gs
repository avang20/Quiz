const CONFIG = {

    ADMIN_EMAIL: 'hvasei90@gmail.com',

    // این رمز را حتماً خودت تغییر بده.
    ADMIN_PASSWORD: 'CHANGE_THIS_ADMIN_PASSWORD',

    SHEET_NAME: 'Requests',

    DRIVE_FOLDER_NAME: 'QuizDuo Receipts'
};


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
            !plan ||
            !planName ||
            !amount ||
            !receiptBase64
        ) {

            return json_({
                ok: false,
                error: 'Missing required fields'
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
            planName
        );


        const sheet =
            getSheet_();


        sheet.appendRow([

            requestId,

            now,

            username,

            plan,

            planName,

            amount,

            'pending',

            file.getId(),

            file.getUrl(),

            ''

        ]);


        MailApp.sendEmail({

            to: CONFIG.ADMIN_EMAIL,

            subject:
                'QuizDuo | درخواست پرداخت جدید | ' +
                planName,

            htmlBody:
                buildAdminEmail_(
                    requestId,
                    username,
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

            error: String(err)

        });
    }
}


function doGet(e) {

    const action =
        String(
            e &&
            e.parameter &&
            e.parameter.action ||
            ''
        );


    if (action === 'status') {

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


        if (callback) {

            return ContentService
                .createTextOutput(
                    callback +
                    '(' +
                    JSON.stringify(result) +
                    ');'
                )
                .setMimeType(
                    ContentService.MimeType.JAVASCRIPT
                );
        }


        return json_(result);
    }


    return HtmlService
        .createHtmlOutputFromFile(
            'Admin'
        )
        .setTitle(
            'QuizDuo Admin'
        );
}


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


function adminList(token) {

    requireAdmin_(token);


    const sheet =
        getSheet_();


    const values =
        sheet.getDataRange()
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
                String(row[0]),

            createdAt:
                new Date(
                    row[1]
                ).toISOString(),

            username:
                String(row[2]),

            plan:
                String(row[3]),

            planName:
                String(row[4]),

            amount:
                Number(row[5]),

            status:
                String(row[6]),

            receiptUrl:
                String(row[8] || '')

        }));
}


function adminSetStatus(
    token,
    requestId,
    status
) {

    requireAdmin_(token);


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
        sheet.getDataRange()
            .getValues();


    for (
        let i = 1;
        i < values.length;
        i++
    ) {

        if (
            String(values[i][0]) ===
            String(requestId)
        ) {

            sheet
                .getRange(i + 1, 7)
                .setValue(status);


            sheet
                .getRange(i + 1, 10)
                .setValue(new Date());


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
            status: 'not_found'
        };
    }


    const sheet =
        getSheet_();


    const values =
        sheet.getDataRange()
            .getValues();


    for (
        let i = 1;
        i < values.length;
        i++
    ) {

        if (
            String(values[i][0]) ===
            requestId &&

            String(values[i][2])
                .toLowerCase() ===
            username.toLowerCase()
        ) {

            return {

                ok: true,

                requestId,

                status:
                    String(values[i][6]),

                plan:
                    String(values[i][4]),

                amount:
                    Number(values[i][5])

            };
        }
    }


    return {
        ok: false,
        status: 'not_found'
    };
}


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
                    .openById(id);

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


    if (
        sheet.getLastRow() === 0
    ) {

        sheet.appendRow([

            'Request ID',
            'Created At',
            'Username',
            'Plan ID',
            'Plan Name',
            'Amount',
            'Status',
            'Receipt File ID',
            'Receipt URL',
            'Reviewed At'

        ]);
    }


    return sheet;
}


function getReceiptFolder_() {

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


function requireAdmin_(token) {

    if (
        !token ||
        CacheService
            .getScriptCache()
            .get('admin:' + token) !==
        '1'
    ) {

        throw new Error(
            'نشست مدیر منقضی شده است.'
        );
    }
}


function buildAdminEmail_(
    requestId,
    username,
    planName,
    amount,
    createdAt,
    receiptUrl
) {

    return (

        '<div dir="rtl" ' +
        'style="font-family:Arial,sans-serif;line-height:1.9">' +

        '<h2>' +
        'درخواست اشتراک جدید QuizDuo' +
        '</h2>' +

        '<p><b>شناسه درخواست:</b> ' +
        escape_(requestId) +
        '</p>' +

        '<p><b>نام کاربری:</b> ' +
        escape_(username) +
        '</p>' +

        '<p><b>اشتراک:</b> ' +
        escape_(planName) +
        '</p>' +

        '<p><b>مبلغ:</b> ' +
        Number(amount)
            .toLocaleString('fa-IR') +
        ' تومان</p>' +

        '<p><b>زمان:</b> ' +
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
        escape_(receiptUrl) +
        '">' +

        'مشاهده فایل فیش' +

        '</a>' +

        '</p>' +

        '<hr>' +

        '<p>' +
        'برای تأیید یا رد، وارد پنل مدیر QuizDuo شوید.' +
        '</p>' +

        '</div>'
    );
}


function escape_(value) {

    return String(value)
        .replace(
            /[&<>'"]/g,
            c => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[c])
        );
}


function json_(obj) {

    return ContentService
        .createTextOutput(
            JSON.stringify(obj)
        )
        .setMimeType(
            ContentService.MimeType.JSON
        );
}
