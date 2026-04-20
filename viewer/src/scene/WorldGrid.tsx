export function WorldGrid() {
  return (
    <>
      {/* Main 1m grid */}
      <gridHelper args={[10, 10, "#2a2a3a", "#1e1e2c"]} />
      {/* Fine 0.25m subdivision */}
      <gridHelper args={[10, 40, "#181824", "#181824"]} />
    </>
  );
}
