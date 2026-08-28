import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "120px 20px",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h1 style={{ fontSize: "4rem", color: "var(--green-700)" }}>४०४</h1>
      <p style={{ fontSize: "1.2rem", marginBottom: "24px" }}>
        हे पृष्ठ सापडले नाही / Page not found
      </p>
      <Link href="/" className="btn btn-primary">
        मुख्यपृष्ठ / Home
      </Link>
    </div>
  );
}
