import { useState, useRef, useCallback } from 'react';
import ResultCard from './components/ResultCard.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import BarcodeScanner from './components/BarcodeScanner.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';

const API = '/api';

/* ── Gold divider ornament ── */
function Ornament() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, margin:'20px 0' }}>
      <div style={{ flex:1, height:1, background:'linear-gradient(to right, transparent, rgba(201,168,76,0.4))' }} />
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1 L10.5 7 L16.5 7 L11.7 10.8 L13.5 17 L9 13.2 L4.5 17 L6.3 10.8 L1.5 7 L7.5 7 Z"
              fill="rgba(201,168,76,0.5)" stroke="rgba(201,168,76,0.8)" strokeWidth="0.5"/>
      </svg>
      <div style={{ flex:1, height:1, background:'linear-gradient(to left, transparent, rgba(201,168,76,0.4))' }} />
    </div>
  );
}

export default function App() {
  const [mode, setMode]               = useState('text');
  const [query, setQuery]             = useState('');
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [result, setResult]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [inputFocused, setInputFocused] = useState(false);
  const fileInputRef   = useRef(null);
  const cameraInputRef = useRef(null);

  const reset = () => { setResult(null); setError(null); };

  const handleImageSelect = useCallback((file) => {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    reset();
  }, []);

  const handleFileChange = (e) => handleImageSelect(e.target.files[0]);
  const handleDrop = (e) => { e.preventDefault(); handleImageSelect(e.dataTransfer.files[0]); };

  const handleTextCheck = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API}/check-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Server error'); }
      setResult(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleImageCheck = async () => {
    if (!imageFile) return;
    setLoading(true); setError(null); setResult(null);
    try {
      // Convert to base64 for Vercel serverless compatibility
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });
      const res = await fetch(`${API}/check-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: imageFile.type }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Server error'); }
      setResult(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <header style={S.header} className="animate-up">
        {/* Quran verse */}
        <div style={S.verseWrap}>
          <div style={S.verseGlow} />
          <p style={S.arabic} lang="ar" dir="rtl">
            يَا أَيُّهَا النَّاسُ كُلُوا مِمَّا فِي الْأَرْضِ حَلَالًا طَيِّبًا
          </p>
          <p style={S.verseTranslation}>
            "O mankind, eat from whatever is on earth that is lawful and pure"
          </p>
          <p style={S.verseRef}>— Surah Al-Baqarah 2:168</p>
        </div>

        <Ornament />

        {/* Logo */}
        <div style={S.logo}>
          <span style={S.crescent}>☽</span>
          <span style={S.logoText}>Halal Checker</span>
        </div>
        <p style={S.tagline}>Verify what you eat — instantly &amp; intelligently</p>
      </header>

      <main style={S.main}>
        {/* ── Mode Toggle ── */}
        <div style={S.modeToggle} className="animate-up-2">
          {[
            { id:'text',    icon:'🔍', label:'Search by Name' },
            { id:'image',   icon:'📷', label:'Scan Product'   },
            { id:'barcode', icon:'📱', label:'Scan Barcode'   },
          ].map(m => (
            <button
              key={m.id}
              style={{ ...S.modeBtn, ...(mode === m.id ? S.modeBtnActive : {}) }}
              onClick={() => { setMode(m.id); reset(); }}
            >
              {m.icon}
              <span style={{ marginLeft:6 }}>{m.label}</span>
            </button>
          ))}
        </div>

        {/* ── Text Mode ── */}
        {mode === 'text' && (
          <div style={S.glass} className="animate-up-3">
            <p style={S.hint}>Enter a product name, brand, or food item</p>
            <form onSubmit={handleTextCheck} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ position:'relative' }}>
                <input
                  style={{ ...S.input, ...(inputFocused ? S.inputFocused : {}) }}
                  type="text"
                  placeholder="e.g. Haribo Gummy Bears, Kit Kat, Oreos…"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); reset(); }}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  disabled={loading}
                />
                {inputFocused && <div style={S.inputGlow} />}
              </div>
              <button
                style={{ ...S.goldBtn, ...(!query.trim() || loading ? S.goldBtnDisabled : {}) }}
                type="submit"
                disabled={loading || !query.trim()}
              >
                {loading ? 'Checking…' : 'Check Halal Status'}
              </button>
            </form>
          </div>
        )}

        {/* ── Image Mode ── */}
        {mode === 'image' && (
          <div style={S.glass} className="animate-up-3">
            <p style={S.hint}>Upload a photo of the product or its ingredients label</p>

            {!imagePreview ? (
              <div
                style={S.dropzone}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={S.dropzoneIcon}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(201,168,76,0.6)" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                </div>
                <p style={S.dropzoneText}>Drop image here or tap to browse</p>
                <p style={S.dropzoneSubtext}>JPEG · PNG · WEBP · up to 10 MB</p>
              </div>
            ) : (
              <div style={{ marginBottom:16, position:'relative' }}>
                <img src={imagePreview} alt="Product" style={S.imgPreview} />
                <button style={S.removeBtn}
                  onClick={() => { setImageFile(null); setImagePreview(null); reset(); }}>
                  ✕ Remove
                </button>
              </div>
            )}

            <div style={{ display:'flex', gap:10, marginBottom:4 }}>
              <button style={S.outlineBtn} onClick={() => fileInputRef.current?.click()}>
                📁 Browse Files
              </button>
              <button style={S.outlineBtn} onClick={() => cameraInputRef.current?.click()}>
                📷 Use Camera
              </button>
            </div>

            <input ref={fileInputRef}   type="file" accept="image/*"                    style={{ display:'none' }} onChange={handleFileChange}/>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }} onChange={handleFileChange}/>

            {imageFile && (
              <button style={{ ...S.goldBtn, marginTop:16 }} onClick={handleImageCheck} disabled={loading}>
                {loading ? 'Analyzing…' : 'Analyze Ingredients'}
              </button>
            )}
          </div>
        )}

        {/* ── Barcode Mode ── */}
        {mode === 'barcode' && (
          <div style={S.glass} className="animate-up-3">
            <p style={S.hint}>Use your camera to scan a product barcode</p>
            <BarcodeScanner
              onResult={setResult}
              onError={setError}
              loading={loading}
              setLoading={setLoading}
            />
          </div>
        )}

        {/* ── Loading ── */}
        {loading && <LoadingSpinner />}

        {/* ── Error ── */}
        {error && (
          <div style={S.errorBox} className="animate-in">
            <span style={{ fontSize:18 }}>⚠️</span>
            <span style={{ fontSize:14 }}>{error}</span>
          </div>
        )}

        {/* ── Result ── */}
        {result && !loading && <ResultCard result={result} />}
      </main>

      <footer style={S.footer}>
        <Ornament />
        <p>Results are AI-generated. Always verify with a certified Halal authority for critical decisions.</p>
      </footer>

      <InstallPrompt />
    </div>
  );
}

/* ── Styles ── */
const glass = {
  background: 'rgba(255,255,255,0.09)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(201,168,76,0.3)',
  borderRadius: 16,
};

const S = {
  page: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 700,
    margin: '0 auto',
    padding: '0 20px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },

  /* Header */
  header: {
    textAlign: 'center',
    padding: '48px 0 28px',
  },
  verseWrap: {
    position: 'relative',
    padding: '18px 24px',
    ...glass,
    marginBottom: 0,
  },
  verseGlow: {
    position: 'absolute',
    inset: 0,
    borderRadius: 16,
    background: 'radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  arabic: {
    fontFamily: "'Amiri', serif",
    fontSize: 'clamp(16px, 2.6vw, 20px)',
    lineHeight: 2,
    color: '#e6c76a',
    letterSpacing: '0.02em',
    marginBottom: 10,
    textShadow: '0 0 20px rgba(201,168,76,0.25)',
  },
  verseTranslation: {
    fontFamily: "'Playfair Display', serif",
    fontStyle: 'italic',
    fontSize: 14,
    color: 'rgba(240,234,214,0.7)',
    lineHeight: 1.7,
    marginBottom: 4,
  },
  verseRef: {
    fontSize: 12,
    color: 'rgba(201,168,76,0.6)',
    letterSpacing: '0.04em',
    fontFamily: "'Inter', sans-serif",
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  crescent: {
    fontSize: 32,
    color: '#c9a84c',
    textShadow: '0 0 20px rgba(201,168,76,0.5)',
    lineHeight: 1,
  },
  logoText: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 'clamp(26px, 5vw, 34px)',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #e6c76a 0%, #c9a84c 50%, #a07830 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-0.5px',
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(245,240,224,0.6)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontFamily: "'Inter', sans-serif",
    fontWeight: 300,
  },

  /* Main */
  main: { flex: 1, paddingBottom: 40 },

  /* Toggle */
  modeToggle: {
    display: 'flex',
    ...glass,
    padding: 4,
    gap: 4,
    marginBottom: 20,
  },
  modeBtn: {
    flex: 1,
    padding: '10px 4px',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    fontSize: 'clamp(10.5px, 3vw, 13px)',
    fontWeight: 500,
    background: 'transparent',
    color: 'rgba(245,240,224,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    fontFamily: "'Inter', sans-serif",
    whiteSpace: 'nowrap',
  },
  modeBtnActive: {
    background: 'linear-gradient(135deg, rgba(201,168,76,0.25) 0%, rgba(201,168,76,0.12) 100%)',
    color: '#e6c76a',
    boxShadow: '0 0 0 1px rgba(201,168,76,0.4) inset',
  },

  /* Glass card */
  glass: {
    ...glass,
    padding: 28,
    marginBottom: 20,
  },
  hint: {
    fontSize: 13,
    color: 'rgba(245,240,224,0.6)',
    marginBottom: 18,
    letterSpacing: '0.02em',
    fontFamily: "'Inter', sans-serif",
  },

  /* Input */
  input: {
    width: '100%',
    padding: '14px 18px',
    borderRadius: 10,
    border: '1px solid rgba(201,168,76,0.3)',
    background: 'rgba(255,255,255,0.08)',
    color: '#f5f0e0',
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: "'Inter', sans-serif",
  },
  inputFocused: {
    borderColor: 'rgba(201,168,76,0.6)',
    boxShadow: '0 0 0 3px rgba(201,168,76,0.08), 0 0 20px rgba(201,168,76,0.1)',
  },
  inputGlow: {
    position: 'absolute',
    inset: -1,
    borderRadius: 11,
    background: 'radial-gradient(ellipse at 50% 100%, rgba(201,168,76,0.06) 0%, transparent 70%)',
    pointerEvents: 'none',
  },

  /* Gold button */
  goldBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 10,
    border: '1px solid rgba(201,168,76,0.4)',
    background: 'linear-gradient(135deg, rgba(201,168,76,0.22) 0%, rgba(201,168,76,0.1) 100%)',
    color: '#e6c76a',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: "'Inter', sans-serif",
    letterSpacing: '0.03em',
    backdropFilter: 'blur(8px)',
  },
  goldBtnDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },

  /* Outline button */
  outlineBtn: {
    flex: 1,
    padding: '11px',
    borderRadius: 10,
    border: '1px solid rgba(201,168,76,0.3)',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(245,240,224,0.65)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    transition: 'all 0.2s',
  },

  /* Dropzone */
  dropzone: {
    border: '1px dashed rgba(201,168,76,0.3)',
    borderRadius: 12,
    padding: '44px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    background: 'rgba(201,168,76,0.03)',
    marginBottom: 14,
    transition: 'all 0.2s',
  },
  dropzoneIcon: { marginBottom: 14, opacity: 0.8 },
  dropzoneText: {
    color: 'rgba(245,240,224,0.75)',
    fontWeight: 500,
    fontSize: 14,
    marginBottom: 4,
    fontFamily: "'Inter', sans-serif",
  },
  dropzoneSubtext: {
    color: 'rgba(240,234,214,0.3)',
    fontSize: 12,
    letterSpacing: '0.05em',
    fontFamily: "'Inter', sans-serif",
  },
  imgPreview: {
    width: '100%',
    borderRadius: 10,
    maxHeight: 300,
    objectFit: 'contain',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(201,168,76,0.15)',
  },
  removeBtn: {
    marginTop: 8,
    background: 'none',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 6,
    padding: '5px 14px',
    cursor: 'pointer',
    fontSize: 12,
    color: 'rgba(240,234,214,0.4)',
    fontFamily: "'Inter', sans-serif",
    letterSpacing: '0.03em',
  },

  /* Error */
  errorBox: {
    background: 'rgba(231,76,60,0.08)',
    border: '1px solid rgba(231,76,60,0.25)',
    color: '#e74c3c',
    borderRadius: 10,
    padding: '14px 18px',
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    marginBottom: 16,
  },

  /* Footer */
  footer: {
    textAlign: 'center',
    paddingBottom: 32,
    color: 'rgba(240,234,214,0.25)',
    fontSize: 12,
    fontFamily: "'Inter', sans-serif",
    lineHeight: 1.6,
    letterSpacing: '0.02em',
  },
};
