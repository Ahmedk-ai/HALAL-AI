import { useEffect, useState } from 'react';

const DISMISS_KEY = 'halal-install-dismissed';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;

    // Android / Chrome: real install prompt
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS Safari: no event exists — show manual instructions on mobile
    if (isIOS()) {
      const t = setTimeout(() => { setIosMode(true); setShow(true); }, 2500);
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onBeforeInstall); };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShow(false);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={S.banner} className="animate-up">
      <div style={S.iconWrap}>
        <span style={S.moon}>☽</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={S.title}>Install Halal Checker</p>
        <p style={S.sub}>
          {iosMode
            ? <>Tap <strong style={S.gold}>Share</strong> <span style={S.shareIcon}>⎋</span> then <strong style={S.gold}>"Add to Home Screen"</strong></>
            : 'Add to your home screen for quick access'}
        </p>
      </div>
      {!iosMode && (
        <button style={S.installBtn} onClick={install}>Install</button>
      )}
      <button style={S.closeBtn} onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}

const S = {
  banner: {
    position: 'fixed',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 32px)',
    maxWidth: 480,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    background: 'rgba(20, 42, 31, 0.92)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(201,168,76,0.35)',
    borderRadius: 14,
    boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 24px rgba(201,168,76,0.08)',
    zIndex: 100,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'rgba(201,168,76,0.12)',
    border: '1px solid rgba(201,168,76,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  moon: {
    fontSize: 20,
    color: '#c9a84c',
    textShadow: '0 0 10px rgba(201,168,76,0.5)',
  },
  title: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 15,
    fontWeight: 700,
    color: '#e6c76a',
    marginBottom: 2,
  },
  sub: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    color: 'rgba(245,240,224,0.65)',
    lineHeight: 1.4,
  },
  gold: { color: '#e6c76a', fontWeight: 600 },
  shareIcon: { display: 'inline-block', transform: 'rotate(0deg)', color: '#e6c76a' },
  installBtn: {
    padding: '9px 18px',
    borderRadius: 9,
    border: '1px solid rgba(201,168,76,0.5)',
    background: 'linear-gradient(135deg, rgba(201,168,76,0.3) 0%, rgba(201,168,76,0.15) 100%)',
    color: '#e6c76a',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    flexShrink: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(245,240,224,0.4)',
    fontSize: 14,
    cursor: 'pointer',
    padding: 6,
    flexShrink: 0,
    fontFamily: "'Inter', sans-serif",
  },
};
