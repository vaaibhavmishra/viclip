import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { checkEmail, saveEmail } from "@/actions/firebase";
import WaitlistEmail from "@/components/EmailTemplate";

// Email validation regex pattern
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function POST(request: NextRequest) {
  let email: string;

  try {
    const body = await request.json();
    email = body.email;
  } catch (_error) {
    return NextResponse.json(
      { message: "Invalid request format" },
      { status: 400 },
    );
  }

  if (!email) {
    return NextResponse.json({ message: "Email is required" }, { status: 400 });
  }

  // Validate email format
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { message: "Invalid email format" },
      { status: 400 },
    );
  }

  // Check if email already exists
  const existingEmail = await checkEmail(email);
  if (existingEmail) {
    return NextResponse.json(
      { message: "Email already signed-up we will keep you updated" },
      { status: 400 },
    );
  }

  // Send Email through Resend first
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("Resend API key is not configured");
    return NextResponse.json(
      { message: "Email service configuration error" },
      { status: 500 },
    );
  }

  const resend = new Resend(resendApiKey);

  try {
    // Send email and wait for it to complete
    await resend.emails.send({
      from: "ViClip <hello@viclip.shipby.me>",
      to: email,
      replyTo: "mishravaibhav12321@gmail.com",
      subject: "Welcome to ViClip's Waitlist! 🚀",
      react: WaitlistEmail(),
    });
    console.log("Email sent successfully");

    // Only save email to Firebase if email sending succeeds
    try {
      await saveEmail(email);
    } catch (e) {
      console.error("Firebase error:", e);
      return NextResponse.json(
        { message: "Failed to save your email" },
        { status: 500 },
      );
    }
  } catch (e) {
    console.error("Resend error:", e);
    return NextResponse.json(
      { message: "Failed to send confirmation email" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { message: "Successfully joined waitlist" },
    { status: 200 },
  );
}
