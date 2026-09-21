import { createContext, type ReactNode, use, useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";

interface PromptContext {
  /** Opens the sign-in modal with a reason, e.g. "vote on this request". */
  prompt: (reason: string) => void;
}

const SignInPromptContext = createContext<PromptContext | null>(null);

/**
 * Anonymous visitors who try to vote, comment or post get this instead of a redirect — losing
 * the page they were reading is a good way to lose the vote as well.
 */
export function SignInPromptProvider({ children }: { children: ReactNode }) {
  const [reason, setReason] = useState<string | null>(null);
  const location = useLocation();

  const prompt = useCallback((next: string) => setReason(next), []);
  const value = useMemo(() => ({ prompt }), [prompt]);

  return (
    <SignInPromptContext value={value}>
      {children}
      <Dialog onOpenChange={(open) => !open && setReason(null)} open={reason !== null}>
        <DialogPopup className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign in to {reason}</DialogTitle>
            <DialogDescription>
              Accounts keep voting honest: one vote per person, and you can follow what happens to your requests.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-col sm:items-stretch">
            <Button render={<Link state={{ from: location.pathname }} to="/login" />}>Sign in</Button>
            <Button render={<Link state={{ from: location.pathname }} to="/signup" />} variant="outline">
              Create an account
            </Button>
            <DialogClose render={<Button variant="ghost" />}>Not now</DialogClose>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </SignInPromptContext>
  );
}

export function useSignInPrompt(): PromptContext {
  const ctx = use(SignInPromptContext);
  if (!ctx) throw new Error("useSignInPrompt must be used inside <SignInPromptProvider>");
  return ctx;
}
