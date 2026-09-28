"use client";

import { useState } from "react";
import { useCivicLens } from "@/store/civiclens";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

export function AuthDialog() {
  const {
    authOpen,
    closeAuth,
    signin,
    signup,
  } = useCivicLens();

  const { toast } = useToast();

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setLoading(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
      closeAuth();
    }
  };

  // =========================================================
  // SIGN IN
  // =========================================================

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      toast({
        title: "Missing details",
        description: "Please enter your email and password.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // IMPORTANT:
      // Do NOT call /api/auth/login.
      //
      // signin() in the Zustand store uses:
      // signIn("credentials", ...)
      //
      // which calls NextAuth correctly.
      await signin(cleanEmail, password);

      toast({
        title: "Signed in successfully",
        description: "Welcome back to Civic India.",
      });

      resetForm();
    } catch (error) {
      console.error("Sign in error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Invalid email or password.";

      toast({
        title: "Sign in failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // SIGN UP
  // =========================================================

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      toast({
        title: "Missing details",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (cleanName.length < 2) {
      toast({
        title: "Invalid name",
        description: "Name must contain at least 2 characters.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must contain at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await signup(cleanName, cleanEmail, password);

      toast({
        title: "Account created",
        description:
          "Check your email and verify your account before signing in.",
      });

      // Move user to sign-in screen after registration
      setTab("signin");

      setName("");
      setPassword("");
    } catch (error) {
      console.error("Registration error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Could not create your account.";

      toast({
        title: "Registration failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={authOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>

            <div>
              <DialogTitle>Civic India</DialogTitle>

              <DialogDescription>
                Secure citizen and authority access
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(value) =>
            setTab(value as "signin" | "signup")
          }
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">
              Sign In
            </TabsTrigger>

            <TabsTrigger value="signup">
              Create Account
            </TabsTrigger>
          </TabsList>

          {/* ================= SIGN IN ================= */}

          <TabsContent value="signin">
            <form
              onSubmit={handleSignIn}
              className="mt-4 space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="signin-email">
                  Email
                </Label>

                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signin-password">
                  Password
                </Label>

                <Input
                  id="signin-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          {/* ================= SIGN UP ================= */}

          <TabsContent value="signup">
            <form
              onSubmit={handleSignUp}
              className="mt-4 space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="signup-name">
                  Full name
                </Label>

                <Input
                  id="signup-name"
                  type="text"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">
                  Email
                </Label>

                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">
                  Password
                </Label>

                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />

                <p className="text-xs text-muted-foreground">
                  Use at least 6 characters.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Create Account
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-2 rounded-lg border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            Authority accounts cannot be created from this form.
            Administrator access is provisioned separately.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}