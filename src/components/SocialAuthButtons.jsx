import React from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import GoogleIcon from "@/components/GoogleIcon";
import { Building2 } from "lucide-react";

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

function AppleIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.46 15.6 3.08 8.27 7.34 7.64c1.34-.2 2.26.25 3.06.53.56.2 1.05.18 1.64-.02.79-.27 1.69-.66 2.93-.55 1.1.09 2.18.55 2.82 1.35-2.55 1.55-2.12 5.04.26 6.05-.47 1.23-1.07 2.43-2 3.28zM12.03 7.25c-.2-1.3.5-2.4 1.16-3.05.87.78 1.6 2.05 1.43 3.3-1.3.1-2.3-.55-2.59-.25z" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" fill="#1877F2" />
    </svg>
  );
}

const providers = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "microsoft", label: "Microsoft", Icon: MicrosoftIcon },
  { id: "apple", label: "Apple", Icon: AppleIcon },
  { id: "facebook", label: "Facebook", Icon: FacebookIcon },
];

export default function SocialAuthButtons({ fromUrl = "/", label = "Continue with" }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Enterprise Single Sign-On
        </span>
      </div>
      <div className="space-y-3">
        {providers.map((p) => {
          const Icon = p.Icon;
          return (
            <Button
              key={p.id}
              type="button"
              variant="outline"
              className="w-full h-11 text-sm font-medium justify-center"
              onClick={() => base44.auth.loginWithProvider(p.id, fromUrl)}
            >
              <Icon className="w-5 h-5 mr-2.5" />
              {label} {p.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}