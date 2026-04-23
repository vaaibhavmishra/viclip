import { CONTACT } from "@viclip/constants";

export const metadata = {
  title: "Privacy Policy",
  description:
    "ViClip's privacy policy. Learn how we protect your data in our universal clipboard sync app. Transparent data handling across Windows, macOS, Linux, iOS, and Android.",
  keywords: [
    "ViClip privacy policy",
    "clipboard sync privacy",
    "data protection",
    "privacy security",
    "clipboard data handling",
    "cross-platform privacy",
    "user data protection",
  ],
  openGraph: {
    title: "Privacy Policy | ViClip",
    description:
      "Learn about ViClip's commitment to protecting your privacy and data in our universal clipboard sync application.",
    url: "https://viclip.shipby.me/privacy",
    type: "website",
  },
  alternates: {
    canonical: "https://viclip.shipby.me/privacy",
  },
};

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background px-4 py-12 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

      <div className="prose max-w-none">
        <p className="text-gray-600 mb-8">Last Updated: April 6, 2025</p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p>
            This Privacy Policy explains how Viclip ("we", "us", or "our")
            collects, uses, discloses, and safeguards your information when you
            use our Viclip application and related services (collectively, the
            "Service").
          </p>
          <p>
            We respect your privacy and are committed to protecting your
            personal information. We encourage you to read this Privacy Policy
            carefully to understand our practices regarding your information and
            how we will treat it.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            2. Information We Collect
          </h2>
          <p>We collect the following types of information:</p>
          <h3 className="text-xl font-medium mt-4 mb-2">
            2.1 Personal Information
          </h3>
          <p>
            When you create an account, we collect information provided through
            Google Sign-In, which may include:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Name</li>
            <li>Email address</li>
            <li>Profile picture</li>
            <li>Google account ID</li>
          </ul>

          <h3 className="text-xl font-medium mt-4 mb-2">2.2 Clipboard Data</h3>
          <p>
            The primary function of our Service is to synchronize clipboard
            content across your devices. To provide this functionality, we
            collect and process:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Text, links, and other content you copy to your clipboard</li>
            <li>Device information to sync across your devices properly</li>
          </ul>

          <h3 className="text-xl font-medium mt-4 mb-2">
            2.3 Usage Information
          </h3>
          <p>
            We automatically collect certain information about how you interact
            with our Service, including:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Device information (operating system, device type)</li>
            <li>Log data (IP address, browser type, pages visited)</li>
            <li>Usage patterns and frequency</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            3. How We Use Your Information
          </h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Provide, maintain, and improve our Service</li>
            <li>
              Process and complete clipboard synchronization between your
              devices
            </li>
            <li>Create and manage your user account</li>
            <li>Send you technical notices, updates, and support messages</li>
            <li>Respond to your comments and questions</li>
            <li>
              Monitor and analyze trends, usage, and activities related to our
              Service
            </li>
            <li>
              Detect, prevent, and address technical issues, security risks, or
              unauthorized access
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            4. How We Share Your Information
          </h2>
          <p>
            We do not sell, trade, or rent your personal information to third
            parties. We may share your information in the following
            circumstances:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>
              <strong>Service Providers:</strong> We may share your information
              with third-party vendors who provide services on our behalf (e.g.,
              hosting, data analytics, customer service).
            </li>
            <li>
              <strong>Compliance with Laws:</strong> We may disclose your
              information where required by law or to protect our rights or the
              rights of others.
            </li>
            <li>
              <strong>Business Transfers:</strong> If we are involved in a
              merger, acquisition, or sale of all or a portion of our assets,
              your information may be transferred as part of that transaction.
            </li>
            <li>
              <strong>With Your Consent:</strong> We may share your information
              with third parties when we have your consent to do so.
            </li>
          </ul>
          <p>
            Any third-party service providers we use are required to maintain
            the confidentiality of the information we share with them and are
            prohibited from using it for any purpose other than providing
            services on our behalf.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to
            protect your personal information from unauthorized access, use, or
            disclosure. However, no method of transmission over the Internet or
            electronic storage is 100% secure, and we cannot guarantee absolute
            security.
          </p>
          <p>
            It's important to understand that clipboard data, by its nature, may
            include sensitive information if you copy such content. We recommend
            that you do not copy highly sensitive information (such as
            passwords, financial details, etc.) if you use our Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            6. Your Rights and Choices
          </h2>
          <p>You have certain rights regarding your personal information:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>
              <strong>Access and Update:</strong> You can access and update your
              profile information through your account settings.
            </li>
            <li>
              <strong>Delete Account:</strong> You can request deletion of your
              account and associated data by contacting us.
            </li>
            <li>
              <strong>Opt-Out:</strong> You can opt out of non-essential
              communications from us.
            </li>
            <li>
              <strong>Data Portability:</strong> You can request a copy of your
              data in a structured, commonly used format.
            </li>
          </ul>
          <p>
            To exercise these rights, please contact us using the information
            provided in the "Contact Us" section.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
          <p>
            We will retain your personal information only for as long as
            necessary to fulfill the purposes for which we collected it,
            including for the purposes of satisfying any legal, regulatory, tax,
            accounting, or reporting requirements.
          </p>
          <p>
            Your clipboard data is retained as long as necessary to provide the
            synchronization service. You can delete specific clipboard entries
            or clear your clipboard history through the application.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Children's Privacy</h2>
          <p>
            Our Service is not directed to individuals under the age of 13. We
            do not knowingly collect personal information from children under
            13. If we become aware that we have collected personal information
            from a child under 13 without verification of parental consent, we
            will take steps to remove that information.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            9. International Data Transfers
          </h2>
          <p>
            Your information may be transferred to — and maintained on —
            computers located outside of your state, province, country, or other
            governmental jurisdiction where the data protection laws may differ
            from those of your jurisdiction.
          </p>
          <p>
            By using our Service, you consent to this transfer of your
            information.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            10. Changes to This Privacy Policy
          </h2>
          <p>
            We may update our Privacy Policy from time to time. We will notify
            you of any changes by posting the new Privacy Policy on this page
            and updating the "Last Updated" date at the top of this Privacy
            Policy.
          </p>
          <p>
            You are advised to review this Privacy Policy periodically for any
            changes. Changes to this Privacy Policy are effective when they are
            posted on this page.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact
            us at{" "}
            <a
              href={`mailto:${CONTACT.supportEmail}`}
              className="text-blue-400"
            >
              {" "}
              {CONTACT.supportEmail}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
