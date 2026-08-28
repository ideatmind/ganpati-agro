"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { href: "#about", label: "आमच्याबद्दल" },
  { href: "#purpose", label: "उद्देश" },
  { href: "#clusters", label: "समूह" },
  { href: "#coverage", label: "कार्यक्षेत्र" },
  { href: "#membership", label: "सभासदत्व" },
  { href: "#register", label: "नोंदणी" },
  { href: "#contact", label: "संपर्क" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.pageYOffset > 40);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`navbar${isScrolled ? " scrolled" : ""}`}
      id="navbar"
    >
      <div className="container nav-inner">
        <nav
          className={`nav-links${isOpen ? " open" : ""}`}
          id="navLinks"
          aria-label="मुख्य मेनू"
          {...(isMobile && !isOpen ? { inert: true } : {})}
        >
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setIsOpen(false)}>
              {link.label}
            </a>
          ))}
        </nav>
        <button
          className={`hamburger${isOpen ? " active" : ""}`}
          id="hamburger"
          aria-label={isOpen ? "मेनू बंद करा" : "मेनू उघडा"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
}
