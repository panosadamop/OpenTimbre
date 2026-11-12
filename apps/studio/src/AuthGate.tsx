import React, { useEffect, useState } from "react";

type User = {
 id: number;
 email: string;
 name: string;
 provider: string;
};

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

 const [lang, setLang] = useState<"en" | "el">("en");

 const el = lang === "el";

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

      const loggedInUser = await api("google", {
       credential: result.credential,
      });

      if (active) {
       setUser(loggedInUser);
      }
     } catch (err) {
      if (active) {
       setError(errorToString(err));
      }
     }
    },
   });

   google.accounts.id.renderButton(container, {
    theme: "outline",
    size: "large",
    width: 280,
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

   const loggedInUser: User = await api(
       register ? "register" : "login",
       payload
   );

   setUser(loggedInUser);
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
      <div className="auth-wrap">
       <div className="auth-card">
        <h1>◉ OpenTimbre</h1>
        <p>Loading OpenTimbre…</p>
       </div>
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

       {children}
      </>
  );
 }

 // --------------------------------------------------
 // Login / Registration screen
 // --------------------------------------------------

 return (
     <div className="auth-wrap">
      <form className="auth-card" onSubmit={handleSubmit}>
       <h1>◉ OpenTimbre</h1>

       <p>
        {register
            ? el
                ? "Δημιουργία λογαριασμού"
                : "Create your OpenTimbre account"
            : el
                ? "Σύνδεση στο Instrument Studio"
                : "Sign in to Instrument Studio"}
       </p>

       {/* Language switch */}

       <button
           type="button"
           onClick={() => setLang(el ? "en" : "el")}
       >
        {el ? "English" : "Ελληνικά"}
       </button>

       {/* Registration name */}

       {register && (
           <label>
            {el ? "Όνομα" : "Name"}

            <input
                type="text"
                required
                maxLength={100}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
           </label>
       )}

       {/* Email */}

       <label>
        Email

        <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
        />
       </label>

       {/* Password */}

       <label>
        {el ? "Κωδικός πρόσβασης" : "Password"}

        <input
            type="password"
            required
            minLength={register ? 12 : 1}
            autoComplete={
             register ? "new-password" : "current-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
        />
       </label>

       {/* Password requirements */}

       {register && (
           <small>
            {el
                ? "Ο κωδικός πρέπει να περιλαμβάνει τουλάχιστον 12 χαρακτήρες."
                : "Password must contain at least 12 characters."}
           </small>
       )}

       {/* Error message */}

       {error && (
           <p
               role="alert"
               className="auth-error"
               style={{ whiteSpace: "pre-wrap" }}
           >
            {error}
           </p>
       )}

       {/* Submit */}

       <button
           className="primary"
           type="submit"
           disabled={submitting}
       >
        {submitting
            ? el
                ? "Παρακαλώ περιμένετε..."
                : "Please wait..."
            : register
                ? el
                    ? "Εγγραφή"
                    : "Create account"
                : el
                    ? "Σύνδεση"
                    : "Sign in"}
       </button>

       {/* Switch login / registration */}

       <button
           type="button"
           onClick={() => {
            setRegister(!register);
            setError("");
            setPassword("");
           }}
       >
        {register
            ? el
                ? "Έχω ήδη λογαριασμό"
                : "Already have an account"
            : el
                ? "Δημιουργία λογαριασμού"
                : "Register"}
       </button>

       <hr />

       {/* Google login */}

       <div id="google-login" />

       {/* GitHub login */}

       <a
           className="auth-github"
           href="/api/auth/github/start"
       >
        {el
            ? "Σύνδεση με GitHub"
            : "Continue with GitHub"}
       </a>

       <small>
        {el
            ? "Η σύνδεση μέσω Google και GitHub απαιτεί ρυθμίσεις OAuth."
            : "Google and GitHub login require OAuth configuration."}
       </small>
      </form>
     </div>
 );
}
