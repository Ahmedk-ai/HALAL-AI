const STATUS = {
  HALAL: {
    icon: '✦',
    label: 'Halal',
    color: '#2ecc71',
    dimBg: 'rgba(46,204,113,0.07)',
    border: 'rgba(46,204,113,0.25)',
    glow: '0 0 40px rgba(46,204,113,0.12)',
    barColor: '#2ecc71',
    badgeBg: 'rgba(46,204,113,0.12)',
    topGlow: 'radial-gradient(ellipse at 50% 0%, rgba(46,204,113,0.08) 0%, transparent 60%)',
  },
  HARAM: {
    icon: '✕',
    label: 'Haram',
    color: '#e74c3c',
    dimBg: 'rgba(231,76,60,0.07)',
    border: 'rgba(231,76,60,0.25)',
    glow: '0 0 40px rgba(231,76,60,0.12)',
    barColor: '#e74c3c',
    badgeBg: 'rgba(231,76,60,0.12)',
    topGlow: 'radial-gradient(ellipse at 50% 0%, rgba(231,76,60,0.08) 0%, transparent 60%)',
  },
  UNCERTAIN: {
    icon: '◈',
    label: 'Uncertain',
    color: '#f39c12',
    dimBg: 'rgba(243,156,18,0.07)',
    border: 'rgba(243,156,18,0.25)',
    glow: '0 0 40px rgba(243,156,18,0.12)',
    barColor: '#f39c12',
    badgeBg: 'rgba(243,156,18,0.12)',
    topGlow: 'radial-gradient(ellipse at 50% 0%, rgba(243,156,18,0.08) 0%, transparent 60%)',
  },
};

const ING_STATUS = {
  HALAL:     { dot: '#2ecc71', text: '#2ecc71', label: 'Halal' },
  HARAM:     { dot: '#e74c3c', text: '#e74c3c', label: 'Haram' },
  UNCERTAIN: { dot: '#f39c12', text: '#f39c12', label: 'Uncertain' },
};

function ConfidenceBar({ pct, color }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 8 }}>
        <span style={S.confLabel}>Halal Confidence</span>
        <span style={{ ...S.confPct, color }}>{pct}%</span>
      </div>
      <div style={S.barTrack}>
        <div style={{ ...S.barFill, width:`${pct}%`, background: color, boxShadow:`0 0 12px ${color}55` }} />
      </div>
      <p style={S.confNote}>
        {pct === 100 ? 'Halal-certified or all ingredients fully confirmed.'
         : pct >= 90  ? 'Very likely halal — no haram source found for any ingredient.'
         : pct >= 70  ? 'Probably halal, but some ingredients could not be fully verified.'
         : pct >= 40  ? 'Uncertain — multiple ambiguous ingredients. Exercise caution.'
                      : 'Strong concern. Likely contains a haram ingredient.'}
      </p>
    </div>
  );
}

export default function ResultCard({ result }) {
  const { status, confidence, productName, ingredients, summary, sources } = result;
  const cfg = STATUS[status] || STATUS.UNCERTAIN;
  const pct = typeof confidence === 'number' ? confidence : null;

  return (
    <div style={{ ...S.card, borderColor: cfg.border, boxShadow: cfg.glow }} className="animate-up">
      {/* top glow */}
      <div style={{ position:'absolute', inset:0, borderRadius:16, background: cfg.topGlow, pointerEvents:'none' }} />

      {/* Status banner */}
      <div style={S.banner}>
        <div style={{ ...S.iconCircle, borderColor: cfg.border, background: cfg.dimBg }}>
          <span style={{ fontSize: 22, color: cfg.color, lineHeight:1 }}>{cfg.icon}</span>
        </div>
        <div>
          <div style={{ ...S.badge, background: cfg.badgeBg, color: cfg.color }}>
            {cfg.label}
          </div>
          {productName && (
            <h2 style={{ ...S.productName, color: cfg.color }}>{productName}</h2>
          )}
        </div>
      </div>

      {/* Confidence */}
      {pct !== null && <ConfidenceBar pct={pct} color={cfg.barColor} />}

      {/* Summary */}
      <div style={S.summaryBox}>
        <p style={S.summaryText}>{summary}</p>
      </div>

      {/* Ingredients */}
      {ingredients?.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionHead}>
            <div style={S.sectionLine} />
            <span style={S.sectionTitle}>Ingredient Breakdown</span>
            <div style={S.sectionLine} />
          </div>
          <div style={S.ingList}>
            {ingredients.map((ing, i) => {
              const s = ING_STATUS[ing.status] || ING_STATUS.UNCERTAIN;
              const ip = typeof ing.confidence === 'number' ? ing.confidence : null;
              return (
                <div key={i} style={S.ingRow}>
                  <div style={S.ingTop}>
                    <span style={{ ...S.dot, background: s.dot, boxShadow:`0 0 6px ${s.dot}88` }} />
                    <span style={S.ingName}>{ing.name}</span>
                    <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                      {ip !== null && ing.status !== 'HALAL' && (
                        <span style={{ fontSize:12, fontWeight:700, color: s.text }}>{ip}%</span>
                      )}
                      <span style={{ ...S.ingBadge, color: s.text, borderColor: `${s.dot}55` }}>
                        {ing.status}
                      </span>
                    </div>
                  </div>
                  {ing.reason && <p style={S.ingReason}>{ing.reason}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sources */}
      {sources?.length > 0 && (
        <div style={{ ...S.section, marginBottom: 0 }}>
          <div style={S.sectionHead}>
            <div style={S.sectionLine} />
            <span style={S.sectionTitle}>Sources Consulted</span>
            <div style={S.sectionLine} />
          </div>
          <ul style={S.sourcesList}>
            {sources.map((src, i) => (
              <li key={i} style={S.sourceItem}>{src}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const S = {
  card: {
    position: 'relative',
    borderRadius: 16,
    border: '1px solid',
    padding: 28,
    marginBottom: 20,
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom: 4,
    fontFamily: "'Inter', sans-serif",
  },
  productName: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  confLabel: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    fontWeight: 500,
    color: 'rgba(240,234,214,0.4)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  confPct: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.5px',
  },
  barTrack: {
    height: 6,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 99,
    transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
  },
  confNote: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    color: 'rgba(240,234,214,0.35)',
    lineHeight: 1.5,
  },
  summaryBox: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(201,168,76,0.2)',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 24,
  },
  summaryText: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    lineHeight: 1.7,
    color: 'rgba(245,240,224,0.82)',
  },
  section: {
    marginBottom: 24,
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    background: 'rgba(201,168,76,0.15)',
  },
  sectionTitle: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(201,168,76,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    whiteSpace: 'nowrap',
  },
  ingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  ingRow: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '10px 14px',
    transition: 'border-color 0.2s',
  },
  ingTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  ingName: {
    fontFamily: "'Inter', sans-serif",
    fontWeight: 500,
    fontSize: 14,
    color: 'rgba(245,240,224,0.95)',
    flex: 1,
  },
  ingBadge: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    border: '1px solid',
    borderRadius: 4,
    padding: '2px 7px',
  },
  ingReason: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 12,
    color: 'rgba(245,240,224,0.55)',
    lineHeight: 1.55,
    marginTop: 6,
    paddingLeft: 18,
  },
  sourcesList: {
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  sourceItem: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 11,
    color: 'rgba(240,234,214,0.3)',
    paddingLeft: 12,
    borderLeft: '2px solid rgba(201,168,76,0.2)',
    wordBreak: 'break-all',
    lineHeight: 1.5,
  },
};
