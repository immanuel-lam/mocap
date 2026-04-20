export function WorldGrid() {
  return (
    <>
      {/* Main 1m grid */}
      <gridHelper args={[10, 10, "#9898b0", "#b0b0c8"]} />
      {/* Fine 0.25m subdivision */}
      <gridHelper args={[10, 40, "#c8c8d8", "#c8c8d8"]} />
    </>
  );
}
