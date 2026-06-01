import wechatContactQr from "@/assets/support/wechat-contact-qr.png";

/** 左侧浮层「技术支持」二维码；替换时只需更新 src/assets/support/wechat-contact-qr.png */
export const SUPPORT_QR = {
  src: wechatContactQr,
  alt: "技术支持微信二维码",
  hint: "扫码添加微信，获取技术支持。",
} as const;
