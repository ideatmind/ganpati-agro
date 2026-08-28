import Navbar from "@/components/Navbar/Navbar";
import Hero from "@/components/Hero/Hero";
import About from "@/components/About/About";
import Purpose from "@/components/Purpose/Purpose";
import Clusters from "@/components/Clusters/Clusters";
import Coverage from "@/components/Coverage/Coverage";
import Membership from "@/components/Membership/Membership";
import RegistrationForm from "@/components/RegistrationForm/RegistrationForm";
import Footer from "@/components/Footer/Footer";
import BackToTop from "@/components/shared/BackToTop";
import MobileCallButton from "@/components/shared/MobileCallButton";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main">
        <Hero />
        <About />
        <Purpose />
        <Clusters />
        <Coverage />
        <Membership />
        <RegistrationForm />
      </main>
      <Footer />
      <MobileCallButton />
      <BackToTop />
    </>
  );
}
