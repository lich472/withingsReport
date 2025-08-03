
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);


  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const trimmedEmail = email.trim();

    try {
      await signInWithEmailAndPassword(auth, trimmedEmail, password);
      router.push('/');
    } catch (err: any) {
      let friendlyMessage = "An unexpected error occurred. Please try again.";
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        friendlyMessage = "Invalid email or password. Please check your credentials and try again.";
      }
      setError(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address to reset your password.");
      return;
    }
    setError(null);
    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      toast({
        title: "Password Reset Email Sent",
        description: `An email has been sent to ${trimmedEmail} with instructions to reset your password.`,
      });
    } catch (err: any) {
       let friendlyMessage = "An unexpected error occurred. Please try again.";
       if (err.code === 'auth/user-not-found') {
           friendlyMessage = "No user found with this email address.";
       } else if (err.code === 'auth/invalid-email') {
           friendlyMessage = "Please enter a valid email address.";
       }
       setError(friendlyMessage);
    } finally {
        setIsResetting(false);
    }
  };
  
  if (loading || user) {
      return (
          <div className="flex min-h-screen w-full items-center justify-center bg-background">
              <Loader2 className="h-10 w-10 animate-spin" />
          </div>
      )
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4 font-body">
      <Card className="w-full max-w-sm shadow-xl rounded-2xl">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl">Sign In</CardTitle>
          <CardDescription>Enter your credentials to access the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs"
                        onClick={handleForgotPassword}
                        disabled={isResetting}
                    >
                        {isResetting ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : null}
                        Forgot password?
                    </Button>
                </div>
                <div className="relative">
                    <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Login Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
