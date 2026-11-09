import Link from 'next/link';

export default function Home() {
  return (
    <main className="home">
      <div className="home-brand">
        {/* Official AvePoint artwork, with a white wordmark for the dark background. */}
        <img src="/brand/avepoint.svg" alt="AvePoint" width="185" height="32" />
      </div>
      <h1>Quay Số May Mắn</h1>
      <div className="home-links">
        <Link href="/lottery" className="home-card home-card-primary">
          <b>Màn chiếu</b>
        </Link>
        <Link href="/admin" className="home-card">
          <b>Quản trị</b>
        </Link>
      </div>
    </main>
  );
}
