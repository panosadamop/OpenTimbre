import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
 ArrowRight,
 AudioWaveform,
 Eye,
 EyeOff,
 Github,
 HardDrive,
 Languages,
 Loader2,
 Lock,
 Mail,
 ShieldCheck,
 Sparkles,
 User as UserIcon,
} from "lucide-react";

// Bar heights (0–1) for the decorative animated waveform on the login screen.
const WAVE = Array.from({ length: 48 }, (_, i) =>
    0.18 + 0.82 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11))
);

export type User = {
 id: number;
 email: string;
 name: string;
 provider: string;
 role?: string;
 permissions?: string[];
};

type AuthState = { user: User | null; refresh: () => Promise<void>; can: (permission: string) => boolean };
const AuthContext = createContext<AuthState>({ user: null, refresh: async () => {}, can: () => false });
/** Signed-in user, a refresh() to reload it, and can(permission) for UI gating. The backend enforces the same permissions. */
export const useAuth = () => useContext(AuthContext);

type ValidationError = {
 loc?: Array<string | number>;
 msg?: string;
 type?: string;
};

type ApiErrorResponse = {
 detail?: string | ValidationError[] | Record<string, unknown>;
 message?: string;
};

function getErrorMessage(
    error: ApiErrorResponse,
    status: number
): string {
 const detail = error?.detail;

 // Standard FastAPI error
 if (typeof detail === "string") {
  return detail;
 }

 // FastAPI validation errors (HTTP 422)
 if (Array.isArray(detail)) {
  return detail
      .map((item) => {
       const field = Array.isArray(item.loc)
           ? item.loc.join(".")
           : "Request";

       return `${field}: ${item.msg || "Validation error"}`;
      })
      .join("; ");
 }

 // Structured backend error
 if (detail && typeof detail === "object") {
  if (
      "message" in detail &&
      typeof detail.message === "string"
  ) {
   return detail.message;
  }

  return JSON.stringify(detail);
 }

 // Alternative error message
 if (typeof error?.message === "string") {
  return error.message;
 }

 // HTTP fallback
 switch (status) {
  case 400:
   return "Invalid request.";
  case 401:
   return "Invalid email or password.";
  case 403:
   return "Access denied.";
  case 404:
   return "Authentication endpoint not found.";
  case 409:
   return "This account already exists.";
  case 422:
   return "Invalid form data.";
  case 500:
   return "Internal server error. Check the backend logs.";
  case 502:
  case 503:
   return "Authentication service is unavailable.";
  default:
   return `HTTP ${status}`;
 }
}

async function api(
    path: string,
    body?: Record<string, unknown>
): Promise<any> {
 let response: Response;

 try {
  response = await fetch(`/api/auth/${path}`, {
   method: body !== undefined ? "POST" : "GET",
   headers: {
    "Content-Type": "application/json",
   },
   credentials: "same-origin",
   body: body !== undefined ? JSON.stringify(body) : undefined,
  });
 } catch {
  throw new Error(
      "Cannot connect to the authentication server. " +
      "Make sure the backend is running."
  );
 }

 if (!response.ok) {
  const error: ApiErrorResponse = await response
      .json()
      .catch(() => ({}));

  throw new Error(getErrorMessage(error, response.status));
 }

 return response.json();
}

function errorToString(error: unknown): string {
 if (error instanceof Error) {
  return error.message;
 }

 if (typeof error === "string") {
  return error;
 }

 try {
  return JSON.stringify(error);
 } catch {
  return "An unexpected error occurred.";
 }
}

