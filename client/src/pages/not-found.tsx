import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button-custom";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md mx-auto shadow-xl border-none">
        <CardContent className="pt-6 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-display text-foreground">Page Not Found</h1>
            <p className="text-muted-foreground">
              We couldn't find the location you were looking for.
            </p>
          </div>

          <Link href="/">
            <Button className="w-full">Return to Safety Map</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
