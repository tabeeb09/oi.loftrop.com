export default function Footer() {
  return (
    <footer className="app-footer" style={{ padding: '0.5rem 1rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ textAlign: 'center', fontSize: '0.9rem' }}>© {new Date().getFullYear()} Tabeeb Rahman</div>
    </footer>
  );
}
