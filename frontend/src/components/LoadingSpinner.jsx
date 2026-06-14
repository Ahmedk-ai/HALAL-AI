import { useEffect, useState } from 'react';

const STEPS = [
  { ar: 'تحديد المنتج…',   en: 'Identifying product…' },
  { ar: 'قراءة المكونات…', en: 'Reading ingredients…' },
  { ar: 'البحث عبر الإنترنت…', en: 'Searching online databases…' },
  { ar: 'التحقق من الحلال…', en: 'Verifying halal status…' },
  { ar: 'تجميع النتائج…',  en: 'Compiling results…' },
];

export default function LoadingSpinner() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setStep(s => (s + 1) % STEPS.length);
        setVisible(true);
      }, 200);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={S.wrap} className="animate-in">
      {/* Spinning ring */}
      <div style={S.ringOuter}>
        <div style={S.ring} />
        <div style={S.ringInner}>
          <span style={S.moon}>☽</span>
        </div>
      </div>

      {/* Step text */}
      <div style={{ textAlign:'center' }}>
        <p style={{
          ...S.arabic,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-4px)',
          transition: 'opacity 0.2s, transform 0.2s',
        }} lang="ar" dir="rtl">
          {STEPS[step].ar}
        </p>
        <p style={{
          ...S.english,
          opacity: visible ? 0.7 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity 0.2s 0.05s, transform 0.2s 0.05s',
        }}>
          {STEPS[step].en}
        </p>
      </div>

      {/* Dots */}
      <div style={S.dots}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            ...S.dot,
            background: i === step ? '#c9a84c' : 'rgba(201,168,76,0.2)',
            transform: i === step ? 'scale(1.3)' : 'scale(1)',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>
    </div>
  );
}

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    padding: '40px 28px',
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(201,168,76,0.18)',
    borderRadius: 16,
    marginBottom: 20,
  },
  ringOuter: {
    position: 'relative',
    width: 64,
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '2px solid transparent',
    borderTopColor: '#c9a84c',
    borderRightColor: 'rgba(201,168,76,0.3)',
    animation: 'spin 1.2s linear infinite',
  },
  ringInner: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(201,168,76,0.06)',
    border: '1px solid rgba(201,168,76,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moon: {
    fontSize: 20,
    color: '#c9a84c',
    textShadow: '0 0 12px rgba(201,168,76,0.5)',
  },
  arabic: {
    fontFamily: "'Amiri', serif",
    fontSize: 18,
    color: '#e6c76a',
    marginBottom: 4,
    letterSpacing: '0.03em',
  },
  english: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 13,
    color: 'rgba(240,234,214,0.6)',
    fontWeight: 400,
    letterSpacing: '0.02em',
  },
  dots: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
};
