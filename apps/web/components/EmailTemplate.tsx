import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

const WaitlistEmail = () => {
  return (
    <Html>
      <Tailwind>
        <Head>
          <title>You're on the Viclip Waitlist!</title>
          <Preview>
            Thanks for joining the Viclip waitlist - sync your clipboard across
            all devices
          </Preview>
        </Head>
        <Body className="bg-[#f4f4f5] font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] mx-auto p-[20px] max-w-[600px]">
            <Section className="mt-[32px] text-center">
              <Img
                src="https://www.viclip.shipby.me/_next/image?url=%2Ficon.png&w=384&q=75"
                width="80"
                height="80"
                alt="Viclip Logo"
                className="mx-auto"
              />
              <Heading className="text-[24px] font-bold mt-[16px] mb-[8px]">
                You're on the Viclip Waitlist!
              </Heading>
              <Text className="text-[16px] mb-[24px] text-[#666666]">
                Thanks for your interest in seamless clipboard syncing
              </Text>
            </Section>

            <Hr className="border-[#e6e6e6] my-[16px]" />

            <Section className="mt-[32px]">
              <Text className="text-[16px] mb-[16px]">Hi there,</Text>
              <Text className="text-[16px] mb-[16px]">
                Thank you for joining the Viclip waitlist! We're thrilled about
                your interest in our clipboard syncing solution.
              </Text>
              <Text className="text-[16px] mb-[16px]">
                <strong>Viclip</strong> will revolutionize how you work across
                devices by:
              </Text>

              <Section className="ml-[16px] mb-[24px]">
                <Text className="text-[16px] mb-[8px] m-0">
                  • Instantly syncing your clipboard across all your devices
                </Text>
                <Text className="text-[16px] mb-[8px] m-0">
                  • Supporting all major platforms (iOS, Android, Windows,
                  macOS)
                </Text>
                <Text className="text-[16px] mb-[8px] m-0">
                  • Providing secure, encrypted syncing of your clipboard data
                </Text>
                <Text className="text-[16px] mb-[8px] m-0">
                  • Offering a seamless, distraction-free experience
                </Text>
              </Section>

              <Text className="text-[16px] mb-[24px]">
                We're working hard to perfect Viclip and will notify you as soon
                as we're ready to welcome our first users. As an early waitlist
                member, you'll get <strong>priority access</strong> when we
                launch!
              </Text>

              <Section className="text-center mb-[32px]">
                <Button
                  className="bg-[#3b82f6] text-white font-bold py-[12px] px-[24px] rounded-[8px] text-[16px] box-border"
                  href="https://www.viclip.shipby.me"
                >
                  Learn More About Viclip
                </Button>
              </Section>

              <Text className="text-[16px] mb-[16px]">
                In the meantime, if you have any questions or feedback, feel
                free to reply to this email. We'd love to hear from you!
              </Text>

              <Text className="text-[16px] mb-[16px]">
                Thanks for your support,
              </Text>
              <Text className="text-[16px] font-bold">The Viclip Team</Text>
            </Section>

            <Hr className="border-[#e6e6e6] my-[32px]" />

            <Section className="text-center text-[14px] text-[#666666]">
              <Text className="m-0 mb-[8px]">
                © {new Date().getFullYear()} ViClip. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default WaitlistEmail;
