import { CONTACT } from "@viclip/constants";

export default function ShippingDelivery() {
  return (
    <div className="px-4 py-12 min-h-screen bg-background flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8">Shipping and Delivery Policy</h1>

      <div className="prose max-w-none">
        <p className="text-gray-600 mb-8">Last Updated: April 6, 2025</p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            1. Digital Service Nature
          </h2>
          <p>
            Viclip is entirely a digital service that enables clipboard
            synchronization across multiple devices. As such, no physical goods
            are shipped or delivered to users at any time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            2. Service Delivery Methods
          </h2>
          <p>Our Service is delivered via the following digital channels:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>
              <strong>Web Application:</strong> Accessible through standard
              internet browsers
            </li>
            <li>
              <strong>Mobile Applications:</strong> Available through the Apple
              App Store for iOS devices and Google Play Store for Android
              devices
            </li>
            <li>
              <strong>Desktop Applications:</strong> Available for download
              directly from our website for Windows and macOS platforms
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Service Activation</h2>
          <p>
            Access to the Viclip service is typically granted immediately upon:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>
              Successfully creating an account via Google Sign-In for free
              services
            </li>
            <li>
              Completion of payment processing for any premium features (if
              applicable)
            </li>
          </ul>
          <p>
            After account creation or payment confirmation, you should have
            instant access to all features included in your service tier.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            4. Download and Installation
          </h2>
          <p>For desktop and mobile applications:</p>
          <ol className="list-decimal pl-6 mb-4">
            <li>
              Download speeds depend on your internet connection speed and the
              app store's server load
            </li>
            <li>
              Installation processes follow standard procedures for your
              respective device or operating system
            </li>
            <li>
              Typical application size is under 100MB, but may vary with updates
            </li>
          </ol>
          <p>
            We recommend being connected to a stable Wi-Fi network when
            downloading our applications to ensure a smooth installation
            process.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Service Updates</h2>
          <p>
            Updates to the Viclip service are delivered automatically or through
            standard application update channels:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>
              Web application updates are applied automatically when you access
              the service
            </li>
            <li>
              Mobile app updates are delivered through the Apple App Store or
              Google Play Store
            </li>
            <li>
              Desktop application updates may be downloaded automatically or
              prompt you based on your settings
            </li>
          </ul>
          <p>
            We regularly update our applications to improve performance,
            security, and features. These updates are included as part of your
            service at no additional cost.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            6. Service Availability
          </h2>
          <p>
            Viclip strives to maintain service availability 24/7. However,
            occasional maintenance windows or unplanned outages may occur.
            During these times:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>
              Your locally stored clipboard data will still be available on your
              device
            </li>
            <li>
              Synchronization between devices may be temporarily unavailable
            </li>
            <li>We will work to restore service as quickly as possible</li>
          </ul>
          <p>
            For planned maintenance, we will attempt to provide advance notice
            through our website or email.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">
            7. Contact Information
          </h2>
          <p>
            If you experience any delays in accessing the Service after account
            creation or payment, or have any questions about our digital
            delivery process, please contact our support team at{" "}
            <a
              href={`mailto:${CONTACT.supportEmail}`}
              className="text-blue-400"
            >
              {CONTACT.supportEmail}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
