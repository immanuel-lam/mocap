export function WorldGrid() {
  return (
    <>
      {/* Main 1m grid */}
      <gridHelper args={[10, 10, "#1a1f30", "#111520"]} />
      {/* Fine 0.25m subdivision */}
      <gridHelper args={[10, 40, "#0d1018", "#0d1018"]} />
    </>
  );
}
