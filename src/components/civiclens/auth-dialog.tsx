"use client";

// CivicLens — demo sign-in (Citizen / Authority). Deliberately lightweight:
// the auth layer is structured so real authentication can replace it later.

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
import { User, ShieldCheck, ScanEye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function AuthDialog() {
  const { authOpen, closeAuth, login } = useCivicLens();
  const { toast } = useToast();
  const [role, setRole] = useState<"CITIZEN" | "ADMIN">("CITIZEN");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const pickRole = (r: "CITIZEN" | "ADMIN") => {
    setRole(r);
    setName(r === "ADMIN" ? "Neha Kulkarni" : "Aarav Sharma");
  };

  const submit = async () => {
    setBusy(true);
    try {
      await login(role, name.trim() || (role === "ADMIN" ? "Municipal Admin" : "Anonymous Citizen"));
      toast({ title: `Signed in as ${role === "ADMIN" ? "Authority" : "Citizen"}`, description: "Welcome to CivicLens." });
    } catch (err) {
      toast({
        title: "Sign in failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={authOpen} onOpenChange={(o) => (o ? null : closeAuth())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanEye className="h-5 w-5 text-primary" /> Sign in to CivicLens
          </DialogTitle>
          <DialogDescription>
            Choose a demo role. Full role-based authentication can be plugged in later —
            this keeps the prototype frictionless.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => pickRole("CITIZEN")}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition-all hover:border-primary/60",
              role === "CITIZEN" ? "border-primary bg-primary/5" : "border-border"
            )}
            aria-pressed={role === "CITIZEN"}
          >
            <User className="mb-2 h-6 w-6 text-primary" />
            <div className="font-semibold">Citizen</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Report issues, track action, get updates
            </div>
          </button>
          <button
            type="button"
            onClick={() => pickRole("ADMIN")}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition-all hover:border-primary/60",
              role === "ADMIN" ? "border-primary bg-primary/5" : "border-border"
            )}
            aria-pressed={role === "ADMIN"}
          >
            <ShieldCheck className="mb-2 h-6 w-6 text-primary" />
            <div className="font-semibold">Authority / Admin</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Verify, assign, resolve, analytics
            </div>
          </button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cl-name">Your name</Label>
          <Input
            id="cl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={role === "ADMIN" ? "e.g. Neha Kulkarni" : "e.g. Aarav Sharma"}
            maxLength={60}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) void submit();
            }}
          />
          <p className="text-xs text-muted-foreground">
            Demo accounts — suggested names are seeded demo users. Citizen identity is never
            shown publicly.
          </p>
        </div>

        <Button onClick={() => void submit()} disabled={busy} className="w-full">
          {busy ? "Signing in…" : `Continue as ${role === "ADMIN" ? "Authority" : "Citizen"}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
