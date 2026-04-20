export function WorldGrid() {
  return (
    <>
      {/* Main 1m grid */}
      <gridHelper args={[10, 10, "#2a2a40", "#222238"]} />
      {/* Fine 0.25m subdivision */}
      <gridHelper args={[10, 40, "#1c1c2e", "#1c1c2e"]} />
    </>
  );
}
