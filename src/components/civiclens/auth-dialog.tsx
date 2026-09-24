"use client";

// CivicLens — authentication dialog.
// - Citizens: self-service Sign In / Create Account (email + password)
// - Authority/Admin: same Sign In form using the provisioned official account
// Powered by NextAuth (credentials provider, httpOnly JWT cookie, CSRF-protected).

import { useState } from "react";
import { useCivicLens } from "@/store/civiclens";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScanEye, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Mode = "signin" | "signup";

export function AuthDialog() {
  const { authOpen, closeAuth, signin, signup } = useCivicLens();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setError(null);
    setPassword("");
    setConfirm("");
    setShowPassword(false);
  };

  const switchMode = (m: string) => {
    setMode(m as Mode);
    resetForm();
  };

  const validate = (): string | null => {
    if (mode === "signup" && name.trim().length < 2) return "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Please enter a valid email address.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (mode === "signup") {
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
        return "Password must contain at least one letter and one number.";
      if (password !== confirm) return "Passwords do not match.";
    }
    return null;
  };

  const submit = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        await signin(email, password);
        toast({ title: "Signed in", description: "Welcome to CivicLens." });
      } else {
        await signup(name, email, password);
        toast({ title: "Account created", description: "Welcome to CivicLens. You are now signed in." });
      }
      resetForm();
      setName("");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !busy) void submit();
  };

  return (
    <Dialog open={authOpen} onOpenChange={(o) => (o ? null : closeAuth())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanEye className="h-5 w-5 text-primary" /> {mode === "signin" ? "Sign in to CivicLens" : "Create your CivicLens account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "signin"
              ? "Sign in to report issues, track action and receive updates."
              : "Free citizen account — report civic issues and follow them to resolution."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={switchMode}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cl-email">Email</Label>
              <Input
                id="cl-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={120}
                onKeyDown={onKeyDown}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-password">Password</Label>
              <div className="relative">
                <Input
                  id="cl-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  maxLength={72}
                  onKeyDown={onKeyDown}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Authority officials: sign in with your official account (provisioned by your municipality).
            </p>
          </TabsContent>

          <TabsContent value="signup" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cl-name">Full name</Label>
              <Input
                id="cl-name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                maxLength={60}
                onKeyDown={onKeyDown}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-su-email">Email</Label>
              <Input
                id="cl-su-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={120}
                onKeyDown={onKeyDown}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-su-password">Password</Label>
              <div className="relative">
                <Input
                  id="cl-su-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters, 1 letter + 1 number"
                  maxLength={72}
                  onKeyDown={onKeyDown}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cl-confirm">Confirm password</Label>
              <Input
                id="cl-confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                maxLength={72}
                onKeyDown={onKeyDown}
              />
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button onClick={() => void submit()} disabled={busy} className="w-full">
          {busy
            ? mode === "signin" ? "Signing in…" : "Creating account…"
            : mode === "signin" ? "Sign In" : "Create Account"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
