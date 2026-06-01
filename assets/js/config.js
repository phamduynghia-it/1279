/**
 * CẤU HÌNH LOCAL - Dựng lại từ API response
 * Đã chuyển tất cả URL ảnh/nhạc về file local
 */
(function(){
'use strict';

window.APP_CONFIG = {
    "enableLockAndChat": true,
    "enablePasscode": true,
    "enableLetter": true,
    "enableWebsiteInfo": true,
    "websiteTitle": "Gửi tới Yi",
    "appTitle": "bé iu",
    "appIcon": "assets/images/user-appicon.jpg",
    "bgMusic": "musics/music.mp3",
    "passcode": "0000",
    "passcodeTitle": "Nhập mật mã tình yêu",
    "passcodeSubtitle": "mật khẩu là: 0000",
    "phoneBackground": "assets/images/user-bg.jpg",
    "selectedTemplateKey": "love",
    "recipientName": "Anh iu ❤️",
    "avatar": "assets/images/user-avatar.jpg",
    "messages": [
        { "id": 1, "side": "left", "text": "hello bé iu", "delay": 0 },
        { "id": 2, "side": "left", "text": "hôm nay là valentine ấy", "delay": 1150 },
        { "id": 3, "side": "left", "text": "anh xin lỗi vì valentine năm nay a không bên cạnh em được", "delay": 2850 },
        { "id": 4, "side": "left", "text": "em đừng buồn nhé", "delay": 1000 },
        { "id": 5, "side": "left", "text": "anh có một chút bất ngờ dành cho em nè ❤️", "delay": 2050 }
    ],
    "heart": {
        "mode": "days",
        "valentineMessageLine1": "",
        "valentineMessageLine2": "",
        "loveStartDate": "2023-05-27",
        "loveDaysLabel": "bên nhau",
        "loveNameLeft": "Sin",
        "loveNameRight": "Yi",
        "heartSideImageLeft": "assets/images/heart-left.jpg",
        "heartSideImageRight": "assets/images/heart-right.jpg",
        "mobileHeartOffsetY": 0.7
    },
    "letter": {
        "type": "cupid",
        "text": "Chúc mừng ngày valentine\nanh có đôi điều nhắn nhủ tới em\nHy vọng nhiều năm sau nữa, anh và em vẫn cùng nhau nắm tay đi qua tất cả thăng trầm của cuộc sống.\nCảm ơn vì chúng ta đã gặp được nhau.\nVì yêu mà đến, vì thương mà ở lại, vì hiểu nhau mà nhường nhịn nhau đến hiện tại.\nChúc anh và em sẽ luôn vui vẻ và hạnh phúc, mãi bên nhau như vậy nhé",
        "signatureText": "mãi iu em"
    },
    "enableSphereFlyingImages": true,
    "sphereImages": [
        "assets/images/spheres/sphere-0.jpg",
        "assets/images/spheres/sphere-1.jpg",
        "assets/images/spheres/sphere-2.jpg",
        "assets/images/spheres/sphere-3.jpg",
        "assets/images/spheres/sphere-4.jpg",
        "assets/images/spheres/sphere-5.jpg",
        "assets/images/spheres/sphere-6.jpg"
    ],
    "expirationOption": "never",
    "expiresAt": null,
    "lockBackgroundDefaults": {
        "default1": "assets/images/backgrounds/backgroudmobile1.png",
        "default2": "assets/images/backgrounds/bakcgroudmobile2.png"
    },
    "templates": [
        {
            "key": "default",
            "name": "Mặc định",
            "theme": {
                "iconColor": "#FFFFFF",
                "bgImage": "",
                "bubbleLeftBg": "#3A3B3C",
                "bubbleLeftText": "#E4E6EB",
                "bubbleRightBg": "#0084FF",
                "bubbleRightText": "#FFFFFF",
                "inputBg": "#3A3B3C",
                "sendActiveColor": "#0084FF",
                "headerBg": "rgba(23, 23, 23, 0.92)",
                "inputContainerBg": "linear-gradient(to top, #0a0a0a, rgba(23, 23, 23, 0.92))",
                "likeIcon": "👍"
            }
        },
        {
            "key": "love",
            "name": "Tình yêu",
            "theme": {
                "iconColor": "#FF3B7B",
                "bgImage": "assets/images/chat/hinhnentinhyeu.jpg",
                "bubbleLeftBg": "#FFFFFF",
                "bubbleLeftText": "#1a1a1a",
                "bubbleRightBg": "#FF3B7B",
                "bubbleRightText": "#FFFFFF",
                "inputBg": "#4a1f3a",
                "sendActiveColor": "#FF3B7B",
                "headerBg": "rgba(255, 182, 193, 0.85)",
                "inputContainerBg": "linear-gradient(to top, #ffe4ec, rgba(255, 182, 193, 0.9))",
                "likeIcon": "💕",
                "sendIdleIcon": "💕"
            }
        },
        {
            "key": "rainbow",
            "name": "Cầu vồng",
            "theme": {
                "iconColor": "#FFD54F",
                "bgImage": "assets/images/backgrounds/rainbowwallpaper.png",
                "bubbleLeftBg": "#563B7C",
                "bubbleLeftText": "#EDE9FE",
                "bubbleRightBg": "#FF9E2C",
                "bubbleRightText": "#1F2937",
                "inputBg": "#374151",
                "sendActiveColor": "#FF9E2C",
                "headerBg": "rgba(55, 35, 65, 0.9)",
                "inputContainerBg": "linear-gradient(to top, #1f1725, rgba(55, 35, 65, 0.9))",
                "likeIcon": "👍"
            }
        }
    ],
    "messageDelayMsPerChar": 50,
    "messageDelayMinMs": 1000,
    "messageDelayMaxMs": 3000,
    "heartDelayBeforeFlyoutMs": 5000,
    "flyOutSpreadDurationMs": 5000,
    "holdDurationMs": 2500
};

window.HEART_MESSAGE_CONFIG = window.APP_CONFIG.heart || {};

})();