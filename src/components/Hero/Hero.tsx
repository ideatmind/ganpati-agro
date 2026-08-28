import Image from "next/image";

export default function Hero() {
  return (
    <section className="hero" id="home">
      <video
        className="hero-video"
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="/about-farm.jpg"
      >
        <source src="/hero-bg.mp4" type="video/mp4" />
      </video>
      <div className="hero-overlay"></div>
      <div className="container hero-inner">
        <Image
          src="/logo-icon.png"
          alt="गणपती ॲग्रो प्रोड्युसर कंपनी लोगो"
          width={200}
          height={200}
          priority
          className="hero-logo"
        />
        <h1>गणपती ॲग्रो प्रोड्युसर कंपनी लि.</h1>
        <p className="hero-tagline">२०१६ पासून बळीराजाच्या सेवेत....</p>
        <div className="hero-actions">
          <a href="#register" className="btn btn-primary">नोंदणी करा</a>
          <a href="#contact" className="btn btn-outline">संपर्क करा</a>
        </div>
        <a href="#about" className="scroll-down" aria-label="खाली स्क्रोल करा">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </a>
      </div>
    </section>
  );
}