export default function AuthGate({
                                  children,
                                 }: {
 children: React.ReactNode;
}) {
 const [user, setUser] = useState<User | null>(null);

 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);

 const [register, setRegister] = useState(false);

 const [email, setEmail] = useState("");
 const [name, setName] = useState("");
 const [password, setPassword] = useState("");

 const [error, setError] = useState("");
 const [showPassword, setShowPassword] = useState(false);

 const [lang, setLang] = useState<"en" | "el">("en");

 const el = lang === "el";

 const refresh = useCallback(async () => {
  try {
   setUser(await api("me"));
  } catch {
   setUser(null); // session revoked, account disabled or deleted
  }
 }, []);
 const can = useCallback((permission: string) => !!user?.permissions?.includes(permission), [user]);

 // --------------------------------------------------
 // Check existing session
 // --------------------------------------------------

 useEffect(() => {
  let active = true;

  api("me")
      .then((currentUser: User) => {
       if (active) {
        setUser(currentUser);
       }
      })
      .catch(() => {
       // No active session.
      })
      .finally(() => {
       if (active) {
        setLoading(false);
       }
      });

  return () => {
   active = false;
  };
 }, []);

 // --------------------------------------------------
 // Google authentication
 // --------------------------------------------------

 useEffect(() => {
  if (user || loading) {
   return;
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
   return;
  }

  let active = true;

  const initializeGoogle = () => {
   if (!active) return;

   const google = (window as any).google;
   const container = document.getElementById("google-login");

   if (!google || !container) {
    return;
   }

   google.accounts.id.initialize({
    client_id: clientId,

    callback: async (result: { credential: string }) => {
     try {
      setError("");

      await api("google", {
       credential: result.credential,
      });

      if (active) {
       setUser(await api("me"));
      }
     } catch (err) {
      if (active) {
       setError(errorToString(err));
      }
     }
    },
   });

   google.accounts.id.renderButton(container, {
    theme: "filled_black",
    size: "large",
    shape: "pill",
    width: Math.min(360, container.clientWidth || 360),
   });
  };

  const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
  );

  if ((window as any).google) {
   initializeGoogle();
   return () => {
    active = false;
   };
  }

  const script = document.createElement("script");

  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.onload = initializeGoogle;

  if (!existingScript) {
   document.head.appendChild(script);
  } else {
   existingScript.addEventListener("load", initializeGoogle);
  }

  return () => {
   active = false;

   if (existingScript) {
    existingScript.removeEventListener(
        "load",
        initializeGoogle
    );
   } else {
    script.remove();
   }
  };
 }, [user, loading]);

 // --------------------------------------------------
 // Login / Registration
 // --------------------------------------------------

 const handleSubmit = async (
     event: React.FormEvent<HTMLFormElement>
 ) => {
  event.preventDefault();

  if (submitting) return;

  setError("");
  setSubmitting(true);

  try {
   const payload = register
       ? {
        email: email.trim(),
        name: name.trim(),
        password,
       }
       : {
        email: email.trim(),
        password,
       };

   await api(register ? "register" : "login", payload);

   setUser(await api("me"));
   setPassword("");
  } catch (err) {
   setError(errorToString(err));
  } finally {
   setSubmitting(false);
  }
 };

 // --------------------------------------------------
 // Logout
 // --------------------------------------------------

 const handleLogout = async () => {
  setError("");

  try {
   await api("logout", {});

   setUser(null);
   setPassword("");
  } catch (err) {
   setError(errorToString(err));
  }
 };

 // --------------------------------------------------
 // Loading screen
 // --------------------------------------------------

 if (loading) {
  return (
      <div className="auth-loading" role="status">
       <span className="auth-mark auth-mark-pulse">◉</span>
       <div className="auth-mini-wave" aria-hidden="true">
        {WAVE.slice(0, 12).map((h, i) => (
            <span key={i} style={{ "--h": h, "--i": i } as React.CSSProperties} />
        ))}
       </div>
       <p>Loading OpenTimbre…</p>
      </div>
  );
 }

 // --------------------------------------------------
 // Authenticated application
 // --------------------------------------------------

 if (user) {
  return (
      <>
       <div className="auth-account">
          <span>
            {user.name || user.email} · {user.email}
            {user.role && <em className="auth-role">{user.role}</em>}
          </span>

        <button type="button" onClick={handleLogout}>
         {el ? "Αποσύνδεση" : "Sign out"}
        </button>

        {error && (
            <span role="alert" className="auth-error">
              {error}
            </span>
        )}
       </div>

       <AuthContext.Provider value={{ user, refresh, can }}>
        {children}
       </AuthContext.Provider>
      </>
  );
 }

 // --------------------------------------------------
 // Login / Registration screen
 // --------------------------------------------------

 const switchMode = (toRegister: boolean) => {
  if (toRegister === register) return;
  setRegister(toRegister);
  setError("");
  setPassword("");
  setShowPassword(false);
 };

 const features = [
  {
   icon: <AudioWaveform size={18} />,
   title: el ? "Μικροτονική απόδοση" : "Microtonal playback",
   text: el
       ? "Παίξτε ούτι, σάζι και τα δικά σας δείγματα με ακρίβεια cents."
       : "Play oud, saz and your own samples with cent-level precision.",
  },
  {
   icon: <Sparkles size={18} />,
   title: el ? "Νευρωνική σύνθεση" : "Neural synthesis",
   text: el
       ? "Εκπαιδεύστε μοντέλα στις δικές σας ηχογραφήσεις."
       : "Train models on your own recordings.",
  },
  {
   icon: <HardDrive size={18} />,
   title: el ? "Τοπικά πρώτα" : "Local-first",
   text: el
       ? "Τα δείγματά σας παραμένουν δικά σας. Χωρίς telemetry."
       : "Your samples stay yours. No telemetry.",
  },
 ];

 return (
     <div className="auth-wrap">
      <div className="auth-glow auth-glow-a" aria-hidden="true" />
      <div className="auth-glow auth-glow-b" aria-hidden="true" />

      <button
          type="button"
          className="auth-lang"
          onClick={() => setLang(el ? "en" : "el")}
      >
       <Languages size={15} />
       {el ? "English" : "Ελληνικά"}
      </button>

      <div className="auth-shell">
       {/* Showcase panel (decorative) */}

       <section className="auth-showcase" aria-hidden="true">
        <div className="auth-brand">
         <span className="auth-mark">◉</span>
         <div>
          <strong>OpenTimbre</strong>
          <small>INSTRUMENT STUDIO</small>
         </div>
        </div>

        <div className="auth-pitch">
         <div className="eyebrow">
          {el ? "ΣΤΑΘΜΟΣ ΕΡΓΑΣΙΑΣ ΗΧΟΥ" : "SAMPLE-BASED MUSIC WORKSTATION"}
         </div>
         <h1>
          {el ? (
              <>Κάθε νότα, <span>κάθε απόχρωση.</span></>
          ) : (
              <>Every note, <span>every shade of tone.</span></>
          )}
         </h1>
        </div>

        <div className="auth-wave">
         {WAVE.map((h, i) => (
             <span key={i} style={{ "--h": h, "--i": i } as React.CSSProperties} />
         ))}
        </div>

        <ul className="auth-features">
         {features.map((f) => (
             <li key={f.title}>
              <span className="auth-feature-icon">{f.icon}</span>
              <div>
               <b>{f.title}</b>
               <p>{f.text}</p>
              </div>
             </li>
         ))}
        </ul>
       </section>

       {/* Form card */}

       <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-card-brand">
         <span className="auth-mark">◉</span>
         <strong>OpenTimbre</strong>
        </div>

        <div className="auth-head">
         <h2>
          {register
              ? el ? "Δημιουργία λογαριασμού" : "Create your account"
              : el ? "Καλώς ήρθατε ξανά" : "Welcome back"}
         </h2>
         <p>
          {register
              ? el
                  ? "Ξεκινήστε να χαρτογραφείτε και να παίζετε τα όργανά σας."
                  : "Start mapping and playing your own instruments."
              : el
                  ? "Συνδεθείτε στο Instrument Studio."
                  : "Sign in to Instrument Studio."}
         </p>
        </div>

        <div className="auth-tabs" role="tablist">
         <button
             type="button"
             role="tab"
             aria-selected={!register}
             className={!register ? "active" : ""}
             onClick={() => switchMode(false)}
         >
          {el ? "Σύνδεση" : "Sign in"}
         </button>
         <button
             type="button"
             role="tab"
             aria-selected={register}
             className={register ? "active" : ""}
             onClick={() => switchMode(true)}
         >
          {el ? "Εγγραφή" : "Register"}
         </button>
         <span className={"auth-tab-pill" + (register ? " right" : "")} />
        </div>

        {register && (
            <label className="auth-field">
             <span>{el ? "Όνομα" : "Name"}</span>
             <div className="auth-input">
              <UserIcon size={17} />
              <input
                  type="text"
                  required
                  maxLength={100}
                  autoComplete="name"
                  placeholder={el ? "Το όνομά σας" : "Your name"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
              />
             </div>
            </label>
        )}

        <label className="auth-field">
         <span>Email</span>
         <div className="auth-input">
          <Mail size={17} />
          <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
          />
         </div>
        </label>

        <label className="auth-field">
         <span>{el ? "Κωδικός πρόσβασης" : "Password"}</span>
         <div className="auth-input">
          <Lock size={17} />
          <input
              type={showPassword ? "text" : "password"}
              required
              minLength={register ? 12 : 1}
              autoComplete={register ? "new-password" : "current-password"}
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
          />
          <button
              type="button"
              className="auth-eye"
              aria-label={
               showPassword
                   ? el ? "Απόκρυψη κωδικού" : "Hide password"
                   : el ? "Εμφάνιση κωδικού" : "Show password"
              }
              onClick={() => setShowPassword((v) => !v)}
          >
           {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
         </div>
        </label>

        {register && (
            <div className="auth-strength" aria-live="polite">
             <div className="auth-strength-bar">
              <span
                  className={password.length >= 12 ? "ok" : ""}
                  style={{ width: `${Math.min(100, (password.length / 12) * 100)}%` }}
              />
             </div>
             <small>
              {password.length >= 12
                  ? el ? "Ο κωδικός έχει αρκετό μήκος." : "Password length looks good."
                  : el
                      ? `Τουλάχιστον 12 χαρακτήρες (${password.length}/12).`
                      : `At least 12 characters (${password.length}/12).`}
             </small>
            </div>
        )}

        {error && (
            <p role="alert" className="auth-error" style={{ whiteSpace: "pre-wrap" }}>
             {error}
            </p>
        )}

        <button className="auth-submit" type="submit" disabled={submitting}>
         {submitting ? (
             <>
              <Loader2 size={18} className="auth-spin" />
              {el ? "Παρακαλώ περιμένετε..." : "Please wait..."}
             </>
         ) : (
             <>
              {register
                  ? el ? "Δημιουργία λογαριασμού" : "Create account"
                  : el ? "Σύνδεση" : "Sign in"}
              <ArrowRight size={18} />
             </>
         )}
        </button>

        <div className="auth-divider">
         <span>{el ? "ή συνεχίστε με" : "or continue with"}</span>
        </div>

        <div id="google-login" />

        <a className="auth-github" href="/api/auth/github/start">
         <Github size={18} />
         {el ? "Σύνδεση με GitHub" : "Continue with GitHub"}
        </a>

        <small className="auth-note">
         <ShieldCheck size={14} />
         {el
             ? "Η σύνδεση μέσω Google και GitHub απαιτεί ρυθμίσεις OAuth."
             : "Google and GitHub login require OAuth configuration."}
        </small>
       </form>
      </div>
     </div>
 );
}
