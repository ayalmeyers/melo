/** Loading placeholders shown while a page's data streams in (used by loading.tsx files). */
const Box = ({ w, h = 14, r = 8 }: { w: number | string; h?: number; r?: number }) => <span className="sk" style={{ display: 'block', width: w, height: h, borderRadius: r }} />;

export function SkRows({ n = 6, round }: { n?: number; round?: boolean }) {
  return <div>{Array.from({ length: n }, (_, i) => <div key={i} className="sk-row"><Box w={56} h={56} r={round ? 28 : 10} /><div style={{ flex: 1, display: 'grid', gap: 8 }}><Box w="55%" /><Box w="35%" h={11} /></div></div>)}</div>;
}
export function SkCards({ n = 3 }: { n?: number }) {
  return <div className="stack">{Array.from({ length: n }, (_, i) => <div key={i} className="sk-card"><div className="sk-row" style={{ padding: 0 }}><Box w={36} h={36} r={18} /><Box w="30%" /></div><Box w="90%" /><Box w="75%" /><Box w="45%" /></div>)}</div>;
}
/** A dark band with a title placeholder, then a white sheet: the shape of most Melo pages. */
export function SkPage({ art, rows, round }: { art?: number; rows?: boolean; round?: boolean }) {
  return <div role="status" aria-label="Loading">
    <section className="band"><div className="wrap" style={{ paddingTop: 40, paddingBottom: 72, display: 'flex', gap: 20, alignItems: 'flex-end' }}>
      {art && <Box w={art} h={art} r={round ? art / 2 : 20} />}
      <div style={{ flex: 1, display: 'grid', gap: 12 }}><Box w={90} h={12} /><Box w="60%" h={34} r={10} /><Box w="35%" h={14} /></div>
    </div></section>
    <div className="sheet"><div className="wrap sec" style={{ maxWidth: 820 }}>{rows ? <SkRows /> : <SkCards />}</div></div>
  </div>;
}
