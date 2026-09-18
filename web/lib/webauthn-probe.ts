/**
 * Wraps navigator.credentials.create/get once per page so the spike can count how many
 * passkey prompts each action produced and which relying-party ID each one used.
 * Instrumentation only. Not for the real app.
 */
export type ProbeEvent = {
  at: number;
  op: "create" | "get";
  rpId: string | undefined;
  prf: boolean;
  outcome: "ok" | "error";
  detail?: string;
};

type Listener = (e: ProbeEvent) => void;

const listeners = new Set<Listener>();
let installed = false;

export function onWebAuthn(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(e: ProbeEvent) {
  for (const l of listeners) l(e);
}

export function installWebAuthnProbe(): void {
  if (installed || typeof navigator === "undefined" || !navigator.credentials) return;
  installed = true;
  const creds = navigator.credentials;
  const origCreate = creds.create.bind(creds);
  const origGet = creds.get.bind(creds);

  creds.create = async (options?: CredentialCreationOptions) => {
    const pk = options?.publicKey;
    const base = {
      at: Date.now(),
      op: "create" as const,
      rpId: pk?.rp?.id ?? "(origin default)",
      prf: Boolean((pk?.extensions as { prf?: unknown } | undefined)?.prf),
    };
    try {
      const r = await origCreate(options);
      emit({ ...base, outcome: "ok" });
      return r;
    } catch (err) {
      emit({ ...base, outcome: "error", detail: String(err) });
      throw err;
    }
  };

  creds.get = async (options?: CredentialRequestOptions) => {
    const pk = options?.publicKey;
    const base = {
      at: Date.now(),
      op: "get" as const,
      rpId: pk?.rpId ?? "(origin default)",
      prf: Boolean((pk?.extensions as { prf?: unknown } | undefined)?.prf),
    };
    try {
      const r = await origGet(options);
      emit({ ...base, outcome: "ok" });
      return r;
    } catch (err) {
      emit({ ...base, outcome: "error", detail: String(err) });
      throw err;
    }
  };
}
