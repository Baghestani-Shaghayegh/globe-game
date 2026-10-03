/**
 * Where a link can be sent from a computer, where the device has no share
 * menu of its own (or one without the chat apps people use). Each opens the
 * app or site with the message ready; chat apps take the text and link, not
 * a video file — the video goes through Download or Share.
 *
 * On a phone none of this is needed: its share menu already lists every chat
 * app installed, KakaoTalk, LINE and Telegram included.
 */

export type ShareTarget = {
  id: string;
  name: string;
  /** Opens the app or site with the message in it. */
  href: (message: string, link: string) => string;
};

const enc = encodeURIComponent;

const apple = () => {
  try {
    return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
  } catch {
    return false;
  }
};

/** The targets that work on this device, in the order they're offered. */
export function shareTargets(): ShareTarget[] {
  const targets: ShareTarget[] = [
    { id: "whatsapp", name: "WhatsApp", href: (m, l) => `https://wa.me/?text=${enc(`${m} ${l}`)}` },
    // sms: opens Messages on a Mac and on phones; Windows has nothing to open.
    ...(apple()
      ? [{ id: "messages", name: "Messages", href: (m: string, l: string) => `sms:?&body=${enc(`${m} ${l}`)}` }]
      : []),
    { id: "telegram", name: "Telegram", href: (m, l) => `https://t.me/share/url?url=${enc(l)}&text=${enc(m)}` },
    { id: "email", name: "Email", href: (m, l) => `mailto:?subject=${enc("GuessGlobe")}&body=${enc(`${m} ${l}`)}` },
    { id: "x", name: "X", href: (m, l) => `https://twitter.com/intent/tweet?text=${enc(m)}&url=${enc(l)}` },
    { id: "facebook", name: "Facebook", href: (_m, l) => `https://www.facebook.com/sharer/sharer.php?u=${enc(l)}` },
  ];
  return targets;
}

// ---- KakaoTalk --------------------------------------------------------------

/**
 * KakaoTalk has no share link; it needs Kakao's own script and a JavaScript
 * key from developers.kakao.com, registered to the site's domain. With no
 * key set, the button simply isn't offered.
 */
export const KAKAO_KEY = (import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) ?? "";

type KakaoSdk = {
  isInitialized(): boolean;
  init(key: string): void;
  Share: { sendDefault(template: object): void };
};

let kakao: Promise<KakaoSdk> | null = null;

function loadKakao(): Promise<KakaoSdk> {
  kakao ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const sdk = (window as unknown as { Kakao?: KakaoSdk }).Kakao;
      if (!sdk) return reject(new Error("Kakao didn't load"));
      if (!sdk.isInitialized()) sdk.init(KAKAO_KEY);
      resolve(sdk);
    };
    script.onerror = () => {
      kakao = null;
      reject(new Error("Kakao didn't load"));
    };
    document.head.appendChild(script);
  });
  return kakao;
}

/** Opens KakaoTalk's share window with a card: the picture, the message, a Play button. */
export async function shareToKakao(message: string, link: string, imageUrl: string): Promise<boolean> {
  if (!KAKAO_KEY) return false;
  try {
    const sdk = await loadKakao();
    sdk.Share.sendDefault({
      objectType: "feed",
      content: {
        title: "GuessGlobe",
        description: message,
        imageUrl,
        link: { mobileWebUrl: link, webUrl: link },
      },
      buttons: [{ title: "Play", link: { mobileWebUrl: link, webUrl: link } }],
    });
    return true;
  } catch {
    return false;
  }
}
