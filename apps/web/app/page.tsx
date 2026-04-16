"use client";

import { Contact } from "@/components/sections/Contact";
import { FAQ } from "@/components/sections/FAQ";
import { Features } from "@/components/sections/Features";
import { Footer } from "@/components/sections/Footer";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Navigation } from "@/components/sections/Navigation";
import { VideoDemo } from "@/components/sections/VideoDemo";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <Hero />
      <VideoDemo />
      <Features />
      <HowItWorks />
      <FAQ />
      <Contact />
      <Footer />
    </div>
  );
}
