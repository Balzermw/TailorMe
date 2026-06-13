import type { Metadata } from "next";
import Image from "next/image";
import { Check, Sparkles } from "lucide-react";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import SignInCard from "./sign-in-card";

export const metadata: Metadata = {
  title: "Sign in — TailorMe by Res.Me",
};

const CREDS = [
  "No card required to start",
  "Fit scored before you spend anything",
  "Three specialist agents on every application",
  "Encrypted at rest · delete everything in one click",
];

export default function SignInPage() {
  return (
    <div className="tm">
      <Nav active="" />
      <main>
        <div className="tmS-wrap">
          <div className="tmS-side">
            <Image
              src="/resme-logomark.png"
              alt=""
              width={942}
              height={1042}
              sizes="40px"
              className="w-[40px] h-auto"
            />
            <h2>Your experience is stronger than your resume makes it look.</h2>
            <span className="tm-pill tm-pill--mint self-start">
              <Sparkles size={13} /> Your first application is free
            </span>
            <div className="tmB-creds">
              {CREDS.map((c) => (
                <span key={c} className="tmB-cred">
                  <Check size={12} /> {c}
                </span>
              ))}
            </div>
          </div>
          <div className="tmS-main">
            <SignInCard />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
