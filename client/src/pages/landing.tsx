import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Shield, 
  Zap,
  TrendingUp,
  Lock,
  FileCheck,
  BarChart3,
  Sparkles,
  Building2,
  CreditCard,
  Brain,
  Activity
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import edellaLogo from "@assets/edella-logo@3x_1760044169163.png";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { user, impersonating, impersonatedRole } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (user) {
      // If impersonating, redirect based on impersonated role
      const roleToCheck = impersonating && impersonatedRole ? impersonatedRole : user.role;
      
      if (roleToCheck === "provider" || roleToCheck === "customer") {
        setLocation("/provider/dashboard");
      } else if (roleToCheck === "admin" || roleToCheck === "super_admin") {
        setLocation("/admin/dashboard");
      } else if (roleToCheck === "bank") {
        setLocation("/bank/dashboard");
      }
    }
  }, [user, impersonating, impersonatedRole, setLocation]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <img 
                src={edellaLogo} 
                alt="Edella" 
                style={{ width: 'auto', height: '100%', maxHeight: '32px' }}
                className="object-contain"
              />
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">
                Features
              </a>
              <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-how-it-works">
                How It Works
              </a>
              <a href="#security" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-security">
                Security
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button
                variant="ghost"
                onClick={() => setShowLogin(true)}
                data-testid="button-login"
              >
                Sign In
              </Button>
              <Button
                onClick={() => setLocation("/onboarding")}
                data-testid="button-get-started"
                className="bg-[#F96B68] hover:bg-[#F96B68]/90"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32 sm:pt-24 sm:pb-40">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.primary/20%),transparent)]" />
        <div className="absolute inset-y-0 right-1/2 -z-10 mr-16 w-[200%] origin-bottom-left skew-x-[-30deg] bg-background shadow-xl shadow-primary/10 ring-1 ring-border sm:mr-28 lg:mr-0 xl:mr-16 xl:origin-center" />
        
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                Instant payments for providers
              </h1>
              <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
                We code and purchase your claims the same day they're submitted. Zero denials, zero A/R days, ultra-low risk. Our AI-powered platform delivers 95% of claim value within hours—transforming your revenue cycle from weeks to minutes.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Button
                  size="lg"
                  onClick={() => setLocation("/onboarding")}
                  data-testid="button-hero-start"
                  className="bg-[#F96B68] hover:bg-[#F96B68]/90"
                >
                  Start getting paid faster
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  data-testid="button-hero-demo"
                >
                  View demo
                </Button>
              </div>
              
              {/* Trust Indicators */}
              <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>HIPAA Compliant</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="h-4 w-4 text-primary" />
                  <span>Bank-Grade Security</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileCheck className="h-4 w-4 text-primary" />
                  <span>SOC 2 Certified</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-20 grid grid-cols-2 gap-8 sm:grid-cols-4">
              <div className="text-center">
                <div className="text-4xl font-bold" data-testid="stat-approval-rate">98%</div>
                <div className="mt-2 text-sm text-muted-foreground">Approval rate</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold" data-testid="stat-claims-processed">$50M+</div>
                <div className="mt-2 text-sm text-muted-foreground">Claims processed</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold" data-testid="stat-avg-payout">24hrs</div>
                <div className="mt-2 text-sm text-muted-foreground">Average payout</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold" data-testid="stat-providers-served">500+</div>
                <div className="mt-2 text-sm text-muted-foreground">Providers served</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-primary">Everything you need</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Built for healthcare providers
            </p>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              ClaimPay combines cutting-edge AI with deep healthcare expertise to deliver the fastest, most reliable claims payment platform available.
            </p>
          </div>
          
          <div className="mx-auto mt-16 max-w-7xl">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="relative overflow-hidden border-border/50">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">AI-Powered Coding</CardTitle>
                  <CardDescription className="text-base">
                    Our advanced AI automatically assigns accurate ICD-10 and CPT codes to your claims, eliminating manual coding errors and speeding up processing.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="relative overflow-hidden border-border/50">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                    <Activity className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle className="text-xl">Risk Assessment</CardTitle>
                  <CardDescription className="text-base">
                    Proprietary algorithms analyze each claim to predict payer approval with 98% accuracy, ensuring you only receive funding for viable claims.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="relative overflow-hidden border-border/50">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-chart-3/10">
                    <Zap className="h-6 w-6 text-chart-3" />
                  </div>
                  <CardTitle className="text-xl">Instant Payments</CardTitle>
                  <CardDescription className="text-base">
                    Receive 95% of approved claim value via ACH within hours. No more waiting 30+ days for insurance reimbursements to arrive.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="relative overflow-hidden border-border/50">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Transparent Pricing</CardTitle>
                  <CardDescription className="text-base">
                    Simple, predictable fees with no hidden charges. You only pay when you get paid—our success is directly tied to yours.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="relative overflow-hidden border-border/50">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                    <BarChart3 className="h-6 w-6 text-accent" />
                  </div>
                  <CardTitle className="text-xl">Real-Time Analytics</CardTitle>
                  <CardDescription className="text-base">
                    Track your cash flow, claim status, and revenue metrics in real-time with our comprehensive dashboard and reporting tools.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="relative overflow-hidden border-border/50">
                <CardHeader>
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-chart-3/10">
                    <Building2 className="h-6 w-6 text-chart-3" />
                  </div>
                  <CardTitle className="text-xl">EHR Integration</CardTitle>
                  <CardDescription className="text-base">
                    Seamlessly connect with Epic, Cerner, Athenahealth, and other major EHR systems. No workflow disruption required.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-muted/30 py-24 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, fast, reliable
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Get started in minutes and receive your first payment within hours
            </p>
          </div>
          
          <div className="mx-auto mt-16 max-w-5xl">
            <div className="grid gap-12 lg:grid-cols-3">
              <div className="relative">
                <div className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  1
                </div>
                <div className="pl-8">
                  <h3 className="text-xl font-semibold">Submit your claim</h3>
                  <p className="mt-4 text-muted-foreground">
                    Upload claims directly or connect your EHR for automatic submission. Our AI instantly codes and validates every claim.
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  2
                </div>
                <div className="pl-8">
                  <h3 className="text-xl font-semibold">Instant approval</h3>
                  <p className="mt-4 text-muted-foreground">
                    Our risk engine analyzes the claim and provides an instant approval decision. High-confidence claims are automatically funded.
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  3
                </div>
                <div className="pl-8">
                  <h3 className="text-xl font-semibold">Get paid immediately</h3>
                  <p className="mt-4 text-muted-foreground">
                    Receive 95% of the claim value via ACH within hours. We handle insurance submission and collect the full reimbursement.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 flex justify-center">
            <Button
              size="lg"
              onClick={() => setLocation("/onboarding")}
              data-testid="button-start-processing"
              className="bg-[#F96B68] hover:bg-[#F96B68]/90"
            >
              Start processing claims
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Security & Compliance */}
      <section id="security" className="py-24 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Enterprise-grade security
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Your data security and patient privacy are our highest priorities
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-5xl">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">HIPAA Compliant</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Full compliance with healthcare data protection regulations
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Data Encryption</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  256-bit encryption for all data in transit and at rest
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <FileCheck className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">SOC 2 Type II</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Independently audited security controls and practices
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">AI Safety</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Ethical AI practices with human oversight and validation
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to transform your cash flow?
            </h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              Join hundreds of healthcare providers who've eliminated payment delays with ClaimPay
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => setLocation("/onboarding")}
                data-testid="button-cta-start"
                className="bg-[#F96B68] hover:bg-[#F96B68]/90"
              >
                Get started now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setShowLogin(true)}
                data-testid="button-cta-signin"
              >
                Sign in
              </Button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              No setup fees • No long-term contracts • Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} />
      )}
    </div>
  );
}

function LoginModal({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      toast({ title: "Welcome back!" });
      onClose();
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In to ClaimPay</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1" data-testid="button-submit-login">
                Sign In
              </Button>
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-login">
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
