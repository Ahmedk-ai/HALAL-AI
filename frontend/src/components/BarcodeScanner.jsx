import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

const API = '/api';

/* Inject keyframes once */
if (typeof document !== 'undefined' && !document.getElementById('barcode-kf')) {
  const s = document.createElement('style');
  s.id = 'barcode-kf';
  s.textContent = `
    @keyframes scanLine {
      0%   { top: 8%; opacity: 1; }
      48%  { opacity: 1; }
      50%  { top: 88%; opacity: 0.6; }
      52%  { opacity: 1; }
      100% { top: 8%; opacity: 1; }
    }
    @keyframes flashIn {
      0%   { opacity: 0; }
      30%  { opacity: 0.55; }
      100% { opacity: 0; }
    }
    @keyframes barcodeCornerPulse {
      0%, 100% { opacity: 0.6; }
      50%       { opacity: 1; }
    }
  `;
  document.head.appendChild(s);
}

export default function BarcodeScanner({ onResult, onError, loading, setLoading }) {
  const videoRef      = useRef(null);
  const controlsRef   = useRef(null);
  const readerRef     = useRef(null);
  const lastCodeRef   = useRef(null);
  const cooldownRef   = useRef(false);

  const [scanning,    setScanning]    = useState(false);
  const [flash,       setFlash]       = useState(false);
  const [statusMsg,   setStatusMsg]   = useState('Point camera at a barcode');
  const [lookupState, setLookupState] = useState('idle'); // idle | fetching | analyzing

  /* ── Start / stop scanner ── */
  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      setScanning(true);
      setStatusMsg('Point camera at a barcode');
      readerRef.current = new BrowserMultiFormatReader();
      controlsRef.current = await readerRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        async (result, err) => {
          if (result && !cooldownRef.current) {
            cooldownRef.current = true;
            const code = result.getText();
            if (code === lastCodeRef.current) {
              setTimeout(() => { cooldownRef.current = false; }, 2000);
              return;
            }
            lastCodeRef.current = code;

            // Flash feedback
            setFlash(true);
            setTimeout(() => setFlash(false), 500);

            await handleBarcode(code);
            setTimeout(() => { cooldownRef.current = false; }, 3000);
          }
        }
      );
    } catch (e) {
      setScanning(false);
      onError('Camera access denied. Please allow camera permissions and try again.');
    }
  }, []);

  const stopScanner = useCallback(() => {
    try { controlsRef.current?.stop(); } catch (_) {}
    setScanning(false);
    setLookupState('idle');
  }, []);

  useEffect(() => {
    startScanner();
    return () => { try { controlsRef.current?.stop(); } catch (_) {} };
  }, []);

  /* ── Barcode → Open Food Facts → Claude ── */
  const handleBarcode = async (barcode) => {
    setLoading(true);
    onResult(null);
    onError(null);

    try {
      // Step 1: Open Food Facts lookup
      setLookupState('fetching');
      setStatusMsg(`Found barcode ${barcode} — looking up product…`);

      const offRes = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        { headers: { 'User-Agent': 'HalalChecker/1.0' } }
      );
      const offData = await offRes.json();

      if (offData.status !== 1 || !offData.product) {
        onError(`Barcode ${barcode} was not found in the Open Food Facts database. Try "Search by Name" or "Scan Product" instead.`);
        setLoading(false);
        setLookupState('idle');
        setStatusMsg('Point camera at a barcode');
        lastCodeRef.current = null;
        return;
      }

      const product = offData.product;
      const productName = product.product_name || product.product_name_en || 'Unknown Product';
      const ingredientsText =
        product.ingredients_text_en ||
        product.ingredients_text ||
        '';
      const brand = product.brands || '';

      if (!ingredientsText) {
        onError(`Found "${productName}" but it has no ingredient list in the database. Try "Search by Name" instead.`);
        setLoading(false);
        setLookupState('idle');
        setStatusMsg('Point camera at a barcode');
        lastCodeRef.current = null;
        return;
      }

      // Step 2: Send to Claude
      setLookupState('analyzing');
      setStatusMsg(`Analyzing "${productName}" with AI…`);

      const claudeRes = await fetch(`${API}/check-ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: `${brand} ${productName}`.trim(), ingredients: ingredientsText }),
      });

      if (!claudeRes.ok) {
        const e = await claudeRes.json();
        throw new Error(e.error || 'Server error');
      }

      const result = await claudeRes.json();
      onResult(result);
      stopScanner();
    } catch (err) {
      onError(err.message);
      setLookupState('idle');
      setStatusMsg('Point camera at a barcode');
      lastCodeRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  const stateLabel = {
    idle:      'Point camera at a barcode',
    fetching:  '🔍 Looking up in database…',
    analyzing: '✦ Analyzing with AI…',
  }[lookupState] || statusMsg;

  return (
    <div style={S.wrap}>
      {/* Viewfinder */}
      <div style={S.viewfinder}>
        <video ref={videoRef} style={S.video} playsInline muted autoPlay />

        {/* Flash overlay */}
        {flash && <div style={S.flash} />}

        {/* Corner brackets */}
        {['tl','tr','bl','br'].map(pos => (
          <div key={pos} style={{ ...S.corner, ...S.corners[pos] }} />
        ))}

        {/* Scan line */}
        {scanning && !loading && lookupState === 'idle' && (
          <div style={S.scanLine} />
        )}

        {/* Analysing overlay */}
        {loading && (
          <div style={S.analysingOverlay}>
            <div style={S.analysingSpinner} />
          </div>
        )}
      </div>

      {/* Status */}
      <div style={S.status}>
        <span style={{
          ...S.statusDot,
          background: loading ? '#f39c12' : scanning ? '#2ecc71' : '#e74c3c',
          boxShadow: `0 0 8px ${loading ? '#f39c12' : scanning ? '#2ecc71' : '#e74c3c'}`,
        }} />
        <span style={S.statusText}>{stateLabel}</span>
      </div>

      {/* Restart button if stopped */}
      {!scanning && !loading && (
        <button style={S.restartBtn} onClick={startScanner}>
          ↺ Restart Scanner
        </button>
      )}

      <p style={S.hint}>Works with UPC, EAN-13, EAN-8, QR codes</p>
    </div>
  );
}

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
  },
  viewfinder: {
    position: 'relative',
    width: '100%',
    maxWidth: 420,
    aspectRatio: '4/3',
    borderRadius: 14,
    overflow: 'hidden',
    background: '#000',
    border: '1px solid rgba(201,168,76,0.3)',
    boxShadow: '0 0 0 1px rgba(201,168,76,0.1), 0 8px 32px rgba(0,0,0,0.4)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  flash: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(201,168,76,0.45)',
    animation: 'flashIn 0.5s ease forwards',
    pointerEvents: 'none',
    zIndex: 10,
  },
  scanLine: {
    position: 'absolute',
    left: '5%',
    right: '5%',
    height: 2,
    background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.9) 20%, #e6c76a 50%, rgba(201,168,76,0.9) 80%, transparent)',
    boxShadow: '0 0 8px rgba(201,168,76,0.8), 0 0 20px rgba(201,168,76,0.4)',
    animation: 'scanLine 2.2s ease-in-out infinite',
    pointerEvents: 'none',
    zIndex: 5,
    borderRadius: 2,
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#c9a84c',
    borderStyle: 'solid',
    animation: 'barcodeCornerPulse 2s ease-in-out infinite',
    zIndex: 6,
  },
  corners: {
    tl: { top: 12,  left: 12,  borderWidth: '2px 0 0 2px', borderTopLeftRadius: 4 },
    tr: { top: 12,  right: 12, borderWidth: '2px 2px 0 0', borderTopRightRadius: 4 },
    bl: { bottom: 12, left: 12,  borderWidth: '0 0 2px 2px', borderBottomLeftRadius: 4 },
    br: { bottom: 12, right: 12, borderWidth: '0 2px 2px 0', borderBottomRightRadius: 4 },
  },
  analysingOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(10,25,18,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
  },
  analysingSpinner: {
    width: 44,
    height: 44,
    border: '3px solid rgba(201,168,76,0.2)',
    borderTop: '3px solid #c9a84c',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(201,168,76,0.15)',
    borderRadius: 99,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background 0.3s, box-shadow 0.3s',
  },
  statusText: {
    fontSize: 13,
    color: 'rgba(245,240,224,0.75)',
    fontFamily: "'Inter', sans-serif",
  },
  restartBtn: {
    padding: '9px 20px',
    borderRadius: 9,
    border: '1px solid rgba(201,168,76,0.3)',
    background: 'rgba(201,168,76,0.1)',
    color: '#e6c76a',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
  },
  hint: {
    fontSize: 11,
    color: 'rgba(245,240,224,0.3)',
    fontFamily: "'Inter', sans-serif",
    letterSpacing: '0.04em',
  },
};
