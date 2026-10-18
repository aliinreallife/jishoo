export const visibilityMode = (me) => me.shareLocation ? (me.discoverable ? "profile" : "news") : "hidden";
export const visibilityLabel = (mode) => ({ hidden: "پنهان", news: "بی‌نام برای دیگران", profile: "با پروفایلم" })[mode];
