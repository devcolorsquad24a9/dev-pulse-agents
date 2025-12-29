"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function NewsletterForm() {
  const [state, setState] = React.useState<FormState>({ status: "idle" });
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [jobRole, setJobRole] = React.useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "submitting" });

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          jobRole
        })
      });

      const data: unknown = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          typeof (data as any)?.message === "string"
            ? (data as any).message
            : "Something went wrong. Please try again.";
        setState({ status: "error", message });
        return;
      }

      const message =
        typeof (data as any)?.message === "string"
          ? (data as any).message
          : "Received — you’ll get our newsletter soon.";
      setState({ status: "success", message });
    } catch {
      setState({
        status: "error",
        message: "Network error. Please try again."
      });
    }
  }

  const isSubmitting = state.status === "submitting";
  const isSuccess = state.status === "success";

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Get the newsletter</CardTitle>
        <CardDescription>
          Drop your email and we’ll send you the next issue (monthly to start).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSuccess ? (
          <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-4 text-sm">
            {state.message}
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input
                  id="name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobRole">Job role (optional)</Label>
                <Input
                  id="jobRole"
                  name="jobRole"
                  autoComplete="organization-title"
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  placeholder="Backend engineer"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {state.status === "error" ? (
              <p className="text-sm text-red-600">{state.message}</p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                By subscribing, you agree to receive the Dev Pulse newsletter. Unsubscribe
                anytime.
              </p>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting…" : "Subscribe"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}


