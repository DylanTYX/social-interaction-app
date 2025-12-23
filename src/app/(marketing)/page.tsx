import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MessageSquare,
  Users,
  Globe,
  BarChart3,
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";
import { ChatMessage } from "@/components/chat/chat-message";
import { SAMPLE_MESSAGES, DEMO_PERSONA_NAME } from "@/lib/constants";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/90 backdrop-blur-xl shadow-soft">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">ConvoTrainer</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150"
            >
              How It Works
            </Link>
            <Link
              href="#demo"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-150"
            >
              Demo
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section with Side-by-Side Demo */}
      <section className="min-h-[calc(100vh-4rem)] flex items-center py-12">
        <div className="mx-auto max-w-7xl px-6 w-full">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-semibold shadow-soft border border-blue-100/50">
                <Sparkles className="h-4 w-4" />
                <span>AI-Powered Communication Training</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl leading-[1.15]">
                  Master Cross-Cultural
                  <br />
                  <span className="gradient-text">Communication</span>
                </h1>
                <p className="text-lg text-gray-600 leading-relaxed max-w-xl">
                  Practice realistic conversations with AI personas from diverse
                  cultures. Build confidence, refine your skills, and excel in
                  global business settings.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  asChild
                  className="shadow-soft-md hover:shadow-soft-lg transition-all duration-200"
                >
                  <Link href="/auth/register">
                    Start Training Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <Link href="#demo">Watch Demo</Link>
                </Button>
              </div>

              <div className="flex items-center gap-8 pt-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900">10k+</p>
                  <p className="text-sm text-gray-600">Active Users</p>
                </div>
                <div className="h-12 w-px bg-gray-200" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">50+</p>
                  <p className="text-sm text-gray-600">Scenarios</p>
                </div>
                <div className="h-12 w-px bg-gray-200" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">8</p>
                  <p className="text-sm text-gray-600">Cultures</p>
                </div>
              </div>

              <p className="text-sm text-gray-500 font-medium">
                No credit card required • 14-day free trial
              </p>
            </div>

            {/* Demo Chat Preview */}
            <Card className="shadow-soft-lg border-gray-200/80 hover-lift">
              <CardHeader>
                <CardTitle>Live Conversation Preview</CardTitle>
                <CardDescription>
                  Demo: Quarterly Business Review with Sarah Chen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg max-h-96 overflow-y-auto">
                  {SAMPLE_MESSAGES.map((msg) => (
                    <ChatMessage
                      key={msg.id}
                      role={msg.role}
                      content={msg.content}
                      timestamp={msg.timestamp}
                      personaName={DEMO_PERSONA_NAME}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section with Colorful Cards */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl md:text-5xl leading-tight">
              Everything You Need to Excel
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Comprehensive tools to help you navigate complex cross-cultural
              conversations with confidence and expertise.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <Card className="border border-gray-200/60 hover:border-blue-200 hover:shadow-soft-md transition-all duration-200 hover-lift">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl mb-2">Diverse Personas</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Practice with AI personas representing different cultures,
                  roles, and communication styles
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-gray-200/60 hover:border-purple-200 hover:shadow-soft-md transition-all duration-200 hover-lift">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle className="text-xl mb-2">
                  Real-time Feedback
                </CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Get instant insights on tone, cultural awareness, and
                  communication effectiveness
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-gray-200/60 hover:border-green-200 hover:shadow-soft-md transition-all duration-200 hover-lift">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                  <Globe className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle className="text-xl mb-2">Cultural Context</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Learn cultural nuances and communication norms from around the
                  world
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-gray-200/60 hover:border-orange-200 hover:shadow-soft-md transition-all duration-200 hover-lift">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-orange-600" />
                </div>
                <CardTitle className="text-xl mb-2">
                  Progress Analytics
                </CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Track your improvement with detailed analytics and performance
                  metrics
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-gray-200/60 hover:border-pink-200 hover:shadow-soft-md transition-all duration-200 hover-lift">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-pink-100 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-pink-600" />
                </div>
                <CardTitle className="text-xl mb-2">Scenario Library</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Access hundreds of realistic business scenarios from
                  negotiations to presentations
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border border-gray-200/60 hover:border-indigo-200 hover:shadow-soft-md transition-all duration-200 hover-lift">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-indigo-600" />
                </div>
                <CardTitle className="text-xl mb-2">Voice & Text</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Practice via text chat or voice conversations to build all
                  communication skills
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl md:text-5xl leading-tight">
              Start Practicing in Minutes
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Simple, effective process to improve your cross-cultural
              communication
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Choose a Scenario
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Select from 50+ workplace scenarios including negotiations,
                feedback, meetings, and more
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Select a Persona
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Pick an AI persona with specific cultural context and
                communication style to practice with
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-600">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Get Feedback
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Receive instant, detailed feedback on your communication
                effectiveness and cultural awareness
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        id="demo"
        className="py-24 bg-linear-to-br from-blue-600 to-purple-600"
      >
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl md:text-5xl mb-6 leading-tight">
            Ready to Transform Your Communication Skills?
          </h2>
          <p className="text-lg md:text-xl text-blue-50 mb-8 leading-relaxed max-w-2xl mx-auto">
            Join thousands of professionals mastering cross-cultural
            communication with AI-powered training
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/auth/register">
              Start Your Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold">ConvoTrainer</span>
              </div>
              <p className="text-sm text-gray-600">
                Master cross-cultural communication through AI-powered practice
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Product</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li>
                  <Link
                    href="#features"
                    className="hover:text-gray-900 transition-colors duration-150"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-gray-900 transition-colors duration-150"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-gray-900 transition-colors duration-150"
                  >
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Company</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li>
                  <Link href="#" className="hover:text-gray-900">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-gray-900">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-gray-900">
                    Careers
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Legal</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                <li>
                  <Link href="#" className="hover:text-gray-900">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-gray-900">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-gray-900">
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t pt-8 text-center text-sm text-gray-600">
            <p>&copy; 2025 ConvoTrainer. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
