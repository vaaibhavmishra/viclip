export default function CancellationRefund() {
  return (
    <div className="px-4 py-12 min-h-screen bg-background flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-8">
        Cancellation and Refund Policy
      </h1>

      <div className="prose max-w-none">
        <p className="text-gray-600 mb-8">Last Updated: April 6, 2025</p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            1. Subscription Cancellation
          </h2>
          <p>
            If you subscribe to any paid plan we may offer in the future, you
            may cancel your subscription at any time through your account
            settings or by contacting our customer support.
          </p>
          <p>
            For monthly subscriptions: If you cancel your subscription, your
            service will remain active until the end of your current billing
            period, after which it will not renew.
          </p>
          <p>
            For annual subscriptions: If you cancel your subscription, your
            service will remain active until the end of your current annual
            billing period, after which it will not renew.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Refund Eligibility</h2>
          <p>
            For monthly subscriptions: Due to the nature of digital services,
            refunds are generally not provided for partial months of service.
            However, we may consider refund requests on a case-by-case basis for
            the current billing month if submitted within 5 days of being
            charged.
          </p>
          <p>
            For annual subscriptions: If you cancel within 14 days of initial
            purchase, you may be eligible for a full refund. Cancellations after
            14 days will not be eligible for a refund for the unused portion of
            your subscription term.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Refund Exceptions</h2>
          <p>We may issue refunds at our discretion in cases of:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>
              Technical issues that substantially impair the functionality of
              the Service and that we cannot resolve within a reasonable
              timeframe
            </li>
            <li>Billing errors where you were charged incorrectly</li>
            <li>Unauthorized transactions (after verification)</li>
            <li>
              Other exceptional circumstances, evaluated on a case-by-case basis
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            4. How to Request a Refund
          </h2>
          <p>To request a refund:</p>
          <ol className="list-decimal pl-6 mb-4">
            <li>
              Contact us at{" "}
              <a
                href="mailto:support@viclip.shipby.me"
                className="text-blue-400"
              >
                support@viclip.shipby.me
              </a>
            </li>
            <li>
              Include your account email address, the date of purchase, and the
              reason for your refund request
            </li>
            <li>
              Our support team will review your request and respond within 3
              business days
            </li>
          </ol>
          <p>
            Please note that submitting a refund request does not guarantee
            approval. Each request will be evaluated based on our refund policy
            and the specific circumstances involved.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Refund Processing</h2>
          <p>
            Approved refunds will be processed to the original payment method
            used for the transaction. Depending on your payment provider, it may
            take 5-10 business days for a refund to appear in your account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">
            6. Account Status After Refund
          </h2>
          <p>
            If a full refund is issued, access to premium features associated
            with the subscription will be revoked. Your account will revert to
            any available free tier with its associated limitations.
          </p>
          <p>
            Any data stored within your account will be maintained in accordance
            with our data retention policies as outlined in our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">
            7. Contact Information
          </h2>
          <p>
            If you have any questions about our Cancellation and Refund Policy,
            please contact us at{" "}
            <a href="mailto:support@viclip.shipby.me" className="text-blue-400">
              support@viclip.shipby.me
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
