import type { Metadata } from "next/types";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "ViClip's terms of service and user agreement. Understand your rights and responsibilities when using our universal clipboard sync app.",
  keywords: [
    "ViClip terms of service",
    "clipboard sync terms",
    "user agreement",
    "service terms",
    "clipboard app terms",
    "cross-platform terms",
  ],
  openGraph: {
    title: "Terms of Service - ViClip Universal Clipboard Sync",
    description:
      "Read ViClip's terms of service and user agreement for our universal clipboard synchronization application.",
    url: "https://viclip.shipby.me/terms",
    type: "website",
  },
  alternates: {
    canonical: "https://viclip.shipby.me/terms",
  },
};

export default function Terms() {
  return (
    <div className="px-4 py-12 min-h-screen bg-background flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

      <div className="prose max-w-none">
        <p className="text-gray-600 mb-8">Last Updated: April 6, 2025</p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p>
            Welcome to Viclip, a service that enables clipboard synchronization
            across multiple devices. These Terms of Service ("Terms") govern
            your access to and use of the Viclip application and website
            (collectively, the "Service"). By accessing or using the Service,
            you agree to be bound by these Terms. If you do not agree to these
            Terms, do not access or use the Service.
          </p>
          <p>
            Viclip is operated by an individual developer ("we," "us," or
            "our"). The Service is provided "as is" and "as available" without
            warranties of any kind.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            2. Description of Service
          </h2>
          <p>
            Viclip is a software application that allows users to synchronize
            clipboard content across multiple devices. The Service includes
            desktop and mobile applications that enable this functionality.
          </p>
          <p>
            We reserve the right to modify, suspend, or discontinue the Service
            at any time, with or without notice, and we will not be liable to
            you or any third party for any such modification, suspension, or
            discontinuation.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
          <p>
            To use certain features of the Service, you must create an account
            using Google Sign-In. You agree to provide accurate information and
            to keep this information updated. You are responsible for
            maintaining the confidentiality of your account credentials and for
            all activities that occur under your account.
          </p>
          <p>
            You agree that you will not share your account credentials with any
            third party or allow any third party to access your account. You
            must notify us immediately of any unauthorized use of your account
            or any other breach of security.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Privacy and Data</h2>
          <p>
            By using the Service, you acknowledge and agree that we will collect
            and process your clipboard data to provide the synchronization
            functionality. We also collect account information provided through
            Google Sign-In, including but not limited to your name and email
            address.
          </p>
          <p>
            We take data security seriously but cannot guarantee absolute
            security. You acknowledge that you provide your data at your own
            risk. We will handle your data in accordance with our Privacy
            Policy.
          </p>
          <p>
            You retain ownership of all content you copy to your clipboard. By
            using our Service, you grant us a non-exclusive, worldwide license
            to use, store, and transfer that content solely for the purpose of
            providing and improving the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Prohibited Uses</h2>
          <p>You agree not to use the Service:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>
              In any way that violates any applicable federal, state, local, or
              international law or regulation
            </li>
            <li>
              To transmit or upload any material that contains viruses, Trojan
              horses, worms, or any other harmful or destructive code
            </li>
            <li>
              To engage in any activity that interferes with or disrupts the
              Service
            </li>
            <li>To attempt to access any other user's clipboard data</li>
            <li>
              To reverse engineer, decompile, or disassemble any part of the
              Service
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            6. Intellectual Property
          </h2>
          <p>
            The Viclip name, logo, software, and all related content and
            materials are protected by intellectual property laws. You agree not
            to copy, modify, distribute, sell, or lease any part of the Service
            or its content without explicit permission.
          </p>
          <p>
            You retain all rights to the content you synchronize through our
            Service, but you grant us a license to use this content as necessary
            to provide the Service to you.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Payment Terms</h2>
          <p>
            The Service is currently provided free of charge. However, we may
            introduce paid subscription plans in the future. If we do so, these
            Terms will be updated to include payment terms, and you will be
            notified of any changes.
          </p>
          <p>
            If paid plans are introduced, you will have the option to continue
            using any free tier services that may remain available or to
            subscribe to paid plans with additional features.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            8. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, in no event shall we be
            liable for any indirect, incidental, special, consequential, or
            punitive damages, including without limitation, loss of profits,
            data, use, goodwill, or other intangible losses, resulting from:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>
              Your access to or use of or inability to access or use the Service
            </li>
            <li>
              Any unauthorized access to or use of our servers and/or any
              personal information stored therein
            </li>
            <li>
              Any interruption or cessation of transmission to or from the
              Service
            </li>
            <li>
              Any bugs, viruses, Trojan horses, or the like that may be
              transmitted to or through our Service by any third party
            </li>
          </ul>
          <p>
            Our total liability to you for any damages shall not exceed the
            greater of $50 or the amounts paid by you to us during the past six
            months.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold harmless us and our
            affiliates from and against any claims, liabilities, damages,
            judgments, awards, losses, costs, expenses, or fees (including
            reasonable attorneys' fees) arising out of or relating to your
            violation of these Terms or your use of the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
          <p>
            We may terminate or suspend your account and access to the Service
            immediately, without prior notice or liability, for any reason
            whatsoever, including without limitation if you breach the Terms.
          </p>
          <p>
            Upon termination, your right to use the Service will immediately
            cease. If you wish to terminate your account, you may simply
            discontinue using the Service or contact us to request account
            deletion.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will
            provide reasonable notice of any material changes, such as by
            posting the updated Terms on our website or within the application.
            Your continued use of the Service after such changes constitutes
            your acceptance of the new Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with
            the laws of the jurisdiction in which the developer resides, without
            regard to its conflict of law provisions.
          </p>
          <p>
            Any dispute arising from these Terms or your use of the Service
            shall be resolved through good faith negotiations. If such
            negotiations fail, the dispute shall be submitted to the exclusive
            jurisdiction of the courts in the jurisdiction where the developer
            resides.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">13. Severability</h2>
          <p>
            If any provision of these Terms is held to be invalid or
            unenforceable, such provision shall be struck and the remaining
            provisions shall be enforced.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">14. Entire Agreement</h2>
          <p>
            These Terms constitute the entire agreement between you and us
            regarding the Service and supersede all prior agreements and
            understandings.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">
            15. Contact Information
          </h2>
          <p>
            If you have any questions about these Terms, please contact us at
            <a href="mailto:support@viclip.shipby.me" className="text-blue-400">
              {" "}
              support@viclip.shipby.me
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
