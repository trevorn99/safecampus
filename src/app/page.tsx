export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1>SafeCampus</h1>
      <p>Team management and scheduling for church safety teams.</p>
    </main>
  );
}
