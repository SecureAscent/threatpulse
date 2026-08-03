import React from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import GoogleIcon from "@/components/GoogleIcon";

function MicrosoftIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3h8v8H3z" fill="#F25022" />
      <path d="M13 3h8v8h-8z" fill="#7FBA00" />
      <path d="M3 13h8v8H3z" fill="#00A4EF" />
      <path d="M13 13h8v8h-8z" fill="#FFB900" />
    </svg>
  );
}

function FacebookIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" fill="#1877F2" />
    </svg>
  );
}

function AppleIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.36 1.43c.04 1.1-.38 2.18-1.02 2.96-.66.8-1.72 1.42-2.76 1.34-.06-1.08.42-2.18 1.02-2.9.66-.78 1.78-1.36 2.76-1.4zM20.5 17.36c-.56 1.3-.83 1.88-1.55 3.04-1 1.6-2.4 3.6-4.15 3.62-1.55.01-1.95-1.02-4.06-1.01-2.1.01-2.54 1.03-4.09 1.01-1.74-.03-3.07-1.83-4.07-3.43-2.8-4.48-3.1-9.74-1.37-12.55 1.23-2 3.17-3.18 4.99-3.18 1.85 0 3.02 1.02 4.55 1.02 1.48 0 2.39-1.02 4.54-1.02 1.62 0 3.34.88 4.57 2.4-4.02 2.2-3.37 7.94.68 9.1z" />
    </svg>
  );
}

const providers = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "microsoft", label: "Microsoft", Icon: MicrosoftIcon },
  { id: "facebook", label: "Facebook", Icon: FacebookIcon },
  { id: "apple", label: "Apple", Icon: AppleIcon },
];

export default function SocialAuthButtons({ fromUrl = "/", label = "Continue with" }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {providers.map((p) => {
        const Icon = p.Icon;
        return (
          <Button
            key={p.id}
            type="button"
            variant="outline"
            className="h-11 text-sm font-medium"
            onClick={() => base44.auth.loginWithProvider(p.id, fromUrl)}
          >
            <Icon className="w-5 h-5 mr-2" />
            {label} {p.label}
          </Button>
        );
      })}
    </div>
  );
}