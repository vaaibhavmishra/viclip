import Autoplay from "embla-carousel-autoplay";
import { ClipboardList, KeyboardIcon, ShieldCheck, Zap } from "lucide-react";
import { useRef } from "react";
import icon from "../../assets/Icon.png";
import { Card, CardContent } from "../../components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../../components/ui/carousel";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { Login } from "./Login";
import { SignUp } from "./SignUp";

export const AuthPage = () => {
  const plugin = useRef(Autoplay({ delay: 4000, stopOnInteraction: true }));

  const features = [
    {
      title: "Universal Sync",
      description:
        "Instantly sync your clipboard across all your devices. Copy on one, paste on another.",
      icon: Zap,
    },
    {
      title: "Secure & Private",
      description:
        "Your data is encrypted end-to-end. We prioritize your privacy and security above all.",
      icon: ShieldCheck,
    },
    {
      title: "History Manager",
      description:
        "Access your clipboard history anytime. Search, filter, and manage your clips with ease.",
      icon: ClipboardList,
    },
    {
      title: "Full Keyboard Control",
      description: "Controll the full app with keyboard shortcuts.",
      icon: KeyboardIcon,
    },
  ];

  return (
    <div className="flex w-full h-full ">
      {/* Left Side - Branding & Carousel */}
      <div className="w-1/2 h-full flex flex-col items-center justify-center p-8 border-r relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center w-full max-w-md">
          <div className="mb-12 flex flex-col items-center space-y-4">
            <img src={icon} alt="ViClip Logo" className="w-16 h-16" />
            <h1 className="text-4xl font-bold tracking-tight bg-linear-to-b from-gray-700 via-gray-900 to-black dark:from-gray-300 dark:via-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
              ViClip
            </h1>
            <p className="text-muted-foreground text-sm font-medium tracking-wide">
              Sync Your Clipboard Across All Your Devices
            </p>
          </div>

          <Carousel plugins={[plugin.current]} className="w-full max-w-xs">
            <CarouselContent>
              {features.map((feature, index) => (
                <CarouselItem key={index}>
                  <div className="p-1">
                    <Card className="bg-transparent border-none shadow-none">
                      <CardContent className="flex flex-col items-center text-center p-6 space-y-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
                          <feature.icon className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {feature.description}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
        <div className="absolute bottom-8 text-xs text-muted-foreground/50 font-mono">
          v2.0.0
        </div>
      </div>

      {/* Right Side - Forms */}
      <div className="w-1/2 h-full flex flex-col p-8 overflow-y-auto">
        <Tabs
          defaultValue="login"
          className="w-full max-w-md mx-auto space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2 bg-transparent border">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="mt-0">
            <Login />
          </TabsContent>
          <TabsContent value="signup" className="mt-0">
            <SignUp />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
